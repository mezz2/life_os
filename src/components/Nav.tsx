"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  TrendingUp,
  Target,
  KeyRound,
  HeartPulse,
  CheckSquare,
  Repeat,
  Link2,
  Compass,
  Sprout,
  HeartHandshake,
  CalendarDays,
  Shuffle,
  CalendarRange,
  NotebookPen,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/Theme";

type Item = { href: string; label: string; icon: LucideIcon };
type Group = { heading: string | null; items: Item[] };

const groups: Group[] = [
  { heading: null, items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    heading: "Finances",
    items: [
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/budget", label: "Budget", icon: Wallet },
      { href: "/net-worth", label: "Net Worth", icon: TrendingUp },
      { href: "/project-buy", label: "Project BUY", icon: KeyRound },
    ],
  },
  {
    heading: "Direction",
    items: [
      { href: "/goals", label: "Goals", icon: Target },
      { href: "/values", label: "Values", icon: Compass },
      { href: "/garden", label: "Knowledge garden", icon: Sprout },
    ],
  },
  {
    heading: "Habits",
    items: [
      { href: "/habits", label: "Habits", icon: Repeat },
      { href: "/stacks", label: "Routines", icon: Link2 },
      { href: "/checkin", label: "Check-in", icon: HeartHandshake },
    ],
  },
  {
    heading: "Time",
    items: [
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/shuffle", label: "Shuffle", icon: Shuffle },
      { href: "/seasons", label: "Seasons", icon: CalendarRange },
    ],
  },
  {
    heading: "Reflect",
    items: [
      { href: "/review", label: "Weekly review", icon: NotebookPen },
      { href: "/align", label: "Alignment", icon: Scale },
    ],
  },
];

const future = [
  { label: "Health", icon: HeartPulse },
  { label: "Tasks", icon: CheckSquare },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-3">
      <div className="px-3 py-4">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-lg grid place-items-center font-bold text-bg"
            style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
          >
            L
          </div>
          <div>
            <div className="font-semibold leading-tight">LifeOS</div>
            <div className="text-xs" style={{ color: "var(--color-muted)" }}>
              Life dashboard
            </div>
          </div>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.heading ?? "home"}>
          {group.heading && (
            <div
              className="mt-3 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--color-muted)" }}
            >
              {group.heading}
            </div>
          )}
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
                style={{
                  background: active ? "var(--color-surface-2)" : "transparent",
                  color: active ? "var(--color-text)" : "var(--color-muted)",
                }}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </div>
      ))}

      <div
        className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-muted)" }}
      >
        Coming soon
      </div>
      {future.map(({ label, icon: Icon }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm opacity-40 cursor-not-allowed"
          style={{ color: "var(--color-muted)" }}
        >
          <Icon size={18} />
          {label}
        </div>
      ))}

      <div className="mt-4 pt-2 border-t">
        <ThemeToggle />
      </div>
    </nav>
  );
}
