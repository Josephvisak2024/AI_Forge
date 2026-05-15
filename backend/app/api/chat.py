import json
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.attachments import ALLOWED_EXTENSIONS, handle_attachment, handle_formula
from app.ai.memory import SYSTEM_PROMPT, WINDOW_K, build_message_context
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.services.chat_service import stream_chat_response
from app.services.thread_service import (
    get_recent_messages,
    save_message,
    update_thread_title,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


async def _generate_and_save_title(thread_id: str, user_message: str, user_email: str, db: AsyncSession) -> None:
    """Generate a thread title from the first message and persist it (runs in background)."""
    prompt = (
        f'Generate a concise chat title (maximum 6 words, no quotes, no punctuation at the end) '
        f'that summarises this user message: "{user_message}"'
    )
    lc_messages = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=prompt)]
    tokens: list[str] = []
    async for token in stream_chat_response(lc_messages, user_email):
        tokens.append(token)
    title = "".join(tokens).strip().strip('"').strip("'").strip()
    await update_thread_title(db, thread_id, title[:80] if title else user_message[:60])


def _history_to_lc(history):
    """Convert DB message rows into windowed LangChain message list (no system, no new msg)."""
    pairs = []
    i = 0
    while i < len(history) - 1:
        h, a = history[i], history[i + 1]
        if h.role in ("user", "human") and a.role in ("assistant", "ai"):
            pairs.append((h.content, a.content))
            i += 2
        else:
            i += 1
    msgs = []
    for hc, ac in pairs[-WINDOW_K:]:
        msgs.append(HumanMessage(content=hc))
        msgs.append(AIMessage(content=ac))
    return msgs


# ── Existing JSON endpoint (Projects 1-4, unchanged) ─────────────────────────

@router.post("")
async def chat(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    history = await get_recent_messages(db, request.thread_id, limit=10)
    lc_messages = build_message_context(history, request.user_message)
    await save_message(db, request.thread_id, "user", request.user_message)

    if len(history) == 0:
        background_tasks.add_task(
            _generate_and_save_title,
            request.thread_id,
            request.user_message,
            current_user.email,
            db,
        )

    async def generate():
        tokens: list[str] = []
        async for token in stream_chat_response(lc_messages, current_user.email):
            tokens.append(token)
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"
        await save_message(db, request.thread_id, "assistant", "".join(tokens))

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── Multipart endpoint (Project 5 — attachments) ─────────────────────────────

@router.post("/attachment")
async def chat_with_attachment(
    background_tasks: BackgroundTasks,
    thread_id: str = Form(...),
    user_message: str = Form(""),
    formula: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Multipart endpoint for Project 5. Accepts a file OR a LaTeX formula string."""
    if not file and not formula:
        raise HTTPException(status_code=422, detail="Provide either a file or a formula.")

    # --- Resolve attachment ---
    if formula:
        lc_content, saved_path = await handle_formula(formula, user_message)
        attachment_type = "formula"
    else:
        ext = ("." + (file.filename or "").rsplit(".", 1)[-1]).lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
            )
        lc_content, saved_path, attachment_type = await handle_attachment(file, user_message)

    # --- Build LangChain messages with k=5 memory ---
    history = await get_recent_messages(db, thread_id, limit=10)
    hist_msgs = _history_to_lc(history)
    lc_messages = (
        [SystemMessage(content=SYSTEM_PROMPT)]
        + hist_msgs
        + [HumanMessage(content=lc_content)]
    )

    display_message = user_message or f"[{attachment_type} attachment]"
    await save_message(
        db, thread_id, "user", display_message,
        attachment_url=saved_path or None,
        attachment_type=attachment_type,
    )

    if len(history) == 0:
        background_tasks.add_task(
            _generate_and_save_title, thread_id, display_message, current_user.email, db,
        )

    async def generate():
        tokens: list[str] = []
        async for token in stream_chat_response(lc_messages, current_user.email):
            tokens.append(token)
            yield f"data: {json.dumps({'token': token, 'attachment_type': attachment_type})}\n\n"
        yield f"data: {json.dumps({'done': True, 'attachment_type': attachment_type})}\n\n"
        await save_message(db, thread_id, "assistant", "".join(tokens))

    return StreamingResponse(generate(), media_type="text/event-stream")

