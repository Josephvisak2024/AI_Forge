# Code Walkthrough — HR Tech: Resume Screening Swarm

## Overview

This document provides a guided walkthrough of the codebase for the **Resume Screening Swarm** capstone project. It covers the project structure, every key module, design decisions, agent configurations, prompt strategies, and how all components interact.

---

## Project Structure

```
capstone/
├── backend/
│   ├── main.py                  # FastAPI app entry point — /api/screen SSE endpoint
│   ├── config.py                # Settings loader — reads .env for LLM credentials
│   ├── requirements.txt         # Python dependencies
│   ├── .env                     # LITELLM_PROXY_URL, LITELLM_API_KEY, LLM_MODEL
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── experience.py        # Work history & alignment scoring agent
│   │   ├── skills.py            # Skill gap analysis agent
│   │   ├── education.py         # Education verification agent
│   │   ├── red_flags.py         # Risk & red flag detection agent
│   │   └── scoring.py           # Final aggregation & recommendation agent
│   └── utils/
│       ├── __init__.py
│       ├── pdf_parser.py        # Resume text extraction (PDF + DOCX)
│       └── json_parser.py       # Robust JSON extraction from LLM responses
│
└── frontend/
    ├── vite.config.js           # Vite dev server — /api proxy to localhost:8000
    ├── package.json             # React 18, Tailwind CSS, lucide-react
    └── src/
        ├── App.jsx              # Root component — phase state machine
        ├── index.css            # Tailwind base styles
        ├── main.jsx             # ReactDOM entry point
        └── components/
            ├── UploadForm.jsx           # File upload + JD textarea
            ├── ScreeningDashboard.jsx   # Live results layout + progress bar
            ├── CandidateHeader.jsx      # Profile card
            ├── SuitabilityGauge.jsx     # Animated SVG score gauge
            ├── RiskAnalysis.jsx         # Red flags 3-panel cards
            ├── SkillMatrix.jsx          # Skill bars + chip lists
            ├── ProfessionalJourney.jsx  # Work history timeline
            ├── EducationPanel.jsx       # Degrees + certifications
            ├── FinalRecommendation.jsx  # Recommendation banner
            ├── CandidateHistory.jsx     # Persistent screening history panel
            └── RejectModal.jsx          # Rejection reason modal
```

---

## Backend

### `config.py` — Settings Loader

**Purpose:** Centralises all environment configuration and fails fast if credentials are missing.

```python
class Settings:
    def __init__(self) -> None:
        api_key = os.getenv("LITELLM_API_KEY", "").strip()
        proxy_url = os.getenv("LITELLM_PROXY_URL", "https://litellm.amzur.com").strip()

        if not api_key:
            api_key = os.getenv("OPENAI_API_KEY", "").strip()   # fallback

        if not api_key:
            raise RuntimeError("LITELLM_API_KEY is missing.")

        self.litellm_api_key = api_key
        self.litellm_proxy_url = proxy_url
        self.llm_model = os.getenv("LLM_MODEL", "gpt-4o").strip()

settings = Settings()
```

**Design decision:** `settings` is a module-level singleton, loaded once at startup. Every agent imports `settings` directly — no dependency injection overhead for this scale. A `RuntimeError` on startup is intentional: it prevents the server from booting in a broken state.

---

### `main.py` — FastAPI App & Async Orchestrator

This is the core of the backend. It has two responsibilities:

#### 1. FastAPI Application Bootstrap

```python
app = FastAPI(title="Resume Screening Swarm", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)
```

CORS is set to `allow_origins=["*"]` to allow the Vite dev server (port 5174) to call the API (port 8000) without cross-origin errors during development.

#### 2. `POST /api/screen` — Main Endpoint

Input validation is performed in strict order:

```python
# 1. MIME type check
if resume.content_type not in {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}:
    raise HTTPException(400, "Only PDF and DOCX files are accepted.")

# 2. File size check
if len(contents) > 5 * 1024 * 1024:
    raise HTTPException(400, "File size must not exceed 5 MB.")

# 3. Job description length
if len(job_description) < 500 or len(job_description) > 3000:
    raise HTTPException(400, "...")
```

After validation, the endpoint returns a `StreamingResponse`:

```python
return StreamingResponse(
    screen_stream(resume_text, job_description),
    media_type="text/event-stream",
    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
)
```

#### 3. `screen_stream()` — The Async Orchestrator

This is the most architecturally significant function. It implements a **fan-out / fan-in** pattern:

