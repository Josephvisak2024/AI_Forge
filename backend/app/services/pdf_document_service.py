from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pdf_document import PDFDocument


async def save_pdf_document(
    db: AsyncSession,
    thread_id: str,
    pdf_name: str,
    pdf_path: str,
    chunk_count: int,
) -> PDFDocument:
    record = PDFDocument(
        thread_id=thread_id,
        pdf_name=pdf_name,
        pdf_path=pdf_path,
        chunk_count=chunk_count,
        processed_at=datetime.now(timezone.utc),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record
