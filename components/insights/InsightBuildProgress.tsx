"use client";

import type { InsightBuildStage } from "@/lib/insightTypes";

const STAGE_LABEL: Record<InsightBuildStage, string> = {
  idle: "准备中",
  preview: "本地预览",
  embedding: "语义向量",
  clustering: "观点聚类",
  prompts: "思考引导",
  done: "完成",
  error: "失败",
};

const STAGE_ORDER: InsightBuildStage[] = [
  "preview",
  "embedding",
  "clustering",
  "prompts",
  "done",
];

interface Props {
  stage: InsightBuildStage;
  message?: string;
  isPreview?: boolean;
}

export default function InsightBuildProgress({
  stage,
  message,
  isPreview,
}: Props) {
  if (stage === "idle" || stage === "done") return null;

  const currentIdx = STAGE_ORDER.indexOf(stage);

  return (
    <div className="soul-card border border-soul-gold/20 bg-soul-gold/5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-soul-gold" />
        <p className="text-sm text-soul-cream">
          {isPreview ? "预览模式 · AI 分析中…" : "AI 分析中…"}
          {message ? ` ${message}` : ""}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {STAGE_ORDER.slice(0, -1).map((s, idx) => {
          const active = s === stage;
          const done = currentIdx > idx;
          return (
            <span
              key={s}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                active
                  ? "border-soul-gold/50 bg-soul-gold/15 text-soul-gold"
                  : done
                  ? "border-soul-jade/30 bg-soul-jade/10 text-soul-jade"
                  : "border-white/10 text-white/35"
              }`}
            >
              {STAGE_LABEL[s]}
            </span>
          );
        })}
      </div>
    </div>
  );
}
