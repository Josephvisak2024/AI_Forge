import json

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from config import settings
from utils.json_parser import parse_json_response

SYSTEM_PROMPT = """You are a senior HR scoring expert who aggregates multi-agent resume analysis into a final hiring decision.

SCORING WEIGHTS:
- Experience Analysis    → 30 points max  (scale alignment_score 0-10 to 0-30)
- Skills Matching        → 40 points max  (scale match_percentage 0-100 to 0-40)
- Education Verification → 20 points max  (Pass = 20 pts, Fail = proportional 0-15 pts)
- Red Flag Deductions    → up to -10 pts  (Low risk = 0, Medium = -5, High = -10)

RECOMMENDATION RULES:
- 90–100 → SHORTLISTED
- 70–89  → REVIEW REQUIRED
- 0–69   → REJECTED

Also extract the candidate's personal information from the provided resume text.

Respond ONLY with valid JSON in this exact structure (no extra text, no markdown code blocks):
{
  "candidate_name": "<Full Name extracted from resume>",
  "candidate_title": "<Professional title or specialization>",
  "location": "<City, State/Country or empty string>",
  "email": "<email address or empty string>",
  "linkedin": "<LinkedIn URL or handle or empty string>",
  "years_of_experience": "<e.g. 12+ Years Experience>",
  "experience_score": <integer 0-30>,
  "skills_score": <integer 0-40>,
  "education_score": <integer 0-20>,
  "red_flags_deduction": <integer -10 to 0>,
  "final_score": <integer 0-100>,
  "matched_requirements": <integer number of key requirements met>,
  "total_requirements": <integer total key requirements identified>,
  "recommendation": "<SHORTLISTED | REVIEW REQUIRED | REJECTED>",
  "tags": ["<Tag1>", "<Tag2>"],
  "summary": "<3-4 sentence executive summary of the overall candidate assessment>"
}

tags should reflect standout qualities such as \"Top 5%\", \"Fast Learner\", \"Cloud Expert\", \"Leadership Track\".
final_score must equal experience_score + skills_score + education_score + red_flags_deduction."""


async def run_scoring_agent(
    results: dict, resume_text: str = "", job_description: str = ""
) -> dict:
    llm = ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.litellm_api_key,
        base_url=settings.litellm_proxy_url,
        temperature=0.1,
    )

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(
            content=(
                f"RESUME TEXT:\n{resume_text}\n\n"
                f"JOB DESCRIPTION:\n{job_description}\n\n"
                "AGENT ANALYSIS RESULTS:\n"
                f"{json.dumps(results, indent=2)}\n\n"
                "Compute the final score, extract candidate information, and generate the recommendation."
            )
        ),
    ]
    response = await llm.ainvoke(messages)
    return parse_json_response(response.content)
