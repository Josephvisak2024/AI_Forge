import os
import sys
from pathlib import Path

backend_dir = Path(__file__).parent / 'backend'
sys.path.insert(0, str(backend_dir))
os.chdir(backend_dir)

from app.core.config import settings
print(f'GEMINI_API_KEY={settings.GEMINI_API_KEY}')
print(f'LITELLM_API_KEY={settings.LITELLM_API_KEY}')
print(f'ENV vars:')
print(f'  os.getenv(GEMINI_API_KEY)={os.getenv("GEMINI_API_KEY")}')
print(f'  os.getenv(LITELLM_API_KEY)={os.getenv("LITELLM_API_KEY")}')
