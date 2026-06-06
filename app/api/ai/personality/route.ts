import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PersonalitySummary {
  totalReadTimeText?: string;
  readDays?: number;
  finishedCount?: number;
  readCount?: number;
  noteCount?: number;
  topCategories?: string[];
  topAuthors?: string[];
  preferTimeWord?: string;
  topBooks?: string[];
}

/**
 * 阅读人格分析（MBTI）。
 * 优先调用 OpenAI 兼容大模型；未配置则降级为规则式 MBTI 推断。
 */
export async function POST(req: NextRequest) {
  let summary: PersonalitySummary;
  try {
    summary = (await req.json()) as PersonalitySummary;
  } catch {
    return NextResponse.json({ errmsg: "请求体不是合法 JSON" }, { status: 400 });
  }

  const apiKey = process.env.AI_API_KEY;
  const baseUrl = (process.env.AI_BASE_URL || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL || "deepseek-chat";

  if (!apiKey) {
    return NextResponse.json({ source: "rule", ...ruleBased(summary) });
  }

  const prompt = buildPrompt(summary);

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.85,
        messages: [
          {
            role: "system",
            content:
              "你是「阅己 ReadSoul」的阅读人格分析师，擅长结合 MBTI 框架解读读者。基于阅读数据推断读者的 MBTI 类型，温暖、有洞察、具传播感。只返回 JSON。",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
      cache: "no-store",
    });

    if (!resp.ok) {
      const t = await resp.text();
      return NextResponse.json({
        source: "rule",
        ...ruleBased(summary),
        warning: `AI 调用失败(${resp.status})，已降级：${t.slice(0, 200)}`,
      });
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { summary: content };
    }
    return NextResponse.json({ source: "ai", ...parsed });
  } catch (e) {
    return NextResponse.json({
      source: "rule",
      ...ruleBased(summary),
      warning: `AI 调用异常，已降级：${(e as Error).message}`,
    });
  }
}

function buildPrompt(s: PersonalitySummary): string {
  return `请根据以下微信读书阅读数据，推断这位读者的 MBTI 阅读人格类型。

阅读数据：
- 累计阅读时长：${s.totalReadTimeText ?? "未知"}
- 有效阅读天数：${s.readDays ?? "未知"} 天
- 读过本数：${s.readCount ?? "未知"}，读完本数：${s.finishedCount ?? "未知"}
- 笔记总数：${s.noteCount ?? "未知"} 条
- 偏好分类：${(s.topCategories ?? []).join("、") || "未知"}
- 偏好作者：${(s.topAuthors ?? []).join("、") || "未知"}
- 偏好时段：${s.preferTimeWord ?? "未知"}
- 读得最多的书：${(s.topBooks ?? []).join("、") || "未知"}

请基于阅读偏好与习惯，从 MBTI 四个维度推断（仅供趣味参考）：
- 外向 E / 内向 I（阅读的私密性、专注度）
- 直觉 N / 实感 S（偏抽象思辨 vs 偏务实具体）
- 思考 T / 情感 F（偏理性逻辑 vs 偏人文共情）
- 判断 J / 感知 P（阅读规律性、是否读完）

请只返回如下 JSON 结构：
{
  "mbti": "四个字母的类型，如 INFJ",
  "title": "对应的阅读人格称号，4-8字，如「深夜思想家」",
  "summary": "90-150字的人格画像，结合其阅读数据，温暖且有洞察力，第二人称",
  "dimensions": [
    {"axis": "I/E", "pick": "I", "label": "内倾", "reason": "12字以内依据"},
    {"axis": "N/S", "pick": "N", "label": "直觉", "reason": "12字以内依据"},
    {"axis": "T/F", "pick": "F", "label": "情感", "reason": "12字以内依据"},
    {"axis": "J/P", "pick": "J", "label": "判断", "reason": "12字以内依据"}
  ],
  "traits": ["3-4个性格关键词标签"],
  "quote": "一句送给该读者的话，20字以内"
}`;
}

interface Dimension {
  axis: string;
  pick: string;
  label: string;
  reason: string;
}

