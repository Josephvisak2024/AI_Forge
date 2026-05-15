"""Manage per-thread external database connections for NL2SQL (Project 8).

Connections are kept in an in-process dict keyed by thread_id.
Passwords are NEVER persisted to PostgreSQL; they live only in memory for the
duration of the server process.
"""
from __future__ import annotations

from typing import Any
from urllib.parse import quote_plus

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from app.core.config import settings


# ── in-memory store: thread_id → { engine, schema, meta } ──────────────────
_connections: dict[str, dict[str, Any]] = {}


def _matches_app_database_defaults(
    db_type: str,
    host: str,
    port: int,
    database: str,
    username: str,
) -> bool:
    app_url = make_url(settings.DATABASE_URL)
    app_driver = app_url.drivername.split("+", 1)[0]

    normalized_type = "postgresql" if app_driver.startswith("postgresql") else app_driver

    return (
        db_type == normalized_type
        and (app_url.host or "") == host
        and int(app_url.port or 0) == int(port or 0)
        and (app_url.database or "") == database
        and (app_url.username or "") == username
    )


def _build_connection_url(
    db_type: str,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
) -> str:
    if db_type == "sqlite":
        # For SQLite, 'database' is the file path
        return f"sqlite:///{database}"

    if _matches_app_database_defaults(db_type, host, port, database, username):
        return settings.DATABASE_URL

    encoded_username = quote_plus(username)
    encoded_password = quote_plus(password)

    if db_type == "postgresql":
        return f"postgresql+psycopg2://{encoded_username}:{encoded_password}@{host}:{port}/{database}"
    if db_type == "mysql":
        return f"mysql+pymysql://{encoded_username}:{encoded_password}@{host}:{port}/{database}"
    raise ValueError(f"Unsupported db_type: {db_type}")


def _extract_schema(engine: Any) -> dict[str, list[dict[str, str]]]:
    """Return {table_name: [{name, type}, ...]} for all user tables."""
    inspector = inspect(engine)
    schema: dict[str, list[dict[str, str]]] = {}
    for table_name in inspector.get_table_names():
        columns = []
        for col in inspector.get_columns(table_name):
            columns.append({"name": col["name"], "type": str(col["type"])})
        schema[table_name] = columns
    return schema


def connect_thread_db(
    thread_id: str,
    db_type: str,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
) -> dict[str, Any]:
    """Create (or replace) the external DB connection for a thread.

    Returns a dict with ``tables`` (list[str]) and ``schema`` (dict).
    Raises on connection failure so the caller can return a 400.
    """
    url = _build_connection_url(db_type, host, port, database, username, password)
    engine = create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 10} if db_type != "sqlite" else {})

    # Verify connectivity
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))

    schema = _extract_schema(engine)
    tables = list(schema.keys())

    _connections[thread_id] = {
        "engine": engine,
        "schema": schema,
        "db_type": db_type,
        "database": database,
    }

    return {"tables": tables, "schema": schema}


def test_db_connection(
    db_type: str,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
) -> dict[str, Any]:
    """Verify an external DB connection and return schema without storing it."""
    url = _build_connection_url(db_type, host, port, database, username, password)
    engine = create_engine(
        url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 10} if db_type != "sqlite" else {},
    )

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        schema = _extract_schema(engine)
        return {"tables": list(schema.keys()), "schema": schema}
    finally:
        engine.dispose()


def get_thread_db(thread_id: str) -> dict[str, Any] | None:
    """Return the stored connection context for the thread, or None."""
    return _connections.get(thread_id)


def disconnect_thread_db(thread_id: str) -> None:
    """Dispose the engine and remove the entry."""
    conn = _connections.pop(thread_id, None)
    if conn:
        try:
            conn["engine"].dispose()
        except Exception:
            pass


def execute_query(thread_id: str, sql: str) -> list[dict[str, Any]]:
    """Execute a validated SELECT query and return rows as list-of-dicts."""
    ctx = _connections.get(thread_id)
    if ctx is None:
        raise RuntimeError("No database connected for this thread.")

    engine = ctx["engine"]
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        columns = list(result.keys())
        rows = [dict(zip(columns, row)) for row in result.fetchall()]
    return rows
