// Shared TypeScript interfaces for all API request/response shapes.
// Import types from this module — never inline them in components or hooks.

export interface User {
  id: string;
  email: string;
  display_name: string;
}

export interface Thread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  attachment_url?: string;
  attachment_type?: string;
  db_sql_query?: string;
  db_results?: Array<Record<string, unknown>>;
  db_row_count?: number;
  db_database_name?: string;
  created_at?: string;
}
