"use client";

import { Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStore } from "@/lib/store/provider";
import { expensesByCategory, incomeByCategory, monthlyCashFlow, totals } from "@/lib/store/selectors";
import { formatCurrency } from "@/lib/utils";

const CHART_TOOLTIP_STYLE = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
};
const PIE = ["#0f5c4a", "#a3763f", "#3f8f74", "#c79a5f", "#6bb298", "#dbb87f"];

export default function ReportsPage() {
  const { state } = useStore();
  const income = incomeByCategory(state);
  const expenses = expensesByCategory(state);
  const t = totals(state.ledger);
  const monthly = monthlyCashFlow(state);

  const totalIncome = income.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenses.reduce((s, r) => s + r.amount, 0);

  function exportSummary() {
    const lines = [
      "Income Statement,",
      ...income.map((r) => `${r.category},${r.amount}`),
      `Total Income,${totalIncome}`,
      "",
      "Expenses,",
      ...expenses.map((r) => `${r.category},${r.amount}`),
      `Total Expenses,${totalExpense}`,
      "",
      `Net,${totalIncome - totalExpense}`,
      "",
      "Monthly Cash Flow,",
      "Month,Inflow,Outflow,Net",
      ...monthly.map((m) => `${m.month},${m.inflow},${m.outflow},${m.net}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "income-statement.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Financial statements computed directly from the ledger — they always reconcile."
        action={
          <Button variant="outline" onClick={exportSummary}>
            <Download className="h-4 w-4" /> Export income statement
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Total Income" value={formatCurrency(totalIncome)} tone="success" />
        <Stat label="Total Expenses" value={formatCurrency(totalExpense)} tone="danger" />
        <Stat label="Net Position" value={formatCurrency(totalIncome - totalExpense)} tone="default" />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Monthly cash flow</CardTitle>
        </CardHeader>
        <CardContent>
          {monthly.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">No ledger activity yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={monthly} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="inflow" name="Collected" fill="var(--color-success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outflow" name="Outflow" fill="var(--color-danger)" radius={[4, 4, 0, 0]} />
                <Line dataKey="net" name="Net" stroke="var(--color-brass)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income by category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown rows={income} total={totalIncome} />
            <CategoryTable rows={income} tone="success" total={totalIncome} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses by category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown rows={expenses} total={totalExpense} />
            <CategoryTable rows={expenses} tone="danger" total={totalExpense} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Monthly summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Outflow</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthly.map((m) => (
                <TableRow key={m.month}>
                  <TableCell>{m.month}</TableCell>
                  <TableCell className="text-right font-medium text-[var(--color-success)]">
                    {formatCurrency(m.inflow)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-[var(--color-danger)]">
                    {formatCurrency(m.outflow)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${m.net >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                    {formatCurrency(m.net)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryBreakdown({ rows, total }: { rows: { category: string; amount: number }[]; total: number }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">Nothing recorded yet.</p>;
  }
  const data = rows.map((r) => ({ name: r.category.replace(/_/g, " "), value: r.amount }));
  return (
    <div className="mb-2 flex items-center gap-4">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={38} outerRadius={65} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={PIE[i % PIE.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="min-w-0 flex-1 space-y-1 text-xs">
        {data.slice(0, 5).map((d, i) => (
          <div key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 truncate capitalize">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PIE[i % PIE.length] }} />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="shrink-0 font-medium">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryTable({
  rows,
  tone,
  total,
}: {
  rows: { category: string; amount: number }[];
  tone: "success" | "danger";
  total: number;
}) {
  const color = tone === "success" ? "text-[var(--color-success)]" : "text-[var(--color-danger)]";
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.category}>
            <TableCell className="capitalize">{r.category.replace(/_/g, " ")}</TableCell>
            <TableCell className={`text-right font-medium ${color}`}>{formatCurrency(r.amount)}</TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell className="font-semibold">Total</TableCell>
          <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "success" | "danger" | "default" }) {
  const color =
    tone === "success"
      ? "text-[var(--color-success)]"
      : tone === "danger"
        ? "text-[var(--color-danger)]"
        : "";
  return (
    <Card className="p-4">
      <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
      <div className={`text-xl font-semibold ${color}`}>{value}</div>
    </Card>
  );
}
