from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from config import settings
from utils.json_parser import parse_json_response

SYSTEM_PROMPT = """You are a technical recruiter specializing in skills gap analysis.
Compare the skills listed in the candidate's resume to the required skills in the job description.

Respond ONLY with valid JSON in this exact structure (no extra text, no markdown code blocks):
{
  "match_percentage": <integer 0-100>,
  "matching_skills": ["<skill1>", "<skill2>"],
  "missing_skills": ["<skill1>", "<skill2>"],
  "skill_scores": [
    {"name": "<SHORT UPPERCASE SKILL CATEGORY>", "score": <integer 0-100>}
  ],
  "skill_gap_analysis": "<2-3 sentence analysis of the overall skills gap and impact>"
}

For skill_scores, list 4-6 key technical skill categories extracted from the resume.
Order by score descending. Use concise uppercase names like \"KUBERNETES / DOCKER\" or \"AWS ARCHITECTURE\"."""


async def run_skills_agent(resume_text: str, job_description: str) -> dict:
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
