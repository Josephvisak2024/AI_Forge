import asyncio
import base64
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.thread import Thread
from app.models.user import User
from app.schemas.chat import GenerateImageRequest, GenerateImageResponse
from app.ai.llm import openai_client
from app.services.thread_service import save_message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["image-generation"])


def _candidate_image_models() -> list[str]:
    configured = (settings.IMAGE_GEN_MODEL or "").strip()
    default_models = [
        configured,
        # Keep an always-allowed image fallback for this LiteLLM key.
        "gemini/imagen-4.0-fast-generate-001",
    ]

    normalized: list[str] = []
    for model in default_models:
        if not model:
            continue
        candidate = model.strip()
        if not candidate.startswith("gemini/"):
            candidate = f"gemini/{candidate}"
        if candidate not in normalized:
            normalized.append(candidate)
    return normalized


def _extract_image_from_response(response) -> tuple[bytes, str]:
    image_data = getattr(response, "data", None) or []
    if not image_data:
        raise HTTPException(status_code=502, detail="No image data returned by LiteLLM image model")

    first = image_data[0]
    b64 = getattr(first, "b64_json", None)
    if not b64:
        raise HTTPException(status_code=502, detail="LiteLLM image response did not include base64 data")

    image_bytes = base64.b64decode(b64)
    # LiteLLM/OpenAI images API typically returns PNG data.
    return image_bytes, "png"


def _save_generated_image(image_bytes: bytes, image_format: str) -> str:
    safe_format = (image_format or "png").lower()
    if safe_format == "jpeg":
        ext = "jpg"
    else:
        ext = safe_format

    upload_dir = Path(settings.UPLOAD_DIR) / "generated_images"
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = upload_dir / filename
    file_path.write_bytes(image_bytes)
    return f"uploads/generated_images/{filename}"


def _generate_image_sync(prompt: str):
    tried_models: list[str] = []
    last_error: Exception | None = None

    for model_name in _candidate_image_models():
        tried_models.append(model_name)
        try:
            return openai_client.images.generate(
                model=model_name,
                prompt=prompt,
                size="1024x1024",
                response_format="b64_json",
            )
        except Exception as exc:
            last_error = exc
            message = str(exc).lower()
            if (
                "key_model_access_denied" in message
                or "access_denied" in message
                or "not allowed to access model" in message
                or "401" in message
                or
                "not_found" in message
                or "not found" in message
                or "404" in message
                or "not supported" in message
                or "resource_exhausted" in message
                or "quota" in message
                or "429" in message
            ):
                logger.warning("Image model %s unavailable, trying next model", model_name)
                continue
            raise

    raise HTTPException(
        status_code=502,
        detail=(
            f"Image generation failed for all candidate models: {', '.join(tried_models)}. "
            f"Last error: {last_error}"
        ),
    )


@router.post("/generate-image", response_model=GenerateImageResponse)
async def generate_image(
    body: GenerateImageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GenerateImageResponse:
    """Generate image via LiteLLM proxy using Gemini 2.5 image models."""
    thread = await db.get(Thread, body.thread_id)
    if not thread or thread.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Thread not found")

    prompt = body.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=422, detail="Prompt is required")

    if not settings.LITELLM_API_KEY:
        raise HTTPException(status_code=501, detail="LITELLM_API_KEY is not configured in environment")

    try:
        response = await asyncio.wait_for(
            asyncio.to_thread(_generate_image_sync, prompt),
            timeout=35,
        )
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Image generation timed out. Please try again.") from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Image generation failed: {str(exc)}") from exc

    image_bytes, image_format = _extract_image_from_response(response)
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    saved_path = await asyncio.to_thread(_save_generated_image, image_bytes, image_format)

    await save_message(db, body.thread_id, "user", prompt)
    await save_message(
        db,
        body.thread_id,
        "assistant",
        f"Generated image for prompt: {prompt}",
        attachment_url=saved_path,
        attachment_type="generated_image",
    )

    return GenerateImageResponse(
        image_base64=image_base64,
        image_format=image_format,
        prompt=prompt,
        thread_id=body.thread_id,
    )
