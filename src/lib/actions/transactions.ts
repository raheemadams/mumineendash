"use server";

import { setTransactionCategory, setTransactionDescription } from "@/lib/db/transactions";
import { listLedgerCategories } from "@/lib/db/categories";
import { writeAudit } from "@/lib/db/audit";
import { requireUser } from "@/lib/db/auth";

export async function setTransactionCategoryAction(txnId: string, category: string | null) {
  const user = await requireUser();
  // Empty string means "clear"; otherwise it must be a known managed purpose.
  const value = category && category.length > 0 ? category : null;
  if (value !== null) {
    const known = new Set((await listLedgerCategories()).map((c) => c.name));
    if (!known.has(value)) throw new Error(`Unknown category: ${value}`);
  }
  await setTransactionCategory(txnId, value);
  await writeAudit({
    action: "update",
    entityType: "Transaction",
    entityId: txnId,
    summary: value ? `Set category to ${value}` : "Cleared category",
    actorId: user.id,
  });
}

export async function setTransactionDescriptionAction(txnId: string, description: string) {
  const user = await requireUser();
  const value = description.trim();
  await setTransactionDescription(txnId, value.length > 0 ? value : null);
  await writeAudit({
    action: "update",
    entityType: "Transaction",
    entityId: txnId,
    summary: "Edited description",
    actorId: user.id,
  });
}
