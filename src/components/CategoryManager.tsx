"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, X } from "lucide-react";
import { Portal } from "@/components/Portal";
import type { CategoryTree } from "@/components/TransactionsClient";

type Cat = CategoryTree[number];
const KINDS = ["income", "expense", "transfer", "investment"] as const;
const inputStyle = { background: "var(--color-surface-2)", border: "1px solid var(--color-border)" } as const;

// Manage the category taxonomy: add / rename / delete top-level categories and
// the subcategories within them. Edits hit the /api/categories and
// /api/subcategories routes; the page is refreshed on close so the budget cards
// and every category dropdown pick up the changes.
export function CategoryManager({ tree, onClose }: { tree: CategoryTree; onClose: () => void }) {
  const router = useRouter();
  const [cats, setCats] = useState<Cat[]>(() => tree.map((c) => ({ ...c, subs: [...c.subs] })));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatKind, setNewCatKind] = useState<(typeof KINDS)[number]>("expense");

  function close() {
    router.refresh();
    onClose();
  }

  async function call(url: string, method: string, body: object): Promise<Record<string, unknown> | null> {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong.");
        return null;
      }
      return data;
    } finally {
      setBusy(false);
    }
  }

  // ----- Category ops -----
  async function addCat() {
    const name = newCatName.trim();
    if (!name) return;
    const data = await call("/api/categories", "POST", { name, kind: newCatKind });
    if (!data) return;
    setCats((cs) => [...cs, { ...(data.category as Cat), subs: [] }]);
    setNewCatName("");
  }
  async function renameCat(id: string, name: string) {
    setCats((cs) => cs.map((c) => (c.id === id ? { ...c, name } : c)));
  }
  async function commitCat(id: string, name: string, kind: string) {
    await call("/api/categories", "PATCH", { id, name, kind });
  }
  async function deleteCat(c: Cat) {
    if (!confirm(`Delete "${c.name}" and its ${c.subs.length} subcategor${c.subs.length === 1 ? "y" : "ies"}? Transactions in them become uncategorised.`)) return;
    const data = await call("/api/categories", "DELETE", { id: c.id });
    if (!data) return;
    setCats((cs) => cs.filter((x) => x.id !== c.id));
  }

  // ----- Subcategory ops -----
  async function addSub(catId: string, name: string, group: string) {
    const data = await call("/api/subcategories", "POST", { categoryId: catId, name, group });
    if (!data) return;
    const sub = data.subcategory as { id: string; name: string; group: string | null };
    setCats((cs) => cs.map((c) => (c.id === catId ? { ...c, subs: [...c.subs, sub] } : c)));
  }
  function editSubLocal(catId: string, subId: string, patch: Partial<{ name: string; group: string | null }>) {
    setCats((cs) =>
      cs.map((c) =>
        c.id === catId ? { ...c, subs: c.subs.map((s) => (s.id === subId ? { ...s, ...patch } : s)) } : c,
      ),
    );
  }
  async function commitSub(subId: string, name: string, group: string | null) {
    await call("/api/subcategories", "PATCH", { id: subId, name, group });
  }
  async function deleteSub(catId: string, subId: string, name: string) {
    if (!confirm(`Delete "${name}"? Its budget line is removed and transactions in it become uncategorised.`)) return;
    const data = await call("/api/subcategories", "DELETE", { id: subId });
    if (!data) return;
    setCats((cs) => cs.map((c) => (c.id === catId ? { ...c, subs: c.subs.filter((s) => s.id !== subId) } : c)));
  }

  return (
    <Portal>
      <div
        onClick={(e) => e.target === e.currentTarget && close()}
        className="anim-overlay fixed inset-0 z-50 grid place-items-center p-4 overflow-y-auto"
        style={{ background: "rgba(0,0,0,0.6)" }}
      >
        <div className="anim-pop card p-6 w-full max-w-2xl my-8">
          <div className="flex items-start justify-between mb-4 gap-3">
            <div>
              <div className="font-semibold">Manage categories</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                Add, rename or remove categories and subcategories
              </div>
            </div>
            <button onClick={close} style={{ color: "var(--color-muted)" }} className="shrink-0">
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="mb-3 text-sm" style={{ color: "var(--color-negative)" }}>
              {error}
            </div>
          )}

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {cats.map((c) => (
              <div key={c.id} className="rounded-lg p-3" style={{ border: "1px solid var(--color-border)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={c.name}
                    onChange={(e) => renameCat(c.id, e.target.value)}
                    onBlur={(e) => commitCat(c.id, e.target.value, c.kind)}
                    className="flex-1 rounded-md px-2 py-1 text-sm font-medium"
                    style={inputStyle}
                  />
                  <select
                    value={c.kind}
                    onChange={(e) => {
                      const kind = e.target.value;
                      setCats((cs) => cs.map((x) => (x.id === c.id ? { ...x, kind } : x)));
                      commitCat(c.id, c.name, kind);
                    }}
                    className="rounded-md px-2 py-1 text-xs"
                    style={inputStyle}
                    title="How this category counts toward income / expense totals"
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => deleteCat(c)}
                    disabled={busy}
                    title="Delete category"
                    className="shrink-0 rounded-md p-1.5"
                    style={{ color: "var(--color-negative)" }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="space-y-1.5 pl-1">
                  {c.subs.map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <input
                        value={s.group ?? ""}
                        placeholder="group"
                        onChange={(e) => editSubLocal(c.id, s.id, { group: e.target.value })}
                        onBlur={(e) => commitSub(s.id, s.name, e.target.value)}
                        className="w-28 rounded-md px-2 py-1 text-xs"
                        style={inputStyle}
                      />
                      <input
                        value={s.name}
                        onChange={(e) => editSubLocal(c.id, s.id, { name: e.target.value })}
                        onBlur={(e) => commitSub(s.id, e.target.value, s.group)}
                        className="flex-1 rounded-md px-2 py-1 text-sm"
                        style={inputStyle}
                      />
                      <button
                        onClick={() => deleteSub(c.id, s.id, s.name)}
                        disabled={busy}
                        title="Delete subcategory"
                        className="shrink-0 rounded-md p-1.5"
                        style={{ color: "var(--color-muted)" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <AddSubRow onAdd={(name, group) => addSub(c.id, name, group)} busy={busy} />
                </div>
              </div>
            ))}
          </div>

          {/* New category */}
          <div className="mt-4 pt-4 flex items-center gap-2" style={{ borderTop: "1px solid var(--color-border)" }}>
            <input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCat()}
              placeholder="New category name"
              className="flex-1 rounded-md px-2 py-1.5 text-sm"
              style={inputStyle}
            />
            <select
              value={newCatKind}
              onChange={(e) => setNewCatKind(e.target.value as (typeof KINDS)[number])}
              className="rounded-md px-2 py-1.5 text-xs"
              style={inputStyle}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button
              onClick={addCat}
              disabled={busy || !newCatName.trim()}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
            >
              <Plus size={14} /> Category
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function AddSubRow({ onAdd, busy }: { onAdd: (name: string, group: string) => void; busy: boolean }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  function submit() {
    if (!name.trim()) return;
    onAdd(name.trim(), group.trim());
    setName("");
    setGroup("");
  }
  return (
    <div className="flex items-center gap-2 pt-0.5">
      <input
        value={group}
        onChange={(e) => setGroup(e.target.value)}
        placeholder="group"
        className="w-28 rounded-md px-2 py-1 text-xs"
        style={inputStyle}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="+ add subcategory"
        className="flex-1 rounded-md px-2 py-1 text-sm"
        style={inputStyle}
      />
      <button
        onClick={submit}
        disabled={busy || !name.trim()}
        className="shrink-0 rounded-md p-1.5 disabled:opacity-40"
        style={{ color: "var(--color-accent)" }}
        title="Add subcategory"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
