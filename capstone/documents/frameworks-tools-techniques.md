# Frameworks, Tools, and Techniques — HR Tech: Resume Screening Swarm

## Overview

This document explains every framework, tool, and technique used in the **Resume Screening Swarm** capstone project, along with the rationale for each choice.

---

## Frameworks

### 1. FastAPI (Backend Web Framework)

**Version:** Latest stable (pinned via `requirements.txt`)  
**Layer:** Backend API server

FastAPI is a modern, high-performance Python web framework built on top of **Starlette** and **Pydantic**.

**Why FastAPI was chosen:**

| Reason | Detail |
|---|---|
| **Native async support** | Built on ASGI — `async def` route handlers work natively with `asyncio.create_task()`, which is the core of the multi-agent orchestration |
| **Streaming responses** | `StreamingResponse` with `AsyncGenerator` provides first-class SSE (Server-Sent Events) support without additional libraries |
| **Automatic validation** | `UploadFile`, `File(...)`, and `Form(...)` parameters handle multipart validation with type safety |
| **Performance** | One of the fastest Python frameworks available — critical when orchestrating 5 concurrent LLM calls |
| **Developer experience** | Auto-generated OpenAPI docs (`/docs`) simplify testing and debugging during development |

**Alternative considered:** Flask — rejected because its synchronous WSGI model requires additional libraries (e.g. `gevent`) to handle concurrent LLM calls efficiently, and has no native streaming response primitives.

---

### 2. React 18 + Vite 5 (Frontend UI Framework)

**Version:** React 18.3.1, Vite 5.4.19  
**Layer:** Frontend single-page application

**Why React was chosen:**

| Reason | Detail |
|---|---|
| **Component-based UI** | Each agent result panel is an independent component that renders when its data arrives — naturally models the SSE fan-in pattern |
| **State-driven rendering** | React's declarative model means the dashboard "just works" — adding a key to `agentResults` state triggers the correct panel to appear without imperative DOM manipulation |
| **React 18 concurrent features** | `useEffect`, `useMemo`, and `useState` provide efficient reactivity for a dashboard that updates 5 times in sequence |
| **Ecosystem maturity** | Lucide-react icons, Tailwind CSS integration, and Vite's HMR make UI development fast |

**Why Vite was chosen over Create React App:**

Vite uses **esbuild** under the hood for near-instant hot module replacement. More importantly, Vite's dev server proxy configuration (`/api → localhost:8000`) eliminates CORS configuration entirely during development. CRA is deprecated and significantly slower.

---

### 3. LangChain + LangChain-OpenAI (AI Orchestration Framework)

**Version:** `langchain`, `langchain-openai`, `langchain-core` (latest stable)  
**Layer:** Agent LLM communication layer

LangChain provides abstractions for building LLM-powered applications.

**Why LangChain was chosen:**

| Reason | Detail |
|---|---|
| **`ChatOpenAI` with `base_url` override** | Allows routing all LLM calls through the Amzur LiteLLM proxy without modifying the OpenAI SDK directly |
| **`ainvoke()` async support** | Native async method enables all 5 agents to be awaited concurrently via `asyncio.create_task()` |
| **`SystemMessage` / `HumanMessage` typing** | Structured message construction prevents accidental prompt injection — system role is clearly separated from user-supplied content |
| **Standardised interface** | All 5 agents use identical `ChatOpenAI → ainvoke → parse_json_response` patterns, making each agent independently testable and replaceable |

**What LangChain is NOT used for in this project:**
- No chains (`LLMChain`, `SequentialChain`) — agents are simple single-turn LLM calls
- No memory or conversation history
- No vector stores or retrieval
- No LangGraph or agent executors

**Design decision:** LangChain is used **only** for its OpenAI-compatible client abstraction and async capabilities. The "agent" logic (prompting, validation, scoring) is implemented in plain Python — LangChain does not orchestrate the agents; `asyncio` does.

---

### 4. Tailwind CSS v3.4 (Utility-First CSS Framework)

**Version:** 3.4.17  
**Layer:** Frontend styling

**Why Tailwind:**

| Reason | Detail |
|---|---|
| **Speed of development** | Utility classes eliminate context-switching between JSX and CSS files |
| **Responsive by default** | `sm:`, `md:`, `lg:` breakpoint prefixes used throughout the dashboard |
| **Colour semantics** | Tailwind's colour palette (`emerald`, `amber`, `red`) directly maps to the SHORTLISTED / REVIEW REQUIRED / REJECTED recommendation thresholds |
| **No CSS-in-JS overhead** | Pure class-based styling avoids runtime style computation |

---

## Tools

### 5. LiteLLM Proxy (LLM Gateway)

**Endpoint:** `https://litellm.amzur.com`  
**Configured via:** `LITELLM_PROXY_URL`, `LITELLM_API_KEY` in `.env`

LiteLLM is an open-source LLM proxy that provides a **unified OpenAI-compatible API** in front of multiple LLM providers (OpenAI, Anthropic, Azure OpenAI, etc.).

**Why LiteLLM:**

