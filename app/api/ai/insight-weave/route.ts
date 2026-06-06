import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NoteInput {
  id: string;
  bookTitle: string;
  text: string;
}

interface WeaveBody {
  notes: NoteInput[];
}

const BATCH = 45;

function extractJson(text: string): { clusters?: unknown[] } {
  try {
    return JSON.parse(text) as { clusters?: unknown[] };
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as { clusters?: unknown[] };
      } catch {
        return {};
      }
    }
    return {};
  }
}

async function weaveBatch(
  notes: NoteInput[],
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<unknown[]> {
  const noteList = notes
    .map(
      (n, i) =>
        `[${i + 1}] id=${n.id}\n书名：《${n.bookTitle}》\n原文：${n.text.slice(0, 180)}`
    )
    .join("\n\n");

  const prompt = `找出跨书「观点群」（每组≥2条笔记，可多条）：
- resonance：主题/立场相近
- debate：同主题但立场相左

只使用下列 id，返回 JSON：{"clusters":[{"theme":"","kind":"resonance|debate","summary":"","noteIds":[],"sides":[{"label":"","noteIds":[]}]}]}

【笔记】
${noteList}`;

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: "你是阅读笔记关联分析师。只输出 JSON 对象，不要 markdown 代码块。",
        },
        { role: "user", content: prompt },
      ],
    }),
    cache: "no-store",
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI 服务错误(${resp.status})：${t.slice(0, 180)}`);
  }

  const data = await resp.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "{}";
  const parsed = extractJson(content);
  return Array.isArray(parsed.clusters) ? parsed.clusters : [];
}

export async function POST(req: NextRequest) {
  let body: WeaveBody;
  try {
    body = (await req.json()) as WeaveBody;
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const notes = body.notes ?? [];
  if (notes.length < 2) {
    return NextResponse.json(
      { error: "至少需要 2 条笔记才能织网" },
      { status: 400 }
    );
  }

  const apiKey = process.env.AI_API_KEY;
  const baseUrl = (process.env.AI_BASE_URL || "https://api.deepseek.com/v1").replace(
    /\/$/,
    ""
  );
  const model = process.env.AI_MODEL || "deepseek-chat";

  if (!apiKey) {
    return NextResponse.json(
      { error: "未配置 AI_API_KEY。请在 .env.local 中设置后重启 dev 服务器。" },
      { status: 503 }
    );
  }

  try {
    const allClusters: unknown[] = [];
    const sample = notes.slice(0, 180);

    for (let i = 0; i < sample.length; i += BATCH) {
      const chunk = sample.slice(i, i + BATCH);
      if (chunk.length < 2) continue;
      const part = await weaveBatch(chunk, apiKey, baseUrl, model);
      allClusters.push(...part);
    }

    return NextResponse.json({ source: "ai", clusters: allClusters });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 502 }
    );
  }
}
