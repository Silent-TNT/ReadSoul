import { NextRequest, NextResponse } from "next/server";
import { logApiError } from "@/lib/apiLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatBody {
  messages: ChatMessage[];
  context?: string;
  /** RAG：与用户问题相关的划线片段（由客户端检索） */
  ragContext?: string;
}

/**
 * AI 阅读伴读对话。基于 OpenAI 兼容接口（流式 SSE 透传）。
 * 携带用户阅读数据摘要作为系统上下文。
 */
export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const apiKey = process.env.AI_API_KEY;
  const baseUrl = (process.env.AI_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL || "deepseek-chat";

  if (!apiKey) {
    return NextResponse.json(
      { error: "未配置 AI_API_KEY，无法使用对话功能" },
      { status: 503 }
    );
  }

  const systemPrompt = `你是「阅己 ReadSoul」的灵魂解读 AI，温暖、有洞察、懂书。
基于用户的微信读书阅读数据与 RAG 检索到的划线/想法，做深度、具体的分析——引用笔记原文，指出跨书共鸣与碰撞，给出可执行的阅读思考。
回答用中文，结构清晰，可用 Markdown。不要编造用户没有的数据。

${body.context ? `【阅读统计摘要】\n${body.context}` : ""}
${body.ragContext ? `\n${body.ragContext}` : ""}`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...(body.messages || []).slice(-20),
  ];

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.8,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text();
      logApiError("/api/ai/chat", 502, "upstream error", {
        status: upstream.status,
      });
      return NextResponse.json(
        { error: "AI 服务暂时不可用，请稍后重试" },
        { status: 502 }
      );
    }

    // 直接透传上游 SSE 流
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    logApiError("/api/ai/chat", 502, (e as Error).message);
    return NextResponse.json(
      { error: "AI 调用异常，请稍后重试" },
      { status: 502 }
    );
  }
}
