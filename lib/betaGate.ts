/** 服务端 HTML 注入 window.__READSOUL_BETA__，避免 NEXT_PUBLIC 构建时未生效 */
declare global {
  interface Window {
    __READSOUL_BETA__?: string;
  }
}

export function getClientBetaSecret(): string {
  if (typeof window !== "undefined") {
    const injected = window.__READSOUL_BETA__?.trim();
    if (injected) return injected;
  }
  return process.env.NEXT_PUBLIC_BETA_GATE_SECRET?.trim() ?? "";
}
