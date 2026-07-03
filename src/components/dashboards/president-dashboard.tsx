"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, HeartHandshake, Home, Megaphone, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store/provider";
import {
  activeFamilyCount,
  donationsByCategory,
  membershipGrowth,
  membershipStatusBreakdown,
  monthlyGiving,
  newMembersThisMonth,
  upcomingEvents,
} from "@/lib/store/selectors";
import { formatCurrency, formatDate } from "@/lib/utils";

const PIE = ["#0d9488", "#14b8a6", "#2dd4bf", "#5eead4", "#99f6e4", "#ccfbf1"];
// Membership-status slice colors — Inactive stands out in red as "needs attention".
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "#0f5c4a", // jade
  INACTIVE: "#c0392b", // red
  PENDING: "#a3763f", // brass
  SUSPENDED: "#7f2d20", // dark red
  DECEASED: "#6b7c76", // muted
  MOVED_AWAY: "#9aa8a2",
};
const statusColor = (status: string, i: number) => STATUS_COLOR[status] ?? PIE[i % PIE.length];

const STATUS_TONE: Record<string, "success" | "secondary" | "warning" | "danger"> = {
  ACTIVE: "success",
  PENDING: "warning",
  INACTIVE: "danger",
  SUSPENDED: "danger",
};

const ANNOUNCEMENTS = [
  "Jumu'ah khutbah this Friday will focus on community giving — all are welcome.",
  "Membership renewal season opens next month; the Administrator dashboard tracks upcoming renewals.",
  "The Building Fund appeal has crossed its first major milestone — see Donations for progress.",
];

export function PresidentDashboard() {
  const { state } = useStore();

  const activeMembers = state.members.filter((m) => m.status === "ACTIVE").length;
  const newThisMonth = newMembersThisMonth(state);
  const families = activeFamilyCount(state);
  const giving = monthlyGiving(state);
  const thisMonth = giving.at(-1)?.amount ?? 0;
  const categories = donationsByCategory(state);
  const growth = membershipGrowth(state);
  const statusBreakdown = membershipStatusBreakdown(state);
  const events = upcomingEvents(state).slice(0, 4);

  return (
    <div>
      <PageHeader
        title="President Dashboard"
        description="Community health at a glance — no banking detail, just the numbers that matter for leadership."
        action={<Badge variant="secondary">June 2026</Badge>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Members" value={String(state.members.length)} icon={Users} trend={`${activeMembers} active`} trendUp />
        <StatCard label="New Members" value={String(newThisMonth)} icon={TrendingUp} trend="This month" trendUp />
        <StatCard label="Active Families" value={String(families)} icon={Home} trend="Households engaged" trendUp />
        <StatCard label="Monthly Giving" value={formatCurrency(thisMonth)} icon={HeartHandshake} trend={`${giving.length} months tracked`} trendUp />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Membership Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={growth} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="total" stroke="#0d9488" strokeWidth={2} fill="url(#pg)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Membership Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusBreakdown} dataKey="count" nameKey="status" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {statusBreakdown.map((s, i) => (
                    <Cell key={i} fill={statusColor(s.status, i)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1.5">
              {statusBreakdown.map((s, i) => (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: statusColor(s.status, i) }}
                    />
                    <Badge variant={STATUS_TONE[s.status] ?? "secondary"}>{s.status.toLowerCase()}</Badge>
                  </span>
                  <span className="font-medium">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top Donation Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {categories.length === 0 && <p className="text-sm text-[var(--color-muted-foreground)]">No data yet.</p>}
            {categories.slice(0, 6).map((c) => (
              <div key={c.name} className="flex items-center justify-between text-sm">
                <span>{c.name}</span>
                <span className="font-medium">{formatCurrency(c.value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.length === 0 && <p className="text-sm text-[var(--color-muted-foreground)]">Nothing scheduled.</p>}
            {events.map((e) => (
              <div key={e.id} className="text-sm">
                <div className="font-medium">{e.name}</div>
                <div className="text-xs text-[var(--color-muted-foreground)]">
                  {formatDate(e.startsOn)} · {e.location}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" /> Quick Announcements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {ANNOUNCEMENTS.map((a, i) => (
              <p key={i} className="text-sm text-[var(--color-muted-foreground)]">
                {a}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
