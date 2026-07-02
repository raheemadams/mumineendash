// Pure derivations over store state. Everything reporting-related is computed
// from the ledger — never from raw statements — so the numbers always reconcile.

import type { AppState, Txn } from "./types";
import { evaluateDues, type DuesEvaluation } from "@/lib/engine/dues";

/**
 * Format a "YYYY-MM" bucket key as a short month label ("Jan 26").
 *
 * Must build the Date with the LOCAL constructor `new Date(year, monthIndex, 1)`,
 * not `new Date("2026-01-01")`. The string form is parsed as UTC midnight, and
 * `toLocaleDateString` then renders it in the local zone — in any timezone west
 * of UTC that rolls back to the previous day, mislabeling every month (e.g.
 * January 2026 shows as "Dec 25"). The numeric constructor is timezone-safe.
 */
function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

export function accountBalance(state: AppState, accountId: string): number {
  const acct = state.accounts.find((a) => a.id === accountId);
  const base = acct?.openingBalance ?? 0;
  const delta = state.ledger
    .filter((t) => t.accountId === accountId)
    .reduce((s, t) => s + (t.direction === "INFLOW" ? t.amount : t.direction === "OUTFLOW" ? -t.amount : 0), 0);
  return base + delta;
}

export function totalBalance(state: AppState): number {
  return state.accounts.reduce((s, a) => s + accountBalance(state, a.id), 0);
}

export function totals(ledger: Txn[]) {
  const inflow = ledger.filter((t) => t.direction === "INFLOW").reduce((s, t) => s + t.amount, 0);
  const outflow = ledger.filter((t) => t.direction === "OUTFLOW").reduce((s, t) => s + t.amount, 0);
  return { inflow, outflow, net: inflow - outflow };
}

export function donationsByCategory(state: AppState): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const d of state.donations) {
    const cat = state.categories.find((c) => c.id === d.categoryId);
    const name = cat?.name ?? "Other";
    map.set(name, (map.get(name) ?? 0) + d.amount);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function monthlyGiving(state: AppState): { month: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of state.ledger) {
    if (t.direction !== "INFLOW") continue;
    const key = t.date.slice(0, 7); // YYYY-MM
    map.set(key, (map.get(key) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, amount]) => ({
      month: monthLabel(key),
      amount,
    }));
}

/** Monthly inflow vs outflow — the backbone of the reports cash-flow chart. */
export function monthlyCashFlow(state: AppState): { month: string; inflow: number; outflow: number; net: number }[] {
  const map = new Map<string, { inflow: number; outflow: number }>();
  for (const t of state.ledger) {
    if (t.direction === "TRANSFER") continue;
    const key = t.date.slice(0, 7); // YYYY-MM
    const row = map.get(key) ?? { inflow: 0, outflow: 0 };
    if (t.direction === "INFLOW") row.inflow += t.amount;
    else row.outflow += t.amount;
    map.set(key, row);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, row]) => ({
      month: monthLabel(key),
      inflow: row.inflow,
      outflow: row.outflow,
      net: row.inflow - row.outflow,
    }));
}

export function campaignProgress(state: AppState, campaignId: string): number {
  return state.donations.filter((d) => d.campaignId === campaignId).reduce((s, d) => s + d.amount, 0);
}

export interface MemberDues {
  memberId: string;
  fullName: string;
  evaluation: DuesEvaluation;
  amount: number;
  frequency: string;
  planId: string;
}

export function membersDues(state: AppState, today = new Date()): MemberDues[] {
  return state.duesPlans.map((plan) => {
    const member = state.members.find((m) => m.id === plan.memberId);
    const payments = state.duesPayments
      .filter((p) => p.planId === plan.id)
      .map((p) => ({ periodStart: new Date(p.periodStart), amount: p.amount }));
    return {
      memberId: plan.memberId,
      planId: plan.id,
      fullName: member?.fullName ?? plan.memberId,
      amount: plan.amount,
      frequency: plan.frequency,
      evaluation: evaluateDues(
        {
          frequency: plan.frequency,
          amount: plan.amount,
          startDate: new Date(plan.startDate),
          graceDays: plan.graceDays,
          active: plan.active,
        },
        payments,
        today,
      ),
    };
  });
}

