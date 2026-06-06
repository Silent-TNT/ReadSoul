"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import SectionCard from "@/components/SectionCard";
import type { PersonalityResult } from "@/lib/types";
import { apiFetch } from "@/lib/apiClient";
import { useToast } from "@/components/Toast";

interface Summary {
  totalReadTimeText?: string;
  readDays?: number;
  finishedCount?: number;
  readCount?: number;
  noteCount?: number;
  topCategories?: string[];
  topAuthors?: string[];
  preferTimeWord?: string;
  topBooks?: string[];
}

export default function PersonalitySection({
  summary,
  apiKey,
}: {
  summary: Summary;
  apiKey?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<PersonalityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const toast = useToast();

  async function analyze() {
    setLoading(true);
    setDegraded(false);
    try {
      const resp = await apiFetch("/api/ai/personality", {
        method: "POST",
        apiKey,
        body: JSON.stringify(summary),
      });
      const data = (await resp.json()) as PersonalityResult & {
        source?: string;
        warning?: string;
      };
      setResult(data);
      if (data.source === "rule" || data.warning) {
        setDegraded(true);
      }
    } catch {
      setDegraded(true);
      setResult({
        title: "神秘阅读者",
        summary: "分析服务暂时不可用，已切换为规则推断。",
        traits: ["独立思考"],
        quote: "见人阅己。",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0b0b0f",
      });
      const link = document.createElement("a");
      link.download = `阅己-阅读人格-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.show("导出失败，请重试", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <SectionCard
      title="阅读人格 · MBTI"
      subtitle="AI 从阅读数据推断你的 MBTI 类型"
      action={
        result && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="rounded-lg bg-gradient-to-r from-soul-amber to-soul-gold px-3 py-1.5 text-xs font-medium text-ink-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {exporting ? "生成中…" : "导出分享图"}
          </button>
        )
      }
    >
      {!result ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="max-w-md text-sm text-white/45">
            基于你的阅读时长、笔记、偏好分类与时段，推断你的 MBTI 阅读人格（趣味参考）。
          </p>
          <button
            onClick={analyze}
            disabled={loading}
            className="mt-5 rounded-xl bg-gradient-to-r from-soul-amber to-soul-gold px-6 py-2.5 text-sm font-medium text-ink-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "正在解读你的灵魂…" : "生成我的 MBTI 阅读人格"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {degraded && (
            <p className="mb-4 text-center text-xs text-amber-400/90">
              AI 服务不可用，当前为规则推断结果（趣味参考）
            </p>
          )}
          <div
            ref={cardRef}
            className="share-surface relative w-full max-w-lg overflow-hidden rounded-2xl border border-soul-gold/20 bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 p-8 text-center"
          >
            <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-soul-gold/10 blur-3xl" />
            <p className="text-xs tracking-[0.4em] text-soul-gold/60">
              READING PERSONA · MBTI
            </p>
            {result.mbti && (
              <h3 className="mt-2 font-serif text-6xl font-black tracking-[0.15em] gold-text">
                {result.mbti}
              </h3>
            )}
            {result.title && (
              <p className="mt-1 font-serif text-2xl font-bold text-soul-cream">
                {result.title}
              </p>
            )}
            {result.dimensions && result.dimensions.length > 0 && (
              <div className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-2">
                {result.dimensions.map((d) => (
                  <div
                    key={d.axis}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-xl font-bold text-soul-amber">
                        {d.pick}
                      </span>
                      <span className="text-sm text-soul-cream">{d.label}</span>
                      <span className="ml-auto text-[10px] text-white/30">
                        {d.axis}
                      </span>
                    </div>
                    {d.reason && (
                      <p className="mt-0.5 text-[11px] text-white/45">{d.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {result.traits && result.traits.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {result.traits.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-soul-jade/30 bg-soul-jade/10 px-3 py-1 text-xs text-soul-jade"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-5 text-sm leading-relaxed text-white/70">
              {result.summary}
            </p>
            {result.quote && (
              <p className="mt-5 font-serif text-base italic text-soul-amber">
                「{result.quote}」
              </p>
            )}
            <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-white/30">
              <span className="font-serif tracking-[0.2em]">阅己 ReadSoul</span>
              <span>·</span>
              <span>readsoul.cn</span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={analyze}
              disabled={loading}
              className="text-xs text-white/40 underline-offset-4 transition hover:text-soul-gold hover:underline"
            >
              {loading ? "重新解读中…" : "重新生成"}
            </button>
            {result.source === "rule" && (
              <span className="text-[11px] text-white/25">
                （规则式生成，配置 AI Key 可获得更深刻的画像）
              </span>
            )}
          </div>
          {result.warning && (
            <p className="mt-2 max-w-md text-center text-[11px] text-amber-500/70">
              {result.warning}
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
