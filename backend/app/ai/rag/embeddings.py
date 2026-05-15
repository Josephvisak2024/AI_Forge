from __future__ import annotations

from typing import Sequence

from app.ai.llm import openai_client
from app.core.config import settings


def embed_texts(texts: Sequence[str], batch_size: int = 64) -> list[list[float]]:
    """Generate embeddings via LiteLLM using the configured embedding model."""
    if not texts:
        return []

    vectors: list[list[float]] = []
    model = settings.LITELLM_EMBEDDING_MODEL

    for i in range(0, len(texts), batch_size):
        batch = list(texts[i : i + batch_size])
        response = openai_client.embeddings.create(
            model=model,
            input=batch,
        )
        # Preserve order to keep chunk/vector alignment stable for storage step.
        vectors.extend([item.embedding for item in response.data])

    return vectors


def embed_pdf_chunks(chunks: Sequence[dict[str, str | int]]) -> list[list[float]]:
    """Embed chunk text content in order; output aligns 1:1 with input chunks."""
    texts = [str(chunk["text"]) for chunk in chunks]
    return embed_texts(texts)


def embed_query(query: str) -> list[float]:
    """Embed a single user query for similarity search."""
    vectors = embed_texts([query])
    return vectors[0] if vectors else []
