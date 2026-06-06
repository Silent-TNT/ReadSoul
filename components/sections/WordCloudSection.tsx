"use client";

import SectionCard from "@/components/SectionCard";
import EChart from "@/components/EChart";
import { PALETTE, chartColors } from "@/lib/chartTheme";
import { useTheme } from "@/hooks/useTheme";
import type { WordCloudItem } from "@/lib/aggregate";

export default function WordCloudSection({ data }: { data: WordCloudItem[] }) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  if (data.length < 5)
    return (
      <SectionCard title="划线词云" subtitle="你反复凝视的词语">
        <p className="py-12 text-center text-sm text-white/30">
          划线内容不足，暂时生成不了词云
        </p>
      </SectionCard>
    );

  const option = {
    tooltip: {
      ...c.tooltip,
      formatter: (p: { name: string; value: number }) =>
        `${p.name} · 出现 ${p.value} 次`,
    },
    series: [
      {
        type: "wordCloud",
        shape: "circle",
        left: "center",
        top: "center",
        width: "96%",
        height: "92%",
        sizeRange: [14, 60],
        rotationRange: [-45, 45],
        rotationStep: 15,
        gridSize: 8,
        drawOutOfBound: false,
        layoutAnimation: true,
        textStyle: {
          fontFamily: '"Noto Serif SC", serif',
          fontWeight: "bold",
          color: () => PALETTE[Math.floor(Math.random() * PALETTE.length)],
        },
        emphasis: {
          textStyle: { color: c.text },
        },
        data: data.map((d) => ({ name: d.name, value: d.value })),
      },
    ],
  };

  return (
    <SectionCard title="划线词云" subtitle="你反复凝视的词语">
      <EChart option={option} height={380} />
    </SectionCard>
  );
}
