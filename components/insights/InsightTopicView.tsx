"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { InsightCluster } from "@/lib/noteGraph";
import type { NoteCorpusItem } from "@/lib/noteLinks";
import type { InsightKind } from "@/lib/noteLinks";

const ClusterMiniGraph = dynamic(
  () => import("@/components/insights/ClusterMiniGraph"),
  { ssr: false }
);

type FilterKind = "all" | InsightKind;

interface Props {
  clusters: InsightCluster[];
  nodeMap: Map<string, NoteCorpusItem>;
  filter: FilterKind;
  search: string;
  building?: boolean;
  buildMessage?: string;
}

export default function InsightTopicView({
  clusters,
  nodeMap,
  filter,
  search,
  building,
  buildMessage,
}: Props) {
  const [index, setIndex] = useState(0);

  const kw = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      clusters.filter((c) => {
        if (filter === "similar" && c.kind !== "resonance") return false;
        if (filter === "opposing" && c.kind !== "debate") return false;
        if (!kw) return true;
        const hay = [
          c.theme,
          c.summary ?? "",
          ...c.nodeIds.map((id) => nodeMap.get(id)?.text ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(kw);
      }),
    [clusters, filter, kw, nodeMap]
  );

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length, filter, kw]);

  if (building && filtered.length === 0) {
    return (
      <div className="soul-card text-center text-sm soul-card-sub">
        {buildMessage || "AI 正在归类话题…"}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="soul-card text-center text-sm soul-card-sub">
        暂无话题归类，等待 AI 分析或调整筛选条件
      </div>
    );
  }

  const cluster = filtered[index];
  const atStart = index === 0;
  const atEnd = index === filtered.length - 1;

  return (
    <div className="space-y-3">
      {building && (
        <p className="px-1 text-[11px] text-soul-amber/80">
          {buildMessage || "AI 还在继续归类…"} · 已找到 {clusters.length} 个话题
        </p>
      )}

      <TopicClusterCard cluster={cluster} nodeMap={nodeMap} />

      <div className="flex items-center justify-between gap-3 px-1">
        <button
          type="button"
          disabled={atStart}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="rounded-lg border border-white/10 px-4 py-2 text-xs text-soul-cream disabled:opacity-30 hover:border-soul-gold/40"
        >
          ← 上一个
        </button>
        <span className="text-[11px] soul-card-sub">
          {index + 1} / {filtered.length}
          {building ? "+" : ""}
        </span>
        <button
          type="button"
          disabled={atEnd}
          onClick={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))}
          className="rounded-lg border border-white/10 px-4 py-2 text-xs text-soul-cream disabled:opacity-30 hover:border-soul-gold/40"
        >
          下一个 →
        </button>
      </div>
    </div>
  );
}

function TopicClusterCard({
  cluster,
  nodeMap,
}: {
  cluster: InsightCluster;
  nodeMap: Map<string, NoteCorpusItem>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const isDebate = cluster.kind === "debate";
  const previewIds = cluster.nodeIds.slice(0, 2);
  const restIds = cluster.nodeIds.slice(2);

  return (
    <article className="soul-card border-l-2 border-l-soul-gold/40">
      <div className="mb-3 flex justify-between gap-2">
        <div>
          <span
            className={`text-xs font-medium ${
              isDebate ? "text-soul-amber" : "text-soul-jade"
            }`}
          >
            {isDebate ? "对立话题" : "相似话题"} · {cluster.nodeIds.length} 条划线
          </span>
          <p className="mt-1 font-serif text-base text-soul-cream">
            {cluster.theme}
          </p>
          {cluster.summary && (
            <p className="mt-1 text-sm soul-card-sub">{cluster.summary}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {cluster.nodeIds.length <= 30 && (
            <button
              type="button"
              onClick={() => setShowGraph((v) => !v)}
              className="text-[10px] soul-card-sub hover:text-soul-gold"
            >
              {showGraph ? "隐藏关系图" : "关系图"}
            </button>
          )}
          {restIds.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] text-soul-gold hover:underline"
            >
              {expanded ? "收起" : `+${restIds.length} 条`}
            </button>
          )}
        </div>
      </div>

      {showGraph && cluster.nodeIds.length <= 30 && (
        <div className="mb-4">
          <ClusterMiniGraph
            nodeIds={cluster.nodeIds}
            nodeMap={nodeMap}
            isDebate={isDebate}
          />
        </div>
      )}

      {cluster.sides && cluster.sides.length >= 2 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {cluster.sides.map((side, si) => (
            <div
              key={si}
              className="rounded-xl border border-white/[0.06] p-3"
            >
              <p className="mb-2 text-[11px] font-medium text-soul-amber/80">
                {side.label || `第 ${si + 1} 派`}
              </p>
              {side.nodeIds.slice(0, expanded ? undefined : 2).map((id) => {
                const item = nodeMap.get(id);
                return item ? (
                  <NoteSnippet key={id} item={item} />
                ) : null;
              })}
            </div>
          ))}
        </div>
      ) : (
        <>
          {previewIds.map((id) => {
            const item = nodeMap.get(id);
            return item ? <NoteSnippet key={id} item={item} /> : null;
          })}
          {expanded &&
            restIds.map((id) => {
              const item = nodeMap.get(id);
              return item ? <NoteSnippet key={id} item={item} /> : null;
            })}
        </>
      )}
    </article>
  );
}

function NoteSnippet({ item }: { item: NoteCorpusItem }) {
  return (
    <div className="mb-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="text-[11px] font-medium text-soul-gold/80">
        《{item.bookTitle}》
      </p>
      <blockquote className="mt-1 border-l-2 border-soul-gold/35 pl-3 font-serif text-xs leading-relaxed text-soul-cream">
        {item.text}
      </blockquote>
    </div>
  );
}