```python
async def screen_stream(resume_text, job_description) -> AsyncGenerator[str, None]:
    queue = asyncio.Queue()

    async def run_and_enqueue(name, coro):
        try:
            result = await coro
        except Exception as exc:
            result = {"error": str(exc)}   # partial failure isolation
        await queue.put((name, result))

    # Fan-out: fire all 4 agents concurrently
    tasks = [
        asyncio.create_task(run_and_enqueue("experience", run_experience_agent(...))),
        asyncio.create_task(run_and_enqueue("skills",     run_skills_agent(...))),
        asyncio.create_task(run_and_enqueue("education",  run_education_agent(...))),
        asyncio.create_task(run_and_enqueue("red_flags",  run_red_flags_agent(...))),
    ]

    # Fan-in: yield each result as it arrives (real-time SSE)
    agent_results = {}
    for _ in range(4):
        name, result = await queue.get()   # blocks until next agent completes
        agent_results[name] = result
        yield sse_event(name, result)      # stream immediately to frontend

    # Ensure all tasks done before scoring
    await asyncio.gather(*tasks, return_exceptions=True)

    # Sequential: scoring runs only after all 4 complete
    scoring_result = await run_scoring_agent(agent_results, resume_text, job_description)
    yield sse_event("scoring", scoring_result)
    yield "data: [DONE]\n\n"
```

**Key design decisions:**
- `asyncio.Queue` decouples agent completion from result consumption — whichever agent finishes first is yielded first.
- Each agent is wrapped in `run_and_enqueue` so a single agent failure does not abort the entire stream.
- `asyncio.gather(*tasks, return_exceptions=True)` before scoring ensures no background tasks leak.
- The Scoring Agent runs **after** all 4 — it needs their results as input.

#### SSE Event Format

```python
def sse_event(event_type: str, data: dict) -> str:
    payload = json.dumps({"type": event_type, "data": data}, ensure_ascii=False)
    return f"data: {payload}\n\n"
```

The double newline `\n\n` is the SSE protocol's event delimiter.

---

### `utils/pdf_parser.py` — Resume Parser

**Purpose:** Extracts plain text from uploaded resumes regardless of format.

```python
def parse_resume(contents: bytes, filename: str) -> str:
    if filename.lower().endswith(".pdf"):
        return _parse_pdf(contents)
    elif filename.lower().endswith(".docx"):
        return _parse_docx(contents)
```

- **PDF** — uses `pypdf.PdfReader`, iterates pages, joins text. Raises `ValueError` if no text is extractable (e.g. scanned/image PDFs).
- **DOCX** — uses `python-docx.Document`, iterates paragraphs, strips empty lines.

**Design decision:** The parser raises early with a descriptive error. The calling endpoint catches it and returns HTTP 400, keeping error messages user-friendly.

---

### `utils/json_parser.py` — Robust JSON Extractor

