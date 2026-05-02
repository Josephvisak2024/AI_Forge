from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.thread import CreateThreadRequest, MessageResponse, ThreadResponse, UpdateThreadRequest
from app.services.thread_service import (
    create_thread,
    delete_thread,
    get_thread_messages,
    get_user_threads,
    update_thread_title,
)

router = APIRouter(prefix="/api/threads", tags=["threads"])


@router.get("", response_model=list[ThreadResponse])
async def list_threads(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ThreadResponse]:
    threads = await get_user_threads(db, current_user.id)
    return [
        ThreadResponse(id=t.id, title=t.title, created_at=t.created_at, updated_at=t.updated_at)
        for t in threads
    ]


@router.post("", response_model=ThreadResponse)
async def create_new_thread(
    body: CreateThreadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ThreadResponse:
    thread = await create_thread(db, current_user.id, body.title)
    return ThreadResponse(id=thread.id, title=thread.title, created_at=thread.created_at, updated_at=thread.updated_at)


@router.patch("/{thread_id}", response_model=ThreadResponse)
async def rename_thread(
    thread_id: str,
    body: UpdateThreadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ThreadResponse:
    from app.models.thread import Thread  # local import to avoid circular
    thread = await db.get(Thread, thread_id)
    if not thread or thread.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Thread not found")
    await update_thread_title(db, thread_id, body.title.strip() or "New Chat")
    await db.refresh(thread)
    return ThreadResponse(id=thread.id, title=thread.title, created_at=thread.created_at, updated_at=thread.updated_at)


@router.delete("/{thread_id}", status_code=204)
async def remove_thread(
    thread_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    deleted = await delete_thread(db, thread_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Thread not found")


@router.get("/{thread_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    thread_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MessageResponse]:
    messages = await get_thread_messages(db, thread_id, current_user.id)
    return [
        MessageResponse(id=m.id, role=m.role, content=m.content, created_at=m.created_at)
        for m in messages
    ]