/** Income grouped by ledger category — the backbone of the income statement. */
export function incomeByCategory(state: AppState): { category: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of state.ledger) {
    if (t.direction !== "INFLOW") continue;
    const key = t.category ?? "uncategorized";
    map.set(key, (map.get(key) ?? 0) + t.amount);
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export function expensesByCategory(state: AppState): { category: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const t of state.ledger) {
    if (t.direction !== "OUTFLOW") continue;
    const key = t.category ?? "uncategorized";
    map.set(key, (map.get(key) ?? 0) + t.amount);
  }
  return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

// ── Members & families ─────────────────────────────────────────────────

export function familyMembers(state: AppState, familyId: string | null) {
  if (!familyId) return [];
  return state.members.filter((m) => m.familyId === familyId);
}

export function memberDonations(state: AppState, memberId: string) {
  return state.donations
    .filter((d) => d.memberId === memberId)
    .sort((a, b) => b.donatedOn.localeCompare(a.donatedOn));
}

export function memberDuesEvaluation(state: AppState, memberId: string, today = new Date()) {
  return membersDues(state, today).filter((r) => r.memberId === memberId);
}

export function pendingApprovals(state: AppState) {
  return state.members.filter((m) => m.status === "PENDING");
}

export function membershipStatusBreakdown(state: AppState): { status: string; count: number }[] {
  const map = new Map<string, number>();
  for (const m of state.members) map.set(m.status, (map.get(m.status) ?? 0) + 1);
  return [...map.entries()].map(([status, count]) => ({ status, count }));
}

export function activeFamilyCount(state: AppState): number {
  return new Set(state.members.filter((m) => m.status === "ACTIVE" && m.familyId).map((m) => m.familyId)).size;
}

export function newMembersThisMonth(state: AppState, today = new Date()): number {
  const key = today.toISOString().slice(0, 7);
  return state.members.filter((m) => m.joined.slice(0, 7) === key).length;
}

/** Cumulative member count by month-joined, for a membership growth chart. */
export function membershipGrowth(state: AppState): { month: string; total: number }[] {
  const byMonth = new Map<string, number>();
  for (const m of state.members) {
    const key = m.joined.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const months = [...byMonth.keys()].sort();
  let running = 0;
  return months.map((key) => {
    running += byMonth.get(key) ?? 0;
    return {
      month: monthLabel(key),
      total: running,
    };
  });
}

export function upcomingEvents(state: AppState, today = new Date()) {
  return state.events
    .filter((e) => new Date(e.startsOn).getTime() >= today.getTime())
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
}

/** Resolve a human label for a donation attribution (family/event/campaign name). */
export function attributionLabel(state: AppState, type: string, targetId: string): string {
  if (type === "FAMILY") return state.families.find((f) => f.id === targetId)?.familyName ?? targetId;
  if (type === "EVENT") return state.events.find((e) => e.id === targetId)?.name ?? targetId;
  if (type === "CAMPAIGN") return state.campaigns.find((c) => c.id === targetId)?.name ?? targetId;
  if (type === "MEMBER") return state.members.find((m) => m.id === targetId)?.fullName ?? targetId;
  return targetId;
}

// ── Notifications (derived live from state, never persisted) ─────────────

export interface NotificationItem {
  id: string;
  type:
    | "MEMBERSHIP_EXPIRED"
    | "DEPOSIT_AWAITING_RECONCILIATION"
    | "LARGE_DONATION"
    | "OUTSTANDING_BALANCE"
    | "UPCOMING_RENEWAL";
  title: string;
  body: string;
  at: string;
}

const LARGE_DONATION_THRESHOLD = 1000;

export function notifications(state: AppState, today = new Date()): NotificationItem[] {
  const items: NotificationItem[] = [];

  for (const d of state.deposits) {
    if (d.status === "DEPOSITED") {
      items.push({
        id: `deposit_${d.id}`,
        type: "DEPOSIT_AWAITING_RECONCILIATION",
        title: `Deposit #${d.code} awaiting reconciliation`,
        body: `$${d.expectedTotal.toFixed(2)} deposited, not yet matched to a bank line.`,
        at: d.depositedOn ?? today.toISOString(),
      });
    } else if (d.status === "PENDING_BANK_DEPOSIT") {
      items.push({
        id: `deposit_pending_${d.id}`,
        type: "DEPOSIT_AWAITING_RECONCILIATION",
        title: `Deposit #${d.code} not yet taken to the bank`,
        body: `$${d.expectedTotal.toFixed(2)} collected and waiting to be deposited.`,
        at: today.toISOString(),
      });
    }
  }

  for (const r of membersDues(state, today)) {
    if (r.evaluation.status === "PAST_DUE") {
      items.push({
        id: `dues_${r.planId}`,
        type: "OUTSTANDING_BALANCE",
        title: `${r.fullName} is past due on dues`,
        body: `$${r.evaluation.balanceDue.toFixed(2)} outstanding.`,
        at: today.toISOString(),
      });
    }
  }

  for (const d of state.donations) {
    if (d.amount >= LARGE_DONATION_THRESHOLD) {
      const cat = state.categories.find((c) => c.id === d.categoryId);
      items.push({
        id: `donation_${d.id}`,
        type: "LARGE_DONATION",
        title: `Large donation received — $${d.amount.toFixed(2)}`,
        body: `${cat?.name ?? "Donation"}${d.isAnonymous ? " (anonymous)" : ""}`,
        at: d.donatedOn,
      });
    }
  }

  for (const m of pendingApprovals(state)) {
    items.push({
      id: `member_pending_${m.id}`,
      type: "MEMBERSHIP_EXPIRED",
      title: `${m.fullName} is awaiting membership approval`,
      body: `Applied ${m.joined}.`,
      at: m.joined,
    });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at));
}
