import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 封面图代理。
 * 微信读书封面 CDN 带 referer 限制且为跨域资源，直接用于 html-to-image 导出会污染 canvas。
 * 经本代理转发后变为同源资源，导出分享图时不会被浏览器拦截。
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !/^https?:\/\//.test(url)) {
    return new Response("invalid url", { status: 400 });
  }

  // 仅允许微信读书相关域名，避免成为开放代理
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return new Response("invalid url", { status: 400 });
  }
  if (
    !/(weread\.qq\.com|qpic\.cn|wrqqreader|weread\.qpic|myqcloud\.com)/.test(host)
  ) {
    return new Response("forbidden host", { status: 403 });
  }

  try {
    const upstream = await fetch(url, {
      headers: { Referer: "https://weread.qq.com/" },
      cache: "no-store",
    });
    if (!upstream.ok) {
      return new Response("upstream error", { status: upstream.status });
    }
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return new Response(`cover proxy failed: ${(e as Error).message}`, {
      status: 502,
    });
  }
}
