from functools import lru_cache
from pathlib import Path

import chromadb
from chromadb import PersistentClient

from app.core.config import settings


@lru_cache(maxsize=1)
def get_chroma_client() -> PersistentClient:
    """Return a singleton persistent ChromaDB client for PDF-RAG collections."""
    db_path = settings.CHROMA_DB_PATH or settings.CHROMA_PERSIST_DIR
    resolved = Path(db_path)
    resolved.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(resolved))
