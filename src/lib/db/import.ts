// Import commit — extends the existing /api/imports/commit route's pattern
// (server-side dedupe re-verification against the live ledger) rather than
// trusting the client's preview verdict blindly. The client already ran
// normalize+dedupe against its locally-loaded ledger snapshot for the
// preview UI; this re-checks each surviving row's exact fingerprint against
// the database one more time immediately before writing, closing the race
// window between "preview computed" and "commit clicked".

import { prisma } from "@/lib/prisma";
import type { NormalizedTxn } from "@/lib/engine/types";

export interface ImportRowVerdict {
  txn: NormalizedTxn;
  isDuplicate: boolean;
}

export async function commitImportRows(
  accountId: string,
  rows: ImportRowVerdict[],
): Promise<{ inserted: number; blocked: number }> {
  const clientFresh = rows.filter((r) => !r.isDuplicate);

  const existing = await prisma.transaction.findMany({
    where: { accountId, dedupeHash: { not: null } },
    select: { dedupeHash: true },
  });
  const existingHashes = new Set(existing.map((e) => e.dedupeHash));

  const toInsert = clientFresh.filter((r) => !existingHashes.has(r.txn.dedupeHash));

  if (toInsert.length > 0) {
    await prisma.transaction.createMany({
      data: toInsert.map((r) => ({
        accountId,
        date: r.txn.date instanceof Date ? r.txn.date : new Date(r.txn.date),
        amount: r.txn.amount,
        direction: r.txn.direction,
        deposit: r.txn.deposit,
        withdrawal: r.txn.withdrawal,
        description: r.txn.description,
        memo: r.txn.memo,
        referenceNumber: r.txn.referenceNumber,
        dedupeHash: r.txn.dedupeHash,
        source: "IMPORT" as const,
        reconStatus: "UNRECONCILED" as const,
      })),
    });
  }

  return { inserted: toInsert.length, blocked: rows.length - toInsert.length };
}
