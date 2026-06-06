// ── 微信读书接口回包类型（仅声明用到的字段）──

export interface WrBook {
  bookId: string;
  title?: string;
  author?: string;
  cover?: string;
  category?: string;
}

export interface ReadLongestItem {
  book?: WrBook;
  albumInfo?: { albumId?: string; name?: string; cover?: string; authorName?: string };
  readTime?: number;
  tags?: string[];
}

export interface PreferCategory {
  categoryId?: number;
  categoryTitle?: string;
  parentCategoryTitle?: string;
  val?: number;
  readingTime?: number;
  readingCount?: number;
}

export interface PreferAuthor {
  authorId?: number;
  name?: string;
  count?: number;
  readTime?: string; // 已格式化字符串
}

export interface ReadStat {
  stat?: string;
  counts?: string;
  scheme?: string;
}

export interface YearReportEntry {
  year?: number;
  times?: number[]; // 12 个月时长（秒）
}

export interface ReadDataDetail {
  baseTime?: number;
  readTimes?: Record<string, number>;
  dailyReadTimes?: Record<string, number>;
  readDays?: number;
  totalReadTime?: number;
  dayAverageReadTime?: number;
  compare?: number;
  readLongest?: ReadLongestItem[];
  readStat?: ReadStat[];
  preferCategory?: PreferCategory[];
  preferCategoryWord?: string;
  preferTime?: number[]; // 24 项，从 6 点起始
  preferTimeWord?: string;
  preferAuthor?: PreferAuthor[];
  authorCount?: number;
  registTime?: number;
  yearReport?: YearReportEntry[];
  errcode?: number;
  errmsg?: string;
}

export interface NotebookBook {
  bookId: string;
  book?: WrBook;
  reviewCount?: number;
  noteCount?: number;
  bookmarkCount?: number;
  markedStatus?: number;
  readingProgress?: number;
  sort?: number;
}

export interface NotebooksResp {
  totalBookCount?: number;
  totalNoteCount?: number;
  hasMore?: number;
  books?: NotebookBook[];
  errcode?: number;
  errmsg?: string;
}

export interface ShelfBook extends WrBook {
  finishReading?: number;
  readUpdateTime?: number;
  secret?: number;
}

export interface ShelfResp {
  books?: ShelfBook[];
  albums?: unknown[];
  bookCount?: number;
  errcode?: number;
  errmsg?: string;
}

export interface Bookmark {
  bookmarkId?: string;
  bookId?: string;
  chapterUid?: number;
  markText?: string;
  createTime?: number;
  range?: string;
}

export interface BookmarkListResp {
  updated?: Bookmark[];
  chapters?: { chapterUid?: number; chapterIdx?: number; title?: string }[];
  book?: WrBook;
  errcode?: number;
  errmsg?: string;
}

export interface MineReview {
  reviewId?: string;
  content?: string;
  createTime?: number;
  star?: number;
  chapterName?: string;
  chapterUid?: number;
  range?: string;
  abstract?: string;
  isFinish?: number;
}

export interface ReviewListResp {
  reviews?: { review?: MineReview }[];
  totalCount?: number;
  hasMore?: number;
  synckey?: number;
  errcode?: number;
  errmsg?: string;
}

export interface MbtiDimension {
  axis: string; // 如 "I/E"
  pick: string; // 如 "I"
  label: string; // 如 "内倾"
  reason?: string;
}

export interface PersonalityResult {
  source?: "ai" | "rule";
  mbti?: string;
  title?: string;
  summary?: string;
  dimensions?: MbtiDimension[];
  traits?: string[];
  quote?: string;
  warning?: string;
}
