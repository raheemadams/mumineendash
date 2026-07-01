import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  normalizeRows,
  detectDuplicates,
  type MappingConfig,
  type RawRow,
} from "@/lib/engine";

// POST /api/imports/commit
// Body: { accountId, importBatchId?, mapping, rows }
// Normalizes raw rows, runs duplicate detection against the existing ledger
// for that account, and persists only the non-duplicate rows as Transactions.
// This is the server-side mirror of the in-browser import preview.

const Body = z.object({
  accountId: z.string().min(1),
  importBatchId: z.string().optional(),
  amountStyle: z.enum(["single", "debit_credit"]),
  dateFormat: z.string().optional(),
  fieldMap: z.object({
    date: z.string(),
    description: z.string().optional(),
    amount: z.string().optional(),
    debit: z.string().optional(),
    credit: z.string().optional(),
    reference: z.string().optional(),
    memo: z.string().optional(),
  }),
  rows: z.array(z.record(z.string(), z.string())),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { accountId, importBatchId, amountStyle, dateFormat, fieldMap, rows } = parsed.data;

  const cfg: MappingConfig = { accountId, amountStyle, dateFormat, fieldMap };
  const { rows: normalized, errors } = normalizeRows(rows as RawRow[], cfg);

  // Pull existing ledger rows for this account to detect duplicates.
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

  const existing = existingRows.map((r) => ({
    ...r,
    amount: Number(r.amount),
  }));

  const verdicts = detectDuplicates(normalized, existing);

  const toInsert = verdicts.filter((v) => !v.isDuplicate);

  const created = await prisma.transaction.createMany({
    data: toInsert.map((v) => ({
      accountId,
      importBatchId: importBatchId ?? null,
      date: v.candidate.date,
      amount: v.candidate.amount,
      direction: v.candidate.direction,
      deposit: v.candidate.deposit,
      withdrawal: v.candidate.withdrawal,
      description: v.candidate.description,
      memo: v.candidate.memo,
      referenceNumber: v.candidate.referenceNumber,
      dedupeHash: v.candidate.dedupeHash,
      duplicateScore: v.score,
      source: "IMPORT" as const,
      reconStatus: "UNRECONCILED" as const,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({
    inserted: created.count,
    duplicatesBlocked: verdicts.filter((v) => v.isDuplicate).length,
    parseErrors: errors.length,
  });
}
