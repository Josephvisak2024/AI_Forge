from typing import AsyncIterator

from langchain_core.messages import BaseMessage
from langchain_openai import ChatOpenAI

from app.core.config import settings


async def stream_chat_response(lc_messages: list[BaseMessage], user_email: str) -> AsyncIterator[str]:
    """Stream an LLM response for a pre-built LangChain message list.

    *lc_messages* should already include the system prompt, conversation
    history (via ``build_message_context``), and the new human message.
    """
    llm = ChatOpenAI(
        model=settings.LLM_MODEL,
        base_url=settings.LITELLM_PROXY_URL,
        api_key=settings.LITELLM_API_KEY,
        timeout=60,
        max_retries=2,
        streaming=True,
    )
    async for chunk in llm.astream(
        lc_messages,
        config={"metadata": {"user_email": user_email}},
    ):
        if chunk.content:
            yield str(chunk.content)
