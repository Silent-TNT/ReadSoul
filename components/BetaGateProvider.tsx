"use client";

import { type ReactNode, useLayoutEffect } from "react";
import { setRuntimeBetaSecret } from "@/lib/betaGate";

/** 服务端传入 BETA_GATE_SECRET，在首屏渲染前写入客户端，供 apiFetch 使用 */
export default function BetaGateProvider({
  secret,
  children,
}: {
  secret: string;
  children: ReactNode;
}) {
  const trimmed = secret.trim();
  if (trimmed) setRuntimeBetaSecret(trimmed);

  useLayoutEffect(() => {
    if (trimmed) {
      window.__READSOUL_BETA__ = trimmed;
      setRuntimeBetaSecret(trimmed);
    }
  }, [trimmed]);

  return <>{children}</>;
}
