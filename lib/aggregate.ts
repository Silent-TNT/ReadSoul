import { formatDate, secToHours } from "./format";
import type {
  ReadDataDetail,
  NotebooksResp,
  NotebookBook,
  YearReportEntry,
} from "./types";

/** 单本书笔记总数（统计口径：reviewCount + noteCount + bookmarkCount） */
export function bookNoteTotal(b: NotebookBook): number {
  return (b.reviewCount ?? 0) + (b.noteCount ?? 0) + (b.bookmarkCount ?? 0);
}

export interface OverviewStat {
  label: string;
  value: string;
  sub?: string;
  scheme?: string;
}

/** 基础统计总览卡片数据 */
export function buildOverview(
  overall: ReadDataDetail,
  notebooks?: NotebooksResp
): {
  totalReadTime?: number;
  readDays?: number;
  dayAverage?: number;
  stats: OverviewStat[];
} {
  const stats: OverviewStat[] = [];
  const seen = new Set<string>();
  // readStat 形如 [{stat:"读过", counts:"12本"}]
  for (const s of overall.readStat ?? []) {
    if (s.stat && s.counts) {
      stats.push({ label: s.stat, value: s.counts, scheme: s.scheme });
      seen.add(s.stat);
    }
  }
  // 仅当 readStat 中没有「笔记」时才补充，避免重复显示
  if (notebooks?.totalNoteCount != null && !seen.has("笔记")) {
    stats.push({ label: "笔记", value: `${notebooks.totalNoteCount}条` });
  }

  // overall 模式常不返回 dayAverageReadTime，回退为 总时长 / 阅读天数
  let dayAverage = overall.dayAverageReadTime;
  if ((!dayAverage || dayAverage <= 0) && overall.totalReadTime && overall.readDays) {
    dayAverage = Math.round(overall.totalReadTime / overall.readDays);
  }

  return {
    totalReadTime: overall.totalReadTime,
    readDays: overall.readDays,
    dayAverage,
    stats,
  };
}

export interface TimelinePoint {
  label: string;
  hours: number;
}

function isYearBucket(ts: number): boolean {
  const d = new Date(ts * 1000);
  return d.getMonth() === 0 && d.getDate() === 1;
}

/** 阅读时间轴：优先 dailyReadTimes（年度日级），否则 readTimes 分桶 */
export function buildTimeline(detail: ReadDataDetail): TimelinePoint[] {
  const useDaily = Boolean(detail.dailyReadTimes);
  const src = detail.dailyReadTimes ?? detail.readTimes;
  if (!src) return [];
  const entries = Object.entries(src).map(([ts, sec]) => ({
    ts: Number(ts),
    sec,
  }));
  const yearGranularity =
    !useDaily || entries.every(({ ts }) => isYearBucket(ts));

  return entries
    .map(({ ts, sec }) => ({
      ts,
      label: yearGranularity
        ? String(new Date(ts * 1000).getFullYear())
        : formatDate(ts),
      hours: secToHours(sec),
    }))
    .sort((a, b) => a.ts - b.ts)
    .map(({ label, hours }) => ({ label, hours }));
}

export interface CategorySlice {
  name: string;
  value: number; // 阅读时长（小时）
  count?: number;
}

/** 书籍类型分布 */
export function buildCategories(detail: ReadDataDetail): CategorySlice[] {
  return (detail.preferCategory ?? [])
    .filter((c) => c.categoryTitle)
    .map((c) => ({
      name: c.categoryTitle as string,
      value: secToHours(c.readingTime) || (c.val ?? 0),
      count: c.readingCount,
    }))
    .filter((c) => c.value > 0);
}

export interface AuthorBar {
  name: string;
  count: number;
  readTime?: string;
}

