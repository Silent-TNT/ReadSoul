"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "readsoul_api_key";

export function isValidKey(key: string): boolean {
  return /^wrk-[A-Za-z0-9]+/.test(key.trim());
}

/** API Key 仅存于浏览器 localStorage，不上传服务器持久化 */
export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setApiKeyState(saved);
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  const setApiKey = useCallback((key: string) => {
    const trimmed = key.trim();
    try {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } catch {
      // ignore
    }
    setApiKeyState(trimmed);
  }, []);

  const clearApiKey = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setApiKeyState(null);
  }, []);

  return { apiKey, setApiKey, clearApiKey, ready };
}