function ruleBased(s: PersonalitySummary): {
  mbti: string;
  title: string;
  summary: string;
  dimensions: Dimension[];
  traits: string[];
  quote: string;
} {
  const cats = (s.topCategories ?? []).join(" ");
  const timeWord = s.preferTimeWord || "";
  const days = s.readDays ?? 0;
  const notes = s.noteCount ?? 0;
  const finished = s.finishedCount ?? 0;
  const read = s.readCount ?? 0;

  // I/E：阅读偏私密专注，整体偏 I；阅读天数极高且时段分散偏 E 一点
  const e = days > 250 && /白天|上午|下午/.test(timeWord);
  // N/S：文学/哲学/科幻/心理 → N；历史/传记/经管/技术/生活 → S
  const nScore =
    (/文学|哲学|科幻|心理|艺术|诗/.test(cats) ? 1 : 0) -
    (/历史|传记|经管|经济|管理|技术|计算|科技|生活|健康/.test(cats) ? 1 : 0);
  const n = nScore >= 0;
  // T/F：人文/小说/心理/文学 → F；科技/经管/科学/逻辑 → T
  const fScore =
    (/文学|小说|心理|情感|人文|艺术/.test(cats) ? 1 : 0) -
    (/科技|经管|经济|科学|技术|计算|逻辑|管理/.test(cats) ? 1 : 0);
  const f = fScore >= 0;
  // J/P：读完比例高、阅读天数多 → J
  const finishRate = read > 0 ? finished / read : 0;
  const j = finishRate >= 0.5 || days > 200 || notes > 150;

  const mbti = `${e ? "E" : "I"}${n ? "N" : "S"}${f ? "F" : "T"}${j ? "J" : "P"}`;

  const titles: Record<string, string> = {
    INFJ: "深夜引路人",
    INFP: "理想织梦者",
    INTJ: "孤峰建筑师",
    INTP: "思辨探险家",
    ISFJ: "温柔守护者",
    ISTJ: "笃实修行者",
    ISFP: "感性漫游者",
    ISTP: "冷静拆解者",
    ENFJ: "灵魂摆渡人",
    ENFP: "好奇追光者",
    ENTJ: "格局掌舵者",
    ENTP: "思想纵火者",
    ESFJ: "暖心联结者",
    ESTJ: "秩序构筑者",
    ESFP: "热望生活家",
    ESTP: "行动派读者",
  };

  const dimensions: Dimension[] = [
    {
      axis: "I/E",
      pick: e ? "E" : "I",
      label: e ? "外倾" : "内倾",
      reason: e ? "阅读节奏外放活跃" : "享受独处沉浸",
    },
    {
      axis: "N/S",
      pick: n ? "N" : "S",
      label: n ? "直觉" : "实感",
      reason: n ? "偏好抽象与想象" : "偏好务实与具体",
    },
    {
      axis: "T/F",
      pick: f ? "F" : "T",
      label: f ? "情感" : "思考",
      reason: f ? "重共情与人文" : "重逻辑与理性",
    },
    {
      axis: "J/P",
      pick: j ? "J" : "P",
      label: j ? "判断" : "感知",
      reason: j ? "阅读自律有始终" : "随兴而读多元",
    },
  ];

  const traits: string[] = [];
  if (/夜|晚/.test(timeWord)) traits.push("夜读者");
  if (notes > 100) traits.push("勤于思考");
  if (j) traits.push("有始有终");
  if (n) traits.push("思想漫游");
  traits.push(s.topCategories?.[0] ? `偏爱${s.topCategories[0]}` : "好奇心强");

  const summary = `从你的阅读轨迹看，你更像一位 ${mbti}。在 ${days} 天里你留下 ${notes} 条思考，${
    timeWord || "在属于自己的时刻"
  }沉入书页。你偏爱${
    s.topCategories?.[0] || "多元"
  }的世界——${f ? "在文字里寻找共鸣与温度" : "在知识中拆解世界的逻辑"}，${
    n ? "并乐于在抽象与想象间漫游" : "也始终脚踏实地"
  }。`;

  return {
    mbti,
    title: titles[mbti] || "自在阅读者",
    summary,
    dimensions,
    traits: traits.slice(0, 4),
    quote: "见人阅己，于书中遇见更完整的自己。",
  };
}