/** 看过的作者排行 */
export function buildAuthors(detail: ReadDataDetail): AuthorBar[] {
  return (detail.preferAuthor ?? [])
    .filter((a) => a.name)
    .map((a) => ({
      name: a.name as string,
      count: a.count ?? 0,
      readTime: a.readTime,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export interface HourSlot {
  hour: number; // 0-23
  label: string; // "06:00"
  hours: number; // 时长（小时）
}

/**
 * 阅读活跃时段。
 * preferTime 为 24 项，输出顺序从 6 点开始到次日 5 点，需要还原到自然小时顺序。
 */
export function buildHourly(detail: ReadDataDetail): HourSlot[] {
  const raw = detail.preferTime;
  if (!raw || raw.length !== 24) return [];
  const slots: HourSlot[] = new Array(24);
  for (let i = 0; i < 24; i++) {
    const hour = (6 + i) % 24;
    slots[hour] = {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      hours: secToHours(raw[i]),
    };
  }
  return slots.sort((a, b) => a.hour - b.hour);
}

export interface TopBook {
  title: string;
  author?: string;
  cover?: string;
  readTime: number; // 秒
  tags?: string[];
  bookId?: string; // 电子书 bookId（有声内容为空，不生成阅读深链）
}

/** 阅读 TOP10（含有声内容） */
export function buildTopBooks(detail: ReadDataDetail): TopBook[] {
  return (detail.readLongest ?? [])
    .map((item) => {
      const title = item.book?.title || item.albumInfo?.name || "未知";
      const author = item.book?.author || item.albumInfo?.authorName;
      const cover = item.book?.cover || item.albumInfo?.cover;
      return {
        title,
        author,
        cover,
        readTime: item.readTime ?? 0,
        tags: item.tags,
        bookId: item.book?.bookId,
      };
    })
    .slice(0, 10);
}

export interface NoteDistItem {
  title: string;
  total: number;
  reviewCount: number;
  noteCount: number;
  bookmarkCount: number;
  bookId: string;
}

/** 笔记分布（按总笔记数降序，取前 N） */
export function buildNoteDistribution(
  notebooks: NotebooksResp,
  topN = 12
): NoteDistItem[] {
  return (notebooks.books ?? [])
    .map((b) => ({
      title: b.book?.title || "未知",
      total: bookNoteTotal(b),
      reviewCount: b.reviewCount ?? 0,
      noteCount: b.noteCount ?? 0,
      bookmarkCount: b.bookmarkCount ?? 0,
      bookId: b.bookId,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);
}

export interface EvolutionYear {
  year: number;
  hours: number;
}

/** 阅读演化：逐年总时长（来自 yearReport.times 各年 12 个月求和） */
export function buildEvolution(overall: ReadDataDetail): EvolutionYear[] {
  const reports: YearReportEntry[] = overall.yearReport ?? [];
  return reports
    .filter((r) => r.year && Array.isArray(r.times))
    .map((r) => ({
      year: r.year as number,
      hours: secToHours((r.times ?? []).reduce((s, v) => s + (v || 0), 0)),
    }))
    .sort((a, b) => a.year - b.year);
}

/** 词云数据：基于汉字分词的朴素切分 + 停用词过滤 */
const STOPWORDS = new Set([
  "我们", "你们", "他们", "自己", "这个", "那个", "什么", "一个", "没有",
  "可以", "因为", "所以", "但是", "如果", "就是", "这样", "那样", "不是",
  "这些", "那些", "已经", "还是", "或者", "而且", "虽然", "然后", "这种",
  "一种", "时候", "知道", "觉得", "认为", "需要", "应该", "可能", "非常",
  "the", "and", "for", "that", "this", "with", "you", "are", "not",
]);

export interface WordCloudItem {
  name: string;
  value: number;
}

/** 从划线文本聚合词云（2-4 字中文词组的简单统计） */
export function buildWordCloud(texts: string[], topN = 120): WordCloudItem[] {
  const freq = new Map<string, number>();
  for (const text of texts) {
    if (!text) continue;
    // 按非中文/英文字符切段，再在中文段内做 2 字滑窗
    const segments = text.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}/g) || [];
    for (const seg of segments) {
      if (/^[a-zA-Z]+$/.test(seg)) {
        const w = seg.toLowerCase();
        if (!STOPWORDS.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
        continue;
      }
      // 中文：2-gram 滑窗
      for (let i = 0; i + 2 <= seg.length; i++) {
        const w = seg.slice(i, i + 2);
        if (STOPWORDS.has(w)) continue;
        freq.set(w, (freq.get(w) ?? 0) + 1);
      }
    }
  }
  return Array.from(freq.entries())
    .filter(([, v]) => v >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name, value]) => ({ name, value }));
}
