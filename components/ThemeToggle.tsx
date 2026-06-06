"use client";

import { useTheme } from "@/hooks/useTheme";
import { MoonIcon, SunIcon } from "@/components/icons";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "切换到白天模式" : "切换到夜间模式"}
      aria-label="切换主题"
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/60 transition hover:border-soul-gold/40 hover:text-soul-gold"
    >
      <span className="relative block h-5 w-5">
        <span
          className={`absolute inset-0 transition-all duration-300 ${
            theme === "dark"
              ? "rotate-0 opacity-100"
              : "-rotate-90 opacity-0"
          }`}
        >
          <MoonIcon />
        </span>
        <span
          className={`absolute inset-0 transition-all duration-300 ${
            theme === "light"
              ? "rotate-0 opacity-100"
              : "rotate-90 opacity-0"
          }`}
        >
          <SunIcon />
        </span>
      </span>
    </button>
  );
}
