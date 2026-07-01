"use server";

import { z } from "zod";
import { createDepositBatch, reconcileDepositRecord, type NewDepositInput } from "@/lib/db/deposits";
import { writeAudit } from "@/lib/db/audit";
import { requireUser } from "@/lib/db/auth";

const NewDepositSchema = z.object({
  accountId: z.string().min(1),
  items: z.array(z.object({ method: z.string(), amount: z.number().positive(), description: z.string() })),
});

export async function addDepositAction(data: NewDepositInput) {
  const user = await requireUser();
  const input = NewDepositSchema.parse(data);
  const { code, total } = await createDepositBatch(input);
  await writeAudit({
    action: "create",
    entityType: "Deposit",
    entityId: code,
    summary: `Created deposit batch #${code} ($${total.toFixed(2)})`,
    actorId: user.id,
  });
}

export async function reconcileDepositAction(depositId: string, txnId: string) {
  const user = await requireUser();
  await reconcileDepositRecord(depositId, txnId);
  await writeAudit({
    action: "reconcile",
    entityType: "Deposit",
    entityId: depositId,
    summary: `Reconciled deposit to bank line ${txnId} — counted once`,
    actorId: user.id,
  });
}
