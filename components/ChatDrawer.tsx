"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CloseIcon, SendIcon, ChatIcon } from "@/components/icons";
import Markdown from "@/components/Markdown";
import { retrieveNotes, formatRagContext, type RagChunk } from "@/lib/rag";
import { loadInsightContextForChat } from "@/lib/insightCache";
import type { NoteCorpusItem } from "@/lib/noteLinks";
import { apiFetch } from "@/lib/apiClient";
import {
  type ChatMsg,
  type ChatThread,
  ensureActiveThread,
  createThread,
  loadChatThreads,
  upsertThread,
  saveActiveThreadId,
  deriveTitle,
} from "@/lib/soulChatStorage";

export const SUGGESTIONS = [
  "你觉得我是一个什么样的人？你觉得我的阅读习惯如何？真实，不玻璃心",
  "分析我书架里的书，推荐 3 本你觉得我会喜欢的书。",
  "从我的划线里，找出最有碰撞感的几组观点",
  "观点织网里有哪些跨书共鸣？帮我展开分析",
  "引用原文，告诉我最近在读什么、思考什么",
  "有哪些笔记值得写成长文思考？",
];

interface SoulChatContextValue {
  thread: ChatThread | null;
  threads: ChatThread[];
  messages: ChatMsg[];
  input: string;
  setInput: (v: string) => void;
  streaming: boolean;
  historyOpen: boolean;
  setHistoryOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  send: (text: string) => Promise<void>;
  handleNewChat: () => void;
  switchThread: (id: string) => void;
  initSession: () => void;
  noteCorpusCount: number;
}

const SoulChatContext = createContext<SoulChatContextValue | null>(null);

function useSoulChatContext() {
  const ctx = useContext(SoulChatContext);
  if (!ctx) throw new Error("SoulChatProvider required");
  return ctx;
}

interface ProviderProps {
  context: string;
  noteCorpus?: NoteCorpusItem[];
  apiKey?: string;
  active: boolean;
  children: ReactNode;
}

export function SoulChatProvider({
  context,
  noteCorpus = [],
  apiKey,
  active,
  children,
}: ProviderProps) {
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messages = thread?.messages ?? [];

  const initSession = useCallback(() => {
    const activeThread = ensureActiveThread();
    setThread(activeThread);
    setThreads(loadChatThreads());
  }, []);

  useEffect(() => {
    if (active) initSession();
  }, [active, initSession]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streaming, active]);

  const persistThread = useCallback((t: ChatThread) => {
    upsertThread(t);
    setThreads(loadChatThreads());
  }, []);

  useEffect(() => {
    if (!thread || streaming || !active) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistThread({ ...thread, title: deriveTitle(thread.messages) });
    }, 400);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [thread, streaming, active, persistThread]);

  function switchThread(id: string) {
    const found = loadChatThreads().find((t) => t.id === id);
    if (!found) return;
    saveActiveThreadId(id);
    setThread(found);
    setHistoryOpen(false);
  }

  function handleNewChat() {
    const t = createThread();
    setThread(t);
    setThreads(loadChatThreads());
    setHistoryOpen(false);
  }

  function setMessages(next: ChatMsg[]) {
    setThread((prev) => (prev ? { ...prev, messages: next } : prev));
  }

  function appendToLast(chunk: string) {
    setThread((prev) => {
      if (!prev) return prev;
      const copy = [...prev.messages];
      const last = copy[copy.length - 1];
      if (last && last.role === "assistant") {
        copy[copy.length - 1] = { ...last, content: last.content + chunk };
      }
      return { ...prev, messages: copy };
    });
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming || !thread) return;
    setInput("");

    const ragChunks: RagChunk[] =
      noteCorpus.length > 0 ? retrieveNotes(noteCorpus, content, 10) : [];
    const insightContext =
      noteCorpus.length > 0
        ? await loadInsightContextForChat(noteCorpus)
        : "";
    const ragContext = [formatRagContext(ragChunks), insightContext]
      .filter(Boolean)
      .join("\n\n");

    const next: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages([
      ...next,
      { role: "assistant", content: "", ragCount: ragChunks.length },
    ]);
    setStreaming(true);

    try {
      const resp = await apiFetch("/api/ai/chat", {
        method: "POST",
        apiKey,
        body: JSON.stringify({ messages: next, context, ragContext }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        appendToLast(`⚠️ ${err.error || "灵魂解读服务暂不可用"}`);
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) appendToLast(delta);
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      appendToLast(`⚠️ ${(e as Error).message}`);
    } finally {
      setStreaming(false);
      setThread((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, title: deriveTitle(prev.messages) };
        upsertThread(updated);
        setThreads(loadChatThreads());
        return updated;
      });
    }
  }

  return (
    <SoulChatContext.Provider
      value={{
        thread,
        threads,
        messages,
        input,
        setInput,
        streaming,
        historyOpen,
        setHistoryOpen,
        scrollRef,
        send,
        handleNewChat,
        switchThread,
        initSession,
        noteCorpusCount: noteCorpus.length,
      }}
    >
      {children}
    </SoulChatContext.Provider>
  );
}

