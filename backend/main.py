from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.image_generation import router as image_generation_router
from app.api.nl2sql import router as nl2sql_router
from app.api.pdf_rag import router as pdf_rag_router
from app.api.threads import router as threads_router
from app.core.config import settings
from app.db.session import engine

# Import models so SQLAlchemy registers them before create_all
import app.models.user  # noqa: F401
import app.models.thread  # noqa: F401
import app.models.message  # noqa: F401
import app.models.pdf_document  # noqa: F401
import app.models.db_connection  # noqa: F401
from app.db.session import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    from sqlalchemy import text

    # Keep startup fast even when remote DB is temporarily unreachable.
    max_attempts = 2
    for attempt in range(1, max_attempts + 1):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

                # Project 5 — idempotent column migrations
                for col, definition in [
                    ("attachment_url",  "TEXT"),
                    ("attachment_type", "VARCHAR(20)"),
                ]:
                    await conn.execute(text(
                        f"ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS {col} {definition};"
                    ))

                # Project 7 — PDF metadata table
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS pdf_documents (
                        id SERIAL PRIMARY KEY,
                        thread_id VARCHAR(255) REFERENCES threads(id),
                        pdf_name VARCHAR(255),
                        pdf_path TEXT,
                        chunk_count INTEGER,
                        processed_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """))

                # Project 8 — DB connection metadata table
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS db_connections (
                        id SERIAL PRIMARY KEY,
                        thread_id VARCHAR(255) REFERENCES threads(id),
                        db_type VARCHAR(20),
                        host VARCHAR(255),
                        port INTEGER,
                        database_name VARCHAR(255),
                        username VARCHAR(255),
                        connected_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """))
            break
        except Exception as exc:
            wait = 1
            print(f"DB connection attempt {attempt}/{max_attempts} failed ({exc}).")
            if attempt < max_attempts:
                print(f"Retrying in {wait}s...")
                await asyncio.sleep(wait)
            else:
                print("WARNING: Database initialization skipped after quick retries. App started; DB-dependent features may fail until connectivity is restored.")
    yield


app = FastAPI(title=settings.APP_NAME, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(threads_router)
app.include_router(chat_router)
app.include_router(image_generation_router)
app.include_router(nl2sql_router)
app.include_router(pdf_rag_router)

uploads_dir = Path(settings.UPLOAD_DIR)
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
