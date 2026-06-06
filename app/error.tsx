"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grain flex min-h-screen flex-col items-center justify-center px-6">
      <div className="soul-card max-w-md text-center">
        <p className="font-serif text-xl text-soul-cream">页面遇到了一点问题</p>
        <p className="mt-3 text-sm soul-card-sub">
          可能是图表或数据加载异常，请尝试刷新。
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-xl bg-gradient-to-r from-soul-amber to-soul-gold px-5 py-2.5 text-sm font-medium text-ink-950 transition hover:brightness-110"
          >
            重试
          </button>
          <a
            href="/"
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-white/70 transition hover:bg-white/5"
          >
            返回首页
          </a>
        </div>
      </div>
    </main>
  );
}
