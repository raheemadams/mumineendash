"use server";

import { z } from "zod";
import {
  createLedgerCategory,
  renameLedgerCategory,
  setLedgerCategoryKind,
  deleteLedgerCategory,
} from "@/lib/db/categories";
import { writeAudit } from "@/lib/db/audit";
import { requireUser } from "@/lib/db/auth";

const KindSchema = z.enum(["INCOME", "EXPENSE", "BOTH"]);
const NameSchema = z.string().trim().min(1, "Name is required").max(80);

export async function createCategoryAction(name: string, kind: string) {
  const user = await requireUser();
  const cat = await createLedgerCategory(NameSchema.parse(name), KindSchema.parse(kind));
  await writeAudit({
    action: "create",
    entityType: "LedgerCategory",
    entityId: cat.id,
    summary: `Added category ${cat.name} (${cat.kind})`,
    actorId: user.id,
  });
  return cat;
}

export async function renameCategoryAction(id: string, name: string) {
  const user = await requireUser();
  await renameLedgerCategory(id, NameSchema.parse(name));
  await writeAudit({
    action: "update",
    entityType: "LedgerCategory",
    entityId: id,
    summary: `Renamed category to ${name}`,
    actorId: user.id,
  });
}

export async function setCategoryKindAction(id: string, kind: string) {
  const user = await requireUser();
  await setLedgerCategoryKind(id, KindSchema.parse(kind));
  await writeAudit({
    action: "update",
    entityType: "LedgerCategory",
    entityId: id,
    summary: `Set category kind to ${kind}`,
    actorId: user.id,
  });
}

export async function deleteCategoryAction(id: string) {
  const user = await requireUser();
  await deleteLedgerCategory(id); // throws if still in use
  await writeAudit({
    action: "delete",
    entityType: "LedgerCategory",
    entityId: id,
    summary: `Deleted category ${id}`,
    actorId: user.id,
  });
}
