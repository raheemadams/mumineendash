"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Banknote, TrendingUp, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store/provider";
import {
  accountBalance,
  donationsByCategory,
  membersDues,
  monthlyGiving,
  totalBalance,
} from "@/lib/store/selectors";
import { formatCurrency } from "@/lib/utils";

const PIE = ["#0d9488", "#14b8a6", "#2dd4bf", "#5eead4", "#99f6e4", "#ccfbf1"];

export function TreasurerDashboard() {
  const { state } = useStore();

  const balance = totalBalance(state);
  const giving = monthlyGiving(state);
  const thisMonth = giving.at(-1)?.amount ?? 0;
  const categories = donationsByCategory(state);
  const activeMembers = state.members.filter((m) => m.status === "ACTIVE").length;

  const dues = membersDues(state);
  const pastDue = dues.filter((d) => d.evaluation.status === "PAST_DUE").length;
  const openDeposits = state.deposits.filter((d) => d.status !== "RECONCILED").length;
  const outstanding = state.deposits
    .filter((d) => d.status !== "RECONCILED")
    .reduce((s, d) => s + d.expectedTotal, 0);

  const accountBars = state.accounts.map((a) => ({
    institution: a.institution,
    balance: accountBalance(state, a.id),
  }));

  return (
    <div>
      <PageHeader
        title="Treasurer Dashboard"
        description="Financial health at a glance — every figure is computed live from the ledger."
        action={<Badge variant="secondary">June 2026</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Balance" value={formatCurrency(balance)} icon={Wallet} trend="Across all accounts" trendUp />
        <StatCard label="This Month's Giving" value={formatCurrency(thisMonth)} icon={TrendingUp} trend={`${giving.length} months tracked`} trendUp />
        <StatCard label="Active Members" value={String(activeMembers)} icon={Users} trend={`${state.members.length} total in directory`} trendUp />
        <StatCard label="Outstanding Deposits" value={formatCurrency(outstanding)} icon={Banknote} trend={`${openDeposits} awaiting reconciliation`} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Collection Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={giving} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Area type="monotone" dataKey="amount" stroke="#0d9488" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--color-muted-foreground)]">No donations recorded yet.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={categories} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                      {categories.map((_, i) => (
                        <Cell key={i} fill={PIE[i % PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5">
                  {categories.slice(0, 6).map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE[i % PIE.length] }} />
                        {c.name}
                      </span>
                      <span className="font-medium">{formatCurrency(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Account Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={accountBars} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="institution" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Bar dataKey="balance" fill="#0d9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs Attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Deposits awaiting reconciliation" value={String(openDeposits)} tone={openDeposits ? "warning" : "success"} />
            <Row label="Members past due on dues" value={String(pastDue)} tone={pastDue ? "danger" : "success"} />
            <Row label="Donations recorded" value={String(state.donations.length)} tone="success" />
            <Row label="Ledger entries" value={String(state.ledger.length)} tone="success" />
            <Row label="Audit events" value={String(state.audit.length)} tone="success" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "danger" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <Badge variant={tone}>{value}</Badge>
    </div>
  );
}
