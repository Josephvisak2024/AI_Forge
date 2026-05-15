from typing import Optional
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_FILE_PATH = Path(__file__).resolve().parents[2] / ".env"

# Ensure env vars are present in os.environ even when uvicorn starts from a
# different working directory/reloader process.
load_dotenv(dotenv_path=str(ENV_FILE_PATH), override=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_FILE_PATH), extra="ignore")

    # App
    SECRET_KEY: str
    JWT_EXPIRE_MINUTES: int = 480
    APP_NAME: str = "amzur-ai-chat"
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:5173"

    # Database
    DATABASE_URL: str

    # Amzur LiteLLM Proxy
    LITELLM_PROXY_URL: str = "https://litellm.amzur.com"
    LITELLM_API_KEY: str
    LLM_MODEL: str = "gemini/gemini-2.5-flash"
    LITELLM_EMBEDDING_MODEL: str = "text-embedding-3-large"
    IMAGE_GEN_MODEL: str = "gemini/gemini-2.5-flash-image"
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"

    # ChromaDB
    CHROMA_DB_PATH: str = "./chromadb"
    CHROMA_PERSIST_DIR: str = "./chroma_db"

    # Google Sheets
    GOOGLE_SERVICE_ACCOUNT_JSON: Optional[str] = None

    # File uploads
    MAX_UPLOAD_MB: int = 20
    UPLOAD_DIR: str = "./uploads"
    ACCEPTED_MIME_TYPES: list[str] = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "video/mp4",
        "video/webm",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "text/csv",
    ]


settings = Settings()
