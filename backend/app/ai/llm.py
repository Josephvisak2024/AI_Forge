"""
LiteLLM proxy client singletons.

Import `llm`, `openai_client`, and `embeddings` from this module.
Never instantiate AI clients elsewhere in the codebase.
"""
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from openai import OpenAI

from app.core.config import settings

# LangChain LLM — use in LCEL chains
llm = ChatOpenAI(
    model=settings.LLM_MODEL,
    base_url=settings.LITELLM_PROXY_URL,
    api_key=settings.LITELLM_API_KEY,
    timeout=30,
    max_retries=2,
)

# OpenAI SDK client — use for direct calls (image gen, etc.)
openai_client = OpenAI(
    api_key=settings.LITELLM_API_KEY,
    base_url=settings.LITELLM_PROXY_URL,
)

# Embeddings — always points to LiteLLM proxy
embeddings = OpenAIEmbeddings(
    model=settings.LITELLM_EMBEDDING_MODEL,
    base_url=settings.LITELLM_PROXY_URL,
    api_key=settings.LITELLM_API_KEY,
)