| Reason | Detail |
|---|---|
| **Centralised API key management** | The Amzur LiteLLM instance handles authentication — individual agents never need provider-specific credentials |
| **Drop-in OpenAI compatibility** | `ChatOpenAI(base_url=settings.litellm_proxy_url)` — no code changes required to switch providers |
| **Cost tracking and rate limiting** | The proxy provides usage analytics across all 5 concurrent agent calls |
| **Model aliasing** | `LLM_MODEL=gpt-4o` in `.env` — changing the model used by all agents requires a single environment variable change |

---

### 6. GPT-4o (LLM Model)

**Provider:** OpenAI (via LiteLLM proxy)  
**Temperature:** 0.1 (all agents)

**Why GPT-4o:**

| Reason | Detail |
|---|---|
| **JSON instruction following** | GPT-4o reliably follows strict JSON-only output instructions without markdown fences or prose — critical for the structured evaluation format |
| **Long context window** | Resumes and job descriptions can be lengthy; GPT-4o handles these comfortably |
| **Reasoning quality** | Red flag detection and scoring require multi-step reasoning across disparate resume sections |

**Why `temperature=0.1`:** Resume evaluation is a factual, analytical task — not a creative one. Low temperature ensures that two identical resumes produce near-identical scores, which is essential for fair, reproducible hiring decisions.

---

### 7. pypdf (PDF Text Extraction)

**Version:** Latest stable  
**Usage:** `utils/pdf_parser.py` → `_parse_pdf()`

`pypdf` is a pure-Python PDF library that extracts text directly from PDF page content streams.

**Why pypdf:**

| Reason | Detail |
|---|---|
| **No system dependencies** | Works without Poppler, Ghostscript, or other native libraries — simpler deployment |
| **Sufficient for text PDFs** | The vast majority of modern resumes are text-based PDFs generated by Word, Google Docs, or LaTeX |
| **Maintained library** | Active development with Python 3.11+ compatibility |

**Limitation acknowledged:** pypdf cannot extract text from **scanned/image-based PDFs**. The parser raises `ValueError("The file may be scanned or image-based.")` which surfaces as HTTP 400 to the user. An OCR engine (e.g. Tesseract via `pytesseract`) would be needed to handle scanned documents — out of scope for this project.

---

### 8. python-docx (DOCX Text Extraction)

**Package name:** `python-docx`  
**Usage:** `utils/pdf_parser.py` → `_parse_docx()`

Extracts text from Microsoft Word `.docx` files by iterating `Document.paragraphs`.

**Why python-docx:** It is the standard library for DOCX manipulation in Python, actively maintained, and covers all paragraph-based text in modern Word resumes.

---

### 9. python-multipart (Multipart Form Parsing)

Required by FastAPI to parse `multipart/form-data` requests (file uploads). It is not called directly — FastAPI uses it internally when `UploadFile` parameters are declared.

---

### 10. lucide-react (Icon Library)

**Version:** 0.525.0  
**Usage:** UI icons throughout the dashboard (`Briefcase`, `Upload`, `FileText`, `History`, etc.)

Chosen for its clean SVG line-icon style that complements Tailwind's minimal aesthetic, and its tree-shakable package (only imported icons are bundled).

---

### 11. python-dotenv (Environment Variable Loader)

**Usage:** `config.py` → `load_dotenv()`

Loads `.env` file variables into `os.environ` at startup. Keeps secrets out of source code while maintaining simple local development workflow.

---

## Techniques

### 12. Multi-Agent Swarm Pattern

**What it is:** Multiple independent AI agents, each specialised for a narrow domain, run concurrently and their results are aggregated by a coordinator.

**How it is implemented:**

```
asyncio.create_task() × 4  ──→  [Experience] [Skills] [Education] [Red Flags]
                                      ↓ asyncio.Queue (stream-as-complete)
                                   [Scoring Agent]  ←── aggregates all 4 results
```

**Why this pattern:**
- **Specialisation:** Each agent has a single, focused system prompt — a generalist "evaluate this resume" prompt would produce lower quality outputs
- **Speed:** 4 parallel LLM calls complete in the time of the slowest single call, not 4× that time
- **Fault isolation:** One agent failing does not block others — partial results are still valuable

**Comparison to alternatives:**
- **Sequential chaining** — would multiply latency by 4×; unacceptable for a real-time dashboard
- **LangGraph** — would add significant complexity for a fixed 4-agent fan-out with no dynamic routing; `asyncio` is sufficient and more transparent
- **Single "super prompt"** — a single prompt asking for all 5 analyses would produce lower fidelity output and lose the ability to stream progressive results

---

### 13. Server-Sent Events (SSE) Streaming

**What it is:** A unidirectional HTTP streaming protocol where the server pushes events to the client over a long-lived connection.

**Why SSE over WebSockets:**

| Aspect | SSE | WebSocket |
|---|---|---|
| Direction | Server → Client only | Bidirectional |
| Protocol | HTTP/1.1 (`text/event-stream`) | WS upgrade |
| Reconnection | Automatic (built into browsers) | Manual |
| Complexity | Simple — `AsyncGenerator` on server, `EventSource` or `fetch + ReadableStream` on client | Requires connection lifecycle management |
| Fit for this use case | ✅ Perfect — server pushes results as they complete | Overkill — no client-to-server messages needed after submission |

