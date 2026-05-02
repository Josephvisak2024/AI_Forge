import uuid
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse
from app.services.auth_service import (
    create_access_token,
    get_user_by_email,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_COOKIE = dict(httponly=True, samesite="lax", secure=False, max_age=60 * 480)
_ALLOWED_DOMAINS = {"amzur.com", "evokesystems.com"}

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def _check_domain(email: str) -> None:
    domain = email.split("@")[-1].lower()
    if domain not in _ALLOWED_DOMAINS:
        raise HTTPException(
            status_code=403,
            detail={"error": "forbidden", "message": "Only @amzur.com or @evokesystems.com email addresses are allowed"},
        )


# ── email/password ────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse)
async def register(
    body: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    _check_domain(body.email)
    if await get_user_by_email(db, body.email):
        raise HTTPException(
            status_code=400,
            detail={"error": "conflict", "message": "Email already registered"},
        )
    user = User(
        id=str(uuid.uuid4()),
        email=body.email,
        display_name=body.display_name,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    response.set_cookie("access_token", create_access_token(user.id), **_COOKIE)
    return UserResponse(id=user.id, email=user.email, display_name=user.display_name)


@router.post("/login", response_model=UserResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    _check_domain(body.email)
    user = await get_user_by_email(db, body.email)
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail={"error": "unauthorized", "message": "Invalid email or password"},
        )
    response.set_cookie("access_token", create_access_token(user.id), **_COOKIE)
    return UserResponse(id=user.id, email=user.email, display_name=user.display_name)


# ── Google OAuth 2.0 ──────────────────────────────────────────────────────────

@router.get("/google")
async def google_login() -> dict:
    """Return the Google OAuth consent-screen URL for the frontend to redirect to."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return {"url": f"{_GOOGLE_AUTH_URL}?{urlencode(params)}"}


@router.get("/google/callback")
async def google_callback(
    code: str,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Exchange the auth code for tokens, upsert the user, set cookie, redirect to frontend."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_res = await client.post(
            _GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google auth code")
        token_data = token_res.json()

        # Fetch user profile
        userinfo_res = await client.get(
            _GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {token_data['access_token']}"},
        )
        if userinfo_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user info")
        info = userinfo_res.json()

    email: str = info.get("email", "")
    _check_domain(email)

    user = await get_user_by_email(db, email)
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            display_name=info.get("name") or email.split("@")[0],
            google_id=info.get("sub"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    elif not user.google_id:
        user.google_id = info.get("sub")
        await db.commit()

    response.set_cookie("access_token", create_access_token(user.id), **_COOKIE)
    # Redirect to the frontend
    response.status_code = 302
    response.headers["location"] = "http://localhost:5173/"


# ── session ───────────────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie("access_token")
    return {"status": "ok"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        display_name=current_user.display_name,
    )
