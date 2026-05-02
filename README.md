# Amzur AI Chat

An internal multi-user conversational AI platform with threaded persistent chat, email/password and Google OAuth authentication, conversational memory, multi-modal input (images, video, code, PDF), AI image generation, RAG over uploaded documents, and natural language querying of databases and spreadsheets.

All AI calls route exclusively through the Amzur LiteLLM proxy at `litellm.amzur.com`.

---

## Tech Stack

| Layer | Technology |
| :---- | :---- |
| Frontend | React 18+, TypeScript, Tailwind CSS v4 |
| Backend | FastAPI, Python 3.11+ |
| Database | PostgreSQL — SQLAlchemy 2.0, Alembic migrations |
| AI Orchestration | LangChain (LCEL) |
| LLM Gateway | Amzur LiteLLM Proxy (`litellm.amzur.com`) |
| Models | `gpt-4o`, `gemini/gemini-2.5-flash` |
| Embeddings | `text-embedding-3-large` |
| Vector Store | ChromaDB (persisted to disk) |
| Auth | Email/password (bcrypt + JWT) + Google OAuth 2.0 |

---

## Project Structure

```
/
├── frontend/               # React + TypeScript + Tailwind CSS (Vite)
│   └── src/
│       ├── components/
│       │   ├── chat/       # MessageList, InputBar, ThreadSidebar
│       │   ├── attachments/
│       │   └── auth/       # Login, OAuth callback
│       ├── pages/
│       ├── hooks/
│       ├── lib/
│       │   └── api.ts      # All API calls go through here
│       └── types/          # Shared TypeScript interfaces
│
└── backend/                # FastAPI + Python
    ├── main.py             # App entry point
    ├── requirements.txt
    ├── .env.example
    └── app/
        ├── api/            # Routers — HTTP only, no business logic
        ├── services/       # All business logic
        ├── models/         # SQLAlchemy ORM models
        ├── schemas/        # Pydantic request/response schemas
        ├── ai/
        │   ├── llm.py      # LiteLLM client singletons — import from here
        │   ├── chains/     # LCEL chains, one file per feature
        │   ├── memory/     # Conversation memory utilities
        │   ├── rag/        # ChromaDB client, ingestion, retrieval
        │   └── prompts/    # Prompt templates (.txt / .yaml)
        ├── db/             # Session factory, Alembic env
        └── core/
            └── config.py   # Settings loaded from .env
```

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL
- Amzur VPN (required to reach `litellm.amzur.com` — see KI-03 below)

---

## Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and fill in SECRET_KEY, DATABASE_URL, LITELLM_API_KEY

# Run database migrations (once Alembic is initialised)
# alembic upgrade head

# Start the development server
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`.

---

## Frontend Setup

```bash
cd frontend

# Install dependencies (already done if scaffolded with Vite)
npm install

# Configure environment
# Create a .env.local file if you need to override the API base URL:
# VITE_API_BASE_URL=http://localhost:8000

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the values.

| Variable | Description |
| :--- | :--- |
| `SECRET_KEY` | Random secret used to sign JWTs |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `LITELLM_PROXY_URL` | Amzur LiteLLM proxy base URL |
| `LITELLM_API_KEY` | API key for the LiteLLM proxy |
| `LLM_MODEL` | Default chat model (`gemini/gemini-2.5-flash`) |
| `LITELLM_EMBEDDING_MODEL` | Embedding model (`text-embedding-3-large`) |
| `IMAGE_GEN_MODEL` | Image generation model |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `CHROMA_PERSIST_DIR` | Path for ChromaDB persistence |
| `UPLOAD_DIR` | Path for uploaded file storage |
| `MAX_UPLOAD_MB` | Maximum upload size in MB |

> **Never commit `.env` to version control.**

---

## Known Issues

| ID | Description |
| :--- | :--- |
| KI-01 | Use `npx create-vite@latest frontend --template react-ts` — the `--template` flag is swallowed by some npm versions otherwise. |
| KI-03 | `litellm.amzur.com` requires Amzur VPN. `httpx.ConnectError` means you are off VPN. |
| KI-04 | LangChain SQL agent requires `psycopg2-binary` — already included in `requirements.txt`. |
| KI-05 | `gspread` is a separate package from `google-auth` — already included in `requirements.txt`. |
| KI-07 | Avoid multi-line `python -c "..."` strings in PowerShell — use single-line invocations. |

---

## Development Guidelines

- **All AI calls** use `settings.LITELLM_PROXY_URL` and `settings.LITELLM_API_KEY`. Direct calls to OpenAI, Google, or Anthropic are not permitted.
- **Layered architecture**: Router → Service → Schema → Model. Logic belongs in the service.
- **Auth**: JWT stored in `httpOnly` cookie only — never `localStorage` or the response body.
- **LangChain**: LCEL syntax only (`prompt | llm | parser`). No `LLMChain` or `SequentialChain`.
- **API calls**: All frontend fetches go through `src/lib/api.ts`. Never call `fetch` directly in components.
- **Secrets**: Never hardcode API keys or secrets. Environment variables only.

---

## Running Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
npm run test
```
