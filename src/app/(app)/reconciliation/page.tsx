"use client";

import { useMemo } from "react";
import { ArrowRight, BookOpenCheck, Link2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store/provider";
import { findDepositMatches, type LedgerTxn } from "@/lib/engine";
import type { Deposit } from "@/lib/store/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function ReconciliationPage() {
  const { state, reconcileDeposit } = useStore();
  const accountName = (id: string) => state.accounts.find((a) => a.id === id)?.name ?? id;

  // Bank lines available to match: inflows not already reconciled.
  const ledger: LedgerTxn[] = useMemo(
    () =>
      state.ledger
        .filter((t) => t.reconStatus !== "RECONCILED")
        .map((t) => ({
          id: t.id,
          accountId: t.accountId,
          date: new Date(t.date),
          amount: t.amount,
          direction: t.direction,
          description: t.description,
          referenceNumber: t.referenceNumber,
          dedupeHash: t.dedupeHash,
        })),
    [state.ledger],
  );

  const open = state.deposits.filter((d) => d.status !== "RECONCILED");
  const reconciledCount = state.deposits.filter((d) => d.status === "RECONCILED").length;

  return (
    <div>
      <PageHeader
        title="Reconciliation"
        description="Match cash deposit batches to imported bank lines so every dollar is counted exactly once."
      />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Open deposits" value={open.length} />
        <Stat label="Reconciled" value={reconciledCount} />
        <Stat label="Unreconciled bank lines" value={ledger.length} />
        <Stat label="Total deposits" value={state.deposits.length} />
      </div>

      <div className="space-y-4">
        {open.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-[var(--color-muted-foreground)]">
              <BookOpenCheck className="mx-auto mb-2 h-6 w-6 text-[var(--color-success)]" />
              Everything is reconciled. Nice work.
            </CardContent>
          </Card>
        )}

        {open.map((d) => (
          <DepositMatcher
            key={d.id}
            deposit={d}
            ledger={ledger}
            accountName={accountName}
            onReconcile={(txnId) => reconcileDeposit(d.id, txnId)}
          />
        ))}
      </div>
    </div>
  );
}

function DepositMatcher({
  deposit,
  ledger,
  accountName,
  onReconcile,
}: {
  deposit: Deposit;
  ledger: LedgerTxn[];
  accountName: (id: string) => string;
  onReconcile: (txnId: string) => void;
}) {
  const matches = useMemo(
    () =>
      findDepositMatches(
        {
          id: deposit.id,
          accountId: deposit.accountId,
          expectedTotal: deposit.expectedTotal,
          depositedOn: deposit.depositedOn ? new Date(deposit.depositedOn) : null,
        },
        ledger,
      ),
    [deposit, ledger],
  );
  const top = matches[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Deposit #{deposit.code}
          <Badge variant={deposit.status === "DEPOSITED" ? "warning" : "secondary"}>
            {deposit.status.replace(/_/g, " ").toLowerCase()}
          </Badge>
          <span className="ml-auto text-base font-semibold">{formatCurrency(deposit.expectedTotal)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-3">
            <div className="mb-2 text-xs font-medium uppercase text-[var(--color-muted-foreground)]">
              Cash batch · {accountName(deposit.accountId)}
            </div>
            <div className="space-y-1.5 text-sm">
              {deposit.items.map((it, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-[var(--color-muted-foreground)]">
                    {it.method} — {it.description || "—"}
                  </span>
                  <span className="font-medium">{formatCurrency(it.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          <ArrowRight className="mx-auto hidden h-5 w-5 text-[var(--color-muted-foreground)] md:block" />

          <div className="rounded-[var(--radius)] border border-[var(--color-border)] p-3">
            <div className="mb-2 text-xs font-medium uppercase text-[var(--color-muted-foreground)]">
              Suggested bank line
            </div>
            {top ? (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{top.transaction.description}</span>
                  <span className="font-semibold">{formatCurrency(top.transaction.amount)}</span>
                </div>
                <div className="text-xs text-[var(--color-muted-foreground)]">
                  {formatDate(top.transaction.date)} · {accountName(top.transaction.accountId)}
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  <Badge variant={top.score >= 0.9 ? "success" : "warning"}>
                    {Math.round(top.score * 100)}% match
                  </Badge>
                  {top.reasons.map((r, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-[var(--color-muted-foreground)]">
                No matching bank line yet — import the statement covering this date.
              </div>
            )}
          </div>
        </div>

        {top && (
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost">Not a match</Button>
            <Button onClick={() => onReconcile(top.transaction.id)}>
              <Link2 className="h-4 w-4" /> Reconcile — link, don&apos;t double-count
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
    </Card>
  );
}
