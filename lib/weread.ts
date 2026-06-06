import type {
  ReadDataDetail,
  NotebooksResp,
  NotebookBook,
  ShelfResp,
  BookmarkListResp,
  ReviewListResp,
  MineReview,
} from "./types";

const UPGRADE_KEY = "upgrade_info";

export class WereadError extends Error {
  constructor(message: string, public errcode?: number) {
    super(message);
    this.name = "WereadError";
  }
}

function apiUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).href;
}

function gatewayParseError(status: number, text: string): WereadError {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    if (status === 404) {
      return new WereadError(
        "数据接口未找到。请确认已用 npm run dev 或 npm start 启动服务，且部署包含 /api/weread 路由。"
      );
    }
    return new WereadError(
      "服务端返回了网页而非数据（可能是网关或部署异常）。请稍后重试，或检查反向代理是否正确转发 /api/* 请求。"
    );
  }
  return new WereadError(
    text.slice(0, 120) || `请求失败（HTTP ${status}）`
  );
}

/** 统一通过本地代理调用微信读书网关 */
async function gateway<T>(apiKey: string, body: Record<string, unknown>): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(apiUrl("/api/weread"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new WereadError("网络请求失败，请检查网络连接后重试");
  }

  const text = await resp.text();
  let data: T & {
    errcode?: number;
    errmsg?: string;
    [UPGRADE_KEY]?: { message?: string };
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw gatewayParseError(resp.status, text);
  }

  if (data && (data as Record<string, unknown>)[UPGRADE_KEY]) {
    const info = (data as Record<string, { message?: string }>)[UPGRADE_KEY];
    throw new WereadError(
      `Skill 需要升级：${info?.message ?? "请更新 skill_version"}`
    );
  }

  if (!resp.ok || (data?.errcode != null && data.errcode !== 0)) {
    throw new WereadError(
      data?.errmsg || `请求失败（${resp.status}）`,
      data?.errcode
    );
  }

  return data as T;
}

export function fetchReadData(
  apiKey: string,
  mode: "weekly" | "monthly" | "annually" | "overall" = "overall",
  baseTime?: number
): Promise<ReadDataDetail> {
  const body: Record<string, unknown> = { api_name: "/readdata/detail", mode };
  if (baseTime != null) body.baseTime = baseTime;
  return gateway<ReadDataDetail>(apiKey, body);
}

export function fetchShelf(apiKey: string): Promise<ShelfResp> {
  return gateway<ShelfResp>(apiKey, { api_name: "/shelf/sync" });
}

export function fetchBookmarkList(
  apiKey: string,
  bookId: string
): Promise<BookmarkListResp> {
  return gateway<BookmarkListResp>(apiKey, {
    api_name: "/book/bookmarklist",
    bookId,
  });
}

/** 单本书的个人想法/点评（遍历分页） */
export async function fetchReviewListMine(
  apiKey: string,
  bookId: string,
  maxPages = 10
): Promise<MineReview[]> {
  let synckey: number | undefined;
  let pages = 0;
  const out: MineReview[] = [];

  while (pages < maxPages) {
    const body: Record<string, unknown> = {
      api_name: "/review/list/mine",
      bookid: bookId,
      count: 100,
    };
    if (synckey != null) body.synckey = synckey;
    const page = await gateway<ReviewListResp>(apiKey, body);
    for (const r of page.reviews ?? []) {
      if (r.review) out.push(r.review);
    }
    pages += 1;
    if (page.hasMore === 1 && page.synckey != null) {
      synckey = page.synckey;
    } else {
      break;
    }
  }
  return out;
}

/** 遍历分页拉取全部笔记本（上限保护，避免书太多时拉太久） */
export async function fetchAllNotebooks(
  apiKey: string,
  maxPages = 20
): Promise<NotebooksResp> {
  let lastSort: number | undefined;
  let pages = 0;
  let totalBookCount = 0;
  let totalNoteCount = 0;
  const books: NotebookBook[] = [];

  while (pages < maxPages) {
    const body: Record<string, unknown> = { api_name: "/user/notebooks", count: 100 };
    if (lastSort != null) body.lastSort = lastSort;
    const page = await gateway<NotebooksResp>(apiKey, body);

    if (page.totalBookCount != null) totalBookCount = page.totalBookCount;
    if (page.totalNoteCount != null) totalNoteCount = page.totalNoteCount;
    if (page.books?.length) books.push(...page.books);

    pages += 1;
    if (page.hasMore === 1 && page.books?.length) {
      lastSort = page.books[page.books.length - 1].sort;
    } else {
      break;
    }
  }

  return { totalBookCount, totalNoteCount, books, hasMore: 0 };
}
