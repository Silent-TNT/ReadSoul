"use client";

import SectionCard from "@/components/SectionCard";
import EChart from "@/components/EChart";
import { chartColors } from "@/lib/chartTheme";
import { useTheme } from "@/hooks/useTheme";
import type { HourSlot } from "@/lib/aggregate";

interface Props {
  data: HourSlot[];
  preferTimeWord?: string;
}

export default function HourlySection({ data, preferTimeWord }: Props) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  if (!data.length)
    return (
      <SectionCard title="阅读活跃时段" subtitle="你的专属阅读时辰">
        <p className="py-12 text-center text-sm text-white/30">暂无时段分布数据</p>
      </SectionCard>
    );

  const option = {
    polar: { radius: ["18%", "78%"] },
    tooltip: {
      ...c.tooltip,
      formatter: (p: { name: string; value: number }) =>
        `${p.name}<br/>${p.value} 小时`,
    },
    angleAxis: {
      type: "category",
      data: data.map((d) => d.label),
      startAngle: 90,
      axisLine: { lineStyle: { color: c.split } },
      axisLabel: { color: c.axis, fontSize: 9 },
      axisTick: { show: false },
    },
    radiusAxis: {
      axisLine: { show: false },
      splitLine: { lineStyle: { color: c.split } },
      axisLabel: { show: false },
    },
    series: [
      {
        type: "bar",
        coordinateSystem: "polar",
        data: data.map((d) => d.hours),
        itemStyle: {
          color: {
            type: "radial",
            x: 0.5,
            y: 0.5,
            r: 0.5,
            colorStops: [
              { offset: 0, color: "rgba(127,176,160,0.4)" },
              { offset: 1, color: "#e0b878" },
            ],
          },
          borderRadius: 3,
        },
      },
    ],
  };

  return (
    <SectionCard
      title="阅读活跃时段"
      subtitle={preferTimeWord || "你的专属阅读时辰"}
    >
      <EChart option={option} height={320} />
    </SectionCard>
  );
}