**Purpose:** LLMs occasionally wrap JSON responses in markdown code fences (` ```json `) or add leading prose. This utility handles all such cases.

```python
def parse_json_response(content: str) -> dict:
    content = content.strip()

    # Strip markdown fences: ```json ... ``` or ``` ... ```
    if content.startswith("```"):
        lines = content.splitlines()[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        content = "\n".join(lines).strip()

    # Attempt direct parse
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # Fallback: find first { ... last } and extract
    start, end = content.find("{"), content.rfind("}") + 1
    if start != -1 and end > start:
        return json.loads(content[start:end])

    return {"error": "Failed to parse agent response", "raw": content[:500]}
```

**Design decision:** The three-pass strategy (clean → direct parse → substring extraction) handles >99% of real LLM output variations without resorting to regex or expensive re-prompting.

---

## Agents

All 5 agents share the same structural pattern:

1. Instantiate `ChatOpenAI` with credentials from `settings`
2. Build a `[SystemMessage, HumanMessage]` message list
3. Call `await llm.ainvoke(messages)` (async, non-blocking)
4. Pass response content through `parse_json_response()`
5. Return a `dict`

This consistent pattern means each agent is independently testable and replaceable.

### Agent Configuration (shared across all agents)

```python
llm = ChatOpenAI(
    model=settings.llm_model,           # "gpt-4o"
    api_key=settings.litellm_api_key,
    base_url=settings.litellm_proxy_url, # routes through LiteLLM proxy
    temperature=0.1,                     # low temperature for consistent structured output
)
```

`temperature=0.1` is a deliberate choice — evaluation tasks require deterministic, factual analysis rather than creative variation.

---

### `agents/experience.py` — Experience Agent

**Role:** Expert HR analyst evaluating work history.

**System prompt strategy:** The prompt constrains output to a single strict JSON schema and instructs the model to include "up to 4–5 most recent significant roles". This prevents token bloat while retaining relevant signal.

**Key output fields:**
```json
{
  "years_of_experience": "8+ years",
  "current_role": "Senior Software Engineer",
  "alignment_score": 8,
  "work_history": [{ "title": "...", "company": "...", "period": "...", "description": "..." }],
  "summary": "..."
}
```

`alignment_score` (0–10) is later scaled to 0–30 by the Scoring Agent.

---

### `agents/skills.py` — Skills Agent

**Role:** Technical recruiter performing skills gap analysis.

**Prompt strategy:** Instructs the model to extract 4–6 key technical skill categories as concise uppercase labels (e.g. `"KUBERNETES / DOCKER"`, `"AWS ARCHITECTURE"`). This normalises the output for consistent UI bar rendering.

**Key output fields:**
```json
{
  "match_percentage": 72,
  "matching_skills": ["Python", "FastAPI"],
  "missing_skills": ["Kubernetes", "Terraform"],
  "skill_scores": [{ "name": "PYTHON / ML", "score": 90 }],
  "skill_gap_analysis": "..."
}
```

`match_percentage` (0–100) is scaled to 0–40 by the Scoring Agent.

---

### `agents/education.py` — Education Agent

**Role:** Education background verification specialist.

**Prompt strategy:** Explicitly instructs the model to extract **every level of education** including SSC (10th grade) and Intermediate (12th grade), sorted chronologically. The `level` field uses a controlled vocabulary (`SSC | INTERMEDIATE | BACHELOR | MASTER | DOCTORATE | DIPLOMA | OTHER`) to ensure UI components can render appropriate badges.

**Key output fields:**
```json
{
  "result": "PASS",
  "degrees": [{ "degree": "B.Tech Computer Science", "institution": "...", "year": "2018", "grade": "8.2 CGPA", "level": "BACHELOR", "verified": true }],
  "certifications": ["AWS Solutions Architect"],
  "meets_requirements": true,
  "analysis": "..."
}
```

Education scoring: PASS = 20 pts, proportional for FAIL (0–15 pts).

---

### `agents/red_flags.py` — Red Flags Agent

**Role:** HR risk analyst detecting hiring concerns.

**Prompt strategy:** The prompt enumerates exactly what to look for — job hopping (< 1 year roles), gaps (> 6 months), timeline inconsistencies, and skills inconsistencies. This specificity prevents the model from inventing new risk categories.

**Key output fields:**
```json
{
  "overall_risk": "Medium",
  "tenure_stability": { "status": "PASS", "detail": "..." },
  "skills_authenticity": { "status": "WARNING", "detail": "..." },
  "employment_gaps": { "status": "FAIL", "detail": "14-month gap 2021–2022" },
  "flags": [{ "type": "Employment Gap", "description": "...", "severity": "High" }],
  "summary": "..."
}
```

`overall_risk` maps to deductions: Low = 0, Medium = −5, High = −10.

---

### `agents/scoring.py` — Scoring Agent

**Role:** Senior HR expert aggregating all sub-agent results into a final hiring decision.

**Prompt strategy:** The system prompt includes explicit **scoring weights** and **recommendation thresholds** so the model produces deterministic arithmetic:

```
Experience Analysis  → 30 pts max  (scale alignment_score 0–10 to 0–30)
Skills Matching      → 40 pts max  (scale match_percentage 0–100 to 0–40)
Education            → 20 pts max  (PASS = 20, FAIL = proportional 0–15)
Red Flag Deductions  → up to −10   (Low=0, Medium=−5, High=−10)
```

The prompt also requires the model to **extract candidate contact info** from the raw resume text (name, email, location, LinkedIn), making the Scoring Agent serve double duty as a structured information extractor.

**Key constraint in prompt:** `"final_score must equal experience_score + skills_score + education_score + red_flags_deduction"` — this prevents arithmetic inconsistencies.

---

## Frontend

### `App.jsx` — Root State Machine

The application is a three-phase state machine:

```
"upload"  →  "screening"  →  "complete"
```

**State managed by `App.jsx`:**

| State variable | Type | Purpose |
|---|---|---|
| `phase` | string | Current app phase |
| `agentResults` | object | Accumulated SSE results keyed by agent name |
| `agentStatus` | object | Per-agent loading state (`"loading"` / `"done"`) |
| `scoring` | object | Final scoring agent result |
| `candidates` | array | Persistent screening history (synced to localStorage) |
| `showRejectModal` | boolean | Controls RejectModal visibility |

**SSE consumption pattern in `App.jsx`:**

```javascript
const es = new EventSource(/* no — App uses fetch + ReadableStream */);
// Uses fetch() with response.body.getReader() to consume SSE:
const reader = response.body.getReader();
while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    // parse "data: {...}\n\n" lines
    // dispatch to setAgentResults / setScoring based on event type
}
```

**History persistence:**

```javascript
const HISTORY_STORAGE_KEY = "capstone-candidate-history-v1";

// Read on mount
useEffect(() => {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    setCandidates(JSON.parse(raw));
}, []);

// Write on every change
useEffect(() => {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(candidates));
}, [candidates]);
```

---

### `components/UploadForm.jsx` — Upload Screen

- Dual-mode file input: click-to-browse and drag-and-drop (`onDrop`, `onDragOver`, `onDragLeave`)
- Client-side validation mirrors backend validation (same limits) to give instant feedback
- Character counter for JD textarea updates on every keystroke
- Submit button disabled when either input fails validation

---

### `components/ScreeningDashboard.jsx` — Live Dashboard

- Receives `agentResults`, `agentStatus`, `scoring` as props from `App.jsx`
- Renders only panels whose data has arrived (conditional rendering on each result key)
- Progress bar formula: `(completedAgents + (scoring ? 1 : 0)) / 5 * 100`
- Recommendation colour theme computed from `REC_STYLES` map keyed by `scoring.recommendation`

---

### `components/SuitabilityGauge.jsx` — SVG Score Gauge

An animated semicircular SVG gauge. The arc length is computed from `final_score` and animated via CSS transitions. Colour transitions: red (< 70) → amber (70–89) → emerald (≥ 90).

---

### `vite.config.js` — Dev Proxy

```javascript
proxy: {
    "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
    },
}
```

All `/api/*` requests from the React dev server are transparently forwarded to FastAPI on port 8000. This eliminates CORS issues during development and means the frontend code never hardcodes the backend URL.

---

## Inter-Component Data Flow

```
App.jsx
  │  fetch POST /api/screen  →  FastAPI :8000
  │  ← SSE stream (event by event)
  │
  ├── setAgentResults({ experience: {...} })  ← on "experience" event
  ├── setAgentResults({ skills: {...} })      ← on "skills" event
  ├── setAgentResults({ education: {...} })   ← on "education" event
  ├── setAgentResults({ red_flags: {...} })   ← on "red_flags" event
  └── setScoring({...})                       ← on "scoring" event
        │
        ├─ props → ScreeningDashboard
        │              ├─ props → CandidateHeader    (scoring)
        │              ├─ props → SuitabilityGauge   (scoring.final_score)
        │              ├─ props → ProfessionalJourney (agentResults.experience)
        │              ├─ props → SkillMatrix         (agentResults.skills)
        │              ├─ props → EducationPanel      (agentResults.education)
        │              ├─ props → RiskAnalysis        (agentResults.red_flags)
        │              └─ props → FinalRecommendation (scoring.recommendation)
        │
        └─ history saved via handleShortlist / handleRejectConfirm
```

---

## Key Design Decisions Summary

| Decision | Rationale |
|---|---|
| `asyncio.Queue` for fan-in | Enables true stream-as-complete — no waiting for all agents to finish before streaming |
| Each agent is isolated (try/except in `run_and_enqueue`) | One failed LLM call doesn't abort the entire screening |
| `temperature=0.1` for all agents | Evaluation tasks need consistent, factual outputs — not creative variation |
| Strict JSON-only prompts | Eliminates post-processing ambiguity; `json_parser.py` handles the rare deviations |
| Scoring Agent runs last, sequentially | It requires all 4 sub-results as input; running it in parallel would be incorrect |
| Frontend re-validates file/JD on client | Immediate UX feedback; avoids wasting backend resources on clearly invalid inputs |
| `localStorage` for history | Keeps the stack simple (no database needed for this scale); persists across sessions |
| Vite proxy for `/api` | Decouples frontend origin from backend origin; production-deployable without code changes |
