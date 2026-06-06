"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "readsoul_onboarded";

export default function DashboardOnboarding() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // ignore
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="soul-card mb-6 animate-fade-in border-soul-gold/20">
      <p className="soul-card-title">欢迎使用阅己</p>
      <ul className="mt-3 space-y-2 text-sm soul-card-sub">
        <li>
          <strong className="text-soul-cream">阅读海报</strong>：生成可分享的海报
        </li>
        <li>
          <strong className="text-soul-cream">阅读全景</strong>
          ：回顾一句、统计、人格、词云等
        </li>
        <li>
          <strong className="text-soul-cream">我的笔记</strong>：浏览与导出划线
        </li>
        <li>
          <strong className="text-soul-cream">观点织网</strong>
          ：AI 分析跨书观点（需等待笔记加载，约 1–2 分钟）
        </li>
        <li>
          <strong className="text-soul-cream">灵魂解读</strong>：与 AI 对话你的阅读
        </li>
      </ul>
      <p className="mt-3 text-xs soul-card-sub">
        右上角切换功能模块；左上角菜单可刷新数据、更换 Key 与切换主题。
      </p>
      <button
        onClick={dismiss}
        className="mt-4 rounded-lg bg-gradient-to-r from-soul-amber to-soul-gold px-4 py-2 text-sm font-medium text-ink-950 transition hover:brightness-110"
      >
        知道了
      </button>
    </div>
  );
}
