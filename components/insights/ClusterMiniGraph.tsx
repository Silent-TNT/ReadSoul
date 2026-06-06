"use client";

import { useMemo } from "react";
import EChart from "@/components/EChart";
import { buildAllEdges, nodeLabel } from "@/lib/noteGraph";
import type { NoteCorpusItem } from "@/lib/noteLinks";

interface Props {
  nodeIds: string[];
  nodeMap: Map<string, NoteCorpusItem>;
  isDebate?: boolean;
  height?: number;
}

/** 簇内静态环形关系图（≤30 节点，无 force 仿真） */
export default function ClusterMiniGraph({
  nodeIds,
  nodeMap,
  isDebate,
  height = 280,
}: Props) {
  const option = useMemo(() => {
    const corpus = nodeIds
      .map((id) => nodeMap.get(id))
      .filter(Boolean) as NoteCorpusItem[];

    if (corpus.length < 2) return null;

    const edges = buildAllEdges(corpus, { minScore: 0.12, maxEdges: 60 });
    const n = corpus.length;
    const radius = 100;

    const nodes = corpus.map((item, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      return {
        id: item.id,
        name: nodeLabel(item.text, 10),
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        symbolSize: 10,
        itemStyle: {
          color: isDebate ? "#FBBF24" : "#4ADE80",
        },
        bookTitle: item.bookTitle,
        fullText: item.text,
      };
    });

    const idSet = new Set(corpus.map((c) => c.id));
    const links = edges
      .filter((e) => idSet.has(e.source) && idSet.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        lineStyle: {
          color:
            e.kind === "opposing"
              ? "rgba(251, 191, 36, 0.5)"
              : "rgba(74, 222, 128, 0.4)",
          width: 1,
          type: e.kind === "opposing" ? "dashed" : "solid",
        },
      }));

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(12, 10, 20, 0.92)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#E8E4DC", fontSize: 11 },
        formatter: (params: {
          dataType?: string;
          data?: { bookTitle?: string; fullText?: string; name?: string };
        }) => {
          if (params.dataType === "edge") return "";
          const d = params.data;
          if (!d?.fullText) return d?.name ?? "";
          return `<div style="max-width:240px"><b>《${d.bookTitle}》</b><br/>${d.fullText.slice(0, 120)}</div>`;
        },
      },
      series: [
        {
          type: "graph",
          layout: "none",
          roam: true,
          draggable: false,
          data: nodes,
          links,
          label: { show: false },
          emphasis: { focus: "adjacency" },
        },
      ],
    };
  }, [nodeIds, nodeMap, isDebate]);

  if (!option) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
      <EChart option={option} height={height} />
    </div>
  );
}
