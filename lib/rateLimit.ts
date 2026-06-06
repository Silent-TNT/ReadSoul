/** 简易内存限流（单实例有效，Beta 试用足够） */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return { ok: true };
}

/** 定期清理过期 bucket，避免内存泄漏 */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    buckets.forEach((entry, key) => {
      if (now >= entry.resetAt) buckets.delete(key);
    });
  }, 60_000);
}
