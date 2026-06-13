"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, FileUp, Check } from "lucide-react";
import { aud, fmtDate } from "@/lib/format";
import { CategorySelect, type CategoryTree } from "./TransactionsClient";

type PreviewRow = {
  date: string;
  description: string;
  rawDescription: string;
  amount: number;
  subcategoryId: string | null;
  subcategoryName: string | null;
  needsReview: boolean;
};

type Account = { id: string; name: string; institution?: string };

export function ImportDialog({
  accounts,
  tree,
  onClose,
  onDone,
  onAccountCreated,
}: {
  accounts: Account[];
  tree: CategoryTree;
  onClose: () => void;
  onDone: () => void;
  onAccountCreated: (a: Account) => void;
}) {
  const [filename, setFilename] = useState("");
  const [detected, setDetected] = useState<{ id: string; label: string; confidence: number } | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  // Inline "add account" form, for when the target account doesn't exist yet.
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("transaction");

  // Portal to <body> so the fixed overlay isn't trapped by an ancestor's
  // transform (the page-transition wrapper) and covers the whole viewport.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function onFile(file: File) {
    setError("");
    setBusy(true);
    const text = await file.text();
    setFilename(file.name);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", text }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.error) {
      setError(data.error + (data.headers ? ` (headers: ${data.headers.join(", ")})` : ""));
      return;
    }
    setDetected(data.detected);
    setRows(data.rows);
    // Auto-pick the account matching the detected institution.
    const match = accounts.find(
      (a) => a.institution?.toLowerCase() === data.detected.id || a.name.toLowerCase().includes(data.detected.id),
    );
    if (match) setAccountId(match.id);
  }

  async function commit() {
    if (!accountId) {
      setError("Choose an account first.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "commit", filename, accountId, rows }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.error) return setError(data.error);
    setResult({ added: data.added, skipped: data.skipped });
  }

  async function createAccount() {
    const name = newName.trim();
    if (!name) {
      setError("Account name is required.");
      return;
    }
    setError("");
    setBusy(true);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: newType, institution: detected?.label ?? "Manual" }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.error) return setError(data.error);
    onAccountCreated(data.account);
    setAccountId(data.account.id);
    setAdding(false);
    setNewName("");
  }

  const reviewCount = rows.filter((r) => r.needsReview).length;

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.65)" }}>
      <div className="card w-full max-w-4xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="font-semibold">Import transactions</div>
          <button onClick={onClose} style={{ color: "var(--color-muted)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {result ? (
            <div className="text-center py-10">
              <div
                className="mx-auto mb-4 h-12 w-12 rounded-full grid place-items-center"
                style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}
              >
                <Check size={24} />
              </div>
              <div className="font-medium">Imported {result.added} transactions</div>
              <div className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
                {result.skipped > 0 ? `${result.skipped} duplicates skipped` : "No duplicates"}
              </div>
              <button
                onClick={onDone}
                className="mt-5 rounded-lg px-4 py-2 text-sm font-medium"
                style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
              >
                Done
              </button>
            </div>
          ) : rows.length === 0 ? (
            <label
              className="flex flex-col items-center justify-center gap-3 py-16 rounded-xl cursor-pointer"
              style={{ border: "1px dashed var(--color-border)" }}
            >
              <FileUp size={28} style={{ color: "var(--color-muted)" }} />
              <div className="text-sm">{busy ? "Parsing…" : "Drop a CSV here or click to choose"}</div>
              <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                CBA, Westpac and UBank formats auto-detected
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </label>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {detected && (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-medium"
                    style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}
                  >
                    Detected: {detected.label} ({Math.round(detected.confidence * 100)}%)
                  </span>
                )}
                <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                  {rows.length} rows · {reviewCount} need review
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-sm" style={{ color: "var(--color-muted)" }}>
                    Account:
                  </span>
                  {adding ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && createAccount()}
                        placeholder="Account name"
                        className="rounded-lg px-3 py-1.5 text-sm"
                        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
                      />
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        className="rounded-lg px-3 py-1.5 text-sm"
                        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
                      >
                        <option value="transaction">Transaction</option>
                        <option value="savings">Savings</option>
                        <option value="brokerage">Brokerage</option>
                        <option value="super">Super</option>
                        <option value="crypto">Crypto</option>
                      </select>
                      <button
                        onClick={createAccount}
                        disabled={busy || !newName.trim()}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                        style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setAdding(false)}
                        className="text-sm"
                        style={{ color: "var(--color-muted)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <select
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        className="rounded-lg px-3 py-1.5 text-sm"
                        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
                      >
                        <option value="">Choose…</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          setNewName(detected?.label ?? "");
                          setAdding(true);
                        }}
                        className="rounded-lg px-3 py-1.5 text-sm"
                        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}
                      >
                        + New
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--color-border)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ color: "var(--color-muted)" }} className="text-left">
                      <th className="py-2 px-3 font-medium">Date</th>
                      <th className="py-2 px-3 font-medium">Description</th>
                      <th className="py-2 px-3 font-medium w-56">Category</th>
                      <th className="py-2 px-3 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-1.5 px-3 whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                          {fmtDate(r.date, "short")}
                        </td>
                        <td className="py-1.5 px-3 max-w-[260px] truncate" title={r.rawDescription}>
                          {r.description}
                        </td>
                        <td className="py-1.5 px-3">
                          <CategorySelect
                            tree={tree}
                            value={r.subcategoryId ?? ""}
                            flag={r.needsReview}
                            onChange={(id) =>
                              setRows((rs) =>
                                rs.map((x, j) =>
                                  j === i ? { ...x, subcategoryId: id, needsReview: false } : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td
                          className="num py-1.5 px-3 text-right whitespace-nowrap"
                          style={{ color: r.amount >= 0 ? "var(--color-positive)" : "var(--color-text)" }}
                        >
                          {aud(r.amount, { cents: true, sign: r.amount > 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {error && (
            <div className="mt-4 text-sm" style={{ color: "var(--color-negative)" }}>
              {error}
            </div>
          )}
        </div>

        {rows.length > 0 && !result && (
          <div className="flex items-center justify-end gap-3 p-5 border-t">
            {!accountId && (
              <span className="text-sm mr-auto" style={{ color: "var(--color-muted)" }}>
                Choose an account above to import.
              </span>
            )}
            <button onClick={onClose} className="text-sm" style={{ color: "var(--color-muted)" }}>
              Cancel
            </button>
            <button
              onClick={commit}
              disabled={busy || !accountId}
              className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
            >
              {busy ? "Importing…" : `Import ${rows.length} transactions`}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
