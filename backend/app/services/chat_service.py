from typing import AsyncIterator

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.schemas.chat import Message

SYSTEM_PROMPT = "You are a helpful AI assistant. Answer clearly and concisely."


def _to_langchain_messages(messages: list[Message]) -> list:
    lc_messages: list = [SystemMessage(content=SYSTEM_PROMPT)]
    for msg in messages:
        if msg.role == "user":
            lc_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            lc_messages.append(AIMessage(content=msg.content))
    return lc_messages


async def stream_chat_response(messages: list[Message], user_email: str) -> AsyncIterator[str]:
    llm = ChatOpenAI(
        model=settings.LLM_MODEL,
        base_url=settings.LITELLM_PROXY_URL,
        api_key=settings.LITELLM_API_KEY,
        timeout=60,
        max_retries=2,
        streaming=True,
    )
    lc_messages = _to_langchain_messages(messages)
    async for chunk in llm.astream(
        lc_messages,
        config={"metadata": {"user_email": user_email}},
    ):
        if chunk.content:
            yield str(chunk.content)
