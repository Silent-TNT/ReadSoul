import { formatDuration } from "@/lib/format";
import type { OverviewStat } from "@/lib/aggregate";

interface Props {
  overview: {
    totalReadTime?: number;
    readDays?: number;
    dayAverage?: number;
    stats: OverviewStat[];
  };
}

export default function OverviewSection({ overview }: Props) {
  const hero = [
    { label: "累计阅读", value: formatDuration(overview.totalReadTime) },
    { label: "阅读天数", value: `${overview.readDays ?? 0}`, unit: "天" },
    { label: "日均阅读", value: formatDuration(overview.dayAverage) },
  ];

  return (
    <section className="soul-card overflow-hidden">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-soul-gold/10 blur-3xl" />
      <p className="soul-card-sub">你的阅读全景</p>
      <h2 className="mt-1 font-serif text-2xl font-medium text-soul-cream sm:text-3xl">
        以书为镜，照见自己
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {hero.map((h) => (
          <div
            key={h.label}
            className="rounded-xl border border-white/5 bg-white/[0.02] p-5"
          >
            <p className="text-xs tracking-wide text-white/40">{h.label}</p>
            <p className="mt-2 font-serif text-3xl font-bold gold-text">
              {h.value}
              {h.unit && (
                <span className="ml-1 text-base text-soul-gold/70">{h.unit}</span>
              )}
            </p>
          </div>
        ))}
      </div>

      {overview.stats.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {overview.stats.map((s) => {
            const cls =
              "rounded-lg border border-white/5 bg-ink-900/60 px-4 py-2 text-sm transition";
            const inner = (
              <>
                <span className="text-white/45">{s.label}</span>
                <span className="ml-2 font-medium text-soul-cream">{s.value}</span>
              </>
            );
            return s.scheme ? (
              <a
                key={s.label}
                href={s.scheme}
                className={`${cls} hover:border-soul-gold/40`}
              >
                {inner}
              </a>
            ) : (
              <div key={s.label} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
