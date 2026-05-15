"""
Project 4 — Conversation Memory Verification Test
===================================================
Tests ConversationBufferWindowMemory (k=5) end-to-end.

Usage:
    cd d:\Amzur-Learnings
    python test_project4_memory.py

Prerequisites:
    - Backend running:  cd backend && uvicorn main:app --reload
    - Valid credentials in TEST_EMAIL / TEST_PASSWORD below
    - pip install httpx  (already in requirements.txt)
"""

import json
import sys
import time

import httpx

# ── Config ────────────────────────────────────────────────────────────────────
BASE_URL = "http://localhost:8000"
TEST_EMAIL = "joseph@evokesystems.com"   # ← change to your test account
TEST_PASSWORD = "Test@1234"              # ← change to your test password
TIMEOUT = 60  # seconds per request

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"

def _pass(label: str) -> None:
    print(f"  {GREEN}[PASS]{RESET} {label}")

def _fail(label: str, detail: str = "") -> None:
    extra = f" — {detail}" if detail else ""
    print(f"  {RED}[FAIL]{RESET} {label}{extra}")

def _info(msg: str) -> None:
    print(f"  {CYAN}[INFO]{RESET} {msg}")

def _section(title: str) -> None:
    print(f"\n{YELLOW}{'═' * 60}{RESET}")
    print(f"{YELLOW}  {title}{RESET}")
    print(f"{YELLOW}{'═' * 60}{RESET}")


# ── API helpers ───────────────────────────────────────────────────────────────

def login(client: httpx.Client) -> bool:
    """POST /api/auth/login — sets httpOnly cookie on the client."""
    resp = client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        timeout=TIMEOUT,
    )
    if resp.status_code == 200:
        _info(f"Logged in as {TEST_EMAIL}")
        return True
    _fail("Login", f"HTTP {resp.status_code}: {resp.text}")
    return False


def create_thread(client: httpx.Client, title: str = "Memory Test Thread") -> str | None:
    """POST /api/threads → thread_id."""
    resp = client.post(
        f"{BASE_URL}/api/threads",
        json={"title": title},
        timeout=TIMEOUT,
    )
    if resp.status_code == 200:
        thread_id = resp.json()["id"]
        _info(f"Created thread: {thread_id}  (title: '{title}')")
        return thread_id
    _fail("Create thread", f"HTTP {resp.status_code}: {resp.text}")
    return None


def send_message(client: httpx.Client, thread_id: str, user_message: str) -> str:
    """POST /api/chat (SSE stream) → collected AI response text."""
    with client.stream(
        "POST",
        f"{BASE_URL}/api/chat",
        json={"thread_id": thread_id, "user_message": user_message},
        timeout=TIMEOUT,
    ) as resp:
        if resp.status_code != 200:
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")
        tokens: list[str] = []
        for line in resp.iter_lines():
            if line.startswith("data: ") and line != "data: [DONE]":
                payload = json.loads(line[6:])
                tokens.append(payload.get("token", ""))
        return "".join(tokens).strip()


# ── Test 1 — Sequential messages + window memory check ───────────────────────

