// Import commit — the server is the single source of truth for what counts as
// a duplicate. The client computes a preview verdict against its locally-loaded
// ledger snapshot, but that snapshot can be stale (e.g. rows deleted out-of-band,
// another device importing concurrently). Trusting the client's `isDuplicate`
// flag would then silently drop genuinely new rows — the worst failure mode for
// "cash counted exactly once." So we ignore the incoming flag and re-run the
// exact-same dedupe engine here against a fresh read of the live ledger.

import { prisma } from "@/lib/prisma";
import { detectDuplicates } from "@/lib/engine";
import type { LedgerTxn, NormalizedTxn } from "@/lib/engine/types";

export interface ImportRowVerdict {
  txn: NormalizedTxn;
  isDuplicate: boolean; // advisory only — the server re-derives this
}

export async function commitImportRows(
  accountId: string,
  rows: ImportRowVerdict[],
): Promise<{ inserted: number; blocked: number }> {
  // Candidates come across the server-action boundary as JSON, so Date fields
  // arrive as ISO strings — coerce them back before the engine touches them.
  const candidates: NormalizedTxn[] = rows.map((r) => ({
    ...r.txn,
    date: r.txn.date instanceof Date ? r.txn.date : new Date(r.txn.date),
  }));

  const existingRows = await prisma.transaction.findMany({
    where: { accountId },
    select: {
      id: true,
      accountId: true,
      date: true,
      amount: true,
      direction: true,
      description: true,
      referenceNumber: true,
      dedupeHash: true,
    },
  });

  const existing: LedgerTxn[] = existingRows.map((e) => ({
    id: e.id,
    accountId: e.accountId,
    date: e.date,
    amount: Number(e.amount),
    direction: e.direction,
    description: e.description,
    referenceNumber: e.referenceNumber,
    dedupeHash: e.dedupeHash,
  }));

  // Authoritative verdict against the live ledger (also catches duplicates
  // within this same upload batch).
  const verdicts = detectDuplicates(candidates, existing);
  const toInsert = verdicts.filter((v) => !v.isDuplicate).map((v) => v.candidate);

  if (toInsert.length > 0) {
    await prisma.transaction.createMany({
      data: toInsert.map((txn) => ({
        accountId,
        date: txn.date instanceof Date ? txn.date : new Date(txn.date),
        amount: txn.amount,
        direction: txn.direction,
        deposit: txn.deposit,
        withdrawal: txn.withdrawal,
        description: txn.description,
        memo: txn.memo,
        referenceNumber: txn.referenceNumber,
        dedupeHash: txn.dedupeHash,
        source: "IMPORT" as const,
        reconStatus: "UNRECONCILED" as const,
      })),
    });
  }

  return { inserted: toInsert.length, blocked: rows.length - toInsert.length };
}
