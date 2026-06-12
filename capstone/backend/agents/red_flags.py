from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from config import settings
from utils.json_parser import parse_json_response

SYSTEM_PROMPT = """You are an HR risk analyst specializing in resume red flag detection.
Analyze the candidate's resume for potential concerns.

Look for:
- Job hopping: roles held for less than 1 year
- Employment gaps: unexplained gaps longer than 6 months
- Timeline inconsistencies: overlapping roles or missing dates
- Skills inconsistencies: stated skills that contradict experience level

Respond ONLY with valid JSON in this exact structure (no extra text, no markdown code blocks):
{
  "overall_risk": "<Low | Medium | High>",
  "flags_found": <integer count>,
  "tenure_stability": {
    "status": "<PASS | WARNING | FAIL>",
    "detail": "<1-2 sentence finding about job tenure patterns>"
  },
  "skills_authenticity": {
    "status": "<PASS | WARNING | FAIL>",
    "detail": "<1-2 sentence finding about consistency of stated skills with experience>"
  },
  "employment_gaps": {
    "status": "<PASS | WARNING | FAIL>",
    "detail": "<1-2 sentence finding about employment continuity>"
  },
  "flags": [
    {
      "type": "<Employment Gap | Job Hopping | Inconsistency | Other>",
      "description": "<specific concern>",
      "severity": "<Low | Medium | High>"
    }
  ],
  "summary": "<2-3 sentence overall risk assessment>"
}

If no red flags, return an empty flags array and PASS status for all three checks."""


async def run_red_flags_agent(resume_text: str, job_description: str) -> dict:
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
                f"RESUME:\n{resume_text}\n\n"
                f"JOB DESCRIPTION:\n{job_description}"
            )
        ),
    ]
    response = await llm.ainvoke(messages)
    return parse_json_response(response.content)
