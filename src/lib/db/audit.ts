// Audit logging. Every write is attributed to the real logged-in office
// account (getCurrentUser()) now that auth exists. Falls back to a fixed
// "system actor" User row only for contexts with no session (e.g. seed
// scripts) so AuditLog.actorId always has something to point at.
//
// The human-readable summary the UI displays is stored in AuditLog.reason —
// that's the schema's only free-text field; there's no dedicated `summary`
// column.

import { prisma } from "@/lib/prisma";
import { iso } from "./mappers";
import type { AuditEntry } from "@/lib/store/types";

const ACTOR_EMAIL = "raheem@masjidulmumineen.org";
const ACTOR_NAME = "Raheem Adams";

let cachedSystemActorId: string | null = null;

export async function systemActorId(): Promise<string> {
  if (cachedSystemActorId) return cachedSystemActorId;
  const user = await prisma.user.upsert({
    where: { email: ACTOR_EMAIL },
    update: {},
    create: { email: ACTOR_EMAIL, fullName: ACTOR_NAME },
  });
  cachedSystemActorId = user.id;
  return user.id;
}

export async function writeAudit(entry: {
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorId?: string;
}): Promise<void> {
  const actorId = entry.actorId ?? (await systemActorId());
  await prisma.auditLog.create({
    data: {
      actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      reason: entry.summary,
    },
  });
}

export async function listAuditLog(): Promise<AuditEntry[]> {
  const rows = await prisma.auditLog.findMany({
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    at: iso(r.createdAt)!,
    actor: r.actor?.fullName ?? "System",
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId ?? "",
    summary: r.reason ?? "",
  }));
}
