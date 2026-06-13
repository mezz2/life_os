"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { fmtDate } from "@/lib/format";

// A calendar popover styled to match the app, replacing the raw native
// <input type="date">. Value is an ISO `YYYY-MM-DD` string, same as before.
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const parse = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? { y: +m[1], mo: +m[2] - 1, d: +m[3] } : null;
};

export function DatePicker({
  value,
  onChange,
  className = "",
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const sel = parse(value);
  const today = new Date();
  const [view, setView] = useState(() => sel ?? { y: today.getFullYear(), mo: today.getMonth() });

  // Re-centre the calendar on the selected month each time it opens.
  useEffect(() => {
    if (open && sel) setView({ y: sel.y, mo: sel.mo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const { y, mo } = view;
  const firstWeekday = (new Date(y, mo, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isToday = (d: number) =>
    d === today.getDate() && mo === today.getMonth() && y === today.getFullYear();
  const isSel = (d: number) => sel != null && sel.y === y && sel.mo === mo && sel.d === d;

  const shift = (delta: number) => {
    const next = new Date(y, mo + delta, 1);
    setView({ y: next.getFullYear(), mo: next.getMonth() });
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-2 text-left ${className}`}
        style={style}
      >
        <span style={{ color: value ? "var(--color-text)" : "var(--color-muted)" }}>
          {value ? fmtDate(value, "med") : "Select date"}
        </span>
        <Calendar size={15} style={{ color: "var(--color-muted)" }} />
      </button>

      {open && (
        <div
          className="anim-pop card absolute left-0 top-full z-50 mt-2 p-3"
          style={{ width: 270, background: "var(--color-surface)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => shift(-1)} className="p-1 rounded-md hover:opacity-100 opacity-70" style={{ color: "var(--color-muted)" }}>
              <ChevronLeft size={16} />
            </button>
            <div className="text-sm font-medium">
              {MONTHS[mo]} {y}
            </div>
            <button type="button" onClick={() => shift(1)} className="p-1 rounded-md hover:opacity-100 opacity-70" style={{ color: "var(--color-muted)" }}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[10px] font-medium uppercase" style={{ color: "var(--color-muted)" }}>
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) =>
              d == null ? (
                <div key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onChange(iso(y, mo, d));
                    setOpen(false);
                  }}
                  className="num h-8 rounded-md text-xs font-medium transition-colors"
                  style={{
                    background: isSel(d) ? "var(--color-accent)" : "transparent",
                    color: isSel(d)
                      ? "var(--color-bg)"
                      : isToday(d)
                        ? "var(--color-accent)"
                        : "var(--color-text)",
                    border: isToday(d) && !isSel(d) ? "1px solid var(--color-accent)" : "1px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSel(d)) e.currentTarget.style.background = "var(--color-surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSel(d)) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {d}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              const n = new Date();
              onChange(iso(n.getFullYear(), n.getMonth(), n.getDate()));
              setOpen(false);
            }}
            className="mt-2 w-full rounded-md py-1.5 text-xs font-medium"
            style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}
