import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self) -> None:
        api_key = os.getenv("LITELLM_API_KEY", "").strip()
        proxy_url = os.getenv("LITELLM_PROXY_URL", "https://litellm.amzur.com").strip()

        if not api_key:
            api_key = os.getenv("OPENAI_API_KEY", "").strip()

        if not api_key:
            raise RuntimeError(
                "LITELLM_API_KEY is missing. Add it to your .env file."
            )

        self.litellm_api_key = api_key
        self.litellm_proxy_url = proxy_url
        self.llm_model = os.getenv("LLM_MODEL", "gpt-4o").strip()


settings = Settings()
