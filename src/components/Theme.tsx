"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export type Theme = "dark" | "light";

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void; mounted: boolean }>({
  theme: "dark",
  toggle: () => {},
  mounted: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Inline head script set data-theme before paint; adopt it on mount.
  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "dark";
    setTheme(current);
    setMounted(true);
  }, []);

  function toggle() {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch {}
      return next;
    });
  }

  return <ThemeCtx.Provider value={{ theme, toggle, mounted }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

// Theme-aware "ink" colours for charts (recharts needs concrete values).
export function useChartInk() {
  const { theme } = useTheme();
  return theme === "light"
    ? { panel: "#ffffff", border: "#dce1e7", grid: "#e8edf2", axis: "#5b6675", text: "#111821", dim: "#c5cdd6" }
    : { panel: "#11171f", border: "#222c38", grid: "#1c2632", axis: "#8a98a8", text: "#e7edf3", dim: "#3b4654" };
}

export function ThemeToggle() {
  const { theme, toggle, mounted } = useTheme();
  // Avoid a hydration mismatch on the icon until we've read the real theme.
  if (!mounted) return <div className="h-9 mx-3" aria-hidden />;
  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm mx-0 transition-colors"
      style={{ color: "var(--color-muted)" }}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
