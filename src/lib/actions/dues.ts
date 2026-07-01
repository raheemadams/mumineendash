"use server";

import { z } from "zod";
import { recordDuesPaymentRecord } from "@/lib/db/dues";
import { writeAudit } from "@/lib/db/audit";
import { requireUser } from "@/lib/db/auth";
import { prisma } from "@/lib/prisma";

const InputSchema = z.object({
  planId: z.string().min(1),
  periodStart: z.string(),
  method: z.string().default("CASH"),
});

/** Dues payments don't carry an explicit account in the UI yet — post to the operating checking account. */
async function resolveOperatingAccountId(): Promise<string> {
  const checking = await prisma.financialAccount.findFirst({ where: { type: "CHECKING" }, orderBy: { createdAt: "asc" } });
  if (checking) return checking.id;
  const any = await prisma.financialAccount.findFirstOrThrow({ orderBy: { createdAt: "asc" } });
  return any.id;
}

export async function recordDuesPaymentAction(planId: string, periodStart: string, method = "CASH") {
  const user = await requireUser();
  const input = InputSchema.parse({ planId, periodStart, method });
  const accountId = await resolveOperatingAccountId();
  const { memberFullName, amount } = await recordDuesPaymentRecord(input.planId, input.periodStart, input.method, accountId);
  await writeAudit({
    action: "create",
    entityType: "DuesPayment",
    entityId: input.planId,
    summary: `Recorded dues $${amount.toFixed(2)} for ${memberFullName}`,
    actorId: user.id,
  });
}
