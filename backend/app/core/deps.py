from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.services.auth_service import decode_token, get_user_by_id


async def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(
            status_code=401,
            detail={"error": "unauthorized", "message": "Not authenticated"},
        )
    user_id = decode_token(access_token)
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail={"error": "unauthorized", "message": "Invalid or expired token"},
        )
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=401,
            detail={"error": "unauthorized", "message": "User not found"},
        )
    return user
