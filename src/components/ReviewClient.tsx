"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, NotebookPen } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";

export type ReviewDTO = { weekStart: string; title: string; lines: string[]; createdAt: string };

export function ReviewClient({ reviews }: { reviews: ReviewDTO[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={generate}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          <RefreshCw size={16} className={busy ? "animate-spin" : ""} /> {busy ? "Generating…" : "Generate this week"}
        </button>
      </div>

      {reviews.length === 0 ? (
        <EmptyState title="No reviews yet" hint="Generate a digest of this week's habits, time and goals." />
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <Card key={r.weekStart}>
              <div className="flex items-center gap-2 mb-3">
                <NotebookPen size={16} style={{ color: "var(--color-accent)" }} />
                <span className="text-sm font-medium">{r.title}</span>
              </div>
              <ul className="space-y-1.5">
                {r.lines.map((l, i) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: "var(--color-muted)" }}>
                    <span style={{ color: "var(--color-accent)" }}>•</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
