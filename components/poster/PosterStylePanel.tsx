"use client";

import ColorField from "@/components/poster/ColorField";
import { POSTER_PRESETS, type PosterStyle } from "@/lib/poster";

interface Props {
  style: PosterStyle;
  presetKey: string;
  onPreset: (key: string) => void;
  onChange: (style: PosterStyle) => void;
}

/** 内联紧凑样式面板（置于海报上方，全宽预览） */
export default function PosterStylePanel({
  style,
  presetKey,
  onPreset,
  onChange,
}: Props) {
  return (
    <div className="soul-card animate-fade-up space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-white/50">样式调节</p>
        <div className="flex flex-wrap gap-1">
          {Object.keys(POSTER_PRESETS).map((k) => (
            <button
              key={k}
              onClick={() => onPreset(k)}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                presetKey === k
                  ? "border-soul-gold/60 bg-soul-gold/15 text-soul-gold"
                  : "border-white/10 text-white/55 hover:border-soul-gold/30"
              }`}
            >
              {k === "readsoul"
                ? "清新"
                : k === "douban"
                ? "豆瓣蓝"
                : k === "warm"
                ? "暖纸"
                : "深夜"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <label className="col-span-2 text-[11px] text-white/40 sm:col-span-1">
          标题
          <input
            value={style.title}
            onChange={(e) => onChange({ ...style, title: e.target.value })}
            className="mt-0.5 w-full rounded-md border border-white/10 bg-ink-900/60 px-2 py-1 text-xs text-soul-cream outline-none focus:border-soul-gold/50"
          />
        </label>
        <label className="col-span-2 text-[11px] text-white/40 sm:col-span-1">
          副标题
          <input
            value={style.subtitle}
            onChange={(e) => onChange({ ...style, subtitle: e.target.value })}
            className="mt-0.5 w-full rounded-md border border-white/10 bg-ink-900/60 px-2 py-1 text-xs text-soul-cream outline-none focus:border-soul-gold/50"
          />
        </label>
        <label className="text-[11px] text-white/40">
          标签
          <select
            value={style.pillSize}
            onChange={(e) =>
              onChange({
                ...style,
                pillSize: e.target.value as PosterStyle["pillSize"],
              })
            }
            className="mt-0.5 w-full rounded-md border border-white/10 bg-ink-900/60 px-2 py-1 text-xs text-soul-cream outline-none"
          >
            <option value="sm">紧凑</option>
            <option value="md">标准</option>
            <option value="lg">大号</option>
          </select>
        </label>
        <div className="flex flex-col justify-end gap-1.5 pb-0.5">
          <label className="flex items-center gap-1.5 text-[11px] text-white/55">
            <input
              type="checkbox"
              checked={style.multicolor}
              onChange={(e) =>
                onChange({ ...style, multicolor: e.target.checked })
              }
              className="rounded"
            />
            六色轮换
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-white/55">
            <input
              type="checkbox"
              checked={style.finishedStrikethrough}
              onChange={(e) =>
                onChange({
                  ...style,
                  finishedStrikethrough: e.target.checked,
                })
              }
              className="rounded"
            />
            已读删除线
          </label>
        </div>
      </div>

      <details className="group">
        <summary className="cursor-pointer list-none text-[11px] text-white/40 transition hover:text-soul-gold [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1">
            <span className="text-soul-gold/70 transition group-open:rotate-90">
              ▸
            </span>
            字体与背景颜色
          </span>
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <ColorField
            label="标题"
            value={style.titleColor}
            onChange={(v) => onChange({ ...style, titleColor: v })}
          />
          <ColorField
            label="副标题"
            value={style.subtitleColor}
            onChange={(v) => onChange({ ...style, subtitleColor: v })}
          />
          <ColorField
            label="页脚"
            value={style.footerColor}
            onChange={(v) => onChange({ ...style, footerColor: v })}
          />
          <ColorField
            label="已读字"
            value={style.finishedText}
            onChange={(v) => onChange({ ...style, finishedText: v })}
          />
          <ColorField
            label="在读字"
            value={style.readingText}
            onChange={(v) => onChange({ ...style, readingText: v })}
          />
          <ColorField
            label="背景起"
            value={style.bgFrom}
            onChange={(v) => onChange({ ...style, bgFrom: v })}
          />
          <ColorField
            label="背景止"
            value={style.bgTo}
            onChange={(v) => onChange({ ...style, bgTo: v })}
          />
          <ColorField
            label="已读底"
            value={style.finishedBg}
            onChange={(v) => onChange({ ...style, finishedBg: v })}
          />
          <ColorField
            label="在读底"
            value={style.readingBg}
            onChange={(v) => onChange({ ...style, readingBg: v })}
          />
        </div>
      </details>
    </div>
  );
}
