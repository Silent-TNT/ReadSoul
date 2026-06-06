import type { NotebookBook, ShelfBook } from "./types";

export type PosterStatus = "finished" | "reading";

export interface PosterBook {
  bookId: string;
  title: string;
  author?: string;
  category?: string;
  status: PosterStatus;
  progress: number;
  readUpdateTime?: number;
}

export interface PillColor {
  bg: string;
  text: string;
}

export const POSTER_SUBTITLE = "见人阅己 · ReadSoul.cn";

export interface PosterStyle {
  title: string;
  subtitle: string;
  bgFrom: string;
  bgTo: string;
  titleColor: string;
  subtitleColor: string;
  footerColor: string;
  finishedBg: string;
  finishedText: string;
  readingBg: string;
  readingText: string;
  pillSize: "sm" | "md" | "lg";
  finishedStrikethrough: boolean;
  multicolor: boolean;
}

export const PILL_PALETTE: PillColor[] = [
  { bg: "#D4EDDA", text: "#1B4332" },
  { bg: "#CCE5FF", text: "#1A365D" },
  { bg: "#FFE8CC", text: "#7C4A03" },
  { bg: "#E8D4F8", text: "#4A1942" },
  { bg: "#FCD4E4", text: "#7F1D4A" },
  { bg: "#CCFBF1", text: "#134E4A" },
];

export const POSTER_PRESETS: Record<string, PosterStyle> = {
  readsoul: {
    title: "我的阅读海报",
    subtitle: POSTER_SUBTITLE,
    bgFrom: "#F7F8FA",
    bgTo: "#FFFFFF",
    titleColor: "#1A2332",
    subtitleColor: "#64748B",
    footerColor: "#94A3B8",
    finishedBg: "#D4EDDA",
    finishedText: "#1B4332",
    readingBg: "#FFE8CC",
    readingText: "#7C4A03",
    pillSize: "md",
    finishedStrikethrough: true,
    multicolor: true,
  },
  douban: {
    title: "我的阅读海报",
    subtitle: POSTER_SUBTITLE,
    bgFrom: "#E8F2F8",
    bgTo: "#F5FAFD",
    titleColor: "#0F172A",
    subtitleColor: "#475569",
    footerColor: "#64748B",
    finishedBg: "#BBF7D0",
    finishedText: "#14532D",
    readingBg: "#FDE68A",
    readingText: "#78350F",
    pillSize: "md",
    finishedStrikethrough: true,
    multicolor: true,
  },
  warm: {
    title: "我的阅读海报",
    subtitle: POSTER_SUBTITLE,
    bgFrom: "#FBF7F0",
    bgTo: "#F3EBE0",
    titleColor: "#292018",
    subtitleColor: "#78716C",
    footerColor: "#A8A29E",
    finishedBg: "#D9E8DC",
    finishedText: "#2D4A38",
    readingBg: "#F5DFC4",
    readingText: "#6B4420",
    pillSize: "md",
    finishedStrikethrough: false,
    multicolor: true,
  },
  midnight: {
    title: "我的阅读海报",
    subtitle: POSTER_SUBTITLE,
    bgFrom: "#050508",
    bgTo: "#0E0C14",
    titleColor: "#ECE8F4",
    subtitleColor: "rgba(200, 192, 220, 0.48)",
    footerColor: "rgba(180, 172, 200, 0.32)",
    finishedBg: "rgba(96, 132, 188, 0.18)",
    finishedText: "#A8C8EA",
    readingBg: "rgba(148, 112, 188, 0.16)",
    readingText: "#C4A0DC",
    pillSize: "sm",
    finishedStrikethrough: false,
    multicolor: false,
  },
};

export function pillColorForBook(
  style: PosterStyle,
  book: PosterBook,
  index: number
): PillColor {
  if (style.multicolor) {
    return PILL_PALETTE[index % PILL_PALETTE.length];
  }
  if (book.status === "finished") {
    return { bg: style.finishedBg, text: style.finishedText };
  }
  return { bg: style.readingBg, text: style.readingText };
}

