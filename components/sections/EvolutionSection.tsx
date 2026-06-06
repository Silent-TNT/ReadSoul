"use client";

import SectionCard from "@/components/SectionCard";
import EChart from "@/components/EChart";
import { chartColors } from "@/lib/chartTheme";
import { useTheme } from "@/hooks/useTheme";
import type { EvolutionYear } from "@/lib/aggregate";

export default function EvolutionSection({ data }: { data: EvolutionYear[] }) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  if (data.length < 2) return null;

  const option = {
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      ...c.tooltip,
      valueFormatter: (v: number) => `${v} 小时`,
    },
    xAxis: {
      type: "category",
      data: data.map((d) => `${d.year}`),
      axisLine: { lineStyle: { color: c.split } },
      axisLabel: { color: c.axis, fontSize: 11 },
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
        type: "bar",
        data: data.map((d) => d.hours),
        barWidth: "45%",
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "#e0b878" },
              { offset: 1, color: "rgba(127,176,160,0.3)" },
            ],
          },
        },
        label: {
          show: true,
          position: "top",
          color: c.axis,
          fontSize: 10,
          formatter: "{c}h",
        },
      },
    ],
  };

  return (
    <SectionCard title="阅读演化" subtitle="逐年的阅读轨迹">
      <EChart option={option} height={300} />
    </SectionCard>
  );
}
