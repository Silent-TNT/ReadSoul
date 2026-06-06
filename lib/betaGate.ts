/** Beta 门禁密钥：服务端注入 + 构建时 NEXT_PUBLIC 兜底 */
declare global {
  interface Window {
    __READSOUL_BETA__?: string;
  }
}

let runtimeBetaSecret = "";

export function setRuntimeBetaSecret(secret: string) {
  runtimeBetaSecret = secret.trim();
}

export function getClientBetaSecret(): string {
  if (runtimeBetaSecret) return runtimeBetaSecret;
  if (typeof window !== "undefined") {
    const injected = window.__READSOUL_BETA__?.trim();
    if (injected) return injected;
  }
  return process.env.NEXT_PUBLIC_BETA_GATE_SECRET?.trim() ?? "";
}
