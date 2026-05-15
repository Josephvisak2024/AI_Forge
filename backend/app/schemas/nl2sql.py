from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class DBConnectRequest(BaseModel):
    db_type: str = Field(..., pattern="^(postgresql|mysql|sqlite)$")
    host: str = ""
    port: int = 5432
    database: str
    username: str = ""
    password: str = ""
    thread_id: str


class DBConnectResponse(BaseModel):
    status: str
    database: str
    tables: list[str]


class DBDefaultsResponse(BaseModel):
    db_type: str
    host: str
    port: int
    database: str
    username: str


class DBQueryRequest(BaseModel):
    question: str
    thread_id: str


class DBQueryResponse(BaseModel):
    answer: str
    sql_query: str
    results: list[dict[str, Any]]
    row_count: int
