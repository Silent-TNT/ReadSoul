import { NextRequest, NextResponse } from "next/server";
import { validateBetaGate, extractWrkKey } from "@/lib/apiAuth";
import { checkRateLimit } from "@/lib/rateLimit";

const AI_RATE_LIMIT = 20;
const AI_RATE_WINDOW_MS = 60_000;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/api/ai/")) {
    return NextResponse.next();
  }

  if (!validateBetaGate(req)) {
    return NextResponse.json(
      {
        error:
          "Beta 门禁校验失败。请确认 Railway 已配置 BETA_GATE_SECRET 并完成重新部署。",
      },
      { status: 401 }
    );
  }

  if (!extractWrkKey(req)) {
    return NextResponse.json(
      { error: "缺少有效的 API Key（需 Authorization: Bearer wrk-...）" },
      { status: 401 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rate = checkRateLimit(`ai:${ip}`, AI_RATE_LIMIT, AI_RATE_WINDOW_MS);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSec ?? 60),
        },
      }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/ai/:path*"],
};
