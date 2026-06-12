import io


def parse_resume(contents: bytes, filename: str) -> str:
    """Extract plain text from a PDF or DOCX resume."""
    fname = filename.lower()
    if fname.endswith(".pdf"):
        return _parse_pdf(contents)
    elif fname.endswith(".docx"):
        return _parse_docx(contents)
    else:
        # Try PDF first, fall back to DOCX
        try:
            return _parse_pdf(contents)
        except Exception:
            return _parse_docx(contents)


def _parse_pdf(contents: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(contents))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)

    result = "\n".join(pages).strip()
    if not result:
        raise ValueError(
            "Could not extract text from PDF. "
            "The file may be scanned or image-based."
        )
    return result


def _parse_docx(contents: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(contents))
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    result = "\n".join(paragraphs).strip()
    if not result:
        raise ValueError("Could not extract text from DOCX file.")
    return result
