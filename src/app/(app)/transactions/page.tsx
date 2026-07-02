"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store/provider";
import { totals } from "@/lib/store/selectors";
import type { LedgerCategory, Txn } from "@/lib/store/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const UNCATEGORIZED = "__none__";

/** Managed categories offered for a ledger row's direction. */
function optionsForDirection(cats: LedgerCategory[], direction: string): LedgerCategory[] {
  return cats.filter((c) => {
    if (!c.isActive) return false;
    if (c.kind === "BOTH") return true;
    if (direction === "INFLOW") return c.kind === "INCOME";
    if (direction === "OUTFLOW") return c.kind === "EXPENSE";
    return true;
  });
}

export default function TransactionsPage() {
  const { state, setTransactionCategory, setTransactionDescription } = useStore();
  const [account, setAccount] = useState("all");
  const [dir, setDir] = useState("all");
  const [category, setCategory] = useState("all");

  const accountName = (id: string) => state.accounts.find((a) => a.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    return state.ledger
      .filter((t) => (account === "all" ? true : t.accountId === account))
      .filter((t) => (dir === "all" ? true : t.direction === dir))
      .filter((t) =>
        category === "all"
          ? true
          : category === UNCATEGORIZED
            ? !t.category
            : t.category === category,
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.ledger, account, dir, category]);

  const t = totals(filtered);
  const uncategorizedCount = state.ledger.filter((r) => !r.category).length;

  function exportCsv() {
    const head = ["Date", "Description", "Account", "Direction", "Amount", "Purpose", "Reference", "Source", "Reconciliation"];
    const lines = filtered.map((r) =>
      [r.date, r.description ?? "", accountName(r.accountId), r.direction, r.amount, r.category ?? "", r.referenceNumber ?? "", r.source, r.reconStatus]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Ledger"
        description="The standardized internal transactions table — the single source of truth for all reporting. Click a description to edit it, and set each row's purpose."
        action={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-[var(--color-muted-foreground)]">Total Inflow</div>
          <div className="text-xl font-semibold text-[var(--color-success)]">{formatCurrency(t.inflow)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[var(--color-muted-foreground)]">Total Outflow</div>
          <div className="text-xl font-semibold text-[var(--color-danger)]">{formatCurrency(t.outflow)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-[var(--color-muted-foreground)]">Net</div>
          <div className="text-xl font-semibold">{formatCurrency(t.net)}</div>
        </Card>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <NativeSelect value={account} onChange={(e) => setAccount(e.target.value)} className="max-w-xs">
          <option value="all">All accounts</option>
          {state.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={dir} onChange={(e) => setDir(e.target.value)} className="max-w-[180px]">
          <option value="all">All directions</option>
          <option value="INFLOW">Inflow</option>
          <option value="OUTFLOW">Outflow</option>
        </NativeSelect>
        <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} className="max-w-[220px]">
          <option value="all">All purposes</option>
          <option value={UNCATEGORIZED}>Uncategorized{uncategorizedCount ? ` (${uncategorizedCount})` : ""}</option>
          {state.ledgerCategories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead className="text-right">Deposit</TableHead>
              <TableHead className="text-right">Withdrawal</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((tx) => (
              <TableRow key={tx.id} id={`txn-${tx.id}`}>
                <TableCell className="whitespace-nowrap">{formatDate(tx.date)}</TableCell>
                <TableCell className="min-w-[240px]">
                  <EditableDescription
                    key={tx.id + (tx.description ?? "")}
                    txn={tx}
                    onSave={(v) => setTransactionDescription(tx.id, v)}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{accountName(tx.accountId)}</Badge>
                </TableCell>
                <TableCell>
                  <NativeSelect
                    value={tx.category ?? ""}
                    onChange={(e) => setTransactionCategory(tx.id, e.target.value || null)}
                    className={`h-8 min-w-[160px] text-xs ${tx.category ? "" : "text-[var(--color-muted-foreground)]"}`}
                    aria-label="Purpose"
                  >
                    <option value="">— Set purpose —</option>
                    {optionsForDirection(state.ledgerCategories, tx.direction).map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </TableCell>
                <TableCell className="text-right text-[var(--color-success)]">
                  {tx.direction === "INFLOW" ? formatCurrency(tx.amount) : "—"}
                </TableCell>
                <TableCell className="text-right text-[var(--color-danger)]">
                  {tx.direction === "OUTFLOW" ? formatCurrency(tx.amount) : "—"}
                </TableCell>
                <TableCell>
                  {tx.reconStatus === "RECONCILED" ? (
                    <Badge variant="success">reconciled</Badge>
                  ) : (
                    <span className="text-xs text-[var(--color-muted-foreground)]">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/**
 * Click-to-edit description. Shows plain text until clicked, then an input that
 * saves on blur or Enter and cancels on Escape. Keyed on the current value so a
 * refresh resets the local draft cleanly.
 */
function EditableDescription({ txn, onSave }: { txn: Txn; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(txn.description ?? "");

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(txn.description ?? "");
          setEditing(true);
        }}
        className="block max-w-[260px] truncate text-left font-medium hover:underline"
        title="Click to edit"
      >
        {txn.description || <span className="text-[var(--color-muted-foreground)]">(no description)</span>}
      </button>
    );
  }

  function commit() {
    setEditing(false);
    if (draft !== (txn.description ?? "")) onSave(draft);
  }

  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          setDraft(txn.description ?? "");
          setEditing(false);
        }
      }}
      className="h-8 min-w-[240px] text-sm"
    />
  );
}
