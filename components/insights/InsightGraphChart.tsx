"use client";

import { useMemo } from "react";
import EChart from "@/components/EChart";
import {
  nodeLabel,
  type InsightGraph,
} from "@/lib/noteGraph";
import type { InsightKind } from "@/lib/noteLinks";

interface Props {
  graph: InsightGraph;
  filter: "all" | InsightKind;
  selectedClusterId: string | null;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onSelectCluster: (id: string | null) => void;
  height?: number;
}

interface ChartNode {
  id: string;
  clusterId?: string;
}

export default function InsightGraphChart({
  graph,
  filter,
  selectedClusterId,
  selectedNodeId,
  onSelectNode,
  onSelectCluster,
  height = 480,
}: Props) {
  const { option, chartNodes } = useMemo(() => {
    const clusterKind = new Map(
      graph.clusters.map((c) => [c.id, c.kind])
    );

    const filteredEdges = graph.edges.filter(
      (e) => filter === "all" || e.kind === filter
    );

    const visibleNodeIds = new Set<string>();
    filteredEdges.forEach((e) => {
      visibleNodeIds.add(e.source);
      visibleNodeIds.add(e.target);
    });

    if (selectedClusterId) {
      graph.clusters
        .find((c) => c.id === selectedClusterId)
        ?.nodeIds.forEach((id) => visibleNodeIds.add(id));
    }

    const nodes = graph.nodes
      .filter((n) => visibleNodeIds.has(n.id))
      .map((n) => {
        const isDebate =
          n.clusterId && clusterKind.get(n.clusterId) === "debate";
        const isSelected =
          n.id === selectedNodeId ||
          (selectedClusterId && n.clusterId === selectedClusterId);
        return {
          id: n.id,
          name: nodeLabel(n.text, 12),
          value: n.degree + 1,
          symbolSize: Math.min(14 + n.degree * 4, 36),
          category: isDebate ? 1 : 0,
          itemStyle: {
            opacity: isSelected ? 1 : 0.88,
            borderWidth: isSelected ? 2 : 0,
            borderColor: isSelected ? "#E8C468" : undefined,
          },
          bookTitle: n.bookTitle,
          fullText: n.text,
          clusterId: n.clusterId,
        };
      });

    const chartNodes: ChartNode[] = nodes.map((n) => ({
      id: n.id,
      clusterId: n.clusterId,
    }));

    const nodeIdSet = new Set(nodes.map((n) => n.id));

    const links = filteredEdges
      .filter(
        (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
      )
      .map((e) => ({
        source: e.source,
        target: e.target,
        lineStyle: {
          color: e.kind === "similar" ? "rgba(74, 222, 128, 0.45)" : "rgba(251, 191, 36, 0.55)",
          width: 1 + e.score * 3,
          type: e.kind === "opposing" ? "dashed" : "solid",
        },
        label: {
          show: false,
        },
      }));

    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(12, 10, 20, 0.92)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#E8E4DC", fontSize: 12 },
        formatter: (params: {
          dataType?: string;
          data?: {
            bookTitle?: string;
            fullText?: string;
            name?: string;
          };
        }) => {
          if (params.dataType === "edge") return "";
          const d = params.data;
          if (!d?.fullText) return d?.name ?? "";
          return `<div style="max-width:280px;line-height:1.5"><b>《${d.bookTitle}》</b><br/>${d.fullText}</div>`;
        },
      },
      legend: {
        data: ["共鸣", "碰撞"],
        bottom: 0,
        textStyle: { color: "rgba(255,255,255,0.45)", fontSize: 11 },
      },
      series: [
        {
          type: "graph",
          layout: "force",
          roam: true,
          draggable: true,
          focusNodeAdjacency: true,
          categories: [
            { name: "共鸣", itemStyle: { color: "#4ADE80" } },
            { name: "碰撞", itemStyle: { color: "#FBBF24" } },
          ],
          data: nodes,
          links,
          force: {
            repulsion: 280,
            gravity: 0.08,
            edgeLength: [60, 140],
            friction: 0.35,
          },
          label: {
            show: true,
            position: "right",
            fontSize: 10,
            color: "rgba(232, 228, 220, 0.75)",
          },
          emphasis: {
            focus: "adjacency",
            lineStyle: { width: 4 },
          },
        },
      ],
    };

    return { option, chartNodes };
  }, [
    graph,
    filter,
    selectedClusterId,
    selectedNodeId,
  ]);

  return (
    <EChart
      option={option}
      height={height}
      onClick={(params) => {
        const idx = params.dataIndex;
        const node = chartNodes[idx];
        if (node?.id) {
          onSelectNode(node.id);
          if (node.clusterId) onSelectCluster(node.clusterId);
        }
      }}
    />
  );
}
