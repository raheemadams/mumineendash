"use server";

import { z } from "zod";
import { createPastoralNote, type NewPastoralNoteInput } from "@/lib/db/pastoral";
import { writeAudit } from "@/lib/db/audit";
import { requireUser } from "@/lib/db/auth";

const NewNoteSchema = z.object({
  memberId: z.string().min(1),
  kind: z.enum(["VISIT", "FUNERAL", "MARRIAGE", "SHAHADA", "COUNSELING", "PRAYER_REQUEST", "VOLUNTEER_REQUEST"]),
  title: z.string().min(1),
  body: z.string(),
  occurredOn: z.string(),
  isPrivate: z.boolean(),
});

export async function addPastoralNoteAction(data: NewPastoralNoteInput) {
  const user = await requireUser();
  const input = NewNoteSchema.parse(data);
  const { memberFullName } = await createPastoralNote(input, user.id);
  await writeAudit({
    action: "create",
    entityType: "PastoralNote",
    entityId: input.memberId,
    summary: `Recorded ${input.kind.toLowerCase().replace(/_/g, " ")} note for ${memberFullName}`,
    actorId: user.id,
  });
}
