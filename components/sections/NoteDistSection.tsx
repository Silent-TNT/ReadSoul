"use client";

import SectionCard from "@/components/SectionCard";
import EChart from "@/components/EChart";
import { chartColors } from "@/lib/chartTheme";
import { useTheme } from "@/hooks/useTheme";
import { wereadReadingLink } from "@/lib/format";
import type { NoteDistItem } from "@/lib/aggregate";

interface Props {
  data: NoteDistItem[];
  total?: number;
}

export default function NoteDistSection({ data, total }: Props) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  if (!data.length)
    return (
      <SectionCard title="笔记分布" subtitle="思考留痕之处">
        <p className="py-12 text-center text-sm text-white/30">暂无笔记数据</p>
      </SectionCard>
    );

  const sorted = [...data].sort((a, b) => a.total - b.total);

  const option = {
    grid: { left: 8, right: 24, top: 12, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      ...c.tooltip,
    },
    legend: {
      data: ["划线", "想法/点评", "书签"],
      top: 0,
      textStyle: { color: c.axis, fontSize: 11 },
    },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: c.split } },
      axisLabel: { color: c.axis, fontSize: 10 },
    },
    yAxis: {
      type: "category",
      data: sorted.map((d) =>
        d.title.length > 8 ? d.title.slice(0, 8) + "…" : d.title
      ),
      axisLine: { lineStyle: { color: c.split } },
      axisLabel: { color: c.axis, fontSize: 11 },
      axisTick: { show: false },
    },
    series: [
      {
        name: "划线",
        type: "bar",
        stack: "n",
        data: sorted.map((d) => d.noteCount),
        itemStyle: { color: "#c8a45c" },
      },
      {
        name: "想法/点评",
        type: "bar",
        stack: "n",
        data: sorted.map((d) => d.reviewCount),
        itemStyle: { color: "#7fb0a0" },
      },
      {
        name: "书签",
        type: "bar",
        stack: "n",
        data: sorted.map((d) => d.bookmarkCount),
        itemStyle: { color: "#9a8cb5" },
      },
    ],
  };

  function handleClick(params: { dataIndex: number }) {
    const item = sorted[params.dataIndex];
    if (item?.bookId) {
      window.location.href = wereadReadingLink(item.bookId);
    }
  }

  return (
    <SectionCard
      title="笔记分布"
      subtitle={
        total != null
          ? `共 ${total} 条思考留痕 · 点击柱形在微信读书打开`
          : "点击柱形在微信读书打开"
      }
    >
      <EChart
        option={option}
        height={Math.max(240, sorted.length * 34)}
        onClick={handleClick}
      />
    </SectionCard>
  );
}
