"use server";

import { z } from "zod";
import { createDonation, type NewDonationInput } from "@/lib/db/donations";
import { writeAudit } from "@/lib/db/audit";
import { requireUser } from "@/lib/db/auth";

const NewDonationSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().positive(),
  method: z.string(),
  memberId: z.string().nullable(),
  campaignId: z.string().nullable(),
  familyId: z.string().nullable(),
  eventId: z.string().nullable(),
  accountId: z.string().min(1),
  donatedOn: z.string(),
  note: z.string(),
  isAnonymous: z.boolean(),
});

export async function recordDonationAction(data: NewDonationInput) {
  const user = await requireUser();
  const input = NewDonationSchema.parse(data);
  const { donation, categoryName } = await createDonation(input);
  await writeAudit({
    action: "create",
    entityType: "Donation",
    entityId: donation.id,
    summary: `Recorded ${categoryName} of $${input.amount.toFixed(2)} → posted to ledger`,
    actorId: user.id,
  });
  return donation;
}
