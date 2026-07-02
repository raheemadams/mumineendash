import { prisma } from "@/lib/prisma";
import { num } from "./mappers";
import type { Txn } from "@/lib/store/types";
import type { Prisma } from "@prisma/client";

function toTxn(row: Prisma.TransactionGetPayload<object>): Txn {
  return {
    id: row.id,
    accountId: row.accountId,
    date: row.date.toISOString(),
    amount: num(row.amount),
    direction: row.direction,
    description: row.description,
    memo: row.memo,
    referenceNumber: row.referenceNumber,
    category: row.category,
    paymentMethod: row.paymentMethod,
    source: row.source,
    reconStatus: row.reconStatus,
    dedupeHash: row.dedupeHash,
    memberId: row.memberId,
    depositBatchId: row.depositBatchId,
  };
}

export async function listTransactions(): Promise<Txn[]> {
  const rows = await prisma.transaction.findMany({ orderBy: { date: "desc" } });
  return rows.map(toTxn);
}

export interface NewLedgerEntry {
  accountId: string;
  date: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW" | "TRANSFER";
  description?: string | null;
  memo?: string | null;
  referenceNumber?: string | null;
  category?: string | null;
  paymentMethod?: string | null;
  source: "IMPORT" | "MANUAL" | "DONATION" | "DUES" | "DEPOSIT" | "SYSTEM";
  dedupeHash?: string | null;
  memberId?: string | null;
}

/** Creates one ledger row and returns its new id — the shared "post to the ledger" primitive every module uses. */
export async function createLedgerEntry(entry: NewLedgerEntry): Promise<string> {
  const amount = Math.abs(entry.amount);
  const txn = await prisma.transaction.create({
    data: {
      accountId: entry.accountId,
      date: new Date(entry.date),
      amount,
      direction: entry.direction,
      deposit: entry.direction === "INFLOW" ? amount : null,
      withdrawal: entry.direction === "OUTFLOW" ? amount : null,
      description: entry.description ?? null,
      memo: entry.memo ?? null,
      referenceNumber: entry.referenceNumber ?? null,
      category: entry.category ?? null,
      paymentMethod: (entry.paymentMethod as any) ?? null,
      source: entry.source,
      dedupeHash: entry.dedupeHash ?? null,
      memberId: entry.memberId ?? null,
    },
  });
  return txn.id;
}

export async function markTransactionReconciled(txnId: string, depositBatchId: string): Promise<void> {
  await prisma.transaction.update({
    where: { id: txnId },
    data: { reconStatus: "RECONCILED", depositBatchId },
  });
}

/** Sets (or clears, when category is null) the purpose category on a ledger row. */
export async function setTransactionCategory(txnId: string, category: string | null): Promise<void> {
  await prisma.transaction.update({
    where: { id: txnId },
    data: { category },
  });
}

/** Updates the human-readable description on a ledger row. */
export async function setTransactionDescription(txnId: string, description: string | null): Promise<void> {
  await prisma.transaction.update({
    where: { id: txnId },
    data: { description },
  });
}
