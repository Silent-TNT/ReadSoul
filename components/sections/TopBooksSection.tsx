import SectionCard from "@/components/SectionCard";
import { formatDuration, proxyCover, wereadReadingLink } from "@/lib/format";
import { ExternalIcon } from "@/components/icons";
import type { TopBook } from "@/lib/aggregate";

export default function TopBooksSection({ data }: { data: TopBook[] }) {
  if (!data.length)
    return (
      <SectionCard title="阅读 TOP 10" subtitle="投入时光最多的书">
        <p className="py-12 text-center text-sm text-white/30">暂无排行数据</p>
      </SectionCard>
    );

  return (
    <SectionCard
      title="阅读 TOP 10"
      subtitle="投入时光最多的书 · 点击在微信读书打开"
    >
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.map((b, i) => {
          const inner = (
            <>
              <span className="w-6 shrink-0 text-center font-serif text-lg font-bold text-soul-gold/70">
                {i + 1}
              </span>
              {b.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proxyCover(b.cover)}
                  alt={b.title}
                  className="h-16 w-12 shrink-0 rounded object-cover shadow-md"
                />
              ) : (
                <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-ink-700 text-[10px] text-white/30">
                  无封面
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate font-medium text-soul-cream">
                  <span className="truncate">{b.title}</span>
                  {b.bookId && (
                    <ExternalIcon className="h-3.5 w-3.5 shrink-0 text-white/25 opacity-0 transition group-hover:opacity-100" />
                  )}
                </p>
                {b.author && (
                  <p className="truncate text-xs text-white/40">{b.author}</p>
                )}
                <p className="mt-1 text-xs text-soul-gold/80">
                  {formatDuration(b.readTime)}
                </p>
                {b.tags && b.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {b.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-soul-jade/15 px-1.5 py-0.5 text-[10px] text-soul-jade"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          );

          const cls =
            "group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-soul-gold/30";

          return b.bookId ? (
            <li key={`${b.title}-${i}`}>
              <a href={wereadReadingLink(b.bookId)} className={cls}>
                {inner}
              </a>
            </li>
          ) : (
            <li key={`${b.title}-${i}`} className={cls}>
              {inner}
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}
