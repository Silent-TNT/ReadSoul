"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "info" | "error" | "success";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-20 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-fade-up rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md ${
              t.kind === "error"
                ? "border-red-400/30 bg-red-950/90 text-red-200"
                : t.kind === "success"
                  ? "border-soul-jade/30 bg-ink-950/90 text-soul-jade"
                  : "border-white/10 bg-ink-950/90 text-soul-cream"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { show: () => {} };
  }
  return ctx;
}
