"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

/** Pill segmented switch with a sliding pill. Icon only — sun and moon. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      role="group"
      aria-label="Theme"
      className="relative flex h-9 w-[72px] items-center rounded-full border border-border bg-bg p-1"
    >
      <span
        aria-hidden
        className={`absolute top-1 h-7 w-[32px] rounded-full bg-surface border border-border transition-transform duration-200 ease-out motion-reduce:transition-none ${
          isDark ? "translate-x-[32px]" : "translate-x-0"
        }`}
      />
      <button
        type="button"
        aria-label="Light theme"
        aria-pressed={!isDark}
        onClick={() => setTheme("light")}
        className={`relative z-10 flex h-7 w-[32px] items-center justify-center rounded-full transition-colors motion-reduce:transition-none ${
          !isDark ? "text-accent" : "text-muted"
        }`}
      >
        <Sun className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label="Dark theme"
        aria-pressed={isDark}
        onClick={() => setTheme("dark")}
        className={`relative z-10 flex h-7 w-[32px] items-center justify-center rounded-full transition-colors motion-reduce:transition-none ${
          isDark ? "text-accent" : "text-muted"
        }`}
      >
        <Moon className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </button>
    </div>
  );
}
