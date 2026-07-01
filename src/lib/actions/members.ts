"use server";

import { z } from "zod";
import { createMember, updateMemberRecord, type CreateMemberInput, type UpdateMemberInput } from "@/lib/db/members";
import { writeAudit } from "@/lib/db/audit";
import { requireUser } from "@/lib/db/auth";

const NewMemberSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string(),
  phone: z.string(),
  type: z.string(),
  status: z.enum(["ACTIVE", "INACTIVE", "PENDING", "SUSPENDED", "DECEASED", "MOVED_AWAY"]),
  family: z.string(),
});

export async function addMemberAction(data: CreateMemberInput) {
  const user = await requireUser();
  const input = NewMemberSchema.parse(data);
  const member = await createMember(input);
  await writeAudit({
    action: "create",
    entityType: "Member",
    entityId: member.id,
    summary: `Added member ${member.fullName} (${member.memberCode})`,
    actorId: user.id,
  });
  return member;
}

const PatchSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  type: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "PENDING", "SUSPENDED", "DECEASED", "MOVED_AWAY"]).optional(),
  family: z.string().optional(),
});

export async function updateMemberAction(id: string, patch: UpdateMemberInput) {
  const user = await requireUser();
  const input = PatchSchema.parse(patch);
  await updateMemberRecord(id, input);
  await writeAudit({
    action: "update",
    entityType: "Member",
    entityId: id,
    summary: `Updated member ${id}`,
    actorId: user.id,
  });
}
