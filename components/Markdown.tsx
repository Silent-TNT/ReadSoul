import { useMemo } from "react";
import { mdToHtml } from "@/lib/markdown";

export default function Markdown({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  const html = useMemo(() => mdToHtml(content), [content]);
  return (
    <div
      className={`md-body ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
