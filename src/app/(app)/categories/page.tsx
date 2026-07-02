"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store/provider";
import type { LedgerCategory } from "@/lib/store/types";

const KIND_LABEL: Record<string, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
  BOTH: "Both",
};

export default function CategoriesPage() {
  const { state, createCategory, renameCategory, setCategoryKind, deleteCategory } = useStore();
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState("INCOME");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Count ledger rows per category name, so we can warn before deleting.
  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of state.ledger) if (t.category) map.set(t.category, (map.get(t.category) ?? 0) + 1);
    return map;
  }, [state.ledger]);

  const sorted = [...state.ledgerCategories].sort((a, b) => a.sortOrder - b.sortOrder);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    setBusy(true);
    try {
      await createCategory(name, newKind);
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add category.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(cat: LedgerCategory) {
    setError(null);
    try {
      await deleteCategory(cat.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete category.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        description="The list of purposes you can assign to ledger entries. Rename a category and every entry using it updates automatically."
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Add a category</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Name</span>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="e.g. Eid Fundraiser"
              className="w-64"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Applies to</span>
            <NativeSelect value={newKind} onChange={(e) => setNewKind(e.target.value)} className="w-40">
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
              <option value="BOTH">Both</option>
            </NativeSelect>
          </label>
          <Button onClick={add} disabled={busy || !newName.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-[var(--radius)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Applies to</TableHead>
              <TableHead className="text-right">In use</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((cat) => {
              const count = usage.get(cat.name) ?? 0;
              return (
                <TableRow key={cat.id}>
                  <TableCell>
                    <CategoryName cat={cat} onRename={(name) => renameCategory(cat.id, name)} />
                  </TableCell>
                  <TableCell>
                    <NativeSelect
                      value={cat.kind}
                      onChange={(e) => setCategoryKind(cat.id, e.target.value)}
                      className="h-8 w-32 text-xs"
                      aria-label="Applies to"
                    >
                      <option value="INCOME">Income</option>
                      <option value="EXPENSE">Expense</option>
                      <option value="BOTH">Both</option>
                    </NativeSelect>
                  </TableCell>
                  <TableCell className="text-right text-[var(--color-muted-foreground)]">
                    {count > 0 ? `${count} entr${count === 1 ? "y" : "ies"}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(cat)}
                      title={count > 0 ? `Used by ${count} entries — reassign first` : "Delete"}
                      aria-label={`Delete ${cat.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
        {KIND_LABEL.INCOME} categories appear on money coming in, {KIND_LABEL.EXPENSE} on money going out, and{" "}
        {KIND_LABEL.BOTH.toLowerCase()} on either. A category can only be deleted once no ledger entries use it.
      </p>
    </div>
  );
}

/** Inline-editable category name — saves on blur / Enter, reverts on Escape. */
function CategoryName({ cat, onRename }: { cat: LedgerCategory; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState(cat.name);

  function commit() {
    const name = draft.trim();
    if (!name || name === cat.name) {
      setDraft(cat.name);
      return;
    }
    onRename(name);
  }

  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setDraft(cat.name);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="h-8 w-56 text-sm font-medium"
      aria-label="Category name"
    />
  );
}
