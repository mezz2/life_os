"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { monthLabel } from "@/lib/format";

export function MonthPicker({ months, value }: { months: string[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <select
      value={value}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("month", e.target.value);
        router.push(`${pathname}?${params.toString()}`);
      }}
      className="rounded-lg px-3 py-2 text-sm"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {months.map((m) => (
        <option key={m} value={m}>
          {monthLabel(m)}
        </option>
      ))}
    </select>
  );
}
