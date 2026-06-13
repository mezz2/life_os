"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, CornerDownLeft } from "lucide-react";
import { aud, fmtDate } from "@/lib/format";
import type { CategoryTree } from "./TransactionsClient";

type Row = {
  id: string;
  date: string;
  description: string;
  rawDescription: string;
  amount: number;
  account: string;
};

type Opt = { id: string; label: string; search: string };

function buildOptions(tree: CategoryTree): Opt[] {
  const out: Opt[] = [];
  for (const c of tree) {
    for (const s of c.subs) {
      const tail = s.group ? `${s.group} › ${s.name}` : s.name;
      const label = `${c.name} › ${tail}`;
      out.push({ id: s.id, label, search: label.toLowerCase() });
    }
  }
  return out;
}

function score(opt: Opt, q: string): number {
  // Higher is better; -1 means no match.
  if (!q) return 0;
  const i = opt.search.indexOf(q);
  if (i === -1) {
    // fall back to subsequence (fuzzy) match
    let qi = 0;
    for (let si = 0; si < opt.search.length && qi < q.length; si++) {
      if (opt.search[si] === q[qi]) qi++;
    }
    return qi === q.length ? 1 : -1;
  }
  // Prefer matches at a word boundary, and earlier matches.
  const boundary = i === 0 || opt.search[i - 1] === " " || opt.search[i - 1] === "›";
  return 1000 - i + (boundary ? 500 : 0);
}

export function BulkCategorise({
  queue,
  tree,
  onAssign,
  onClose,
}: {
  queue: Row[];
  tree: CategoryTree;
  onAssign: (id: string, subcategoryId: string, applyToMatching: boolean, matchText: string) => Promise<void>;
  onClose: () => void;
}) {
  const options = useMemo(() => buildOptions(tree), [tree]);
  const total = queue.length;
  const [index, setIndex] = useState(0);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const [applyMatching, setApplyMatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Portal to <body> so the fixed overlay covers the whole viewport — otherwise
  // an ancestor with a transform (the page-transition wrapper) becomes the
  // containing block and the overlay only dims part of the screen.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const row = queue[index];

  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    const scored = options
      .map((o) => ({ o, s: score(o, query) }))
      .filter((x) => x.s >= 0);
    scored.sort((a, b) => b.s - a.s || a.o.label.localeCompare(b.o.label));
    return scored.map((x) => x.o);
  }, [options, q]);

  // Reset highlight & refocus when the query or the current row changes.
  useEffect(() => setHi(0), [q, index]);
  useEffect(() => inputRef.current?.focus(), [index]);

  // Keep highlighted item in view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  async function assign(opt: Opt) {
    if (!row || busy) return;
    setBusy(true);
    try {
      await onAssign(row.id, opt.id, applyMatching, row.description || row.rawDescription);
    } finally {
      setBusy(false);
    }
    setQ("");
    if (index >= total - 1) onClose();
    else setIndex((i) => i + 1);
  }

  function skip() {
    setQ("");
    if (index >= total - 1) onClose();
    else setIndex((i) => i + 1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = matches[hi];
      if (opt) assign(opt);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab") {
      e.preventDefault();
      skip();
    }
  }

  if (!row || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onMouseDown={onClose}
    >
      <div
        className="card w-full max-w-xl p-0 overflow-hidden"
        style={{ background: "var(--color-surface)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header / progress */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <span className="text-sm font-medium">
            Categorise{" "}
            <span style={{ color: "var(--color-muted)" }}>
              {index + 1} / {total}
            </span>
          </span>
          <button onClick={onClose} style={{ color: "var(--color-muted)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="h-0.5" style={{ background: "var(--color-border)" }}>
          <div
            className="h-full"
            style={{ width: `${(index / total) * 100}%`, background: "var(--color-accent)" }}
          />
        </div>

        {/* Current transaction */}
        <div className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium" title={row.rawDescription}>
                {row.description || row.rawDescription}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                {fmtDate(row.date, "med")} · {row.account}
              </div>
            </div>
            <div
              className="num font-medium whitespace-nowrap"
              style={{ color: row.amount >= 0 ? "var(--color-positive)" : "var(--color-text)" }}
            >
              {aud(row.amount, { cents: true, sign: row.amount > 0 })}
            </div>
          </div>
        </div>

        {/* Typeahead */}
        <div className="px-4 pb-2">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            placeholder="Type a category…"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
          />
        </div>

        {/* Options */}
        <div ref={listRef} className="max-h-[40vh] overflow-y-auto px-2 pb-2">
          {matches.length === 0 && (
            <div className="px-2 py-3 text-sm" style={{ color: "var(--color-muted)" }}>
              No category matches “{q}”.
            </div>
          )}
          {matches.map((o, i) => (
            <button
              key={o.id}
              data-i={i}
              onMouseEnter={() => setHi(i)}
              onClick={() => assign(o)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm"
              style={{
                background: i === hi ? "var(--color-accent-dim)" : "transparent",
                color: i === hi ? "var(--color-accent)" : "var(--color-text)",
              }}
            >
              <span className="truncate">{o.label}</span>
              {i === hi && <CornerDownLeft size={13} className="shrink-0 opacity-60" />}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2.5 text-xs"
          style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-muted)" }}
        >
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={applyMatching}
              onChange={(e) => setApplyMatching(e.target.checked)}
              tabIndex={-1}
            />
            Apply to all matching this description
          </label>
          <span>
            <kbd>↑↓</kbd> move · <kbd>↵</kbd> assign · <kbd>Tab</kbd> skip · <kbd>Esc</kbd> close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
