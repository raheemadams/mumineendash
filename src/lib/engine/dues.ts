// Dues engine — pure logic that turns a dues plan + its payments into a
// current status, a per-period schedule and an outstanding balance. No DB, no
// React: just dates and numbers, so it is fully unit-testable.

export type DuesFrequency = "MONTHLY" | "QUARTERLY" | "YEARLY" | "CUSTOM";
export type DuesStatus = "PAID" | "UPCOMING" | "PAST_DUE" | "GRACE_PERIOD" | "SUSPENDED";

export interface DuesPlanInput {
  frequency: DuesFrequency;
  amount: number;
  startDate: Date;
  graceDays: number;
  active: boolean;
}

export interface DuesPaymentInput {
  /** the period this payment covers, identified by its start date */
  periodStart: Date;
  amount: number;
}

export interface PeriodStatus {
  start: Date;
  end: Date;
  due: number;
  paid: number;
  status: DuesStatus;
}

export interface DuesEvaluation {
  status: DuesStatus;
  periods: PeriodStatus[];
  balanceDue: number;
  nextDueDate: Date | null;
}

const MONTHS_PER: Record<DuesFrequency, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  YEARLY: 12,
  CUSTOM: 1,
};

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function sameOrBefore(a: Date, b: Date): boolean {
  return a.getTime() <= b.getTime();
}

/**
 * Evaluate a dues plan as of `today`. Generates every period from the plan's
 * start through the current period, marks each paid/unpaid, and rolls those up
 * into a single plan status (worst-case wins: a past-due period dominates).
 */
export function evaluateDues(
  plan: DuesPlanInput,
  payments: DuesPaymentInput[],
  today: Date = new Date(),
): DuesEvaluation {
  if (!plan.active) {
    return { status: "SUSPENDED", periods: [], balanceDue: 0, nextDueDate: null };
  }

  const step = MONTHS_PER[plan.frequency];
  const periods: PeriodStatus[] = [];

  // Sum payments per period-start key (so two partial payments add up).
  const paidByPeriod = new Map<string, number>();
  for (const p of payments) {
    const key = p.periodStart.toISOString().slice(0, 10);
    paidByPeriod.set(key, (paidByPeriod.get(key) ?? 0) + p.amount);
  }

  let cursor = new Date(plan.startDate);
  let guard = 0;
  let nextDueDate: Date | null = null;

  // Walk forward until we pass `today`, then include one upcoming period.
  while (guard++ < 600) {
    const start = new Date(cursor);
    const end = addDays(addMonths(start, step), -1);
    const key = start.toISOString().slice(0, 10);
    const paid = paidByPeriod.get(key) ?? 0;
    const fullyPaid = paid + 0.005 >= plan.amount;

    let status: DuesStatus;
    if (fullyPaid) {
      status = "PAID";
    } else if (start.getTime() > today.getTime()) {
      status = "UPCOMING";
      if (!nextDueDate) nextDueDate = start;
    } else if (sameOrBefore(today, addDays(start, plan.graceDays))) {
      status = "GRACE_PERIOD";
    } else {
      status = "PAST_DUE";
    }

    periods.push({ start, end, due: plan.amount, paid, status });

    // Stop once we've generated the first period that starts after today.
    if (start.getTime() > today.getTime()) break;
    cursor = addMonths(cursor, step);
  }

  const balanceDue = periods
    .filter((p) => p.status === "PAST_DUE" || p.status === "GRACE_PERIOD")
    .reduce((s, p) => s + Math.max(0, p.due - p.paid), 0);

  // Roll up: past-due dominates, then grace, then upcoming, else paid.
  let status: DuesStatus = "PAID";
  if (periods.some((p) => p.status === "PAST_DUE")) status = "PAST_DUE";
  else if (periods.some((p) => p.status === "GRACE_PERIOD")) status = "GRACE_PERIOD";
  else if (periods.every((p) => p.status === "UPCOMING" || p.status === "PAID")) {
    status = periods.some((p) => p.status === "PAID") ? "PAID" : "UPCOMING";
  }

  return { status, periods, balanceDue, nextDueDate };
}
