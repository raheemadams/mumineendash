import { prisma } from "@/lib/prisma";
import type { LedgerCategory } from "@/lib/store/types";

function toCategory(row: {
  id: string;
  name: string;
  kind: string;
  sortOrder: number;
  isActive: boolean;
}): LedgerCategory {
  return { id: row.id, name: row.name, kind: row.kind as LedgerCategory["kind"], sortOrder: row.sortOrder, isActive: row.isActive };
}

export async function listLedgerCategories(): Promise<LedgerCategory[]> {
  const rows = await prisma.ledgerCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return rows.map(toCategory);
}

export async function createLedgerCategory(name: string, kind: string): Promise<LedgerCategory> {
  const max = await prisma.ledgerCategory.aggregate({ _max: { sortOrder: true } });
  const row = await prisma.ledgerCategory.create({
    data: { name, kind, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  return toCategory(row);
}

/**
 * Rename a category. Because Transaction.category stores the category *name*
 * as a plain string, we also re-point every ledger row carrying the old name
 * so reports and filters stay consistent.
 */
export async function renameLedgerCategory(id: string, newName: string): Promise<void> {
  const existing = await prisma.ledgerCategory.findUnique({ where: { id } });
  if (!existing) throw new Error("Category not found");
  if (existing.name === newName) return;
  await prisma.$transaction([
    prisma.ledgerCategory.update({ where: { id }, data: { name: newName } }),
    prisma.transaction.updateMany({ where: { category: existing.name }, data: { category: newName } }),
  ]);
}

export async function setLedgerCategoryKind(id: string, kind: string): Promise<void> {
  await prisma.ledgerCategory.update({ where: { id }, data: { kind } });
}

/** How many ledger rows currently use this category (by name). */
export async function ledgerCategoryUsage(id: string): Promise<number> {
  const cat = await prisma.ledgerCategory.findUnique({ where: { id } });
  if (!cat) return 0;
  return prisma.transaction.count({ where: { category: cat.name } });
}

/** Deletes a category. Throws if any ledger rows still use it. */
export async function deleteLedgerCategory(id: string): Promise<void> {
  const cat = await prisma.ledgerCategory.findUnique({ where: { id } });
  if (!cat) return;
  const inUse = await prisma.transaction.count({ where: { category: cat.name } });
  if (inUse > 0) {
    throw new Error(`"${cat.name}" is used by ${inUse} ledger entr${inUse === 1 ? "y" : "ies"}. Reassign those first.`);
  }
  await prisma.ledgerCategory.delete({ where: { id } });
}
