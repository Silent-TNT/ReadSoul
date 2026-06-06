"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "readsoul_thoughts";

/**
 * 用户自己记录的思考，仅存于浏览器本地。
 * key 约定：
 *   - 整本书思考：`book:{bookId}`
 *   - 单条划线思考：`mark:{bookmarkId}`
 */
export function useThoughts() {
  const [map, setMap] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) setMap(JSON.parse(s));
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  const setThought = useCallback((key: string, value: string) => {
    setMap((prev) => {
      const next = { ...prev };
      if (value.trim()) next[key] = value;
      else delete next[key];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { thoughts: map, setThought, ready };
}
