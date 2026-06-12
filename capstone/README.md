# Capstone Project — HR Tech: Resume Screening Swarm

An AI-powered resume screening system that runs **5 specialist agents in parallel** to evaluate a candidate's resume against a job description and produce a structured hiring recommendation in real time.

---

## Architecture Overview

```
Frontend (React + Vite)
       │
       │  POST /api/screen  (multipart: resume file + job description)
       ▼
Backend (FastAPI)
       │
       ├── asyncio.create_task() ──► Experience Agent
       ├── asyncio.create_task() ──► Skills Agent
       ├── asyncio.create_task() ──► Education Agent
       ├── asyncio.create_task() ──► Red Flags Agent
       │         (all 4 run in parallel via asyncio.Queue)
       │
       └── Scoring Agent  (aggregates all 4 results + resume + JD)
                │
                └── SSE stream → Frontend (real-time dashboard)
```

Each agent result is streamed to the frontend **as it completes** via **Server-Sent Events (SSE)**. The dashboard updates progressively — panels appear one by one as agents finish.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS v3.4, lucide-react |
| Backend | FastAPI, Python 3.11+, uvicorn |
| AI Orchestration | LangChain + LangChain-OpenAI |
| LLM Gateway | Amzur LiteLLM Proxy (`litellm.amzur.com`) → `gpt-4o` |
| Resume Parsing | `pypdf` (PDF), `python-docx` (DOCX) |
| Streaming | Server-Sent Events (`text/event-stream`) |

---

## Project Structure

```
capstone/
├── backend/
│   ├── main.py                 # FastAPI app, /api/screen SSE endpoint
│   ├── config.py               # Settings (LiteLLM URL, API key, model)
│   ├── requirements.txt
│   ├── .env                    # LITELLM_PROXY_URL, LITELLM_API_KEY, LLM_MODEL
│   ├── agents/
│   │   ├── experience.py       # Work history, years of experience, alignment score
│   │   ├── skills.py           # Skill gap analysis, match %, skill scores
│   │   ├── education.py        # Degrees, certifications, PASS/FAIL
│   │   ├── red_flags.py        # Tenure stability, skills authenticity, employment gaps
│   │   └── scoring.py          # Final aggregation → recommendation + score
│   └── utils/
│       ├── pdf_parser.py       # Resume text extraction (PDF + DOCX)
│       └── json_parser.py      # Robust JSON extraction from LLM responses
│
└── frontend/
    ├── vite.config.js           # Vite dev server with /api proxy → localhost:8000
    ├── package.json
    └── src/
        ├── App.jsx              # Root — phase state machine (upload → screening → complete)
        ├── components/
        │   ├── UploadForm.jsx           # Drag-and-drop resume upload + JD textarea
        │   ├── ScreeningDashboard.jsx   # Main results layout + live agent progress bar
        │   ├── CandidateHeader.jsx      # Profile card (avatar, name, title, contacts)
        │   ├── SuitabilityGauge.jsx     # Animated SVG semicircular score gauge
        │   ├── RiskAnalysis.jsx         # 3-panel risk assessment cards
        │   ├── SkillMatrix.jsx          # Animated skill bars + missing skills chips
        │   ├── ProfessionalJourney.jsx  # Work history timeline
        │   └── EducationPanel.jsx       # Degrees + certifications panels
        └── types/
```

---

## Agent Details

### 1. Experience Agent
Evaluates work history against job requirements.  
**Output:** `years_of_experience`, `alignment_score` (0–100), `work_history[]`, `current_role`, `relevant_experience`, `summary`

### 2. Skills Agent
Performs skill gap analysis.  
**Output:** `match_percentage`, `skill_scores[]` (category bars), `matching_skills[]`, `missing_skills[]`, `skill_gap_analysis`

### 3. Education Agent
Verifies academic qualifications.  
**Output:** `degrees[]`, `certifications[]`, `result` (PASS/FAIL), `meets_requirements`, `analysis`

### 4. Red Flags Agent
Detects hiring risks.  
**Output:** `tenure_stability`, `skills_authenticity`, `employment_gaps` (each with PASS/WARNING/FAIL + detail), `overall_risk`, `flags[]`, `summary`

### 5. Scoring Agent *(runs after all 4 complete)*
Aggregates results and extracts candidate info from the resume.  
**Output:** `candidate_name`, `candidate_title`, `location`, `email`, `final_score`, `recommendation`, `experience_score`, `skills_score`, `education_score`, `red_flags_deduction`, `tags[]`, `summary`

---

## Recommendation Thresholds

| Score | Recommendation | UI Color |
|---|---|---|
| 90 – 100 | **SHORTLISTED** | Green (emerald) |
| 70 – 89 | **REVIEW REQUIRED** | Amber |
| 0 – 69 | **REJECTED** | Red |

---

## SSE Event Format

Every event from the backend follows this structure:

```json
{ "type": "experience" | "skills" | "education" | "red_flags" | "scoring", "data": { ... } }
```

The stream ends with:
```
data: [DONE]
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Access to the Amzur LiteLLM proxy

### Backend

```bash
cd capstone/backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
# Create .env with LITELLM_PROXY_URL, LITELLM_API_KEY, LLM_MODEL
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd capstone/frontend
npm install
npm run dev
# Runs on http://localhost:5174
# /api requests are proxied to http://localhost:8000
```

### Input Validation
- **Resume:** PDF or DOCX, max 5 MB
- **Job Description:** 500–3000 characters

---

## Environment Variables (`.env`)

```env
LITELLM_PROXY_URL=https://litellm.amzur.com
LITELLM_API_KEY=your-api-key-here
LLM_MODEL=gpt-4o
```
