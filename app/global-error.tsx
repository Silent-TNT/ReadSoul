"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN" data-theme="dark">
      <body className="min-h-screen bg-ink-950 antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center px-6">
          <div className="max-w-md rounded-2xl border border-white/10 bg-ink-900/80 p-8 text-center">
            <p className="font-serif text-xl text-soul-cream">阅己 ReadSoul</p>
            <p className="mt-3 text-sm text-white/50">应用发生严重错误，请刷新页面。</p>
            <button
              onClick={reset}
              className="mt-6 rounded-xl bg-gradient-to-r from-soul-amber to-soul-gold px-5 py-2.5 text-sm font-medium text-ink-950"
            >
              刷新
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
