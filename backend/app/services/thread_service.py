import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.thread import Thread


async def create_thread(db: AsyncSession, user_id: str, title: str = "New Chat") -> Thread:
    thread = Thread(id=str(uuid.uuid4()), user_id=user_id, title=title)
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return thread


async def get_user_threads(db: AsyncSession, user_id: str) -> list[Thread]:
    result = await db.execute(
        select(Thread)
        .where(Thread.user_id == user_id)
        .order_by(Thread.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_thread_messages(db: AsyncSession, thread_id: str, user_id: str) -> list[Message]:
    thread = await db.get(Thread, thread_id)
    if not thread or thread.user_id != user_id:
        return []
    result = await db.execute(
        select(Message)
        .where(Message.thread_id == thread_id)
        .order_by(Message.created_at.asc())
    )
    return list(result.scalars().all())


async def save_message(db: AsyncSession, thread_id: str, role: str, content: str) -> Message:
    msg = Message(id=str(uuid.uuid4()), thread_id=thread_id, role=role, content=content)
    db.add(msg)
    await db.execute(
        update(Thread)
        .where(Thread.id == thread_id)
        .values(updated_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return msg


async def update_thread_title(db: AsyncSession, thread_id: str, title: str) -> None:
    await db.execute(update(Thread).where(Thread.id == thread_id).values(title=title))
    await db.commit()


async def delete_thread(db: AsyncSession, thread_id: str, user_id: str) -> bool:
    """Delete a thread and all its messages. Returns False if not found / not owned."""
    thread = await db.get(Thread, thread_id)
    if not thread or thread.user_id != user_id:
        return False
    await db.execute(delete(Message).where(Message.thread_id == thread_id))
    await db.execute(delete(Thread).where(Thread.id == thread_id))
    await db.commit()
    return True
