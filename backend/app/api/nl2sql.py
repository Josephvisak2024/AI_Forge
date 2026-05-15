"""Project 8 — Natural Language to SQL API endpoints."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.engine import make_url

from app.ai.nl2sql import format_answer, generate_sql, validate_sql
from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.db_connection import DBConnection
from app.models.thread import Thread
from app.models.user import User
from app.schemas.nl2sql import DBConnectRequest, DBConnectResponse, DBDefaultsResponse, DBQueryRequest, DBQueryResponse
from app.services.nl2sql_service import connect_thread_db, execute_query, get_thread_db, test_db_connection
from app.services.thread_service import save_message

router = APIRouter(prefix="/api/db", tags=["nl2sql"])


@router.get("/app-defaults", response_model=DBDefaultsResponse)
async def db_app_defaults(
    current_user: User = Depends(get_current_user),
) -> DBDefaultsResponse:
    """Return safe, non-secret defaults derived from the app DATABASE_URL."""
    _ = current_user

    try:
        url = make_url(settings.DATABASE_URL)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to parse app database configuration: {exc}") from exc

    drivername = url.drivername.split("+", 1)[0]
    if drivername.startswith("postgresql"):
        db_type = "postgresql"
    elif drivername.startswith("mysql"):
        db_type = "mysql"
    elif drivername.startswith("sqlite"):
        db_type = "sqlite"
    else:
        raise HTTPException(status_code=400, detail="App database type is not supported by NL2SQL")

    return DBDefaultsResponse(
        db_type=db_type,
        host=url.host or "",
        port=url.port or (5432 if db_type == "postgresql" else 3306 if db_type == "mysql" else 0),
        database=url.database or "",
        username=url.username or "",
    )


@router.post("/test-connect", response_model=DBConnectResponse)
async def db_test_connect(
    body: DBConnectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DBConnectResponse:
    """Validate an external database connection without persisting it."""
    thread = await db.get(Thread, body.thread_id)
    if not thread or thread.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Thread not found")

    try:
        result = await asyncio.to_thread(
            test_db_connection,
            body.db_type,
            body.host,
            body.port,
            body.database,
            body.username,
            body.password,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Database connection failed: {exc}",
        ) from exc

    return DBConnectResponse(
        status="connected",
        database=body.database,
        tables=result["tables"],
    )


@router.post("/connect", response_model=DBConnectResponse)
async def db_connect(
    body: DBConnectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DBConnectResponse:
    """Connect an external database to a thread for NL2SQL queries."""
    thread = await db.get(Thread, body.thread_id)
    if not thread or thread.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Thread not found")

    try:
        result = await asyncio.to_thread(
            connect_thread_db,
            body.thread_id,
            body.db_type,
            body.host,
            body.port,
            body.database,
            body.username,
            body.password,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Database connection failed: {exc}",
        ) from exc

    # Persist connection metadata (no password stored)
    record = DBConnection(
        thread_id=body.thread_id,
        db_type=body.db_type,
        host=body.host,
        port=body.port,
        database_name=body.database,
        username=body.username,
        connected_at=datetime.now(timezone.utc),
    )
    db.add(record)
    await db.commit()

    await save_message(
        db,
        body.thread_id,
        "assistant",
        (
            "Database connected successfully.\n\n"
            f"Type: {body.db_type}\n"
            f"Database: {body.database}\n"
            f"Tables: {', '.join(result['tables'][:10]) or 'No tables found'}"
        ),
        attachment_type="db",
    )

    return DBConnectResponse(
        status="connected",
        database=body.database,
        tables=result["tables"],
    )


@router.post("/query", response_model=DBQueryResponse)
async def db_query(
    body: DBQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DBQueryResponse:
    """Convert a natural-language question to SQL, execute it, and return results."""
    thread = await db.get(Thread, body.thread_id)
    if not thread or thread.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Thread not found")

    ctx = get_thread_db(body.thread_id)
    if ctx is None:
        raise HTTPException(
            status_code=400,
            detail="No database connected for this thread. Please connect first.",
        )

    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question is required")

    # Step 1 — Generate SQL
    try:
        sql_query = await asyncio.to_thread(
            generate_sql, question, ctx["schema"], ctx["db_type"]
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"SQL generation failed: {exc}") from exc

    # Step 2 — Validate (block destructive queries)
    try:
        validate_sql(sql_query)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Step 3 — Execute
    try:
        results = await asyncio.to_thread(execute_query, body.thread_id, sql_query)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Query execution failed: {exc}",
        ) from exc

    # Step 4 — Format answer in plain English
    if results:
        try:
            answer = await asyncio.to_thread(format_answer, question, sql_query, results)
        except Exception:
            answer = f"Query returned {len(results)} row(s)."
    else:
        answer = "No data found for your query."

    # Persist messages
    sql_note = f"\n\n```sql\n{sql_query}\n```"
    await save_message(db, body.thread_id, "user", question, attachment_type="db_question")
    await save_message(
        db,
        body.thread_id,
        "assistant",
        f"{answer}{sql_note}",
        attachment_type="db_response",
    )

    return DBQueryResponse(
        answer=answer,
        sql_query=sql_query,
        results=results,
        row_count=len(results),
    )
