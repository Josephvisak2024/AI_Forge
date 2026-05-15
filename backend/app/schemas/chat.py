from pydantic import BaseModel


class Message(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    thread_id: str
    user_message: str


class ChatResponse(BaseModel):
    ai_response: str
    thread_id: str


class GenerateImageRequest(BaseModel):
    prompt: str
    thread_id: str


class GenerateImageResponse(BaseModel):
    image_base64: str
    image_format: str = "png"
    prompt: str
    thread_id: str