**Event format:**

```
data: {"type": "experience", "data": {...}}\n\n
data: {"type": "skills", "data": {...}}\n\n
data: {"type": "education", "data": {...}}\n\n
data: {"type": "red_flags", "data": {...}}\n\n
data: {"type": "scoring", "data": {...}}\n\n
data: [DONE]\n\n
```

The `[DONE]` sentinel lets the frontend close the stream gracefully.

---

### 14. Prompt Engineering — Structured JSON Output

**Technique:** Every agent system prompt instructs the LLM to respond **only with valid JSON** matching a prescribed schema, with no markdown fences, no prose preamble, and no explanation.

**Why this works:**
- GPT-4o reliably follows strict output format instructions at `temperature=0.1`
- The backend never needs to parse natural language — it only processes structured data
- Each field is typed (integer, string, array, boolean) which maps directly to frontend component props

**Defensive fallback:** `json_parser.py` implements a three-pass JSON extraction strategy for the rare cases where the model adds a code fence or prefix text:
1. Strip markdown fences
2. Direct `json.loads()`
3. Substring extraction (`content[first_brace : last_brace + 1]`)

---

### 15. Prompt Chaining (Implicit)

**What it is:** The output of upstream agents feeds as input to the downstream Scoring Agent.

**How it is implemented:** The Scoring Agent receives the full result dictionaries from all 4 specialist agents as a serialised JSON block in its `HumanMessage`, along with the raw resume text and job description. This gives the Scoring Agent full context to:

1. Perform arithmetic scoring with all inputs
2. Cross-validate findings (e.g. a high skills match but many red flags)
3. Extract candidate contact info from the raw resume text

**Why not a LangChain chain:** The chaining logic here is a single step (collect 4 outputs → run 1 scoring call). LangChain's `SequentialChain` would add abstraction overhead without benefit. Plain `await run_scoring_agent(agent_results, resume_text, jd)` is clearer.

---

### 16. Async Fan-Out / Fan-In with `asyncio.Queue`

**What it is:** A concurrency pattern where multiple coroutines (fan-out) write results to a shared queue as they complete, and a consumer reads from the queue in completion order (fan-in).

**Why `asyncio.Queue` over `asyncio.gather()`:**

```python
# asyncio.gather() — waits for ALL tasks, returns in submission order
results = await asyncio.gather(task1, task2, task3, task4)

# asyncio.Queue — yields EACH result as it completes (stream-as-complete)
for _ in range(4):
    name, result = await queue.get()
    yield sse_event(name, result)   # ← streams immediately
```

`asyncio.gather()` would require all 4 agents to finish before streaming any result. The `Queue` approach enables true incremental streaming — the fastest agent's result appears in the UI first, regardless of which agent it is.

---

### 17. Client-Side State Machine

**What it is:** The React frontend models the application lifecycle as an explicit state machine with three phases: `"upload"` → `"screening"` → `"complete"`.

**Why a state machine:**
- Prevents invalid UI states (e.g. showing the dashboard before a file is submitted)
- `reset()` function resets all state cleanly, returning to `"upload"` phase without a page refresh
- Phase transitions are traceable and testable

---

### 18. LocalStorage Persistence for Candidate History

**What it is:** Candidate screening history is serialised as JSON and stored in `window.localStorage` under the key `capstone-candidate-history-v1`.

**Why localStorage:**
- No backend database required — keeps the architecture simple
- Persists across browser sessions and page refreshes
- Version-keyed (`-v1`) to allow clean migration if the schema changes
- The `useEffect` write-on-change pattern ensures history is always up to date

---

## Technology Stack Summary

| Category | Technology | Version | Purpose |
|---|---|---|---|
| Backend Framework | FastAPI | Latest | API server, SSE streaming |
| Backend Runtime | Python | 3.11+ | Async runtime |
| ASGI Server | Uvicorn | Standard | Serves FastAPI app |
| AI Framework | LangChain + LangChain-OpenAI | Latest | LLM client abstraction |
| LLM Model | GPT-4o | — | Resume analysis |
| LLM Gateway | LiteLLM Proxy | — | Centralised API routing |
| PDF Parsing | pypdf | Latest | Extract text from PDF resumes |
| DOCX Parsing | python-docx | Latest | Extract text from DOCX resumes |
| Frontend Framework | React | 18.3.1 | UI component rendering |
| Build Tool | Vite | 5.4.19 | Dev server, bundler, /api proxy |
| CSS Framework | Tailwind CSS | 3.4.17 | Utility-first styling |
| Icons | lucide-react | 0.525.0 | UI iconography |
| Environment Config | python-dotenv | Latest | `.env` loader |
| Multipart Parsing | python-multipart | Latest | File upload handling |
| Concurrency | asyncio (stdlib) | Python 3.11 | Parallel agent orchestration |
| Streaming | SSE / `text/event-stream` | HTTP/1.1 | Real-time result delivery |
| Persistence | localStorage | Browser API | Candidate history |
