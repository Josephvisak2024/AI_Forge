from __future__ import annotations

import io
import uuid
from pathlib import Path

import pdfplumber
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import settings


def save_uploaded_pdf(pdf_bytes: bytes, original_filename: str) -> str:
    """Save uploaded PDF under uploads/pdfs and return a relative path."""
    upload_dir = Path(settings.UPLOAD_DIR) / "pdfs"
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(original_filename or "document.pdf").suffix.lower()
    if ext != ".pdf":
        ext = ".pdf"

    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = upload_dir / filename
    file_path.write_bytes(pdf_bytes)
    return f"uploads/pdfs/{filename}"


def extract_pdf_pages(pdf_bytes: bytes) -> list[dict[str, str | int]]:
    """Extract non-empty page text from PDF as page-numbered records."""
    pages: list[dict[str, str | int]] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for idx, page in enumerate(pdf.pages, start=1):
            text = (page.extract_text() or "").strip()
            if text:
                pages.append({"page": idx, "text": text})

    return pages


def split_pdf_into_chunks(
    pages: list[dict[str, str | int]],
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> list[dict[str, str | int]]:
    """Split extracted page text into chunks while preserving source page metadata."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )

    chunks: list[dict[str, str | int]] = []
    for page_item in pages:
        page_no = int(page_item["page"])
        page_text = str(page_item["text"])
        for i, chunk_text in enumerate(splitter.split_text(page_text), start=1):
            chunks.append(
                {
                    "page": page_no,
                    "chunk_index": i,
                    "text": chunk_text,
                }
            )

    return chunks
