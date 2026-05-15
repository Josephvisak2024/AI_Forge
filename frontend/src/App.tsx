import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import ReactMarkdown from "react-markdown";
import { useDropzone } from "react-dropzone";
import remarkGfm from "remark-gfm";
import { AuthPage } from "./pages/AuthPage";
import { ThreadSidebar } from "./components/chat/ThreadSidebar";
import type { ChatMessage, Thread, User } from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function apiFetch(path: string, init?: RequestInit) {
  const isFormData = init?.body instanceof FormData;
  return fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
    ...init,
  });
}

async function apiFetchWithTimeout(path: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await apiFetch(path, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

type PreviewData = {
  kind: "image" | "video" | "table" | "code" | "generic";
  url?: string;
  tableRows?: string[][];
  codeSnippet?: string;
};

type DatabaseType = "postgresql" | "mysql" | "sqlite";

type DatabaseFormState = {
  db_type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
};

type DatabaseDefaultsResponse = Omit<DatabaseFormState, "password">;

const DEFAULT_DB_FORM: DatabaseFormState = {
  db_type: "postgresql",
  host: "",
  port: 5432,
  database: "",
  username: "",
  password: "",
};

const ACCEPT_ATTR =
  ".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.csv,.xlsx,.py,.js,.ts,.java,.html,.css,.pdf";

const DROPZONE_ACCEPT = {
  "image/*": [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  "video/*": [".mp4", ".mov", ".avi"],
  "text/csv": [".csv"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/plain": [".py", ".js", ".ts", ".java", ".html", ".css"],
} as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resolveAttachmentUrl(path?: string): string | null {
  if (!path) return null;
  if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${BASE}/${path.replace(/^\/+/, "")}`;
}

function extractLatex(content: string): string | null {
  const match = content.match(/\$\$([\s\S]+?)\$\$/);
  return match?.[1]?.trim() ?? null;
}

function ensureKatexCss() {
  if (document.getElementById("katex-css")) return;
  const link = document.createElement("link");
  link.id = "katex-css";
  link.rel = "stylesheet";
  link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
  document.head.appendChild(link);
}

function FormulaBlock({ latex }: { latex: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      ensureKatexCss();
      const katex = (await import("katex")).default;
      const rendered = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
        strict: "ignore",
      });
      if (alive) setHtml(rendered);
    })();
    return () => {
      alive = false;
    };
  }, [latex]);

  if (!html) {
    return <pre className="rounded-lg bg-gray-900 px-3 py-2 overflow-x-auto text-xs text-emerald-200">{`$$${latex}$$`}</pre>;
  }

  return <div className="rounded-lg bg-gray-900 px-3 py-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
}

function LazyCodeBlock({ code, language }: { code: string; language: string }) {
  const [syntax, setSyntax] = useState<{
    Component: ComponentType<Record<string, unknown>>;
    style: Record<string, unknown>;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [syntaxModule, styleModule] = await Promise.all([
        import("react-syntax-highlighter"),
        import("react-syntax-highlighter/dist/esm/styles/prism"),
      ]);
      if (!alive) return;
      setSyntax({
        Component: syntaxModule.Prism as unknown as ComponentType<Record<string, unknown>>,
        style: styleModule.oneDark as unknown as Record<string, unknown>,
      });
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!syntax) {
    return (
      <pre className="bg-gray-900 rounded-lg p-3 my-2 overflow-x-auto">
        <code className="text-xs font-mono text-gray-200">{code}</code>
      </pre>
    );
  }

  const { Component, style } = syntax;
  return (
    <Component
      style={style}
      language={language}
      PreTag="div"
      customStyle={{
        margin: "0.5rem 0",
        borderRadius: "0.5rem",
        fontSize: "0.75rem",
      }}
    >
      {code}
    </Component>
  );
}

function tagAssistantAttachmentType(history: ChatMessage[]): ChatMessage[] {
  let pendingType: ChatMessage["attachment_type"] | undefined;
  return history.map((msg) => {
    if (msg.role === "user") {
      pendingType = msg.attachment_type;
      return msg;
    }
    if (msg.role === "assistant" && !msg.attachment_type && pendingType) {
      const tagged = { ...msg, attachment_type: pendingType };
      pendingType = undefined;
      return tagged;
    }
    pendingType = undefined;
    return msg;
  });
}

function inferAttachmentType(fileName: string): ChatMessage["attachment_type"] {
  const ext = `.${(fileName.split(".").pop() ?? "").toLowerCase()}`;
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)) return "image";
  if ([".mp4", ".mov", ".avi"].includes(ext)) return "video";
  if ([".csv", ".xlsx"].includes(ext)) return "table";
  if ([".py", ".js", ".ts", ".java", ".html", ".css"].includes(ext)) return "code";
  if ([".pdf"].includes(ext)) return "pdf";
  return undefined;
}

function isThreadPdfReady(history: ChatMessage[]): boolean {
  return history.some((msg) => {
    if (msg.attachment_type === "pdf_question" || msg.attachment_type === "pdf_response") {
      return true;
    }
    return (
      msg.role === "assistant"
      && msg.attachment_type === "pdf"
      && msg.content.toLowerCase().includes("pdf uploaded successfully")
    );
  });
}

function isThreadDbReady(history: ChatMessage[]): boolean {
  return history.some((msg) => {
    return msg.attachment_type === "db" || msg.attachment_type === "db_question" || msg.attachment_type === "db_response";
  });
}

function extractConnectedDatabaseName(content: string): string | null {
  const match = content.match(/Database:\s*(.+)/i);
  return match?.[1]?.trim() ?? null;
}

function extractSqlQuery(content: string): string | null {
  const match = content.match(/```sql\s*([\s\S]*?)```/i);
  return match?.[1]?.trim() ?? null;
}

function stripSqlQuery(content: string): string {
  return content.replace(/\n*```sql[\s\S]*?```\s*$/i, "").trim();
}

function formatDbCell(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getUserAttachmentBadgeLabel(type?: ChatMessage["attachment_type"]): string {
  if (!type) return "";
  if (type === "db_question") return "DB QUESTION";
  if (type === "pdf_question") return "PDF QUESTION";
  if (type === "pdf") return "PDF";
  return type.toUpperCase();
}

function getAssistantAttachmentBadgeLabel(type?: ChatMessage["attachment_type"]): string {
  if (!type) return "";
  if (type === "db") return "DB CONNECTED";
  if (type === "db_response") return "DB RESPONSE";
  if (type === "generated_image") return "IMAGE GENERATED";
  if (type === "pdf_response") return "PDF RESPONSE";
  if (type === "pdf") return "PDF READY";
  return `${type.toUpperCase()} RESPONSE`;
}

export default function App() {
  // -- auth state --------------------------------------------------------------
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);

  // -- chat state ---------------------------------------------------------------
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dbReadyByThread, setDbReadyByThread] = useState<Record<string, boolean>>({});
  const [dbNameByThread, setDbNameByThread] = useState<Record<string, string>>({});
  const [pdfReadyByThread, setPdfReadyByThread] = useState<Record<string, boolean>>({});
  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formulaInput, setFormulaInput] = useState("");
  const [formulaMode, setFormulaMode] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [dbForm, setDbForm] = useState<DatabaseFormState>(DEFAULT_DB_FORM);
  const [dbDefaults, setDbDefaults] = useState<DatabaseDefaultsResponse | null>(null);
  const [dbModalError, setDbModalError] = useState("");
  const [dbModalStatus, setDbModalStatus] = useState("");
  const [dbModalBusy, setDbModalBusy] = useState<"idle" | "testing" | "connecting">("idle");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Check current session on mount — also handles Google OAuth redirect back
  useEffect(() => {
    apiFetchWithTimeout("/api/auth/me", {}, 8000)
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

  useEffect(() => {
    let revokedUrl: string | null = null;

    if (!selectedFile) {
      setPreview(null);
      return;
    }

    const attachmentType = inferAttachmentType(selectedFile.name);
    if (attachmentType === "image") {
      const objectUrl = URL.createObjectURL(selectedFile);
      revokedUrl = objectUrl;
      setPreview({ kind: "image", url: objectUrl });
      return () => {
        if (revokedUrl) URL.revokeObjectURL(revokedUrl);
      };
    }

    if (attachmentType === "video") {
      const objectUrl = URL.createObjectURL(selectedFile);
      revokedUrl = objectUrl;
      setPreview({ kind: "video", url: objectUrl });
      return () => {
        if (revokedUrl) URL.revokeObjectURL(revokedUrl);
      };
    }

    if (selectedFile.name.toLowerCase().endsWith(".csv")) {
      selectedFile
        .text()
        .then((csv) => {
          const rows = csv
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0)
            .slice(0, 6)
            .map((line) => line.split(",").map((cell) => cell.trim()));
          setPreview({ kind: "table", tableRows: rows });
        })
        .catch(() => setPreview({ kind: "generic" }));
      return;
    }

    if (attachmentType === "code") {
      selectedFile
        .text()
        .then((text) => setPreview({ kind: "code", codeSnippet: text.split(/\r?\n/).slice(0, 20).join("\n") }))
        .catch(() => setPreview({ kind: "generic" }));
      return;
    }

    setPreview({ kind: "generic" });

    return () => {
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (!user || dbDefaults) return;

    apiFetch("/api/db/app-defaults")
      .then((res) => (res.ok ? res.json() : null))
      .then((defaults: DatabaseDefaultsResponse | null) => {
        if (!defaults) return;
        setDbDefaults(defaults);
        setDbForm((prev) => {
          if (prev.host || prev.database || prev.username) return prev;
          return {
            ...prev,
            ...defaults,
            password: prev.password,
          };
        });
      })
      .catch(() => {
        // keep manual defaults if the helper endpoint is unavailable
      });
  }, [dbDefaults, user]);

  const canSend = useMemo(
    () => Boolean(input.trim() || selectedFile || (formulaMode && formulaInput.trim())),
    [formulaInput, formulaMode, input, selectedFile]
  );

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
    const tagged = tagAssistantAttachmentType(data);
    setMessages(tagged);
    setPdfReadyByThread((prev) => ({ ...prev, [thread.id]: isThreadPdfReady(tagged) }));
    setDbReadyByThread((prev) => ({ ...prev, [thread.id]: isThreadDbReady(tagged) }));

    const dbMessage = tagged.find((msg) => msg.attachment_type === "db");
    const dbName = dbMessage ? extractConnectedDatabaseName(dbMessage.content) : null;
    if (dbName) {
      setDbNameByThread((prev) => ({ ...prev, [thread.id]: dbName }));
    }
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
    setDbReadyByThread({});
    setDbNameByThread({});
    setPdfReadyByThread({});
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
    setDbReadyByThread((prev) => {
      const next = { ...prev };
      delete next[thread.id];
      return next;
    });
    setDbNameByThread((prev) => {
      const next = { ...prev };
      delete next[thread.id];
      return next;
    });
    setPdfReadyByThread((prev) => {
      const next = { ...prev };
      delete next[thread.id];
      return next;
    });
    if (activeThread?.id === thread.id) {
      setActiveThread(null);
      setMessages([]);
    }
  }

  async function runDbConnection(mode: "test" | "connect") {
    let thread = activeThread;
    setDbModalError("");
    setDbModalStatus("");

    if (!dbForm.database.trim()) {
      setDbModalError(dbForm.db_type === "sqlite" ? "Database path is required" : "Database name is required");
      return;
    }

    if (dbForm.db_type !== "sqlite" && (!dbForm.host.trim() || !dbForm.username.trim())) {
      setDbModalError("Host and username are required");
      return;
    }

    if (!thread) {
      const threadRes = await apiFetch("/api/threads", {
        method: "POST",
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (!threadRes.ok) {
        setDbModalError("Unable to create a thread for this database connection");
        return;
      }
      thread = await threadRes.json() as Thread;
      setThreads((prev) => [thread!, ...prev]);
      setActiveThread(thread);
      setMessages([]);
    }

    const body = {
      ...dbForm,
      database: dbForm.database.trim(),
      host: dbForm.host.trim(),
      username: dbForm.username.trim(),
      thread_id: thread.id,
    };

    setDbModalBusy(mode === "test" ? "testing" : "connecting");

    try {
      const res = await apiFetch(mode === "test" ? "/api/db/test-connect" : "/api/db/connect", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let detail = "Database connection failed";
        try {
          const err = await res.json() as { detail?: string };
          if (err.detail) detail = err.detail;
        } catch {
          // keep fallback detail
        }
        setDbModalError(detail);
        return;
      }

      const payload = await res.json() as {
        database: string;
        tables: string[];
      };

      setDbModalStatus(`Connection successful. Found ${payload.tables.length} table(s).`);

      if (mode === "connect") {
        setDbReadyByThread((prev) => ({ ...prev, [thread.id]: true }));
        setDbNameByThread((prev) => ({ ...prev, [thread.id]: payload.database }));
        setDbModalOpen(false);
        setDbModalBusy("idle");
        await selectThread(thread);
        await loadThreads();
        return;
      }
    } finally {
      setDbModalBusy("idle");
    }
  }

  // -- send message -------------------------------------------------------------
  async function sendMessage() {
    const text = input.trim();
    const isImageGeneration = imageMode && !selectedFile && !formulaMode;
    const isDbQuestionMode = Boolean(
      activeThread
      && dbReadyByThread[activeThread.id]
      && !selectedFile
      && !formulaMode
      && !imageMode
    );
    const isPdfQuestionMode = Boolean(
      activeThread
      && !dbReadyByThread[activeThread.id]
      && pdfReadyByThread[activeThread.id]
      && !selectedFile
      && !formulaMode
      && !imageMode
    );
    const isPdfUpload = selectedFile ? inferAttachmentType(selectedFile.name) === "pdf" : false;
    const hasAttachment = Boolean(selectedFile || (formulaMode && formulaInput.trim()));
    if ((!text && !hasAttachment) || streaming) return;

    // Ensure an active thread exists
    let thread = activeThread;
    if (!thread) {
      const res = await apiFetch("/api/threads", {
        method: "POST",
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (!res.ok) {
        if (isImageGeneration) {
          let detail = "Image generation failed";
          try {
            const err = await res.json() as { detail?: string };
            if (err.detail) detail = err.detail;
          } catch {
            // keep fallback detail
          }
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: detail,
              attachment_type: "generated_image",
            };
            return updated;
          });
        }
        return;
      }
      thread = await res.json() as Thread;
      setThreads((prev) => [thread!, ...prev]);
      setActiveThread(thread);
    }

    const attachmentType = selectedFile
      ? inferAttachmentType(selectedFile.name)
      : isImageGeneration
        ? "generated_image"
      : isDbQuestionMode
        ? "db_question"
      : isPdfQuestionMode
        ? "pdf_question"
      : formulaMode && formulaInput.trim()
        ? "formula"
        : undefined;
    const userMsg: ChatMessage = {
      role: "user",
      content:
        text ||
        (selectedFile
          ? `[${attachmentType ?? "attachment"}] ${selectedFile.name} (${formatFileSize(selectedFile.size)})`
          : "[formula]"),
      attachment_type: attachmentType,
    };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setStreaming(true);

    // Append placeholder for assistant
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: isImageGeneration ? "Generating image..." : isPdfUpload ? "Processing PDF..." : "",
        attachment_type: isDbQuestionMode ? "db_response" : isPdfQuestionMode ? "pdf_response" : attachmentType,
      },
    ]);

    try {
      const res = isImageGeneration
        ? await apiFetchWithTimeout(
            "/api/generate-image",
            {
              method: "POST",
              body: JSON.stringify({
                prompt: text,
                thread_id: thread.id,
              }),
            },
            40000
          )
        : isPdfUpload
        ? await (async () => {
            const formData = new FormData();
            formData.append("thread_id", thread.id);
            if (selectedFile) {
              formData.append("file", selectedFile);
            }
            return apiFetch("/api/upload-pdf", {
              method: "POST",
              body: formData,
            });
          })()
        : isDbQuestionMode
        ? await apiFetch("/api/db/query", {
            method: "POST",
            body: JSON.stringify({
              thread_id: thread.id,
              question: text,
            }),
          })
        : isPdfQuestionMode
        ? await apiFetch("/api/chat-pdf", {
            method: "POST",
            body: JSON.stringify({
              thread_id: thread.id,
              question: text,
            }),
          })
        : hasAttachment
        ? await (async () => {
            const formData = new FormData();
            formData.append("thread_id", thread.id);
            formData.append("user_message", text);
            if (selectedFile) {
              formData.append("file", selectedFile);
            } else if (formulaMode && formulaInput.trim()) {
              formData.append("formula", formulaInput.trim());
            }
            return apiFetch("/api/chat/attachment", {
              method: "POST",
              body: formData,
            });
          })()
        : await apiFetch("/api/chat", {
            method: "POST",
            body: JSON.stringify({
              thread_id: thread.id,
              user_message: text,
            }),
          });

      if (!res.ok) {
        let detail = "Request failed";
        if (isImageGeneration) detail = "Image generation failed";
        if (isPdfUpload) detail = "PDF upload failed";
        if (isDbQuestionMode) detail = "Database query failed";
        if (isPdfQuestionMode) detail = "PDF question failed";
        try {
          const err = await res.json() as { detail?: string };
          if (err.detail) detail = err.detail;
        } catch {
          // keep fallback detail
        }
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: detail,
            attachment_type: isImageGeneration
              ? "generated_image"
              : isPdfUpload
                ? "pdf"
                : isDbQuestionMode
                  ? "db_response"
                  : isPdfQuestionMode
                    ? "pdf_response"
                    : attachmentType,
          };
          return updated;
        });
        return;
      }

      if (isImageGeneration) {
        const payload = await res.json() as {
          image_base64: string;
          image_format: string;
          prompt: string;
          thread_id: string;
        };
        const dataUrl = `data:image/${payload.image_format || "png"};base64,${payload.image_base64}`;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "",
            attachment_type: "generated_image",
            attachment_url: dataUrl,
          };
          return updated;
        });

        loadThreads();
        return;
      }

      if (isPdfUpload) {
        const payload = await res.json() as {
          pdf_name: string;
          page_count: number;
          chunk_count: number;
          message: string;
        };

        const confirmation =
          "PDF uploaded successfully. You can now ask questions about it!\n\n"
          + `File: ${payload.pdf_name}\n`
          + `Pages: ${payload.page_count}\n`
          + `Chunks: ${payload.chunk_count}`;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: confirmation,
            attachment_type: "pdf",
          };
          return updated;
        });

        setPdfReadyByThread((prev) => ({ ...prev, [thread.id]: true }));

        loadThreads();
        return;
      }

      if (isPdfQuestionMode) {
        const payload = await res.json() as {
          answer: string;
          source_pages: number[];
        };

        const sourceLine = payload.source_pages.length > 0
          ? `\n\nSource: ${payload.source_pages.map((p) => `Page ${p}`).join(", ")}`
          : "";

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `${payload.answer}${sourceLine}`,
            attachment_type: "pdf_response",
          };
          return updated;
        });

        loadThreads();
        return;
      }

      if (isDbQuestionMode) {
        const payload = await res.json() as {
          answer: string;
          sql_query: string;
          results: Array<Record<string, unknown>>;
          row_count: number;
        };

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: payload.answer,
            attachment_type: "db_response",
            db_sql_query: payload.sql_query,
            db_results: payload.results,
            db_row_count: payload.row_count,
          };
          return updated;
        });

        await loadThreads();
        return;
      }

      if (!res.body) return;

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
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload) as { token?: string; done?: boolean };
            if (!parsed.token || parsed.done) continue;
            setMessages((prev) => {
              const updated = [...prev];
              const current = updated[updated.length - 1];
              updated[updated.length - 1] = {
                role: "assistant",
                content: current.content + parsed.token,
                attachment_type: current.attachment_type,
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
    } catch (err) {
      if (isImageGeneration && err instanceof DOMException && err.name === "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Image generation took too long. Please try again.",
            attachment_type: "generated_image",
          };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      setSelectedFile(null);
      setPreview(null);
      setFormulaInput("");
      setFormulaMode(false);
      setImageMode(false);
    }
  }

  function onPickFile(file: File | null) {
    if (!file) return;
    setFormulaMode(false);
    setFormulaInput("");
    setImageMode(false);
    setSelectedFile(file);
  }

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) onPickFile(acceptedFiles[0]);
    },
    []
  );

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    multiple: false,
    accept: DROPZONE_ACCEPT,
  });

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
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-gray-800 text-gray-100 rounded-bl-sm"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="space-y-2">
                    {msg.attachment_type && (
                      <div className="inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide bg-indigo-500/40 border border-indigo-300/40">
                        {getUserAttachmentBadgeLabel(msg.attachment_type)}
                      </div>
                    )}
                    {msg.attachment_url && (() => {
                      const src = resolveAttachmentUrl(msg.attachment_url);
                      if (!src) return null;
                      if (msg.attachment_type === "image") {
                        return (
                          <img
                            src={src}
                            alt="attachment"
                            className="max-h-48 rounded-lg border border-indigo-300/40"
                          />
                        );
                      }
                      if (msg.attachment_type === "video") {
                        return (
                          <video
                            src={src}
                            controls
                            className="max-h-48 rounded-lg border border-indigo-300/40"
                          />
                        );
                      }
                      return (
                        <a
                          href={src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-xs underline text-indigo-100"
                        >
                          Open attached file
                        </a>
                      );
                    })()}
                    <span className="whitespace-pre-wrap block">{msg.content}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {msg.attachment_type && (
                      <div className="inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide bg-emerald-500/25 border border-emerald-400/35">
                        {getAssistantAttachmentBadgeLabel(msg.attachment_type)}
                      </div>
                    )}

                    {msg.attachment_type === "generated_image" && msg.attachment_url && (() => {
                      const src = resolveAttachmentUrl(msg.attachment_url);
                      if (!src) return null;
                      return (
                        <div className="space-y-2">
                          <img src={src} alt="Generated" className="max-h-72 rounded-lg border border-emerald-400/30" />
                          <a
                            href={src}
                            download={`generated-image-${Date.now()}.png`}
                            className="inline-block rounded-md border border-emerald-400/35 bg-emerald-500/15 px-2 py-1 text-xs text-emerald-100 hover:bg-emerald-500/25"
                          >
                            Download Image
                          </a>
                        </div>
                      );
                    })()}

                    {msg.attachment_type === "formula" && extractLatex(msg.content) && (
                      <FormulaBlock latex={extractLatex(msg.content) ?? ""} />
                    )}

                    {msg.attachment_type === "db_response" && (() => {
                      const sqlQuery = msg.db_sql_query ?? extractSqlQuery(msg.content);
                      const rowCount = msg.db_row_count ?? msg.db_results?.length ?? 0;
                      const answerText = stripSqlQuery(msg.content);
                      const rows = msg.db_results ?? [];
                      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

                      return (
                        <div className="space-y-3">
                          {answerText && (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                code: ({ children }) => <code className="bg-gray-700 text-indigo-300 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
                              }}
                            >
                              {answerText}
                            </ReactMarkdown>
                          )}

                          <div className="inline-flex rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide bg-sky-500/20 border border-sky-400/35 text-sky-100">
                            {rowCount} row{rowCount === 1 ? "" : "s"} returned
                          </div>

                          {sqlQuery && (
                            <details className="rounded-xl border border-gray-700 bg-gray-900/50 overflow-hidden">
                              <summary className="cursor-pointer select-none px-3 py-2 text-xs text-sky-200 hover:bg-gray-800">
                                View SQL Query
                              </summary>
                              <div className="border-t border-gray-700 px-3 py-3">
                                <LazyCodeBlock code={sqlQuery} language="sql" />
                              </div>
                            </details>
                          )}

                          {rows.length > 0 && columns.length > 0 && (
                            <div className="overflow-x-auto rounded-xl border border-gray-700">
                              <table className="min-w-full text-xs border-collapse">
                                <thead className="bg-gray-700/70">
                                  <tr>
                                    {columns.map((column) => (
                                      <th key={column} className="border border-gray-600 px-3 py-2 text-left font-semibold text-gray-100">
                                        {column}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="even:bg-gray-800/60">
                                      {columns.map((column) => (
                                        <td key={`${rowIndex}-${column}`} className="border border-gray-700 px-3 py-2 align-top text-gray-200">
                                          {formatDbCell(row[column])}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {msg.attachment_type !== "db_response" && (
                      <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-1">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-1">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-1">{children}</h3>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li className="ml-2">{children}</li>,
                        code: ({ className, children }) => {
                          const codeText = String(children).replace(/\n$/, "");
                          const match = /language-(\w+)/.exec(className || "");
                          if (!match) {
                            return <code className="bg-gray-700 text-indigo-300 rounded px-1 py-0.5 text-xs font-mono">{children}</code>;
                          }
                          return <LazyCodeBlock code={codeText} language={match[1]} />;
                        },
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-2">
                            <table className="min-w-full text-xs border-collapse">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="bg-gray-700">{children}</thead>,
                        th: ({ children }) => <th className="border border-gray-600 px-3 py-1.5 text-left font-semibold">{children}</th>,
                        td: ({ children }) => <td className="border border-gray-600 px-3 py-1.5">{children}</td>,
                        tr: ({ children }) => <tr className="even:bg-gray-750">{children}</tr>,
                        blockquote: ({ children }) => <blockquote className="border-l-4 border-indigo-500 pl-3 my-2 text-gray-300 italic">{children}</blockquote>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline hover:text-indigo-300">{children}</a>,
                        hr: () => <hr className="border-gray-600 my-3" />,
                      }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                )}
                {msg.role === "assistant" && streaming && msg.attachment_type === "generated_image" && msg.content === "Generating image..." && (
                  <div className="mt-1 inline-flex items-center gap-2 text-xs text-amber-200">
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                    <span>Generating image...</span>
                  </div>
                )}
                {msg.role === "assistant" && streaming && msg.attachment_type === "pdf" && msg.content === "Processing PDF..." && (
                  <div className="mt-1 inline-flex items-center gap-2 text-xs text-cyan-200">
                    <span className="inline-flex gap-1">
                      <span className="w-1.5 h-1.5 bg-cyan-300 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-cyan-300 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-cyan-300 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                    <span>Processing PDF...</span>
                  </div>
                )}
                {msg.role === "assistant" && msg.content === "" && streaming && msg.attachment_type !== "generated_image" && (
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
          {(selectedFile || (formulaMode && formulaInput.trim())) && (
            <div className="mb-2 rounded-xl border border-gray-700 bg-gray-900/80 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-gray-300">
                  {selectedFile
                    ? `Attachment: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`
                    : "Formula attached"}
                </p>
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-gray-200"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(null);
                    setFormulaInput("");
                    setFormulaMode(false);
                  }}
                >
                  Remove
                </button>
              </div>

              {formulaMode && formulaInput.trim() && (
                <pre className="text-xs text-emerald-200 bg-gray-950 rounded-lg p-2 overflow-x-auto">{`$$${formulaInput.trim()}$$`}</pre>
              )}

              {preview?.kind === "image" && preview.url && (
                <img src={preview.url} alt="preview" className="max-h-44 rounded-lg border border-gray-700" />
              )}

              {preview?.kind === "video" && preview.url && (
                <video src={preview.url} controls className="max-h-44 rounded-lg border border-gray-700" />
              )}

              {preview?.kind === "table" && preview.tableRows && preview.tableRows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse min-w-full">
                    <tbody>
                      {preview.tableRows.map((row, rowIndex) => (
                        <tr key={rowIndex} className={rowIndex === 0 ? "bg-gray-800" : ""}>
                          {row.map((cell, cellIndex) => (
                            <td key={`${rowIndex}-${cellIndex}`} className="border border-gray-700 px-2 py-1 text-gray-200">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {preview?.kind === "code" && preview.codeSnippet && (
                <pre className="text-xs text-gray-200 bg-gray-950 rounded-lg p-2 overflow-x-auto">
                  <code>{preview.codeSnippet}</code>
                </pre>
              )}
            </div>
          )}

          <div
            {...getRootProps()}
            className={`flex gap-2 items-end rounded-2xl border px-4 py-2.5 transition-colors ${
              isDragActive
                ? "bg-indigo-900/30 border-indigo-400"
                : "bg-gray-800 border-gray-700"
            }`}
          >
            <input {...getInputProps()} accept={ACCEPT_ATTR} />

            <button
              type="button"
              className="rounded-lg border border-gray-600 px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
              onClick={open}
              disabled={streaming}
            >
              Attach
            </button>

            <button
              type="button"
              className="rounded-lg border border-gray-600 px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-700"
              onClick={() => {
                setSelectedFile(null);
                setPreview(null);
                setImageMode(false);
                setFormulaMode((v) => !v);
              }}
              disabled={streaming}
            >
              Formula
            </button>

            <button
              type="button"
              className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                imageMode
                  ? "border-amber-400 bg-amber-500/20 text-amber-100"
                  : "border-gray-600 text-gray-300 hover:bg-gray-700"
              }`}
              onClick={() => {
                setSelectedFile(null);
                setPreview(null);
                setFormulaMode(false);
                setFormulaInput("");
                setImageMode((v) => !v);
              }}
              disabled={streaming}
            >
              Generate Image
            </button>

            <button
              type="button"
              className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                activeThread && dbReadyByThread[activeThread.id]
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                  : "border-gray-600 text-gray-300 hover:bg-gray-700"
              }`}
              onClick={() => {
                setSelectedFile(null);
                setPreview(null);
                setFormulaMode(false);
                setFormulaInput("");
                setImageMode(false);
                if (dbDefaults) {
                  setDbForm((prev) => ({
                    ...prev,
                    ...dbDefaults,
                    password: prev.password,
                  }));
                }
                setDbModalError("");
                setDbModalStatus("");
                setDbModalOpen(true);
              }}
              disabled={streaming}
            >
              Database
            </button>

            {imageMode && (
              <span className="rounded-full border border-amber-400/70 bg-amber-500/20 px-2 py-1 text-[10px] uppercase tracking-wide text-amber-100">
                Image Mode ON
              </span>
            )}

            {activeThread && dbReadyByThread[activeThread.id] && !imageMode && (
              <span className="rounded-full border border-emerald-400/70 bg-emerald-500/20 px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-100">
                DB CONNECTED {dbNameByThread[activeThread.id] ? `• ${dbNameByThread[activeThread.id]}` : ""}
              </span>
            )}

            {activeThread && !dbReadyByThread[activeThread.id] && pdfReadyByThread[activeThread.id] && !imageMode && (
              <span className="rounded-full border border-cyan-400/70 bg-cyan-500/20 px-2 py-1 text-[10px] uppercase tracking-wide text-cyan-100">
                PDF READY
              </span>
            )}

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={
                imageMode
                  ? "Describe the image you want to generate..."
                  : activeThread && dbReadyByThread[activeThread.id]
                    ? "Ask a question about your database..."
                  : activeThread && pdfReadyByThread[activeThread.id]
                    ? "Ask a question about the PDF..."
                  : "Type a message... (Enter to send, Shift+Enter for newline)"
              }
              className="flex-1 bg-transparent resize-none text-sm text-gray-100 placeholder-gray-500 focus:outline-none min-h-[1.5rem] max-h-40 overflow-y-auto"
            />

            {formulaMode && (
              <textarea
                value={formulaInput}
                onChange={(e) => setFormulaInput(e.target.value)}
                rows={1}
                placeholder="LaTeX formula: e.g. \int_0^1 x^2 dx"
                className="w-64 bg-gray-900 resize-none text-xs text-emerald-100 placeholder-gray-500 rounded-lg border border-gray-700 px-2 py-1.5 focus:outline-none"
              />
            )}

            <button
              onClick={sendMessage}
              disabled={!canSend || streaming}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 py-1.5 text-sm font-medium transition-colors shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {dbModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-100">Database Connection</h3>
                <p className="mt-1 text-xs text-gray-400">Connect PostgreSQL, MySQL, or SQLite to this thread.</p>
              </div>
              <button
                type="button"
                className="rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
                onClick={() => setDbModalOpen(false)}
                disabled={dbModalBusy !== "idle"}
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              {dbDefaults && (
                <div className="md:col-span-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                  App DB defaults loaded. Enter only the database password if you want to query the current Amzur database.
                </div>
              )}

              <label className="space-y-1 text-sm text-gray-200">
                <span className="text-xs text-gray-400">Database Type</span>
                <select
                  value={dbForm.db_type}
                  onChange={(e) => {
                    const nextType = e.target.value as DatabaseType;
                    setDbForm((prev) => ({
                      ...prev,
                      db_type: nextType,
                      port: nextType === "mysql" ? 3306 : nextType === "sqlite" ? 0 : 5432,
                    }));
                  }}
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:outline-none"
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="sqlite">SQLite</option>
                </select>
              </label>

              {dbForm.db_type !== "sqlite" ? (
                <label className="space-y-1 text-sm text-gray-200">
                  <span className="text-xs text-gray-400">Host</span>
                  <input
                    value={dbForm.host}
                    onChange={(e) => setDbForm((prev) => ({ ...prev, host: e.target.value }))}
                    className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:outline-none"
                  />
                </label>
              ) : (
                <div />
              )}

              {dbForm.db_type !== "sqlite" ? (
                <label className="space-y-1 text-sm text-gray-200">
                  <span className="text-xs text-gray-400">Port</span>
                  <input
                    type="number"
                    value={dbForm.port}
                    onChange={(e) => setDbForm((prev) => ({ ...prev, port: Number(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:outline-none"
                  />
                </label>
              ) : (
                <div />
              )}

              <label className="space-y-1 text-sm text-gray-200">
                <span className="text-xs text-gray-400">{dbForm.db_type === "sqlite" ? "Database File Path" : "Database Name"}</span>
                <input
                  value={dbForm.database}
                  onChange={(e) => setDbForm((prev) => ({ ...prev, database: e.target.value }))}
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:outline-none"
                  placeholder={dbForm.db_type === "sqlite" ? "C:/path/to/app.db" : "database_name"}
                />
              </label>

              {dbForm.db_type !== "sqlite" ? (
                <label className="space-y-1 text-sm text-gray-200">
                  <span className="text-xs text-gray-400">Database Username</span>
                  <input
                    value={dbForm.username}
                    onChange={(e) => setDbForm((prev) => ({ ...prev, username: e.target.value }))}
                    className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:outline-none"
                  />
                  <span className="text-[11px] text-gray-500">Use the database user, not your Amzur login email.</span>
                </label>
              ) : (
                <div />
              )}

              {dbForm.db_type !== "sqlite" ? (
                <label className="space-y-1 text-sm text-gray-200 md:col-span-2">
                  <span className="text-xs text-gray-400">Password</span>
                  <input
                    type="password"
                    value={dbForm.password}
                    onChange={(e) => setDbForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:outline-none"
                  />
                </label>
              ) : null}
            </div>

            {(dbModalError || dbModalStatus) && (
              <div className="px-5 pb-1">
                {dbModalError && (
                  <div className="rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                    {dbModalError}
                  </div>
                )}
                {dbModalStatus && !dbModalError && (
                  <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                    {dbModalStatus}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-gray-800 px-5 py-4">
              <button
                type="button"
                className="rounded-xl border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50"
                onClick={() => runDbConnection("test")}
                disabled={dbModalBusy !== "idle"}
              >
                {dbModalBusy === "testing" ? "Testing..." : "Test Connection"}
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                onClick={() => runDbConnection("connect")}
                disabled={dbModalBusy !== "idle"}
              >
                {dbModalBusy === "connecting" ? "Connecting..." : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
