"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function GenerateInsights() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function run() {
    setBusy(true);
    await fetch("/api/insights", { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={run}
      disabled={busy}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
      style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
    >
      <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
      {busy ? "Analysing…" : "Generate insights"}
    </button>
  );
}
