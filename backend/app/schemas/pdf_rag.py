from pydantic import BaseModel


class PDFUploadResponse(BaseModel):
    thread_id: str
    pdf_name: str
    pdf_path: str
    page_count: int
    chunk_count: int
    embedded_chunk_count: int
    stored_chunk_count: int
    collection_name: str
    embedding_model: str
    message: str


class PDFChatRequest(BaseModel):
    thread_id: str
    question: str


class PDFChatResponse(BaseModel):
    thread_id: str
    question: str
    answer: str
    source_pages: list[int]
    retrieved_chunks: int
