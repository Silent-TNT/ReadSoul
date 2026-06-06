"use client";

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** 将 #rrggbb 转为 color input 可用的值；非 hex 时回退 */
function toPickerHex(value: string): string {
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value;
  return "#888888";
}

export default function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <label className="block text-[11px] text-white/40">
      {label}
      <div className="mt-0.5 flex items-center gap-1.5">
        <input
          type="color"
          value={toPickerHex(value)}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-9 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="#1A2332"
          className="min-w-0 flex-1 rounded border border-white/10 bg-ink-900/60 px-2 py-1 font-mono text-[11px] text-soul-cream outline-none focus:border-soul-gold/50"
        />
      </div>
    </label>
  );
}
