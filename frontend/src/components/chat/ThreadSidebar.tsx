import { useRef, useState } from "react";
import type { Thread, User } from "../../types";

interface Props {
  threads: Thread[];
  activeThread: Thread | null;
  onSelect: (thread: Thread) => void;
  onNewChat: () => void;
  onRename: (thread: Thread, newTitle: string) => void;
  onDelete: (thread: Thread) => void;
  user: User;
  onLogout: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ThreadSidebar({ threads, activeThread, onSelect, onNewChat, onRename, onDelete, user, onLogout }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (thread: Thread) => {
    setEditingId(thread.id);
    setEditValue(thread.title);
    setMenuId(null);
    setTimeout(() => inputRef.current?.select(), 30);
  };

  const commitEdit = (thread: Thread) => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== thread.title) onRename(thread, trimmed);
    setEditingId(null);
  };

  return (
    <aside
      className="flex flex-col w-64 shrink-0 bg-gray-900 border-r border-gray-800 h-full"
      onClick={() => setMenuId(null)}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-800">
        <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
          AI
        </div>
        <span className="font-semibold text-white text-sm truncate">Amzur AI</span>
      </div>

      {/* New Chat button */}
      <div className="px-3 pt-3 pb-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          New Chat
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {threads.length === 0 && (
          <p className="text-xs text-gray-600 px-2 py-4 text-center">No conversations yet</p>
        )}
        {threads.map((thread) => (
          <div
            key={thread.id}
            className={`group relative flex items-center rounded-lg transition-colors ${
              activeThread?.id === thread.id
                ? "bg-indigo-600/20 border border-indigo-500/30"
                : "hover:bg-gray-800 border border-transparent"
            }`}
          >
            {editingId === thread.id ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => commitEdit(thread)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit(thread);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="flex-1 bg-transparent text-sm text-white px-3 py-2.5 focus:outline-none"
              />
            ) : (
              <button
                onClick={() => onSelect(thread)}
                className="flex-1 text-left px-3 py-2.5 min-w-0"
              >
                <p className={`text-sm truncate leading-tight ${
                  activeThread?.id === thread.id ? "text-indigo-200" : "text-gray-200"
                }`}>
                  {thread.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{timeAgo(thread.updated_at)}</p>
              </button>
            )}

            {/* Three-dot menu trigger */}
            {editingId !== thread.id && (
              <button
                onClick={(e) => { e.stopPropagation(); setMenuId(menuId === thread.id ? null : thread.id); }}
                className="opacity-0 group-hover:opacity-100 mr-2 p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-700 shrink-0 text-xs leading-none"
                title="Options"
              >
                ···
              </button>
            )}

            {/* Dropdown */}
            {menuId === thread.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-8 z-50 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1"
              >
                <button
                  onClick={() => startEdit(thread)}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                >
                  Rename
                </button>
                <button
                  onClick={() => { onDelete(thread); setMenuId(null); }}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-gray-700"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div className="border-t border-gray-800 px-3 py-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {user.display_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-200 truncate">{user.display_name}</p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
        </div>
        <button
          onClick={onLogout}
          title="Sign out"
          className="text-gray-500 hover:text-gray-300 transition-colors text-xs shrink-0"
        >
          ⏏
        </button>
      </div>
    </aside>
  );
}

