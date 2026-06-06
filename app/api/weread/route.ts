import { NextRequest, NextResponse } from "next/server";
import { isAllowedWereadApi } from "@/lib/wereadAllowlist";
import { logApiError } from "@/lib/apiLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GATEWAY = "https://i.weread.qq.com/api/agent/gateway";
const SKILL_VERSION = process.env.WEREAD_SKILL_VERSION || "1.0.3";

/** 健康检查：浏览器直接打开 /api/weread 时不应返回 HTML 405 页 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "weread-gateway",
    skill_version: SKILL_VERSION,
  });
}

/**
 * 微信读书网关代理。
 * 浏览器无法直连 i.weread.qq.com（跨域），并且每次请求必须注入 skill_version。
 * 客户端把用户的 wrk- key 放在 Authorization 头里透传，后端不做任何持久化。
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || !/Bearer\s+wrk-/i.test(auth)) {
    return NextResponse.json(
      { errcode: -1, errmsg: "缺少有效的 API Key（需以 wrk- 开头）" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { errcode: -1, errmsg: "请求体不是合法 JSON" },
      { status: 400 }
    );
  }

  if (!body || typeof body.api_name !== "string") {
    return NextResponse.json(
      { errcode: -1, errmsg: "缺少 api_name" },
      { status: 400 }
    );
  }

  if (!isAllowedWereadApi(body.api_name)) {
    return NextResponse.json(
      { errcode: -1, errmsg: "不允许的 api_name" },
      { status: 403 }
    );
  }

  const payload = { ...body, skill_version: SKILL_VERSION };

  async function callUpstream(attempt: number): Promise<Response> {
    try {
      return await fetch(GATEWAY, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "ReadSoul/1.0",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });
    } catch (e) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600));
        return callUpstream(attempt + 1);
      }
      throw e;
    }
  }

  try {
    const upstream = await callUpstream(1);

    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      logApiError("/api/weread", 502, "upstream non-json", {
        api_name: body.api_name,
      });
      return NextResponse.json(
        { errcode: -1, errmsg: "上游返回非 JSON 内容" },
        { status: 502 }
      );
    }

    return NextResponse.json(data, { status: upstream.ok ? 200 : upstream.status });
  } catch (e) {
    const msg = (e as Error).message || "unknown";
    logApiError("/api/weread", 502, msg, {
      api_name: body.api_name,
    });
    const hint =
      msg.includes("timeout") || msg.includes("abort")
        ? "连接微信读书超时，请稍后重试"
        : "网关请求失败，请稍后重试";
    return NextResponse.json(
      { errcode: -1, errmsg: hint },
      { status: 502 }
    );
  }
}
