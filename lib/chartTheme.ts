import type { Theme } from "@/hooks/useTheme";

export const PALETTE = [
  "#c8a45c",
  "#7fb0a0",
  "#e0b878",
  "#9a8cb5",
  "#cf8a6b",
  "#6f95b8",
  "#b5a98c",
  "#a3b87f",
];

export interface ChartColors {
  axis: string;
  split: string;
  text: string;
  tooltip: {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    textStyle: { color: string; fontSize: number };
  };
}

const DARK: ChartColors = {
  axis: "rgba(243,234,214,0.35)",
  split: "rgba(255,255,255,0.05)",
  text: "rgba(243,234,214,0.7)",
  tooltip: {
    backgroundColor: "rgba(16,16,24,0.95)",
    borderColor: "rgba(200,164,92,0.3)",
    borderWidth: 1,
    textStyle: { color: "#f3ead6", fontSize: 12 },
  },
};

const LIGHT: ChartColors = {
  axis: "rgba(40,33,24,0.55)",
  split: "rgba(40,33,24,0.08)",
  text: "rgba(40,33,24,0.8)",
  tooltip: {
    backgroundColor: "rgba(255,253,248,0.97)",
    borderColor: "rgba(200,164,92,0.5)",
    borderWidth: 1,
    textStyle: { color: "#2a2620", fontSize: 12 },
  },
};

export function chartColors(theme: Theme): ChartColors {
  return theme === "light" ? LIGHT : DARK;
}

// 兼容旧引用（默认暗色）
export const AXIS_COLOR = DARK.axis;
export const SPLIT_COLOR = DARK.split;
export const TEXT_COLOR = DARK.text;
export const tooltipStyle = DARK.tooltip;
