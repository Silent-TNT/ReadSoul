"use client";

import SectionCard from "@/components/SectionCard";
import EChart from "@/components/EChart";
import { PALETTE, chartColors } from "@/lib/chartTheme";
import { useTheme } from "@/hooks/useTheme";
import type { CategorySlice } from "@/lib/aggregate";

export default function CategorySection({ data }: { data: CategorySlice[] }) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  if (!data.length)
    return (
      <SectionCard title="书籍类型分布" subtitle="你偏爱的世界">
        <p className="py-12 text-center text-sm text-white/30">暂无分类偏好数据</p>
      </SectionCard>
    );

  const option = {
    color: PALETTE,
    tooltip: {
      trigger: "item",
      ...c.tooltip,
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}<br/>${p.value} 小时 · ${p.percent}%`,
    },
    legend: {
      type: "scroll",
      orient: "horizontal",
      bottom: 0,
      textStyle: { color: c.axis, fontSize: 11 },
      pageTextStyle: { color: c.axis },
    },
    series: [
      {
        type: "pie",
        radius: ["42%", "70%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: theme === "light" ? "#fffdf8" : "#101018",
          borderWidth: 2,
          borderRadius: 4,
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            color: c.text,
            fontSize: 14,
            fontWeight: "bold",
            formatter: "{b}\n{d}%",
          },
        },
        data: data.map((d) => ({ name: d.name, value: d.value })),
      },
    ],
  };

  return (
    <SectionCard title="书籍类型分布" subtitle="你偏爱的世界">
      <EChart option={option} height={320} />
    </SectionCard>
  );
}
