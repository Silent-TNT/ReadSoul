"use client";

import { useApiKey } from "@/hooks/useApiKey";

const BETA_SECRET = process.env.NEXT_PUBLIC_BETA_GATE_SECRET ?? "";

function buildHeaders(apiKey?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (BETA_SECRET) {
    headers["X-ReadSoul-Beta"] = BETA_SECRET;
  }
  return headers;
}

/** 带 Beta 门禁与 wrk- Key 的 API 请求封装 */
export async function apiFetch(
  path: string,
  init: RequestInit & { apiKey?: string | null } = {}
): Promise<Response> {
  const { apiKey, headers: initHeaders, ...rest } = init;
  const headers = {
    ...buildHeaders(apiKey),
    ...(initHeaders as Record<string, string> | undefined),
  };
  return fetch(path, { ...rest, headers });
}

/** React 组件内使用的 hook 版本 */
export function useApiFetch() {
  const { apiKey } = useApiKey();
  return (path: string, init: RequestInit = {}) =>
    apiFetch(path, { ...init, apiKey });
}
