"use client";

import { useEffect, useState, type ReactNode } from "react";

export type TabDef = { id: string; label: string; content: ReactNode };

const LS_KEY = "budget-hub-tab";

// Tabbed shell for the Budget hub. Each tab's content is server-rendered and
// passed in; only the active tab is mounted, so charts size correctly on entry.
// The active tab persists to localStorage so the page reopens where you left it.
export function TabbedHub({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  // After mount, pick the active tab: a `?tab=` deep-link wins (so dashboard
  // alerts can land on the right tab), else the last-used tab. Avoids SSR/client
  // mismatch by only reading the URL/localStorage client-side.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    const saved = window.localStorage.getItem(LS_KEY);
    const pick = [fromUrl, saved].find((id) => id && tabs.some((t) => t.id === id));
    if (pick) setActive(pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function pick(id: string) {
    setActive(id);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_KEY, id);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
  }

  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div
        role="tablist"
        className="inline-flex rounded-xl p-1 gap-1 mb-5"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
      >
        {tabs.map((t) => {
          const on = t.id === current?.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => pick(t.id)}
              className="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: on ? "var(--color-accent)" : "transparent",
                color: on ? "var(--color-bg)" : "var(--color-muted)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 items-start">{current?.content}</div>
    </div>
  );
}
