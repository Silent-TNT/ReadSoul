import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grain flex min-h-screen flex-col items-center justify-center px-6">
      <div className="soul-card max-w-md text-center">
        <p className="font-serif text-4xl font-black text-soul-cream">404</p>
        <p className="mt-3 text-sm soul-card-sub">这一页似乎不在你的阅读图谱里。</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-gradient-to-r from-soul-amber to-soul-gold px-5 py-2.5 text-sm font-medium text-ink-950 transition hover:brightness-110"
        >
          返回首页
        </Link>
      </div>
    </main>
  );
}
