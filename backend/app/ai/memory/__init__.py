"""
Conversation memory utilities.

Implements a sliding window of the last WINDOW_K human/AI conversation pairs
using pure langchain_core — no langchain_community dependency required.

Import `build_message_context` from here.
"""
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage

from app.models.message import Message as DBMessage

SYSTEM_PROMPT = "You are a helpful AI assistant. Answer clearly and concisely."
WINDOW_K = 5  # number of conversation pairs (human + AI) to retain


def build_message_context(db_messages: list[DBMessage], new_user_message: str) -> list[BaseMessage]:
    """
    Build the full LangChain message list for an LLM call:

        [SystemMessage, ...last WINDOW_K human/AI pairs..., HumanMessage(new_user_message)]

    *db_messages* must be ordered oldest → newest (as returned by
    ``get_recent_messages``).

    Pairs are walked in order; any un-paired / out-of-role messages are
    skipped so a single bad row never corrupts the whole context window.
    """
    # Collect complete human/AI pairs chronologically
    pairs: list[tuple[str, str]] = []
    i = 0
    while i < len(db_messages) - 1:
        human_msg = db_messages[i]
        ai_msg = db_messages[i + 1]
        if human_msg.role in ("user", "human") and ai_msg.role in ("assistant", "ai"):
            pairs.append((human_msg.content, ai_msg.content))
            i += 2
        else:
            i += 1

    # Apply window: keep only the last WINDOW_K pairs
    windowed_pairs = pairs[-WINDOW_K:]

    # Convert to LangChain message objects
    history: list[BaseMessage] = []
    for human_content, ai_content in windowed_pairs:
        history.append(HumanMessage(content=human_content))
        history.append(AIMessage(content=ai_content))

    return [SystemMessage(content=SYSTEM_PROMPT)] + history + [HumanMessage(content=new_user_message)]
