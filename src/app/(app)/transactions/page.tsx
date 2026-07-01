"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store/provider";
import { totals } from "@/lib/store/selectors";
import { formatCurrency, formatDate } from "@/lib/utils";

const SOURCE_TONE: Record<string, "secondary" | "success" | "warning"> = {
  IMPORT: "secondary",
  DONATION: "success",
  DUES: "success",
  DEPOSIT: "warning",
  MANUAL: "secondary",
};

export default function TransactionsPage() {
  const { state } = useStore();
  const [account, setAccount] = useState("all");
  const [dir, setDir] = useState("all");

  const accountName = (id: string) => state.accounts.find((a) => a.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    return state.ledger
      .filter((t) => (account === "all" ? true : t.accountId === account))
      .filter((t) => (dir === "all" ? true : t.direction === dir))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.ledger, account, dir]);

  const t = totals(filtered);

  function exportCsv() {
    const head = ["Date", "Description", "Account", "Direction", "Amount", "Reference", "Source", "Reconciliation"];
    const lines = filtered.map((r) =>
      [r.date, r.description ?? "", accountName(r.accountId), r.direction, r.amount, r.referenceNumber ?? "", r.source, r.reconStatus]
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
        description="The standardized internal transactions table — the single source of truth for all reporting."
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

      <div className="mb-3 flex flex-wrap gap-3">
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
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Deposit</TableHead>
              <TableHead className="text-right">Withdrawal</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((tx) => (
              <TableRow key={tx.id} id={`txn-${tx.id}`}>
                <TableCell className="whitespace-nowrap">{formatDate(tx.date)}</TableCell>
                <TableCell className="max-w-[260px] truncate font-medium">{tx.description}</TableCell>
                <TableCell>
                  <Badge variant="outline">{accountName(tx.accountId)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={SOURCE_TONE[tx.source] ?? "secondary"}>{tx.source.toLowerCase()}</Badge>
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
