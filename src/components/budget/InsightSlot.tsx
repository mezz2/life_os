import { InsightCard, type InsightDTO } from "@/components/InsightCard";

// A contextual insight strip attached to a section. Renders its insights as
// compact, dismissable cards — and renders nothing at all when empty, so pages
// stay quiet unless there's something worth surfacing.
export function InsightSlot({
  insights,
  className = "",
}: {
  insights?: InsightDTO[];
  className?: string;
}) {
  if (!insights || insights.length === 0) return null;
  return (
    <div className={`space-y-2 ${className}`}>
      {insights.map((i) => (
        <InsightCard key={i.id} insight={i} compact />
      ))}
    </div>
  );
}
