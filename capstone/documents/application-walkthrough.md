# Application Walkthrough — HR Tech: Resume Screening Swarm

## Overview

This document provides a step-by-step walkthrough of the **Resume Screening Swarm** application — an AI-powered hiring tool that runs **5 specialist agents in parallel** to evaluate a candidate's resume against a job description and produce a structured, scored hiring recommendation in real time.

---

## Pre-requisites Before Demo

| Item | Value |
|---|---|
| Backend URL | `http://localhost:8000` |
| Frontend URL | `http://localhost:5174` |
| Resume format | PDF or DOCX, max 5 MB |
| Job Description | 500–3000 characters |

Start the backend:
```bash
cd capstone/backend
uvicorn main:app --reload --port 8000
```

Start the frontend:
```bash
cd capstone/frontend
npm run dev
# Opens on http://localhost:5174
```

---

## End-to-End Workflow

### Phase 1 — Upload Screen

**URL:** `http://localhost:5174`

On first load the application presents the **Upload Form**, which has three key areas:

#### 1. Statistics Bar (Top)
Shows historical screening stats sourced from `localStorage`:
- **Candidates Screened** — total count
- **Shortlisted** — green count
- **Rejected** — red count

These persist across browser sessions via `localStorage` key `capstone-candidate-history-v1`.

#### 2. Agent Preview Panel
Before any upload, the form lists the 5 agents that will run:

| Agent | Description |
|---|---|
| 💼 Experience | Work history vs requirements |
| ⚡ Skills Match | Technical skills gap analysis |
| 🎓 Education | Qualification verification |
| 🚩 Red Flags | Risk & consistency check |
| 🏆 Final Score | Aggregated recommendation |

#### 3. Upload Controls
- **Drag-and-drop zone** — accepts `.pdf` and `.docx` files
  - Shows file name and size upon selection
  - Validates file type and rejects anything other than PDF/DOCX
  - Enforces 5 MB maximum file size with an inline error message
- **Job Description textarea** — free-text input
  - Live character counter
  - Minimum 500 characters enforced (button disabled below threshold)
  - Maximum 3000 characters enforced

**Action:** Drop a resume PDF into the drop zone, paste the job description, and click **"Screen Candidate"**.

---

### Phase 2 — Real-Time Screening Dashboard

After submission, the application transitions to the **Screening Dashboard**. The frontend sends:

```
POST /api/screen
Content-Type: multipart/form-data
  resume: <binary file>
  jobDescription: <string>
```

The backend responds immediately with a **Server-Sent Events (SSE)** stream (`text/event-stream`). The dashboard updates **progressively** as each agent completes.

#### Progress Bar
A sticky header shows a live progress bar:
- 5 total steps (4 parallel agents + 1 scoring agent)
- Each step completion increments the bar in real time
- Displays agent completion status: e.g. `2 / 5 agents done`

#### Live Panel Appearance
Each SSE event carries `{ "type": "<agent>", "data": { ... } }`. As events arrive, panels appear:

##### Step 1 — Experience Panel (arrives first or in any order)
Populated by the **Experience Agent**:
- `years_of_experience` — e.g. "8+ years"
- `current_role` — most recent job title
- `alignment_score` — integer 0–10 (displayed as a score chip)
- `work_history[]` — timeline of up to 4–5 roles, each with title, company, period, and description
- `summary` — 2–3 sentence assessment

**UI Component:** `ProfessionalJourney.jsx` — renders a vertical timeline of work history cards.

##### Step 2 — Skills Panel
Populated by the **Skills Agent**:
- `match_percentage` — integer 0–100
- `skill_scores[]` — 4–6 category bars with uppercase labels (e.g. "KUBERNETES / DOCKER") and scores
- `matching_skills[]` — green chip list
- `missing_skills[]` — red chip list
- `skill_gap_analysis` — narrative summary

**UI Component:** `SkillMatrix.jsx` — animated horizontal bars with skill chips.

##### Step 3 — Education Panel
Populated by the **Education Agent**:
- `degrees[]` — sorted oldest to newest (SSC → Intermediate → Bachelor → Master), each with degree name, institution, year, grade, level, and verified flag
- `certifications[]` — list of certs
- `result` — PASS or FAIL badge
- `meets_requirements` — boolean
- `analysis` — explanation

