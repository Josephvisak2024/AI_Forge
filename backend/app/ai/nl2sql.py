"""LLM helpers for Project 8 — Natural Language to SQL."""
from __future__ import annotations

import re
from typing import Any

from app.ai.llm import openai_client
from app.core.config import settings

# ── SQL safety ────────────────────────────────────────────────────────────────
_BLOCKED = re.compile(
    r"\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|REPLACE|MERGE|EXEC|EXECUTE)\b",
    re.IGNORECASE,
)
_ALLOWED_START = re.compile(r"^\s*(SELECT|WITH|SHOW|DESCRIBE|EXPLAIN)\b", re.IGNORECASE)


def validate_sql(sql: str) -> None:
    """Raise ValueError if the query is not a safe read-only statement."""
    if _BLOCKED.search(sql):
        raise ValueError(
            "For security reasons only read queries are allowed "
            "(SELECT, WITH, SHOW, DESCRIBE)."
        )
    if not _ALLOWED_START.match(sql):
        raise ValueError(
            "Only SELECT / WITH / SHOW / DESCRIBE queries are permitted."
        )


def _schema_to_text(schema: dict[str, list[dict[str, str]]]) -> str:
    lines: list[str] = []
    for table, columns in schema.items():
        col_str = ", ".join(f"{c['name']} ({c['type']})" for c in columns)
        lines.append(f"Table: {table}\nColumns: {col_str}")
    return "\n\n".join(lines)


def generate_sql(question: str, schema: dict[str, list[dict[str, str]]], db_type: str) -> str:
    """Ask Gemini to convert a natural-language question to SQL."""
    schema_text = _schema_to_text(schema)

    prompt = (
        f"You are a SQL expert for {db_type}.\n"
        "Given the following database schema:\n\n"
        f"{schema_text}\n\n"
        f"Convert this question to a valid {db_type} SQL query:\n"
        f"'{question}'\n\n"
        "Rules:\n"
        "- Return ONLY the raw SQL query — no explanation, no markdown, no code fences.\n"
        "- Use correct table and column names from the schema above.\n"
        "- Always add LIMIT 100 to prevent large result sets (unless the query is an aggregate).\n"
        "- Only use SELECT statements."
    )

    response = openai_client.chat.completions.create(
        model=settings.LLM_MODEL,
        temperature=0.0,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = (response.choices[0].message.content or "").strip()

    # Strip any accidental markdown code fences
    raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    return raw.strip()


def format_answer(
    question: str,
    sql_query: str,
    results: list[dict[str, Any]],
) -> str:
    """Ask Gemini to summarise raw SQL results in plain English."""
    results_preview = results[:20]  # avoid huge prompts

    prompt = (
        f"Given this SQL query:\n{sql_query}\n\n"
        f"And these results ({len(results)} row(s) total):\n{results_preview}\n\n"
        f"Answer this question in plain English:\n'{question}'\n\n"
        "Format the answer clearly and concisely in 1-3 sentences."
    )

    response = openai_client.chat.completions.create(
        model=settings.LLM_MODEL,
        temperature=0.2,
        messages=[
            {
                "role": "system",
                "content": "You answer database questions in plain English based on SQL query results.",
            },
            {"role": "user", "content": prompt},
        ],
    )
    return (response.choices[0].message.content or "").strip()
