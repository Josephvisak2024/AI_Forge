from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm import openai_client
from app.ai.rag.embeddings import embed_pdf_chunks, embed_query
from app.ai.rag.pdf_processing import extract_pdf_pages, save_uploaded_pdf, split_pdf_into_chunks
from app.ai.rag.vector_store import query_thread_chunks, upsert_thread_chunks
from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.thread import Thread
from app.models.user import User
from app.schemas.pdf_rag import PDFChatRequest, PDFChatResponse, PDFUploadResponse
from app.services.pdf_document_service import save_pdf_document
from app.services.thread_service import save_message

router = APIRouter(prefix="/api", tags=["pdf-rag"])


def _build_pdf_rag_prompt(question: str, retrieved_chunks: list[dict[str, str | int | float]]) -> str:
    context_blocks = []
    for idx, chunk in enumerate(retrieved_chunks, start=1):
        page = int(chunk.get("page", 0))
        text = str(chunk.get("text", "")).strip()
        context_blocks.append(f"[Chunk {idx} | Page {page}]\n{text}")

    context = "\n\n".join(context_blocks)
    return (
        "Answer the question based on the following PDF content only:\n\n"
        f"Context: {context}\n\n"
        f"Question: {question}\n\n"
        "If the answer is not in the PDF content, "
        "say 'I could not find this information in the uploaded PDF'."
    )


def _generate_pdf_answer_sync(prompt: str) -> str:
    response = openai_client.chat.completions.create(
        model=settings.LLM_MODEL,
        temperature=0.2,
        messages=[
            {
                "role": "system",
                "content": "You answer user questions strictly from provided PDF context.",
            },
            {"role": "user", "content": prompt},
        ],
    )
    return (response.choices[0].message.content or "").strip()


@router.post("/upload-pdf", response_model=PDFUploadResponse)
async def upload_pdf(
    thread_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PDFUploadResponse:
    thread = await db.get(Thread, thread_id)
    if not thread or thread.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Thread not found")

    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Only .pdf files are supported for this endpoint")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=422, detail="Uploaded PDF is empty")

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail=f"PDF exceeds {settings.MAX_UPLOAD_MB}MB size limit")

    try:
        pages = extract_pdf_pages(data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {exc}") from exc

    if not pages:
        raise HTTPException(status_code=422, detail="No extractable text found in uploaded PDF")

    chunks = split_pdf_into_chunks(pages, chunk_size=500, chunk_overlap=50)

    try:
        vectors = embed_pdf_chunks(chunks)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Embedding generation failed: {exc}") from exc

    if len(vectors) != len(chunks):
        raise HTTPException(
            status_code=502,
            detail="Embedding generation returned mismatched vector count",
        )

    try:
        pdf_id = uuid.uuid4().hex
        stored_count = upsert_thread_chunks(thread_id=thread_id, chunks=chunks, vectors=vectors, pdf_id=pdf_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to store vectors in ChromaDB: {exc}") from exc

    saved_path = save_uploaded_pdf(data, filename)

    try:
        await save_pdf_document(
            db=db,
            thread_id=thread_id,
            pdf_name=filename,
            pdf_path=saved_path,
            chunk_count=len(chunks),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to save PDF metadata: {exc}") from exc

    return PDFUploadResponse(
        thread_id=thread_id,
        pdf_name=filename,
        pdf_path=saved_path,
        page_count=len(pages),
        chunk_count=len(chunks),
        embedded_chunk_count=len(vectors),
        stored_chunk_count=stored_count,
        collection_name=thread_id,
        embedding_model=settings.LITELLM_EMBEDDING_MODEL,
        message="PDF uploaded, chunked, embedded, and stored in ChromaDB successfully.",
    )


@router.post("/chat-pdf", response_model=PDFChatResponse)
async def chat_pdf(
    body: PDFChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PDFChatResponse:
    thread = await db.get(Thread, body.thread_id)
    if not thread or thread.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Thread not found")

    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question is required")

    try:
        query_vector = await asyncio.to_thread(embed_query, question)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to embed question: {exc}") from exc

    if not query_vector:
        raise HTTPException(status_code=502, detail="Failed to generate question embedding")

    try:
        hits = await asyncio.to_thread(query_thread_chunks, body.thread_id, query_vector, 5)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to query ChromaDB: {exc}") from exc

    if not hits:
        fallback = "I could not find this information in the uploaded PDF"
        await save_message(db, body.thread_id, "user", question, attachment_type="pdf_question")
        await save_message(db, body.thread_id, "assistant", fallback, attachment_type="pdf_response")
        return PDFChatResponse(
            thread_id=body.thread_id,
            question=question,
            answer=fallback,
            source_pages=[],
            retrieved_chunks=0,
        )

    prompt = _build_pdf_rag_prompt(question, hits)

    try:
        answer = await asyncio.to_thread(_generate_pdf_answer_sync, prompt)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to generate PDF answer: {exc}") from exc

    source_pages = sorted({int(hit.get("page", 0)) for hit in hits if int(hit.get("page", 0)) > 0})
    source_line = (
        "\n\nSource: " + ", ".join(f"Page {p}" for p in source_pages)
        if source_pages
        else ""
    )

    await save_message(db, body.thread_id, "user", question, attachment_type="pdf_question")
    await save_message(db, body.thread_id, "assistant", f"{answer}{source_line}", attachment_type="pdf_response")

    return PDFChatResponse(
        thread_id=body.thread_id,
        question=question,
        answer=answer,
        source_pages=source_pages,
        retrieved_chunks=len(hits),
    )
