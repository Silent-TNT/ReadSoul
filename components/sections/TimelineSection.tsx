"use client";

import SectionCard from "@/components/SectionCard";
import EChart from "@/components/EChart";
import { chartColors } from "@/lib/chartTheme";
import { useTheme } from "@/hooks/useTheme";
import type { TimelinePoint } from "@/lib/aggregate";

export default function TimelineSection({ data }: { data: TimelinePoint[] }) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  if (!data.length) return null;

  const option = {
    grid: { left: 8, right: 16, top: 24, bottom: 24, containLabel: true },
    tooltip: {
      trigger: "axis",
      ...c.tooltip,
      valueFormatter: (v: number) => `${v} 小时`,
    },
    xAxis: {
      type: "category",
      data: data.map((d) => d.label),
      axisLine: { lineStyle: { color: c.split } },
      axisLabel: { color: c.axis, fontSize: 10, hideOverlap: true },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      name: "小时",
      nameTextStyle: { color: c.axis, fontSize: 10 },
      splitLine: { lineStyle: { color: c.split } },
      axisLabel: { color: c.axis, fontSize: 10 },
    },
    series: [
      {
        type: "line",
        smooth: true,
        symbol: "none",
        data: data.map((d) => d.hours),
        lineStyle: { color: "#c8a45c", width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(200,164,92,0.35)" },
              { offset: 1, color: "rgba(200,164,92,0.01)" },
            ],
          },
        },
      },
    ],
  };

  return (
    <SectionCard title="阅读时间轴" subtitle="每一天，你与书相处的时光">
      <EChart option={option} height={300} />
    </SectionCard>
  );
}
