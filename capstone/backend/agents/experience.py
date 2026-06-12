from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from config import settings
from utils.json_parser import parse_json_response

SYSTEM_PROMPT = """You are an expert HR analyst specializing in work experience evaluation.
Analyze the candidate's work history against the job requirements.

Respond ONLY with valid JSON in this exact structure (no extra text, no markdown code blocks):
{
  "years_of_experience": "<e.g. 8+ years>",
  "current_role": "<most recent job title>",
  "relevant_experience": "<2-3 sentence description of relevant experience>",
  "alignment_score": <integer 0-10>,
  "work_history": [
    {
      "title": "<job title>",
      "company": "<company name>",
      "period": "<e.g. 2020 \u2013 Present or 2018 \u2013 2022>",
      "description": "<1-2 sentence key achievement or responsibility>"
    }
  ],
  "summary": "<2-3 sentence assessment of how well the experience matches the role>"
}

Include up to 4-5 most recent significant roles from the resume in work_history."""


async def run_experience_agent(resume_text: str, job_description: str) -> dict:
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
