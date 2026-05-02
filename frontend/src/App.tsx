import { useEffect, useRef, useState } from "react";
import { AuthPage } from "./pages/AuthPage";
import { ThreadSidebar } from "./components/chat/ThreadSidebar";
import type { ChatMessage, Thread, User } from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
}

export default function App() {
  // -- auth state --------------------------------------------------------------
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);

  // -- chat state ---------------------------------------------------------------
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Check current session on mount — also handles Google OAuth redirect back
  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u: User | null) => {
        setUser(u);
        if (u) loadThreads();
      })
      .catch(() => setUser(null));
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // -- thread helpers ----------------------------------------------------------
  async function loadThreads() {
    const res = await apiFetch("/api/threads");
    if (!res.ok) return;
    const data: Thread[] = await res.json();
    setThreads(data);
  }

  async function selectThread(thread: Thread) {
    setActiveThread(thread);
    const res = await apiFetch(`/api/threads/${thread.id}/messages`);
    if (!res.ok) return;
    const data: ChatMessage[] = await res.json();
    setMessages(data);
  }

  async function newChat() {
    const res = await apiFetch("/api/threads", {
      method: "POST",
      body: JSON.stringify({ title: "New Chat" }),
    });
    if (!res.ok) return;
    const thread: Thread = await res.json();
    setThreads((prev) => [thread, ...prev]);
    setActiveThread(thread);
    setMessages([]);
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setThreads([]);
    setActiveThread(null);
    setMessages([]);
  }

  async function renameThread(thread: Thread, newTitle: string) {
    const res = await apiFetch(`/api/threads/${thread.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: newTitle }),
    });
    if (!res.ok) return;
    const updated: Thread = await res.json();
    setThreads((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    if (activeThread?.id === updated.id) setActiveThread(updated);
  }

  async function deleteThread(thread: Thread) {
    const res = await apiFetch(`/api/threads/${thread.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setThreads((prev) => prev.filter((t) => t.id !== thread.id));
    if (activeThread?.id === thread.id) {
      setActiveThread(null);
      setMessages([]);
    }
  }

  // -- send message -------------------------------------------------------------
  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    // Ensure an active thread exists
    let thread = activeThread;
    if (!thread) {
      const res = await apiFetch("/api/threads", {
        method: "POST",
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (!res.ok) return;
      thread = await res.json() as Thread;
      setThreads((prev) => [thread!, ...prev]);
      setActiveThread(thread);
    }

    const userMsg: ChatMessage = { role: "user", content: text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setStreaming(true);

    // Append placeholder for assistant
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          thread_id: thread.id,
          messages: newHistory.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") break;
          try {
            const { token } = JSON.parse(payload) as { token: string };
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: updated[updated.length - 1].content + token,
              };
              return updated;
            });
          } catch {
            // ignore malformed chunk
          }
        }
      }

      // Refresh threads to show updated title / order
      loadThreads();
    } finally {
      setStreaming(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // -- render guards -------------------------------------------------------------
  if (user === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage
        onAuth={(u) => {
          setUser(u);
          loadThreads();
        }}
      />
    );
  }

  // -- main layout ---------------------------------------------------------------
  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <ThreadSidebar
        threads={threads}
        activeThread={activeThread}
        onSelect={selectThread}
        onNewChat={newChat}
        onRename={renameThread}
        onDelete={deleteThread}
        user={user}
        onLogout={logout}
      />

      {/* Chat panel */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Topbar */}
        <header className="flex items-center gap-3 px-6 py-3 border-b border-gray-800 shrink-0">
          <h2 className="text-sm font-semibold text-gray-200 truncate">
            {activeThread?.title ?? "Select or start a chat"}
          </h2>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 && !activeThread && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-60">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-2xl font-bold text-white">
                AI
              </div>
              <p className="text-gray-400 text-sm">Start a new chat or select a previous one from the sidebar.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-gray-800 text-gray-100 rounded-bl-sm"
                }`}
              >
                {msg.content}
                {msg.role === "assistant" && msg.content === "" && streaming && (
                  <span className="inline-flex gap-1 ml-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="px-4 pb-4 shrink-0">
          <div className="flex gap-2 items-end bg-gray-800 rounded-2xl border border-gray-700 px-4 py-2.5">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Type a message� (Enter to send, Shift+Enter for newline)"
              className="flex-1 bg-transparent resize-none text-sm text-gray-100 placeholder-gray-500 focus:outline-none min-h-[1.5rem] max-h-40 overflow-y-auto"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-1.5 text-sm font-medium transition-colors shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