/** 海报顶部「已读 / 在读」计数标签配色 */
export function statBadgeColors(
  style: PosterStyle
): { finished: PillColor; reading: PillColor } {
  if (style.multicolor) {
    // 六色模式下书底按序号着色，徽章用中性色 + 删除线/无删除线区分
    const neutral: PillColor = {
      bg: "rgba(100, 116, 139, 0.14)",
      text: style.subtitleColor,
    };
    return { finished: neutral, reading: neutral };
  }
  return {
    finished: { bg: style.finishedBg, text: style.finishedText },
    reading: { bg: style.readingBg, text: style.readingText },
  };
}

/** 六色模式下顶部徽章用删除线区分已读/在读 */
export function statBadgeStrike(
  style: PosterStyle,
  kind: "finished" | "reading"
): boolean {
  if (!style.multicolor) return false;
  return kind === "finished";
}

export function buildPosterBooks(
  shelf: ShelfBook[],
  notebooks: NotebookBook[] = []
): PosterBook[] {
  const progressMap = new Map<string, number>();
  const markedMap = new Map<string, number>();
  for (const nb of notebooks) {
    if (nb.readingProgress != null) progressMap.set(nb.bookId, nb.readingProgress);
    if (nb.markedStatus != null) markedMap.set(nb.bookId, nb.markedStatus);
  }

  const books: PosterBook[] = [];

  for (const b of shelf) {
    if (!b.title) continue;

    const progress =
      progressMap.get(b.bookId) ?? (b.finishReading === 1 ? 100 : 0);
    const marked = markedMap.get(b.bookId);
    let status: PosterStatus = "reading";
    if (b.finishReading === 1 || marked === 1 || progress >= 100) {
      status = "finished";
    } else if (
      progress <= 0 &&
      (b.readUpdateTime == null || b.readUpdateTime <= 0)
    ) {
      continue;
    }

    books.push({
      bookId: b.bookId,
      title: b.title,
      author: b.author,
      category: b.category,
      status,
      progress: status === "finished" ? 100 : Math.min(Math.max(progress, 1), 99),
      readUpdateTime: b.readUpdateTime,
    });
  }

  return books.sort((a, b) => (b.readUpdateTime ?? 0) - (a.readUpdateTime ?? 0));
}

export function filterPosterBooks(
  books: PosterBook[],
  opts: {
    statusFilter: "all" | "finished" | "reading";
    timeScope: "all" | "year" | "month";
    year?: number;
    month?: number;
  }
): PosterBook[] {
  let list = books;
  if (opts.statusFilter !== "all") {
    list = list.filter((b) => b.status === opts.statusFilter);
  }
  if (opts.timeScope === "year" && opts.year) {
    list = list.filter((b) => {
      if (!b.readUpdateTime) return false;
      return new Date(b.readUpdateTime * 1000).getFullYear() === opts.year;
    });
  }
  if (opts.timeScope === "month" && opts.year && opts.month) {
    list = list.filter((b) => {
      if (!b.readUpdateTime) return false;
      const d = new Date(b.readUpdateTime * 1000);
      return d.getFullYear() === opts.year && d.getMonth() + 1 === opts.month;
    });
  }
  return list;
}

export function posterCounts(books: PosterBook[]) {
  const finished = books.filter((b) => b.status === "finished").length;
  const reading = books.filter((b) => b.status === "reading").length;
  return { finished, reading, total: finished + reading };
}

export function availableYears(books: PosterBook[]): number[] {
  const set = new Set<number>();
  for (const b of books) {
    if (b.readUpdateTime) set.add(new Date(b.readUpdateTime * 1000).getFullYear());
  }
  return Array.from(set).sort((a, b) => b - a);
}

export function solidBgFrom(style: PosterStyle): string {
  return style.bgFrom.startsWith("#") ? style.bgFrom : "#F7F8FA";
}
