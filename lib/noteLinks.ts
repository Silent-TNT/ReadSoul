/** 跨书笔记关联：相似（共鸣）与相反（碰撞）观点发现 */

export interface NoteCorpusItem {
  id: string;
  bookId: string;
  bookTitle: string;
  text: string;
  type: "mark" | "review";
}

export interface NoteLink {
  target: NoteCorpusItem;
  score: number;
  /** 共同主题词，用于 UI 提示 */
  sharedTerms: string[];
}

export interface NoteLinkGroup {
  similar: NoteLink[];
  opposing: NoteLink[];
}

const STOPWORDS = new Set([
  "我们", "你们", "他们", "自己", "这个", "那个", "什么", "一个", "没有",
  "可以", "因为", "所以", "但是", "如果", "就是", "这样", "那样", "不是",
  "这些", "那些", "已经", "还是", "或者", "而且", "虽然", "然后", "这种",
  "一种", "时候", "知道", "觉得", "认为", "需要", "应该", "可能", "非常",
  "他们", "它们", "以及", "通过", "进行", "成为", "作为", "对于", "关于",
]);

const NEGATION = /不|非|没|无|未|勿|别|莫|否|难以|无法|不能|不应|反对|拒绝|缺乏|缺少|避免|禁止|否定|并非|不是|不会|不要|不可|不必|不用|不想|不愿|勿要/;

const OPPOSITE_WORDS: [string, string][] = [
  ["成功", "失败"], ["自由", "束缚"], ["理性", "感性"], ["乐观", "悲观"],
  ["简单", "复杂"], ["主动", "被动"], ["开放", "封闭"], ["信任", "怀疑"],
  ["合作", "竞争"], ["稳定", "变化"], ["长期", "短期"], ["内向", "外向"],
  ["坚持", "放弃"], ["增长", "衰退"], ["肯定", "否定"], ["集中", "分散"],
  ["安全", "风险"], ["传统", "创新"], ["客观", "主观"], ["独立", "依赖"],
  ["充足", "匮乏"], ["有序", "混乱"], ["真实", "虚假"], ["正确", "错误"],
];

/** 从文本提取 2-gram 中文词 + 英文词 */
export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  if (!text) return tokens;
  const segments = text.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}/g) || [];
  for (const seg of segments) {
    if (/^[a-zA-Z]+$/.test(seg)) {
      const w = seg.toLowerCase();
      if (!STOPWORDS.has(w)) tokens.add(w);
      continue;
    }
    for (let i = 0; i + 2 <= seg.length; i++) {
      const w = seg.slice(i, i + 2);
      if (!STOPWORDS.has(w)) tokens.add(w);
    }
  }
  return tokens;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter++;
  });
  return inter / (a.size + b.size - inter);
}

function sharedTerms(a: Set<string>, b: Set<string>, limit = 4): string[] {
  const shared: string[] = [];
  a.forEach((t) => {
    if (b.has(t) && shared.length < limit) shared.push(t);
  });
  return shared;
}

function hasNegation(text: string): boolean {
  return NEGATION.test(text);
}

function hasOppositeWords(textA: string, textB: string): boolean {
  for (const [w1, w2] of OPPOSITE_WORDS) {
    if (
      (textA.includes(w1) && textB.includes(w2)) ||
      (textA.includes(w2) && textB.includes(w1))
    ) {
      return true;
    }
  }
  return false;
}

function isOpposing(
  textA: string,
  textB: string,
  tokensA: Set<string>,
  tokensB: Set<string>,
  overlap: number
): boolean {
  if (overlap < 0.08) return false;

  const negA = hasNegation(textA);
  const negB = hasNegation(textB);
  if (negA !== negB && overlap >= 0.1) return true;
  if (hasOppositeWords(textA, textB) && overlap >= 0.06) return true;

  // 同主题但表述方向相反：一方含「应/要/必须」，另一方含「不/勿/避免」
  const dutyA = /应|该|必须|需要|值得|应当/.test(textA);
  const dutyB = /应|该|必须|需要|值得|应当/.test(textB);
  const avoidA = /不应|不该|不必|不要|避免|切勿|勿/.test(textA);
  const avoidB = /不应|不该|不必|不要|避免|切勿|勿/.test(textB);
  if ((dutyA && avoidB) || (dutyB && avoidA)) return true;

  return false;
}

function noteKey(item: NoteCorpusItem): string {
  return item.id;
}

export interface BuildLinksOptions {
  maxSimilar?: number;
  maxOpposing?: number;
  minSimilarScore?: number;
  /** 仅跨书关联 */
  crossBookOnly?: boolean;
}

