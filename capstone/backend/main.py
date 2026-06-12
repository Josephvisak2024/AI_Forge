import asyncio
import json
import logging
from collections.abc import AsyncGenerator

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from agents.education import run_education_agent
from agents.experience import run_experience_agent
from agents.red_flags import run_red_flags_agent
from agents.scoring import run_scoring_agent
from agents.skills import run_skills_agent
from utils.pdf_parser import parse_resume

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    force=True,
)
logger = logging.getLogger("capstone.main")

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

app = FastAPI(title="Resume Screening Swarm", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def sse_event(event_type: str, data: dict) -> str:
    payload = json.dumps({"type": event_type, "data": data}, ensure_ascii=False)
    return f"data: {payload}\n\n"


async def screen_stream(
    resume_text: str, job_description: str
) -> AsyncGenerator[str, None]:
    """
    Run 4 agents in parallel via asyncio.  Stream each result via SSE as it
    completes, then run the Scoring Agent and stream the final result.
    """
    queue: asyncio.Queue = asyncio.Queue()

    async def run_and_enqueue(name: str, coro) -> None:
        try:
            result = await coro
        except Exception as exc:
            logger.error("Agent %s failed: %s", name, exc)
            result = {"error": str(exc)}
        await queue.put((name, result))

    # Fire all 4 specialist agents concurrently
    tasks = [
        asyncio.create_task(
            run_and_enqueue(
                "experience",
                run_experience_agent(resume_text, job_description),
            )
        ),
        asyncio.create_task(
            run_and_enqueue(
                "skills",
                run_skills_agent(resume_text, job_description),
            )
        ),
        asyncio.create_task(
            run_and_enqueue(
                "education",
                run_education_agent(resume_text, job_description),
            )
        ),
        asyncio.create_task(
            run_and_enqueue(
                "red_flags",
                run_red_flags_agent(resume_text, job_description),
            )
        ),
    ]

    # Yield each result as it arrives (real-time SSE)
    agent_results: dict = {}
    for _ in range(4):
        name, result = await queue.get()
        agent_results[name] = result
        logger.info("Agent '%s' completed.", name)
        yield sse_event(name, result)

    # Ensure all tasks are fully done before scoring
    await asyncio.gather(*tasks, return_exceptions=True)

    # Run the Scoring Agent with all 4 results
    logger.info("Running Scoring Agent...")
    try:
        scoring_result = await run_scoring_agent(agent_results, resume_text, job_description)
    except Exception as exc:
        logger.error("Scoring Agent failed: %s", exc)
        scoring_result = {"error": str(exc)}

    yield sse_event("scoring", scoring_result)
    yield "data: [DONE]\n\n"


@app.post("/api/screen")
async def screen_resume(
    resume: UploadFile = File(..., description="Candidate resume (PDF or DOCX, max 5 MB)"),
    jobDescription: str = Form(..., description="Job description (500–3000 characters)"),
):
    # --- Validate file type ---
    if resume.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are accepted.",
        )

    # --- Validate file size ---
    contents = await resume.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File size must not exceed 5 MB.",
        )

    # --- Validate job description ---
    job_description = jobDescription.strip()
    if len(job_description) < 500:
        raise HTTPException(
            status_code=400,
            detail="Job description must be at least 500 characters.",
        )
    if len(job_description) > 3000:
        raise HTTPException(
            status_code=400,
            detail="Job description must not exceed 3000 characters.",
        )

    # --- Parse resume text ---
    try:
        resume_text = parse_resume(contents, resume.filename or "")
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to parse resume: {exc}",
        )

    logger.info(
        "Screening started | file=%s | jd_chars=%d | resume_chars=%d",
        resume.filename,
        len(job_description),
        len(resume_text),
    )

    return StreamingResponse(
        screen_stream(resume_text, job_description),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "resume-screening-swarm"}
