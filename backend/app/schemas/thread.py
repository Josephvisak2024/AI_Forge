from datetime import datetime

from pydantic import BaseModel


class ThreadResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime


class CreateThreadRequest(BaseModel):
    title: str = "New Chat"


class UpdateThreadRequest(BaseModel):
    title: str