/** 为语料库中每条笔记计算共鸣 / 碰撞关联 */
export function buildNoteLinkIndex(
  corpus: NoteCorpusItem[],
  opts: BuildLinksOptions = {}
): Map<string, NoteLinkGroup> {
  const {
    maxSimilar = 3,
    maxOpposing = 2,
    minSimilarScore = 0.18,
    crossBookOnly = true,
  } = opts;

  const tokenCache = new Map<string, Set<string>>();
  for (const item of corpus) {
    tokenCache.set(noteKey(item), tokenize(item.text));
  }

  const index = new Map<string, NoteLinkGroup>();

  for (let i = 0; i < corpus.length; i++) {
    const a = corpus[i];
    const keyA = noteKey(a);
    const tokensA = tokenCache.get(keyA)!;
    if (tokensA.size === 0) continue;

    const similar: NoteLink[] = [];
    const opposing: NoteLink[] = [];

    for (let j = 0; j < corpus.length; j++) {
      if (i === j) continue;
      const b = corpus[j];
      if (crossBookOnly && a.bookId === b.bookId) continue;

      const tokensB = tokenCache.get(noteKey(b))!;
      if (tokensB.size === 0) continue;

      const overlap = jaccard(tokensA, tokensB);
      if (overlap < 0.06) continue;

      const shared = sharedTerms(tokensA, tokensB);

      if (isOpposing(a.text, b.text, tokensA, tokensB, overlap)) {
        opposing.push({ target: b, score: overlap, sharedTerms: shared });
      } else if (overlap >= minSimilarScore) {
        similar.push({ target: b, score: overlap, sharedTerms: shared });
      }
    }

    similar.sort((x, y) => y.score - x.score);
    opposing.sort((x, y) => y.score - x.score);

    if (similar.length > 0 || opposing.length > 0) {
      index.set(keyA, {
        similar: similar.slice(0, maxSimilar),
        opposing: opposing.slice(0, maxOpposing),
      });
    }
  }

  return index;
}

export type InsightKind = "similar" | "opposing";

/** 全局展示用：去重后的笔记关联对 */
export interface InsightPair {
  id: string;
  kind: InsightKind;
  score: number;
  sharedTerms: string[];
  source: NoteCorpusItem;
  target: NoteCorpusItem;
}

/** 从语料库构建全局关联对（跨书，按强度排序） */
export function buildGlobalInsightPairs(
  corpus: NoteCorpusItem[],
  opts: BuildLinksOptions = {},
  limit = 150
): InsightPair[] {
  const itemMap = new Map(corpus.map((c) => [c.id, c]));
  const index = buildNoteLinkIndex(corpus, {
    maxSimilar: 5,
    maxOpposing: 3,
    crossBookOnly: true,
    ...opts,
  });

  const seen = new Set<string>();
  const pairs: InsightPair[] = [];

  index.forEach((group, sourceId) => {
    const source = itemMap.get(sourceId);
    if (!source) return;

    const append = (kind: InsightKind, links: NoteLink[]) => {
      for (const link of links) {
        const key = [sourceId, link.target.id, kind].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({
          id: key,
          kind,
          score: link.score,
          sharedTerms: link.sharedTerms,
          source,
          target: link.target,
        });
      }
    };

    append("similar", group.similar);
    append("opposing", group.opposing);
  });

  pairs.sort((a, b) => b.score - a.score);
  return pairs.slice(0, limit);
}

export function corpusFromBookmarks(
  bookmarks: { bookmarkId?: string; bookId?: string; markText?: string }[],
  bookTitles: Record<string, string>
): NoteCorpusItem[] {
  const items: NoteCorpusItem[] = [];
  for (const m of bookmarks) {
    const text = (m.markText || "").trim();
    if (!text || text.length < 6) continue;
    const bookId = m.bookId || "";
    if (!bookId) continue;
    items.push({
      id: markNoteId({ bookmarkId: m.bookmarkId, bookId, markText: text }),
      bookId,
      bookTitle: bookTitles[bookId] || "未知书名",
      text,
      type: "mark",
    });
  }
  return items;
}

export function truncateText(text: string, max = 72): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function markNoteId(
  bookmark: { bookmarkId?: string; bookId?: string; markText?: string }
): string {
  const text = (bookmark.markText || "").trim();
  return `mark:${bookmark.bookmarkId || `${bookmark.bookId}-${text.slice(0, 12)}`}`;
}