def test_window_memory(client: httpx.Client) -> None:
    _section("TEST 1 — Window Memory (k=5) Verification")

    thread_id = create_thread(client, "Window Memory Test")
    if not thread_id:
        sys.exit(1)

    messages = [
        "My name is Joseph and I work at EvokesystemspvtLtd",
        "I am a QA Engineer with 07 years of experience",
        "My favorite programming language is JAVA",
        "I am currently in AI_forge learning sessions",
        "I prefer working on web application testing and API automation",
        "I also enjoy cricket in my free time",
    ]

    print()
    for i, msg in enumerate(messages, start=1):
        _info(f"Sending message {i}/6: \"{msg[:60]}...\"" if len(msg) > 60 else f"Sending message {i}/6: \"{msg}\"")
        reply = send_message(client, thread_id, msg)
        _info(f"  AI reply snippet: \"{reply[:80]}\"")
        time.sleep(0.5)  # small pause to avoid rate-limit

    # ── Verification Q1: name should be remembered (message 1 is within last 5 pairs)
    # After 6 messages, window holds pairs for msgs 2-6 (i.e., the last 5 human turns).
    # Message 1 ("My name is Joseph") is the 6th-most-recent human message → evicted.
    # Adjust expectation comment below if your test results differ.
    print()
    _info("Verification Q1: 'What is my name?'")
    answer_q1 = send_message(client, thread_id, "What is my name?")
    _info(f"  AI answered: \"{answer_q1[:120]}\"")

    if "joseph" in answer_q1.lower():
        # Name was in message 1 — if remembered, window may have k>5 or model guessing
        _fail(
            "Q1 — Name recalled: 'Joseph' (Message 1 is 6th-back, should be evicted from k=5 window)",
            "Check WINDOW_K — may recall from beyond window or model is guessing",
        )
    else:
        _pass("Q1 — 'Joseph' NOT recalled (message 1 correctly evicted from k=5 window)")

    # ── Verification Q2: cricket should be remembered (message 6 = most recent)
    print()
    _info("Verification Q2: 'What do I enjoy in my free time?'")
    answer_q2 = send_message(client, thread_id, "What do I enjoy in my free time?")
    _info(f"  AI answered: \"{answer_q2[:120]}\"")

    if "cricket" in answer_q2.lower():
        _pass("Q2 — 'cricket' recalled (message 6 is within k=5 window)")
    else:
        _fail("Q2 — 'cricket' NOT recalled", "Message 6 should be in context; check memory loading")

    # ── Verification Q3: favourite language (message 3 = 4th-back from Q2 call)
    print()
    _info("Verification Q3: 'What is my favorite programming language?'")
    answer_q3 = send_message(client, thread_id, "What is my favorite programming language?")
    _info(f"  AI answered: \"{answer_q3[:120]}\"")

    # After 8 messages (6 + Q1 + Q2), message 3 ("JAVA") is well outside k=5 window.
    if "java" in answer_q3.lower():
        _fail(
            "Q3 — 'JAVA' recalled (message 3 should now be evicted from window after 8 exchanges)",
            "If you just sent Q1+Q2, message 3 may still be in window — this is expected if k=5 counting differs",
        )
    else:
        _pass("Q3 — 'JAVA' NOT recalled (correctly evicted from window)")

    print(f"\n  {CYAN}Thread ID for DB inspection: {thread_id}{RESET}")
    return thread_id


# ── Test 2 — Thread isolation ─────────────────────────────────────────────────

def test_thread_isolation(client: httpx.Client) -> None:
    _section("TEST 2 — Thread Isolation (No Cross-Thread Memory Leak)")

    # Thread A: establish context
    thread_a = create_thread(client, "Isolation Thread A")
    if not thread_a:
        sys.exit(1)
    _info("Thread A: sending identity message")
    send_message(client, thread_a, "My name is Joseph and I am a QA Engineer")
    time.sleep(0.5)

    # Thread B: fresh thread — should have no knowledge of Thread A
    thread_b = create_thread(client, "Isolation Thread B (fresh)")
    if not thread_b:
        sys.exit(1)
    _info("Thread B: asking 'What is my name?' (should NOT know Joseph)")
    answer = send_message(client, thread_b, "What is my name?")
    _info(f"  AI answered: \"{answer[:120]}\"")

    if "joseph" in answer.lower():
        _fail(
            "Thread isolation FAILED — 'Joseph' leaked from Thread A into Thread B",
            "Memory is NOT isolated per thread_id",
        )
    else:
        _pass("Thread isolation PASSED — Thread B has no knowledge of Thread A's context")


# ── Test 3 — Config audit ─────────────────────────────────────────────────────

