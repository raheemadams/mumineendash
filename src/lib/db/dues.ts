import { prisma } from "@/lib/prisma";
import { num, isoDate } from "./mappers";
import { createLedgerEntry } from "./transactions";
import { addMonths } from "@/lib/engine/dues";
import type { DuesPayment, DuesPlan } from "@/lib/store/types";
import type { Prisma } from "@prisma/client";

function toDuesPlan(row: Prisma.DuesPlanGetPayload<object>): DuesPlan {
  return {
    id: row.id,
    memberId: row.memberId ?? "",
    frequency: row.frequency,
    amount: num(row.amount),
    startDate: isoDate(row.startDate),
    graceDays: row.graceDays,
    active: row.isActive,
  };
}

type PaymentWithTxn = Prisma.DuesPaymentGetPayload<{ include: { transaction: true } }>;

function toDuesPayment(row: PaymentWithTxn): DuesPayment {
  return {
    id: row.id,
    planId: row.duesPlanId,
    memberId: row.memberId ?? "",
    periodStart: isoDate(row.periodStart),
    periodEnd: isoDate(row.periodEnd),
    amount: num(row.amount),
    paidOn: isoDate(row.paidOn),
    // DuesPayment has no method column of its own — the linked ledger
    // transaction is the source of truth for how the money moved.
    method: (row.transaction?.paymentMethod as DuesPayment["method"]) ?? "CASH",
    transactionId: row.transactionId,
  };
}

export async function listDuesPlans(): Promise<DuesPlan[]> {
  const rows = await prisma.duesPlan.findMany({ orderBy: { startDate: "asc" } });
  return rows.map(toDuesPlan);
}

export async function listDuesPayments(): Promise<DuesPayment[]> {
  const rows = await prisma.duesPayment.findMany({
    include: { transaction: true },
    orderBy: { periodStart: "desc" },
  });
  return rows.map(toDuesPayment);
}

/** Records a dues payment for a plan's period and posts the matching ledger entry. */
export async function recordDuesPaymentRecord(
  planId: string,
  periodStart: string,
  method: string,
  fallbackAccountId: string,
): Promise<{ memberFullName: string; amount: number }> {
  const plan = await prisma.duesPlan.findUniqueOrThrow({ where: { id: planId } });
  const member = plan.memberId ? await prisma.member.findUnique({ where: { id: plan.memberId } }) : null;

  const end = addMonths(new Date(periodStart), 1);
  end.setUTCDate(end.getUTCDate() - 1);
  const amount = num(plan.amount);

  const txnId = await createLedgerEntry({
    accountId: fallbackAccountId,
    date: new Date().toISOString().slice(0, 10),
    amount,
    direction: "INFLOW",
    description: `Dues — ${member?.fullName ?? plan.memberId} (${periodStart.slice(0, 7)})`,
    category: "dues",
    paymentMethod: method,
    source: "DUES",
    memberId: plan.memberId,
  });

  await prisma.duesPayment.create({
    data: {
      duesPlanId: planId,
      memberId: plan.memberId,
      periodStart: new Date(periodStart),
      periodEnd: end,
      amount,
      paidOn: new Date(),
      status: "PAID",
      transactionId: txnId,
    },
  });

  return { memberFullName: member?.fullName ?? String(plan.memberId), amount };
}
