/**
 * 轻量 Markdown → 安全 HTML 渲染器（零依赖）。
 * 流程：先转义 HTML，再套用受控的块级 / 行内规则，仅放行 http(s)/weread 链接。
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inline(text: string): string {
  let s = text;
  // 行内代码（先保护，避免内部再被解析）
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_m, c) => {
    codes.push(c);
    return `\u0000CODE${codes.length - 1}\u0000`;
  });
  // 链接 [text](url)
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|weread:\/\/[^\s)]+)\)/g,
    (_m, t, url) =>
      `<a href="${url}" target="_blank" rel="noreferrer" class="md-a">${t}</a>`
  );
  // 加粗 / 斜体
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>");
  // 还原行内代码
  s = s.replace(/\u0000CODE(\d+)\u0000/g, (_m, i) => `<code class="md-code">${codes[Number(i)]}</code>`);
  return s;
}

export function mdToHtml(md: string): string {
  if (!md) return "";
  const src = escapeHtml(md.replace(/\r\n/g, "\n"));
  const lines = src.split("\n");
  const out: string[] = [];

  let i = 0;
  let listType: "ul" | "ol" | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join("<br/>"))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 代码块
    if (trimmed.startsWith("```")) {
      flushParagraph();
      closeList();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 跳过结束的 ```
      out.push(`<pre class="md-pre"><code>${buf.join("\n")}</code></pre>`);
      continue;
    }

    // 空行
    if (!trimmed) {
      flushParagraph();
      closeList();
      i++;
      continue;
    }

    // 标题
    const h = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushParagraph();
      closeList();
      const level = h[1].length;
      out.push(`<h${level} class="md-h md-h${level}">${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // 引用
    if (trimmed.startsWith("&gt;")) {
      flushParagraph();
      closeList();
      out.push(`<blockquote class="md-quote">${inline(trimmed.replace(/^&gt;\s?/, ""))}</blockquote>`);
      i++;
      continue;
    }

    // 无序列表
    const ul = /^[-*]\s+(.*)$/.exec(trimmed);
    if (ul) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        out.push('<ul class="md-ul">');
        listType = "ul";
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      i++;
      continue;
    }

    // 有序列表
    const ol = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    if (ol) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        out.push('<ol class="md-ol">');
        listType = "ol";
      }
      out.push(`<li>${inline(ol[2])}</li>`);
      i++;
      continue;
    }

    // 普通段落
    closeList();
    paragraph.push(trimmed);
    i++;
  }

  flushParagraph();
  closeList();
  return out.join("");
}
