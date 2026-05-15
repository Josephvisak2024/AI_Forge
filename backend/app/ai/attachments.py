"""
Project 5 — Attachment file handlers.

Each handler:
 1. Saves the uploaded file to disk under UPLOAD_DIR/<type>/
 2. Builds a LangChain-compatible message content list
    (text prompt + optional base64 image parts)
 3. Returns (content_list, saved_relative_path)

Import the top-level `handle_attachment` dispatcher from here.
"""
from __future__ import annotations

import base64
import io
import os
import uuid
from pathlib import Path
from typing import Any

from fastapi import UploadFile

from app.core.config import settings

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _upload_path(sub: str) -> Path:
    p = Path(settings.UPLOAD_DIR) / sub
    p.mkdir(parents=True, exist_ok=True)
    return p


def _save_file(data: bytes, sub: str, original_name: str) -> str:
    """Save bytes to uploads/<sub>/<uuid>_<original_name> and return the relative path."""
    ext = Path(original_name).suffix
    filename = f"{uuid.uuid4().hex}{ext}"
    dest = _upload_path(sub) / filename
    dest.write_bytes(data)
    return f"uploads/{sub}/{filename}"


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


# ---------------------------------------------------------------------------
# IMAGE
# ---------------------------------------------------------------------------

async def handle_image(file: UploadFile, user_message: str) -> tuple[list[Any], str]:
    """Return (lc_content_parts, saved_path)."""
    from PIL import Image

    data = await file.read()
    # Re-encode as JPEG to normalise format and keep size reasonable
    img = Image.open(io.BytesIO(data)).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    img_bytes = buf.getvalue()

    rel_path = _save_file(img_bytes, "images", file.filename or "image.jpg")

    prompt = user_message or "Analyze this image and describe what you see."
    content: list[Any] = [
        {
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{_b64(img_bytes)}"},
        },
        {"type": "text", "text": prompt},
    ]
    return content, rel_path


# ---------------------------------------------------------------------------
# VIDEO
# ---------------------------------------------------------------------------

async def handle_video(file: UploadFile, user_message: str) -> tuple[list[Any], str]:
    """Extract key frames every 5 s, send as base64 images."""
    import tempfile
    import cv2  # opencv-python-headless

    data = await file.read()
    rel_path = _save_file(data, "videos", file.filename or "video.mp4")

    # Write to a temp file so OpenCV can open it
    suffix = Path(file.filename or "video.mp4").suffix
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        interval = int(fps * 5)  # every 5 seconds
        frames: list[str] = []
        frame_idx = 0
        while len(frames) < 8:  # cap at 8 frames
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                break
            _, buf = cv2.imencode(".jpg", frame)
            frames.append(_b64(buf.tobytes()))
            frame_idx += interval
        cap.release()
    finally:
        os.unlink(tmp_path)

    prompt = user_message or "Analyze these video frames and describe what is happening."
    content: list[Any] = [
        {"type": "text", "text": f"{prompt}\n\nVideo frames ({len(frames)} extracted at ~5-second intervals):"},
    ]
    for b64frame in frames:
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{b64frame}"},
        })
    return content, rel_path


# ---------------------------------------------------------------------------
# TABLE (CSV / XLSX)
# ---------------------------------------------------------------------------

async def handle_table(file: UploadFile, user_message: str) -> tuple[list[Any], str]:
    import pandas as pd

    data = await file.read()
    fname = file.filename or "table.csv"
    rel_path = _save_file(data, "tables", fname)

    buf = io.BytesIO(data)
    
    # Aggressively limit what we read to keep LLM context small
    try:
        if fname.endswith(".xlsx") or fname.endswith(".xls"):
            df = pd.read_excel(buf, nrows=10)  # Only first 10 rows
        else:
            df = pd.read_csv(buf, nrows=10)  # Only first 10 rows
    except Exception:
        df = pd.DataFrame({"error": ["Could not read file"]})

    row_count, col_count = df.shape

    # Skip markdown conversion—send as raw CSV string (much faster)
    csv_preview = df.to_csv(index=False)

    prompt = user_message or "Analyze this table data and provide insights."
    text = (
        f"{prompt}\n\n"
        f"Table: {fname} ({row_count}+ rows × {col_count} columns)\n"
        f"Preview (CSV format, first 10 rows):\n\n"
        f"{csv_preview}"
    )
    content: list[Any] = [{"type": "text", "text": text}]
    return content, rel_path


# ---------------------------------------------------------------------------
# CODE FILE
# ---------------------------------------------------------------------------

_EXT_LANG_MAP = {
    ".py": "python", ".js": "javascript", ".ts": "typescript",
    ".java": "java", ".html": "html", ".css": "css",
    ".json": "json", ".sh": "bash", ".go": "go", ".cpp": "cpp",
}


async def handle_code(file: UploadFile, user_message: str) -> tuple[list[Any], str]:
    data = await file.read()
    fname = file.filename or "code.py"
    rel_path = _save_file(data, "code", fname)

    ext = Path(fname).suffix.lower()
    lang = _EXT_LANG_MAP.get(ext, "text")

    try:
        code_text = data.decode("utf-8")
    except UnicodeDecodeError:
        code_text = data.decode("latin-1")

    prompt = user_message or "Review this code and provide feedback."
    text = f"{prompt}\n\n```{lang}\n{code_text}\n```"
    content: list[Any] = [{"type": "text", "text": text}]
    return content, rel_path


# ---------------------------------------------------------------------------
# FORMULA (LaTeX)
# ---------------------------------------------------------------------------

async def handle_formula(latex: str, user_message: str) -> tuple[list[Any], str]:
    prompt = user_message or "Explain this mathematical formula."
    text = f"{prompt}\n\nFormula: $${latex}$$"
    content: list[Any] = [{"type": "text", "text": text}]
    return content, ""  # No file saved for formula


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

ALLOWED_EXTENSIONS: dict[str, str] = {
    # images
    ".jpg": "image", ".jpeg": "image", ".png": "image",
    ".gif": "image", ".webp": "image",
    # videos
    ".mp4": "video", ".mov": "video", ".avi": "video",
    # tables
    ".csv": "table", ".xlsx": "table", ".xls": "table",
    # code
    ".py": "code", ".js": "code", ".ts": "code", ".java": "code",
    ".html": "code", ".css": "code", ".json": "code",
    ".sh": "code", ".go": "code", ".cpp": "code",
}


async def handle_attachment(
    file: UploadFile,
    user_message: str,
) -> tuple[list[Any], str, str]:
    """
    Dispatch to the correct handler based on file extension.

    Returns:
        (lc_content_parts, saved_relative_path, attachment_type)
    """
    ext = Path(file.filename or "").suffix.lower()
    atype = ALLOWED_EXTENSIONS.get(ext)
    if not atype:
        raise ValueError(f"Unsupported file type: {ext}")

    if atype == "image":
        content, path = await handle_image(file, user_message)
    elif atype == "video":
        content, path = await handle_video(file, user_message)
    elif atype == "table":
        content, path = await handle_table(file, user_message)
    elif atype == "code":
        content, path = await handle_code(file, user_message)
    else:
        raise ValueError(f"No handler for type: {atype}")

    return content, path, atype
