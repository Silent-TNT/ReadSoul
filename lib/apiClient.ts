"use client";

import { useApiKey } from "@/hooks/useApiKey";
import { getClientBetaSecret } from "@/lib/betaGate";

function buildHeaders(apiKey?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = apiKey?.trim();
  if (key && /^wrk-[A-Za-z0-9]+/.test(key)) {
    headers.Authorization = `Bearer ${key}`;
  }
  const betaSecret = getClientBetaSecret();
  if (betaSecret) {
    headers["X-ReadSoul-Beta"] = betaSecret;
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
