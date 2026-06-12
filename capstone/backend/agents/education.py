from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from config import settings
from utils.json_parser import parse_json_response

SYSTEM_PROMPT = """You are an education background verification specialist.
Verify the candidate's educational qualifications against the job requirements.

Respond ONLY with valid JSON in this exact structure (no extra text, no markdown code blocks):
{
  "result": "<PASS or FAIL>",
  "degrees": [
    {
      "degree": "<Full qualification name e.g. B.Tech Computer Science / Class X SSC / Class XII Intermediate>",
      "institution": "<School, college or university name>",
      "year": "<Completion year or empty string if not mentioned>",
      "grade": "<Percentage, CGPA, or grade if mentioned, otherwise empty string>",
      "level": "<one of: SSC | INTERMEDIATE | BACHELOR | MASTER | DOCTORATE | DIPLOMA | OTHER>",
      "verified": <true if clearly mentioned in resume, false if inferred>
    }
  ],
  "certifications": ["<Certification 1>", "<Certification 2>"],
  "meets_requirements": <true or false>,
  "analysis": "<2-3 sentence explanation of how education meets or falls short of requirements>"
}

IMPORTANT:
- Extract EVERY level of education found: SSC (10th), Intermediate/HSC (12th), Bachelor's, Master's, Diploma, PhD, etc.
- Sort degrees from OLDEST to NEWEST (SSC first, highest degree last).
- Use the level field to categorize each entry.
- If SSC or Intermediate details are partially mentioned, still include them with available info.
- If no certifications are mentioned, return an empty array."""


async def run_education_agent(resume_text: str, job_description: str) -> dict:
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
