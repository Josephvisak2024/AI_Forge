from __future__ import annotations

import uuid
from typing import Sequence

from app.ai.rag.chroma import get_chroma_client


def _safe_collection_name(thread_id: str) -> str:
    """Return a ChromaDB-safe collection name derived from the thread_id."""
    # ChromaDB requires: 3-63 chars, start/end alphanumeric, only [a-zA-Z0-9_-].
    name = thread_id.replace("-", "_").lower()
    # Ensure it starts and ends with an alphanumeric character.
    name = name.strip("_")
    if not name:
        name = "thread"
    return name[:63]


def upsert_thread_chunks(
    thread_id: str,
    chunks: Sequence[dict[str, str | int]],
    vectors: Sequence[list[float]],
    pdf_id: str | None = None,
) -> int:
    """Append PDF chunks into the thread's Chroma collection.

    Each upload uses a unique ``pdf_id`` prefix for chunk IDs so that multiple
    PDFs uploaded to the same thread all coexist and are independently
    searchable.  The old delete-and-recreate approach caused data from earlier
    uploads to be silently discarded.
    """
    if len(chunks) != len(vectors):
        raise ValueError("chunks and vectors length mismatch")

    # Unique identifier for this specific upload so chunk IDs never collide.
    upload_id = pdf_id or uuid.uuid4().hex

    client = get_chroma_client()
    collection_name = _safe_collection_name(thread_id)
    collection = client.get_or_create_collection(name=collection_name)

    ids: list[str] = []
    documents: list[str] = []
    metadatas: list[dict[str, int | str]] = []

    for i, chunk in enumerate(chunks):
        page = int(chunk["page"])
        chunk_index = int(chunk["chunk_index"])
        text = str(chunk["text"])

        ids.append(f"{upload_id}_{i}")
        documents.append(text)
        metadatas.append(
            {
                "thread_id": thread_id,
                "pdf_id": upload_id,
                "page": page,
                "chunk_index": chunk_index,
            }
        )

    if ids:
        # upsert is idempotent — re-uploading the same pdf_id overwrites safely.
        collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
            embeddings=list(vectors),
        )

    return len(ids)


def query_thread_chunks(
    thread_id: str,
    query_vector: list[float],
    top_k: int = 5,
) -> list[dict[str, str | int | float]]:
    """Query top-k similar chunks from a thread collection."""
    client = get_chroma_client()

    try:
        collection = client.get_collection(name=_safe_collection_name(thread_id))
    except Exception:
        return []

    result = collection.query(
        query_embeddings=[query_vector],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    docs = (result.get("documents") or [[]])[0]
    metas = (result.get("metadatas") or [[]])[0]
    dists = (result.get("distances") or [[]])[0]

    hits: list[dict[str, str | int | float]] = []
    for doc, meta, dist in zip(docs, metas, dists):
        page = int((meta or {}).get("page", 0))
        chunk_index = int((meta or {}).get("chunk_index", 0))
        hits.append(
            {
                "text": str(doc or ""),
                "page": page,
                "chunk_index": chunk_index,
                "distance": float(dist or 0.0),
            }
        )
    return hits
