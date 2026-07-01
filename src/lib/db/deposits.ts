import { prisma } from "@/lib/prisma";
import { num, isoDate } from "./mappers";
import { markTransactionReconciled } from "./transactions";
import type { Deposit, DepositItem } from "@/lib/store/types";
import type { Prisma } from "@prisma/client";

type DepositWithRelations = Prisma.DepositBatchGetPayload<{ include: { items: true; transactions: true } }>;

function toDeposit(row: DepositWithRelations): Deposit {
  const items: DepositItem[] = row.items.map((it) => ({
    method: it.method,
    amount: num(it.amount),
    description: it.description ?? "",
    memberId: it.memberId,
  }));
  return {
    id: row.id,
    code: row.depositCode,
    status: row.status as Deposit["status"],
    expectedTotal: num(row.expectedTotal),
    depositedOn: row.depositedOn ? isoDate(row.depositedOn) : null,
    accountId: row.accountId ?? "",
    items,
    reconciledTxnId: row.transactions[0]?.id ?? null,
  };
}

export async function listDeposits(): Promise<Deposit[]> {
  const rows = await prisma.depositBatch.findMany({
    include: { items: true, transactions: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDeposit);
}

export interface NewDepositInput {
  accountId: string;
  items: { method: string; amount: number; description: string }[];
}

export async function createDepositBatch(data: NewDepositInput): Promise<{ code: string; total: number }> {
  const total = data.items.reduce((sum, it) => sum + it.amount, 0);
  const count = await prisma.depositBatch.count();
  const code = `2026-${String(count + 16).padStart(3, "0")}`;

  await prisma.depositBatch.create({
    data: {
      depositCode: code,
      accountId: data.accountId,
      status: "PENDING_BANK_DEPOSIT",
      expectedTotal: total,
      items: { create: data.items.map((it) => ({ method: it.method as any, amount: it.amount, description: it.description })) },
    },
  });

  return { code, total };
}

export async function reconcileDepositRecord(depositId: string, txnId: string): Promise<void> {
  await prisma.$transaction([
    prisma.depositBatch.update({ where: { id: depositId }, data: { status: "RECONCILED", reconciledOn: new Date() } }),
  ]);
  await markTransactionReconciled(txnId, depositId);
}
