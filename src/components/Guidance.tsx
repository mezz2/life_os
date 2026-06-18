"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { HelpCircle, Lightbulb, ChevronDown } from "lucide-react";
import { CONCEPTS, type PageHint, type Coach } from "@/lib/guidance";

// Small "?" affordance next to a term. Click to reveal its definition.
// Pass either a `concept` key (looked up in CONCEPTS) or explicit text.
export function InfoTip({
  concept,
  title,
  text,
  className = "",
}: {
  concept?: string;
  title?: string;
  text?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const c = concept ? CONCEPTS[concept] : undefined;
  const heading = title ?? c?.term ?? "";
  const body = text ?? c?.short ?? "";

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!body) return null;

  return (
    <span ref={ref} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label={`What is ${heading}?`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-grid place-items-center transition-colors"
        style={{ color: open ? "var(--color-accent)" : "var(--color-muted)" }}
      >
        <HelpCircle size={14} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="anim-pop absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-lg p-3 text-left shadow-lg"
          style={{
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
          }}
        >
          {heading && (
            <span className="mb-1 block text-xs font-semibold" style={{ color: "var(--color-text)" }}>
              {heading}
            </span>
          )}
          <span className="block text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
            {body}
          </span>
        </span>
      )}
    </span>
  );
}

// Dismissible/collapsible coaching card for the top of a page. Remembers its
// collapsed state in localStorage so a returning user isn't nagged, but can
// always re-open it — nothing is permanently lost.
export function HintCard({ hint }: { hint: PageHint }) {
  const storageKey = `lifeos-hint:${hint.id}`;
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOpen(localStorage.getItem(storageKey) !== "collapsed");
    setReady(true);
  }, [storageKey]);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      localStorage.setItem(storageKey, next ? "open" : "collapsed");
      return next;
    });
  }

  // Avoid a flash of the wrong state before localStorage is read.
  if (!ready) return null;

  return (
    <div
      className="card mb-4 overflow-hidden"
      style={{ borderColor: "var(--color-accent)", background: "var(--color-accent-dim)" }}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Lightbulb size={16} style={{ color: "var(--color-accent)" }} />
        <span className="flex-1 text-sm font-medium">{hint.title}</span>
        <ChevronDown
          size={16}
          style={{
            color: "var(--color-muted)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </button>
      {open && (
        <ul className="space-y-1.5 px-4 pb-4 pl-9 text-sm" style={{ color: "var(--color-muted)" }}>
          {hint.points.map((p, i) => (
            <li key={i} className="list-disc">
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Richer empty state used when a section has nothing in it yet — explains the
// concept and shows concrete examples instead of a bare "nothing here".
export function CoachEmptyState({ coach, action }: { coach: Coach; action?: ReactNode }) {
  return (
    <div className="card p-6 text-center">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full" style={{ background: "var(--color-accent-dim)" }}>
        <Lightbulb size={18} style={{ color: "var(--color-accent)" }} />
      </div>
      <div className="text-sm font-medium">{coach.title}</div>
      <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: "var(--color-muted)" }}>
        {coach.body}
      </p>
      {coach.examples && coach.examples.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {coach.examples.map((ex) => (
            <span
              key={ex}
              className="rounded-full px-2.5 py-1 text-xs"
              style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}
            >
              {ex}
            </span>
          ))}
        </div>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
