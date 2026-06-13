import type { ReactNode } from "react";

// A plain (non-collapsible) titled card used as the building block of each
// tab's bento grid. `span` controls how many columns it takes in a 2-col grid.
export function Section({
  title,
  subtitle,
  action,
  children,
  span = "full",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  span?: "full" | "half";
}) {
  return (
    <section className={`card p-5 ${span === "full" ? "md:col-span-2" : ""}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="font-semibold leading-tight">{title}</h2>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}
