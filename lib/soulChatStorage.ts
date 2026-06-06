export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  ragCount?: number;
}

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMsg[];
  updatedAt: number;
}

const STORAGE_KEY = "readsoul_chat_threads";
const ACTIVE_KEY = "readsoul_chat_active";

function readThreads(): ChatThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatThread[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeThreads(threads: ChatThread[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(threads.slice(0, 30)));
}

export function loadChatThreads(): ChatThread[] {
  return readThreads().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadActiveThreadId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveThreadId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function createThread(): ChatThread {
  const thread: ChatThread = {
    id: `t_${Date.now()}`,
    title: "新对话",
    messages: [],
    updatedAt: Date.now(),
  };
  const threads = [thread, ...readThreads()];
  writeThreads(threads);
  saveActiveThreadId(thread.id);
  return thread;
}

export function getThread(id: string): ChatThread | null {
  return readThreads().find((t) => t.id === id) ?? null;
}

export function upsertThread(thread: ChatThread) {
  const threads = readThreads();
  const idx = threads.findIndex((t) => t.id === thread.id);
  const next = { ...thread, updatedAt: Date.now() };
  if (idx >= 0) threads[idx] = next;
  else threads.unshift(next);
  writeThreads(threads);
}

export function deriveTitle(messages: ChatMsg[]): string {
  const first = messages.find((m) => m.role === "user" && m.content.trim());
  if (!first) return "新对话";
  const t = first.content.trim().replace(/\s+/g, " ");
  return t.length <= 18 ? t : `${t.slice(0, 18)}…`;
}

export function ensureActiveThread(): ChatThread {
  const activeId = loadActiveThreadId();
  if (activeId) {
    const found = getThread(activeId);
    if (found) return found;
  }
  const threads = loadChatThreads();
  if (threads.length > 0) {
    saveActiveThreadId(threads[0].id);
    return threads[0];
  }
  return createThread();
}
