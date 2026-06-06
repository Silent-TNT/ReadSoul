"use client";

import { useMemo } from "react";
import EChart from "@/components/EChart";
import type { BookOverviewGraph } from "@/lib/noteGraph";

interface Props {
  overview: BookOverviewGraph;
  selectedBookIds: Set<string>;
  onSelectBook: (bookId: string) => void;
  height?: number;
}

export default function BookOverviewChart({
  overview,
  selectedBookIds,
  onSelectBook,
  height = 420,
}: Props) {
  const { option, idByIndex } = useMemo(() => {
    const nodes = overview.nodes.map((n) => ({
      id: n.id,
      name: n.title.length > 10 ? `${n.title.slice(0, 10)}…` : n.title,
      value: n.noteCount,
      symbolSize: Math.min(18 + Math.sqrt(n.noteCount) * 3, 52),
      fullTitle: n.title,
      noteCount: n.noteCount,
      itemStyle: {
        borderWidth: selectedBookIds.has(n.id) ? 2 : 0,
        borderColor: "#E8C468",
      },
    }));

    const idSet = new Set(nodes.map((n) => n.id));
    const links = overview.edges
      .filter((e) => idSet.has(e.source) && idSet.has(e.target))
      .map((e) => ({
        source: e.source,
        target: e.target,
        value: e.weight,
        lineStyle: {
          width: Math.min(1 + e.weight * 0.4, 6),
          color:
            e.opposing > e.similar
              ? "rgba(251, 191, 36, 0.5)"
              : "rgba(74, 222, 128, 0.45)",
          type: e.opposing > e.similar ? "dashed" : "solid",
        },
      }));

    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(12, 10, 20, 0.92)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#E8E4DC", fontSize: 12 },
        formatter: (p: {
          dataType?: string;
          data?: { fullTitle?: string; noteCount?: number; value?: number };
        }) => {
          if (p.dataType === "edge") return "";
          const d = p.data;
          if (!d?.fullTitle) return "";
          return `<b>《${d.fullTitle}》</b><br/>${d.noteCount ?? 0} 条笔记`;
        },
      },
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          draggable: true,
          data: nodes,
          links,
          force: {
            repulsion: 320,
            gravity: 0.06,
            edgeLength: [80, 180],
          },
          label: {
            show: true,
            fontSize: 10,
            color: "var(--c-text)",
          },
          emphasis: { focus: "adjacency" },
        },
      ],
    };

    const idByIndex = nodes.map((n) => n.id);
    return { option, idByIndex };
  }, [overview, selectedBookIds]);

  return (
    <EChart
      option={option}
      height={height}
      onClick={(params) => {
        const id = idByIndex[params.dataIndex];
        if (id) onSelectBook(id);
      }}
    />
  );
}
