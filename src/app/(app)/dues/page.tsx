"use client";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store/provider";
import { membersDues } from "@/lib/store/selectors";
import { DEFAULT_MEMBERSHIP_DUES } from "@/lib/config";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { DuesStatus } from "@/lib/engine/dues";

const TONE: Record<DuesStatus, "success" | "warning" | "danger" | "secondary"> = {
  PAID: "success",
  UPCOMING: "secondary",
  GRACE_PERIOD: "warning",
  PAST_DUE: "danger",
  SUSPENDED: "secondary",
};

export default function DuesPage() {
  const { state, recordDuesPayment } = useStore();
  const today = new Date();
  const rows = membersDues(state, today);

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.evaluation.status] = (acc[r.evaluation.status] ?? 0) + 1;
    return acc;
  }, {});
  const totalDue = rows.reduce((s, r) => s + r.evaluation.balanceDue, 0);

  return (
    <div>
      <PageHeader
        title="Membership Dues"
        description={`Standard membership is ${formatCurrency(DEFAULT_MEMBERSHIP_DUES.amount)} per month. Status is computed live from each plan's cadence, payments and grace window.`}
        action={
          <Badge variant="secondary" className="text-sm">
            {formatCurrency(DEFAULT_MEMBERSHIP_DUES.amount)} / month standard
          </Badge>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Mini label="Paid" value={counts.PAID ?? 0} tone="success" />
        <Mini label="In grace" value={counts.GRACE_PERIOD ?? 0} tone="warning" />
        <Mini label="Past due" value={counts.PAST_DUE ?? 0} tone="danger" />
        <Mini label="Outstanding" value={formatCurrency(totalDue)} tone="danger" isMoney />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Balance due</TableHead>
                <TableHead>Next period</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                // The earliest unpaid period is the one to collect next.
                const owed = r.evaluation.periods.find(
                  (p) => p.status === "PAST_DUE" || p.status === "GRACE_PERIOD",
                );
                return (
                  <TableRow key={r.planId}>
                    <TableCell className="font-medium">{r.fullName}</TableCell>
                    <TableCell className="text-[var(--color-muted-foreground)]">
                      {formatCurrency(r.amount)} · {r.frequency.toLowerCase()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TONE[r.evaluation.status]}>
                        {r.evaluation.status.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {r.evaluation.balanceDue > 0 ? formatCurrency(r.evaluation.balanceDue) : "—"}
                    </TableCell>
                    <TableCell className="text-[var(--color-muted-foreground)]">
                      {owed
                        ? `${formatDate(owed.start)} (unpaid)`
                        : r.evaluation.nextDueDate
                          ? formatDate(r.evaluation.nextDueDate)
                          : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {owed ? (
                        <Button
                          size="sm"
                          onClick={() => recordDuesPayment(r.planId, owed.start.toISOString().slice(0, 10))}
                        >
                          Record payment
                        </Button>
                      ) : (
                        <span className="text-xs text-[var(--color-muted-foreground)]">up to date</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length === 0 && (
            <p className="p-8 text-center text-sm text-[var(--color-muted-foreground)]">
              No dues plans yet. Standard membership is {formatCurrency(DEFAULT_MEMBERSHIP_DUES.amount)} per
              month — enroll members to start tracking their dues here.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
  isMoney,
}: {
  label: string;
  value: number | string;
  tone: "success" | "warning" | "danger";
  isMoney?: boolean;
}) {
  const color =
    tone === "success"
      ? "text-[var(--color-success)]"
      : tone === "warning"
        ? "text-[var(--color-warning)]"
        : "text-[var(--color-danger)]";
  return (
    <Card className="p-4">
      <div className={`text-2xl font-semibold ${color}`}>{isMoney ? value : value}</div>
      <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
    </Card>
  );
}
