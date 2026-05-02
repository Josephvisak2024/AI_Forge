import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.services.chat_service import stream_chat_response
from app.services.thread_service import save_message, update_thread_title

router = APIRouter(prefix="/api/chat", tags=["chat"])


async def _generate_title(first_user_message: str, user_email: str) -> str:
    """Ask the LLM to produce a short thread title (≤6 words) from the first message."""
    from app.schemas.chat import Message as ChatMsg
    prompt = (
        f'Generate a concise chat title (maximum 6 words, no quotes, no punctuation at the end) '
        f'that summarises this user message: "{first_user_message}"'
    )
    tokens: list[str] = []
    async for token in stream_chat_response([ChatMsg(role="user", content=prompt)], user_email):
        tokens.append(token)
    title = "".join(tokens).strip().strip('"').strip("'").strip()
    return title[:80] if title else first_user_message[:60]


@router.post("")
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    # Save the incoming user message
    user_msg = request.messages[-1]
    await save_message(db, request.thread_id, user_msg.role, user_msg.content)

    # Auto-title the thread using the LLM on the first message
    if len(request.messages) == 1:
        title = await _generate_title(user_msg.content, current_user.email)
        await update_thread_title(db, request.thread_id, title)

    async def generate():
        tokens: list[str] = []
        async for token in stream_chat_response(request.messages, current_user.email):
            tokens.append(token)
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"
        # Persist the complete assistant response after streaming
        await save_message(db, request.thread_id, "assistant", "".join(tokens))

    return StreamingResponse(generate(), media_type="text/event-stream")