def test_config_audit() -> None:
    _section("TEST 3 — LangChain Memory Config Audit (Static Code Check)")

    import ast
    import pathlib

    memory_file = pathlib.Path("backend/app/ai/memory.py")
    chat_service = pathlib.Path("backend/app/services/chat_service.py")
    thread_service = pathlib.Path("backend/app/services/thread_service.py")
    chat_api = pathlib.Path("backend/app/api/chat.py")

    # 3a — memory.py exists and sets WINDOW_K = 5
    if memory_file.exists():
        _pass("app/ai/memory.py exists")
        source = memory_file.read_text()
        if "WINDOW_K = 5" in source:
            _pass("Window size WINDOW_K = 5 is configured")
        else:
            _fail("WINDOW_K = 5 NOT found — check window size value")
        if "pairs[-WINDOW_K:]" in source:
            _pass("Sliding window slice pairs[-WINDOW_K:] is applied")
        else:
            _fail("Sliding window slice not found in memory.py")
        if "def build_message_context" in source:
            _pass("build_message_context function is defined")
        else:
            _fail("build_message_context NOT defined in memory.py")
        if "SystemMessage" in source and "HumanMessage" in source and "AIMessage" in source:
            _pass("SystemMessage / HumanMessage / AIMessage are all used")
        else:
            _fail("One or more LangChain message types missing from memory.py")
    else:
        _fail("app/ai/memory.py does NOT exist")

    # 3b — thread_service has get_recent_messages with limit
    if thread_service.exists():
        source = thread_service.read_text()
        if "get_recent_messages" in source:
            _pass("thread_service.get_recent_messages() is defined")
        else:
            _fail("get_recent_messages NOT found in thread_service.py")
        if "order_by(Message.created_at.desc())" in source:
            _pass("Messages fetched DESC (newest first) then reversed")
        else:
            _fail("DESC ordering not found in get_recent_messages")
    else:
        _fail("app/services/thread_service.py does NOT exist")

    # 3c — chat API uses get_recent_messages + build_message_context
    if chat_api.exists():
        source = chat_api.read_text()
        if "get_recent_messages" in source:
            _pass("chat.py calls get_recent_messages before every LLM call")
        else:
            _fail("chat.py does NOT call get_recent_messages")
        if "build_message_context" in source:
            _pass("chat.py calls build_message_context (window memory applied)")
        else:
            _fail("chat.py does NOT call build_message_context")
        if "save_message" in source:
            _pass("chat.py calls save_message (messages persisted to PostgreSQL)")
        else:
            _fail("chat.py does NOT call save_message")
    else:
        _fail("app/api/chat.py does NOT exist")

    # 3d — chat_service accepts BaseMessage list (no schema conversion)
    if chat_service.exists():
        source = chat_service.read_text()
        if "BaseMessage" in source or "list[BaseMessage]" in source:
            _pass("chat_service.stream_chat_response accepts LangChain BaseMessage list")
        else:
            _fail("chat_service does not type-hint with BaseMessage")


# ── DB verification query printer ─────────────────────────────────────────────

def print_db_query(thread_id: str | None = None) -> None:
    _section("DATABASE VERIFICATION QUERIES")

    placeholder = thread_id or "<paste-thread-id-here>"

    print(f"""
-- ① Inspect all messages for a thread (chronological order)
SELECT
    id,
    role,
    LEFT(content, 80)   AS content_preview,
    created_at
FROM chat_messages
WHERE thread_id = '{placeholder}'
ORDER BY created_at ASC;

-- ② Count messages per role for the thread
SELECT role, COUNT(*) AS total
FROM chat_messages
WHERE thread_id = '{placeholder}'
GROUP BY role;

-- ③ Confirm only the last 10 rows (5 pairs) are used as memory context
--    (mirrors what get_recent_messages fetches)
SELECT
    role,
    LEFT(content, 80)   AS content_preview,
    created_at
FROM chat_messages
WHERE thread_id = '{placeholder}'
ORDER BY created_at DESC
LIMIT 10;

-- ④ Thread isolation check — count messages across all threads for the test user
SELECT
    t.id          AS thread_id,
    t.title,
    COUNT(m.id)   AS message_count
FROM threads t
LEFT JOIN chat_messages m ON m.thread_id = t.id
GROUP BY t.id, t.title
ORDER BY t.updated_at DESC
LIMIT 10;
""")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    print(f"\n{YELLOW}Project 4 — Conversation Memory (k=5) Verification Suite{RESET}")
    print(f"{YELLOW}Backend: {BASE_URL}{RESET}")

    # Static config audit (no network needed)
    test_config_audit()

    # Live API tests
    _section("CONNECTING TO BACKEND API")
    with httpx.Client(base_url=BASE_URL, follow_redirects=True) as client:
        if not login(client):
            print(f"\n{RED}Cannot continue without a valid login. Exiting.{RESET}")
            sys.exit(1)

        thread_id = test_window_memory(client)
        test_thread_isolation(client)

    # Print SQL queries with the real thread_id from test 1
    print_db_query(thread_id if isinstance(thread_id, str) else None)

    _section("VERIFICATION COMPLETE")
    print(
        f"\n  Run the SQL queries above against your PostgreSQL database\n"
        f"  (psql or pgAdmin) to confirm message persistence.\n"
    )


if __name__ == "__main__":
    main()
