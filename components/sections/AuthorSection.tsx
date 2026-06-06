"use client";

import SectionCard from "@/components/SectionCard";
import EChart from "@/components/EChart";
import { chartColors } from "@/lib/chartTheme";
import { useTheme } from "@/hooks/useTheme";
import type { AuthorBar } from "@/lib/aggregate";

export default function AuthorSection({ data }: { data: AuthorBar[] }) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  if (!data.length)
    return (
      <SectionCard title="看过的作者" subtitle="陪你最久的人">
        <p className="py-12 text-center text-sm text-white/30">暂无作者偏好数据</p>
      </SectionCard>
    );

  const sorted = [...data].sort((a, b) => a.count - b.count);

  const option = {
    grid: { left: 8, right: 24, top: 12, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      ...c.tooltip,
      formatter: (p: { name: string; value: number }[]) =>
        `${p[0].name}<br/>${p[0].value} 本`,
    },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: c.split } },
      axisLabel: { color: c.axis, fontSize: 10 },
    },
    yAxis: {
      type: "category",
      data: sorted.map((d) => d.name),
      axisLine: { lineStyle: { color: c.split } },
      axisLabel: { color: c.axis, fontSize: 11 },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: sorted.map((d) => d.count),
        barWidth: "55%",
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: "rgba(127,176,160,0.5)" },
              { offset: 1, color: "#c8a45c" },
            ],
          },
        },
      },
    ],
  };

  return (
    <SectionCard title="看过的作者" subtitle="陪你最久的人（按本数）">
      <EChart option={option} height={Math.max(220, sorted.length * 34)} />
    </SectionCard>
  );
}