function ChatToolbar({ onClose }: { onClose: () => void }) {
  const {
    thread,
    handleNewChat,
    historyOpen,
    setHistoryOpen,
  } = useSoulChatContext();

  return (
    <header className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
      <div className="min-w-0 flex-1">
        <h3 className="font-serif text-lg text-soul-cream">灵魂解读</h3>
        <p className="truncate text-xs soul-card-sub">
          {thread?.title ?? "新对话"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={handleNewChat}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] soul-card-sub transition hover:border-soul-gold/40 hover:text-soul-gold"
        >
          新对话
        </button>
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] soul-card-sub transition hover:border-soul-gold/40 hover:text-soul-gold"
        >
          历史
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="收起灵魂解读"
          title="收起"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/5 hover:text-soul-gold"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function ChatHistory() {
  const { threads, thread, switchThread, historyOpen } = useSoulChatContext();
  if (!historyOpen) return null;

  return (
    <div className="max-h-40 overflow-y-auto border-b border-white/10 px-3 py-2">
      {threads.length === 0 ? (
        <p className="px-2 py-2 text-xs soul-card-sub">暂无历史对话</p>
      ) : (
        threads.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchThread(t.id)}
            className={`mb-1 w-full truncate rounded-lg px-3 py-2 text-left text-xs transition ${
              t.id === thread?.id
                ? "bg-soul-gold/15 text-soul-gold"
                : "text-white/65 hover:bg-white/5"
            }`}
          >
            {t.title}
          </button>
        ))
      )}
    </div>
  );
}

function ChatMessages() {
  const { messages, streaming, scrollRef, send } = useSoulChatContext();

  return (
    <div
      ref={scrollRef}
      className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5"
    >
      {messages.length === 0 && (
        <div>
          <p className="text-sm soul-card-sub">
            问我任何关于你阅读的问题。我会检索相关划线原文再回答。
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-left text-sm soul-card-sub transition hover:border-soul-gold/40 hover:text-soul-gold"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === "user"
                ? "whitespace-pre-wrap bg-gradient-to-r from-soul-amber to-soul-gold text-ink-950"
                : "border border-white/10 bg-white/[0.03] text-soul-cream"
            }`}
          >
            {m.role === "user" ? (
              m.content
            ) : m.content ? (
              <>
                {m.ragCount != null && m.ragCount > 0 && (
                  <p className="mb-2 text-[10px] text-soul-jade/80">
                    已检索 {m.ragCount} 条相关笔记
                  </p>
                )}
                <Markdown content={m.content} />
              </>
            ) : (
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-soul-gold" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-soul-gold [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-soul-gold [animation-delay:-0.3s]" />
              </span>
            )}
          </div>
        </div>
      ))}
      {streaming && messages.length > 0 && null}
    </div>
  );
}

function ChatComposer() {
  const { input, setInput, streaming, send } = useSoulChatContext();

  return (
    <div className="border-t border-white/10 p-4">
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          placeholder="基于我的划线，深度解读…"
          className="soul-input max-h-32 flex-1 resize-none py-2.5"
        />
        <button
          type="button"
          onClick={() => send(input)}
          disabled={streaming || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-soul-amber to-soul-gold text-ink-950 disabled:opacity-40"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ChatPanelBody({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ backgroundColor: "var(--c-surface-solid)" }}
    >
      <ChatToolbar onClose={onClose} />
      <ChatHistory />
      <ChatMessages />
      <ChatComposer />
    </div>
  );
}

/** Tab 内全屏嵌入（灵魂解读 Tab） */
export function SoulChatEmbedded({ onClose }: { onClose: () => void }) {
  return (
    <div className="soul-card overflow-hidden p-0">
      <div className="min-h-[calc(100vh-11rem)] sm:min-h-[70vh]">
        <ChatPanelBody onClose={onClose} />
      </div>
    </div>
  );
}

/** 全屏浮层（从其它 Tab 唤起） */
export function SoulChatOverlay({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div
        onClick={onClose}
        className="animate-backdrop fixed inset-0 top-14 z-40 bg-black/50 backdrop-blur-sm"
      />
      <div
        className="fixed inset-x-0 bottom-0 top-14 z-50 flex flex-col"
        style={{ backgroundColor: "var(--c-surface-solid)" }}
      >
        <ChatPanelBody onClose={onClose} />
      </div>
    </>
  );
}

export function SoulChatFab({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="打开灵魂解读"
      className="fixed bottom-6 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-soul-amber to-soul-gold text-ink-950 shadow-lg shadow-soul-gold/30 transition hover:scale-105 active:scale-95"
    >
      <ChatIcon className="h-6 w-6" />
    </button>
  );
}

/** @deprecated 保留默认导出以兼容 dynamic import */
export default function ChatDrawer({
  open,
  onOpenChange,
  context,
  noteCorpus,
  apiKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: string;
  noteCorpus?: NoteCorpusItem[];
  apiKey?: string;
}) {
  return (
    <SoulChatProvider
      context={context}
      noteCorpus={noteCorpus}
      apiKey={apiKey}
      active={open}
    >
      {!open && <SoulChatFab onOpen={() => onOpenChange(true)} />}
      {open && <SoulChatOverlay onClose={() => onOpenChange(false)} />}
    </SoulChatProvider>
  );
}
