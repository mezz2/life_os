"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Sparkles, ChevronDown, X } from "lucide-react";
import { ONBOARDING } from "@/lib/guidance";

export type SetupProgress = {
  values: boolean;
  goals: boolean;
  habits: boolean;
  identity: boolean;
  routine: boolean;
  checkin: boolean;
};

// First-run onboarding: a persistent checklist that walks setup in the
// recommended order and ticks itself off as each piece exists. Once every step
// is done it can be dismissed for good.
export function GettingStarted({ progress }: { progress: SetupProgress }) {
  const done = ONBOARDING.filter((s) => progress[s.key]).length;
  const total = ONBOARDING.length;
  const allDone = done === total;

  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem("lifeos-onboarding") === "dismissed");
    setOpen(localStorage.getItem("lifeos-onboarding-open") !== "collapsed");
    setReady(true);
  }, []);

  function toggle() {
    setOpen((v) => {
      localStorage.setItem("lifeos-onboarding-open", v ? "collapsed" : "open");
      return !v;
    });
  }

  function dismiss() {
    localStorage.setItem("lifeos-onboarding", "dismissed");
    setDismissed(true);
  }

  if (!ready || dismissed) return null;

  return (
    <div className="card mb-4 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{ background: "var(--color-accent-dim)" }}
        >
          <Sparkles size={18} style={{ color: "var(--color-accent)" }} />
        </div>
        <button type="button" onClick={toggle} className="flex-1 text-left">
          <div className="text-sm font-medium">
            {allDone ? "You're all set up" : "Getting started"}
          </div>
          <div className="text-xs" style={{ color: "var(--color-muted)" }}>
            {allDone
              ? "Your values, goals and habits are connected. Nice work."
              : `${done} of ${total} steps done — set things up in this order.`}
          </div>
        </button>
        <div className="flex items-center gap-1">
          {allDone && (
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="grid h-7 w-7 place-items-center rounded-lg"
              style={{ color: "var(--color-muted)" }}
            >
              <X size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? "Collapse" : "Expand"}
            className="grid h-7 w-7 place-items-center rounded-lg"
          >
            <ChevronDown
              size={16}
              style={{
                color: "var(--color-muted)",
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 0.15s",
              }}
            />
          </button>
        </div>
      </div>

      {/* progress bar */}
      <div className="h-1 w-full" style={{ background: "var(--color-surface-2)" }}>
        <div
          className="h-full rounded-r-full transition-all"
          style={{ width: `${(done / total) * 100}%`, background: "var(--color-accent)" }}
        />
      </div>

      {open && (
        <ol className="divide-y" style={{ borderColor: "var(--color-border)" }}>
          {ONBOARDING.map((step) => {
            const complete = progress[step.key];
            return (
              <li key={step.title} className="flex items-center gap-3 px-5 py-3">
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs"
                  style={{
                    background: complete ? "var(--color-accent)" : "var(--color-surface-2)",
                    color: complete ? "var(--color-bg)" : "var(--color-muted)",
                    border: complete ? "none" : "1px solid var(--color-border)",
                  }}
                >
                  {complete ? <Check size={13} /> : ""}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-medium"
                    style={{ color: complete ? "var(--color-muted)" : "var(--color-text)" }}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {step.blurb}
                  </div>
                </div>
                {!complete && (
                  <Link
                    href={step.href}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium"
                    style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
                  >
                    {step.cta}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
