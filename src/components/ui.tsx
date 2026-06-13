import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-5 ${className}`}>{children}</div>;
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "positive" | "negative" | "warn";
}) {
  const color =
    tone === "positive"
      ? "var(--color-positive)"
      : tone === "negative"
        ? "var(--color-negative)"
        : tone === "warn"
          ? "var(--color-warn)"
          : "var(--color-text)";
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
        {label}
      </div>
      <div className="num text-2xl font-semibold mt-2" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
          {sub}
        </div>
      )}
    </Card>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "positive" | "negative" | "warn" | "accent";
}) {
  const map: Record<string, [string, string]> = {
    default: ["var(--color-surface-2)", "var(--color-muted)"],
    positive: ["rgba(52,211,153,0.12)", "var(--color-positive)"],
    negative: ["rgba(248,113,113,0.12)", "var(--color-negative)"],
    warn: ["rgba(251,191,36,0.12)", "var(--color-warn)"],
    accent: ["var(--color-accent-dim)", "var(--color-accent)"],
  };
  const [bg, fg] = map[tone];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="text-center py-12">
      <div className="text-sm font-medium">{title}</div>
      {hint && (
        <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
          {hint}
        </div>
      )}
    </Card>
  );
}
