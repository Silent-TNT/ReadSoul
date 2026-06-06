import { NextRequest, NextResponse } from "next/server";

const WRK_KEY_RE = /^Bearer\s+wrk-[A-Za-z0-9]+/i;

export function extractWrkKey(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth || !WRK_KEY_RE.test(auth)) return null;
  const match = auth.match(/Bearer\s+(wrk-[A-Za-z0-9]+)/i);
  return match?.[1] ?? null;
}

export function validateBetaGate(req: NextRequest): boolean {
  const secret = process.env.BETA_GATE_SECRET;
  if (!secret) return true;
  return req.headers.get("x-readsoul-beta") === secret;
}

export function guardAiRoute(req: NextRequest): NextResponse | null {
  if (!validateBetaGate(req)) {
    return NextResponse.json({ error: "未授权访问" }, { status: 401 });
  }
  if (!extractWrkKey(req)) {
    return NextResponse.json(
      { error: "缺少有效的 API Key（需 Authorization: Bearer wrk-...）" },
      { status: 401 }
    );
  }
  return null;
}
