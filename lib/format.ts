/** 秒 → "x小时y分钟"（不足 1 小时只显示分钟，不足 1 分钟显示 <1分钟） */
export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "0分钟";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
  if (m > 0) return `${m}分钟`;
  return "<1分钟";
}

/** 秒 → 小时（保留一位小数），用于图表数值轴 */
export function secToHours(seconds?: number): number {
  if (!seconds || seconds <= 0) return 0;
  return Math.round((seconds / 3600) * 10) / 10;
}

/** Unix 时间戳（秒） → YYYY-MM-DD */
export function formatDate(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Unix 时间戳（秒） → YYYY年 */
export function formatYear(ts?: number): string {
  if (!ts) return "";
  return `${new Date(ts * 1000).getFullYear()}年`;
}

/** 大数字千分位 */
export function formatNumber(n?: number): string {
  if (n == null) return "0";
  return n.toLocaleString("zh-CN");
}

/** 构造微信读书阅读深链 */
export function wereadReadingLink(bookId: string | number): string {
  return `weread://reading?bId=${bookId}`;
}

/** 构造微信读书划线位置深链 */
export function wereadBookmarkLink(params: {
  bookId: string | number;
  chapterUid: string | number;
  range?: string;
  userVid?: string | number;
}): string {
  const { bookId, chapterUid, range, userVid } = params;
  let url = `weread://bestbookmark?bookId=${bookId}&chapterUid=${chapterUid}`;
  if (range && range.includes("-")) {
    const [start, end] = range.split("-");
    url += `&rangeStart=${start}&rangeEnd=${end}`;
  }
  if (userVid) url += `&userVid=${userVid}`;
  return url;
}

/** 封面图走本地代理，避免导出时跨域污染 canvas */
export function proxyCover(url?: string): string {
  if (!url) return "";
  return `/api/cover?url=${encodeURIComponent(url)}`;
}
