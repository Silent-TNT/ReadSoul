"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isValidKey, useApiKey } from "@/hooks/useApiKey";
import ThemeToggle from "@/components/ThemeToggle";

export default function LandingPage() {
  const router = useRouter();
  const { apiKey, setApiKey, ready } = useApiKey();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (ready && apiKey) setInput(apiKey);
  }, [ready, apiKey]);

  function handleEnter() {
    const key = input.trim();
    if (!isValidKey(key)) {
      setError("请输入以 wrk- 开头的有效 API Key");
      return;
    }
    setError("");
    setApiKey(key);
    router.push("/dashboard");
  }

  return (
    <main className="grain relative min-h-screen overflow-hidden">
      {/* 主题切换 */}
      <div className="absolute right-5 top-5 z-20">
        <ThemeToggle />
      </div>

      {/* 背景光晕 */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-soul-gold/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-soul-jade/10 blur-[120px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16">
        <div className="animate-fade-in text-center">
          <p className="mb-4 font-sans text-sm tracking-[0.5em] text-soul-gold/70">
            READSOUL
          </p>
          <h1 className="font-serif text-6xl font-black tracking-wider text-soul-cream sm:text-8xl">
            阅<span className="gold-text">己</span>
          </h1>
          <p className="mt-6 font-serif text-xl tracking-[0.3em] text-white/60 sm:text-2xl">
            见 人 阅 己
          </p>
          <p className="mx-auto mt-6 max-w-md font-serif text-sm leading-relaxed tracking-wide soul-card-sub sm:text-base">
            连接微信读书，把阅读绘成可凝视、可分享的灵魂图谱。
          </p>
        </div>

        {/* Key 输入卡片 */}
        <div className="animate-fade-up mt-12 w-full max-w-md">
          <div className="soul-card">
            <label className="soul-card-title block">连接你的阅读数据</label>
            <p className="soul-card-sub mb-4">
              输入微信读书 API Key（以 <code className="text-soul-gold">wrk-</code> 开头）
            </p>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEnter()}
              placeholder="wrk-xxxxxxxxxxxxxxxx"
              className="w-full rounded-xl border border-white/10 bg-ink-900/80 px-4 py-3 font-mono text-sm text-soul-cream outline-none transition focus:border-soul-gold/60 focus:ring-1 focus:ring-soul-gold/30"
            />
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            <button
              onClick={handleEnter}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-soul-amber to-soul-gold px-4 py-3 font-medium text-ink-950 transition hover:brightness-110 active:scale-[0.99]"
            >
              进入我的阅读图谱
            </button>
            <button
              onClick={() => setShowGuide((v) => !v)}
              className="mt-3 w-full text-center text-xs soul-card-sub underline-offset-4 transition hover:text-soul-gold hover:underline"
            >
              如何获取我的 API Key？
            </button>
            <p className="mt-3 text-center text-[11px] leading-relaxed soul-card-sub">
              Key 仅保存在你的浏览器本地，每次请求经服务端代理转发，我们不会存储。
            </p>
          </div>

          {showGuide && (
            <div className="soul-card animate-fade-up mt-4 text-sm leading-relaxed">
              <p className="soul-card-title mb-3 text-base">获取微信读书 API Key</p>

              <p className="mb-2 text-xs soul-card-sub">
                请先确保微信读书已更新至
                <strong className="font-semibold text-soul-cream">最新版</strong>
                （App Store / 应用商店搜索「微信读书」→ 更新），旧版本可能看不到 API Key 入口。
              </p>

              <p className="mb-1.5 text-xs font-medium text-soul-gold">方式一 · 手机 App</p>
              <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-xs soul-card-sub marker:text-soul-gold">
                <li>打开微信读书 → 底部「我」→ 「设置」</li>
                <li>找到「微信读书 skill」</li>
                <li>
                  滑至底部「复制 key」（复制以{" "}
                  <code className="text-soul-gold">wrk-</code> 开头的 Key）
                </li>
              </ol>

              <p className="mb-1.5 text-xs font-medium text-soul-gold">方式二 · 电脑浏览器</p>
              <ol className="list-decimal space-y-1.5 pl-5 text-xs soul-card-sub marker:text-soul-gold">
                <li>
                  打开{" "}
                  <a
                    href="https://weread.qq.com/r/weread-skills"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-soul-gold underline-offset-2 hover:underline"
                  >
                    weread.qq.com/r/weread-skills
                  </a>
                </li>
                <li>点击「快速配置」→「登录微信读书」（可用 App 扫码）</li>
                <li>登录成功后复制页面上的 <code className="text-soul-gold">wrk-</code> Key</li>
              </ol>

              <p className="mt-3 text-xs soul-card-sub">
                API Key 等同于你的阅读账号凭证，请勿分享给他人；Key 仅保存在浏览器本地。
              </p>
            </div>
          )}
        </div>

        {/* 特性预告 */}
        <div className="animate-fade-up mt-14 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["阅读全景", "时间轴 · 词云 · 时段"],
            ["阅读人格", "AI MBTI 解读"],
            ["我的笔记", "浏览 · 导出 · AI"],
            ["观点织网", "跨书观点碰撞"],
            ["灵魂解读", "AI 伴读对话"],
            ["阅读海报", "一键生成分享图"],
          ].map(([t, d]) => (
            <div
              key={t}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center"
            >
              <p className="font-serif text-sm text-soul-cream">{t}</p>
              <p className="mt-1 text-[11px] text-white/35">{d}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-[11px] text-white/25">
          阅己 ReadSoul · readsoul.cn · 让人们更好地认识自己
          <br />
          <a href="/privacy" className="mt-1 inline-block hover:text-soul-gold">
            隐私说明
          </a>
        </p>
      </div>
    </main>
  );
}
