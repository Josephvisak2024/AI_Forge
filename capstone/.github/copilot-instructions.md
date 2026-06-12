# Copilot Instructions — Capstone: HR Tech Resume Screening Swarm

## Project Overview

This is an **AI-powered resume screening system** using a multi-agent swarm pattern. Five LangChain agents run in parallel (via `asyncio.gather`) to evaluate a resume against a job description and stream results in real time to a React dashboard via **Server-Sent Events (SSE)**.

All AI calls route exclusively through the **Amzur LiteLLM proxy** at `litellm.amzur.com`. Do **not** call OpenAI, Google, or Anthropic directly.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS v3.4, lucide-react |
| Backend | FastAPI, Python 3.11+, uvicorn |
| AI | LangChain, langchain-openai, LiteLLM proxy → `gpt-4o` |
| Streaming | Server-Sent Events (`text/event-stream`) |
| Resume Parsing | `pypdf` (PDF), `python-docx` (DOCX) |

---

## Repository Structure

```
capstone/
├── backend/
│   ├── main.py          # FastAPI app — /api/screen SSE endpoint
│   ├── config.py        # Settings loaded from .env
│   ├── .env             # LITELLM_PROXY_URL, LITELLM_API_KEY, LLM_MODEL
│   ├── agents/
│   │   ├── experience.py
│   │   ├── skills.py
│   │   ├── education.py
│   │   ├── red_flags.py
│   │   └── scoring.py
│   └── utils/
│       ├── pdf_parser.py
│       └── json_parser.py
└── frontend/
    └── src/
        ├── App.jsx
        └── components/
            ├── UploadForm.jsx
            ├── ScreeningDashboard.jsx
            ├── CandidateHeader.jsx
            ├── SuitabilityGauge.jsx
            ├── RiskAnalysis.jsx
            ├── SkillMatrix.jsx
            ├── ProfessionalJourney.jsx
            └── EducationPanel.jsx
```

---

## Coding Conventions

### Backend (Python / FastAPI)

- **LLM client**: Always instantiate via `ChatOpenAI` with `base_url=settings.litellm_proxy_url`, `api_key=settings.litellm_api_key`, `model=settings.llm_model`, `temperature=0.1`.
- **Agent pattern**: Each agent is an `async def run_*_agent(resume_text, job_description) -> dict` function. It calls the LLM, parses JSON from the response using `parse_json_response()`, and returns a plain dict.
- **JSON parsing**: Always use `utils/json_parser.py → parse_json_response(content)` to extract JSON from LLM responses. It handles markdown code fences.
- **Streaming**: The `/api/screen` endpoint uses `StreamingResponse` with `media_type="text/event-stream"`. Each SSE event is formatted as `data: {json}\n\n`. The stream ends with `data: [DONE]\n\n`.
- **Swarm execution**: 4 agents run in parallel via `asyncio.Queue` + `asyncio.create_task()`. Each task puts its result into the queue as it completes. The main coroutine reads from the queue and yields SSE events. The Scoring Agent runs last with all 4 results.
- **Validation**: Resume must be PDF or DOCX, max 5 MB. Job description must be 500–3000 characters. Return `HTTPException(status_code=400)` for violations.
- **CORS**: `allow_origins=["*"]` — this is an internal dev tool.

### Frontend (React / Vite / Tailwind)

- **SSE parsing**: In `App.jsx`, use `fetch()` + `response.body.getReader()`. Split chunks on `"\n"`, filter lines starting with `"data: "`, strip the prefix, skip `"[DONE]"`, then `JSON.parse()` the remaining payload as `{type, data}`.
- **State**: `agentResults` (object keyed by agent type), `agentStatus` (object mapping agent → `"running"|"complete"`), `scoring` (final score object), `phase` (`"upload"|"screening"|"complete"`).
- **Component props**: 
  - `ScreeningDashboard` receives `{ agentResults, agentStatus, scoring, isComplete, onReset }`
  - `RiskAnalysis` receives `{ redFlags }` (from `agentResults.red_flags`)
  - `SkillMatrix` receives `{ skills }` (from `agentResults.skills`)
  - `ProfessionalJourney` receives `{ experience }` (from `agentResults.experience`)
  - `EducationPanel` receives `{ education }` (from `agentResults.education`)
- **Tailwind**: Use v3.4 utility classes. Color-code by recommendation: emerald = SHORTLISTED, amber = REVIEW REQUIRED, red = REJECTED.
- **Vite proxy**: `/api` → `http://localhost:8000` (configured in `vite.config.js`).

---

## Agent Output Schemas

### Experience Agent
```json
{
  "years_of_experience": 5,
  "alignment_score": 82,
  "current_role": "Senior Developer at Acme",
  "work_history": [{ "title": "", "company": "", "period": "", "description": "" }],
  "relevant_experience": "...",
  "summary": "..."
}
```

### Skills Agent
```json
{
  "match_percentage": 75,
  "skill_scores": [{ "name": "PYTHON", "score": 90 }],
  "matching_skills": ["Python", "FastAPI"],
  "missing_skills": ["Kubernetes"],
  "skill_gap_analysis": "..."
}
```

### Education Agent
```json
{
  "degrees": [{ "degree": "B.Tech CS", "institution": "IIT", "year": "2019", "verified": true }],
  "certifications": ["AWS Solutions Architect"],
  "result": "PASS",
  "meets_requirements": true,
  "analysis": "..."
}
```

### Red Flags Agent
```json
{
  "tenure_stability": { "status": "PASS", "detail": "..." },
  "skills_authenticity": { "status": "WARNING", "detail": "..." },
  "employment_gaps": { "status": "PASS", "detail": "..." },
  "overall_risk": "LOW",
  "flags_found": 0,
  "flags": [],
  "summary": "..."
}
```

### Scoring Agent
```json
{
  "candidate_name": "Jane Doe",
  "candidate_title": "Senior Engineer",
  "location": "Hyderabad, India",
  "email": "jane@example.com",
  "linkedin": "linkedin.com/in/janedoe",
  "years_of_experience": 5,
  "experience_score": 80,
  "skills_score": 75,
  "education_score": 90,
  "red_flags_deduction": 0,
  "final_score": 82,
  "recommendation": "REVIEW REQUIRED",
  "matched_requirements": 8,
  "total_requirements": 10,
  "tags": ["Python", "FastAPI"],
  "summary": "..."
}
```

---

## Recommendation Thresholds

| `final_score` | `recommendation` |
|---|---|
| 90 – 100 | `SHORTLISTED` |
| 70 – 89 | `REVIEW REQUIRED` |
| 0 – 69 | `REJECTED` |

---

## Running Locally

```bash
# Backend
cd capstone/backend
uvicorn main:app --reload --port 8000

# Frontend
cd capstone/frontend
npm run dev          # http://localhost:5174
```
