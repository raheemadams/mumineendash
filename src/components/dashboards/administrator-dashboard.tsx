"use client";

import Link from "next/link";
import { Banknote, FileUp, Receipt, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store/provider";
import { pendingApprovals } from "@/lib/store/selectors";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_TONE: Record<string, "secondary" | "warning" | "success"> = {
  PENDING_BANK_DEPOSIT: "secondary",
  DEPOSITED: "warning",
  RECONCILED: "success",
};

export function AdministratorDashboard() {
  const { state, updateMember } = useStore();

  const approvals = pendingApprovals(state);
  const openDeposits = state.deposits.filter((d) => d.status !== "RECONCILED");
  const outstanding = openDeposits.reduce((s, d) => s + d.expectedTotal, 0);
  const dues = state.duesPlans.length;

  const tasks = [
    { label: `Review ${approvals.length} pending membership approval(s)`, done: approvals.length === 0 },
    { label: `Reconcile ${openDeposits.length} open deposit batch(es)`, done: openDeposits.length === 0 },
    { label: "Import this week's bank statements", done: false },
    { label: "Generate receipts for last week's donations", done: false },
  ];

  return (
    <div>
      <PageHeader
        title="Administrator Dashboard"
        description="Today's operational priorities — approvals, deposits, imports and receipts."
        action={
          <Link href="/import">
            <Button>
              <FileUp className="h-4 w-4" /> Import statements
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending Approvals" value={String(approvals.length)} icon={UserCheck} trend={approvals.length ? "Needs review" : "All clear"} />
        <StatCard label="Outstanding Deposits" value={formatCurrency(outstanding)} icon={Banknote} trend={`${openDeposits.length} open batches`} />
        <StatCard label="Dues Plans on File" value={String(dues)} icon={Receipt} trend="Across all members" trendUp />
        <StatCard label="Families" value={String(state.families.length)} icon={UserCheck} trend="In directory" trendUp />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Today's Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {tasks.map((t, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    t.done ? "bg-[var(--color-success)] text-white" : "border border-[var(--color-border)]"
                  }`}
                >
                  {t.done ? "✓" : ""}
                </span>
                <span className={t.done ? "text-[var(--color-muted-foreground)] line-through" : ""}>{t.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Membership Approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {approvals.length === 0 && <p className="text-sm text-[var(--color-muted-foreground)]">Nothing waiting.</p>}
            {approvals.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] p-2.5">
                <div>
                  <div className="text-sm font-medium">{m.fullName}</div>
                  <div className="text-xs text-[var(--color-muted-foreground)]">Applied {formatDate(m.joined)}</div>
                </div>
                <Button size="sm" onClick={() => updateMember(m.id, { status: "ACTIVE" })}>
                  Approve
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deposit Batches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.deposits.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <span>#{d.code}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatCurrency(d.expectedTotal)}</span>
                  <Badge variant={STATUS_TONE[d.status]}>{d.status.replace(/_/g, " ").toLowerCase()}</Badge>
                </div>
              </div>
            ))}
            <Link href="/deposits" className="block pt-1 text-xs font-medium text-[var(--color-primary)] hover:underline">
              View all deposits →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