**UI Component:** `EducationPanel.jsx` — degree cards with level badges + certification chips.

##### Step 4 — Risk Analysis Panel
Populated by the **Red Flags Agent**:
- `overall_risk` — Low / Medium / High
- Three sub-checks, each with a PASS / WARNING / FAIL status and detail text:
  - `tenure_stability` — job-hopping detection
  - `skills_authenticity` — skills vs experience consistency
  - `employment_gaps` — unexplained gap detection
- `flags[]` — individual flags with type, description, and severity
- `summary` — risk narrative

**UI Component:** `RiskAnalysis.jsx` — three colour-coded status cards.

##### Step 5 — Scoring & Final Recommendation (last)
After all 4 parallel agents complete, the **Scoring Agent** runs sequentially and streams the final result:
- `candidate_name`, `candidate_title`, `location`, `email`, `linkedin` — extracted directly from resume text
- Component scores:
  - `experience_score` — 0–30 pts
  - `skills_score` — 0–40 pts
  - `education_score` — 0–20 pts
  - `red_flags_deduction` — −10 to 0 pts
- `final_score` — sum of all components (0–100)
- `recommendation` — SHORTLISTED / REVIEW REQUIRED / REJECTED
- `tags[]` — standout quality tags (e.g. "Top 5%", "Cloud Expert")
- `summary` — executive hiring summary

**UI Components:**
- `CandidateHeader.jsx` — avatar, name, title, location, email, LinkedIn
- `SuitabilityGauge.jsx` — animated SVG semicircular gauge showing `final_score`
- `FinalRecommendation.jsx` — full-width recommendation banner

The recommendation banner is colour-coded:
| Score | Recommendation | Color |
|---|---|---|
| 90–100 | **SHORTLISTED** | Emerald green |
| 70–89 | **REVIEW REQUIRED** | Amber |
| 0–69 | **REJECTED** | Red |

---

### Phase 3 — Hiring Decision

Once screening completes, two action buttons appear:

#### Shortlist
Clicking **"Shortlist"** saves the candidate to history with `decision: "SHORTLISTED"` and resets the app to the upload screen. The statistics bar increments the shortlisted count.

#### Reject
Clicking **"Reject"** opens the **RejectModal** (`RejectModal.jsx`), which prompts for:
- A rejection reason code (dropdown)
- Optional notes

On confirmation, the candidate is saved with `decision: "REJECTED"` and a rejection reason.

---

### Phase 4 — Candidate History

Clicking **"View History"** opens the **CandidateHistory** (`CandidateHistory.jsx`) panel, which shows all previously screened candidates stored in `localStorage`. Each history entry shows:
- Candidate name, title, and final score
- Recommendation badge
- Screening timestamp
- Decision (Shortlisted / Rejected) with rejection reason if applicable

History persists across sessions and browser refreshes.

---

## SSE Stream Format Reference

Every event from the backend follows this structure:

```json
{ "type": "experience" | "skills" | "education" | "red_flags" | "scoring", "data": { ... } }
```

The stream terminates with:
```
data: [DONE]
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Non-PDF/DOCX file | Inline error on drop zone |
| File > 5 MB | Inline error on drop zone |
| JD < 500 chars | Submit button disabled + char counter shows red |
| Backend returns HTTP 4xx | Error banner shown on dashboard |
| Agent LLM failure | Agent result contains `{"error": "<message>"}`, other agents continue |
| Scanned/image PDF | Backend returns 400: "Could not extract text from PDF" |

---

## Key Real Outputs Demonstrated

The application does **not** use mocked data. All outputs are generated live by GPT-4o via the Amzur LiteLLM Proxy. Examples of real outputs include:

- A `final_score` of 87 resulting in a **"REVIEW REQUIRED"** amber banner
- Skills bars showing "PYTHON / ML" at 90%, "KUBERNETES / DOCKER" at 45%
- A red flag for a 14-month employment gap between 2021–2022
- Education timeline showing B.Tech → M.Tech with grades and institutions
- Work history timeline with 4 roles and key achievements per role
