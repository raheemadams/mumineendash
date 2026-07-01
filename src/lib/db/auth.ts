// Resolves the logged-in Supabase Auth user to an app role. Each of the 5
// office accounts (president/treasurer/administrator/imam/secretary) is a
// Prisma User row with `authId` set to its Supabase Auth user id, joined to
// exactly one Role via UserRole.
//
// The app's dashboard switch only has 4 views (President/Treasurer/
// Administrator/Imam) — Secretary reuses the Administrator dashboard for now
// (see ROLE_TO_DASHBOARD below), but `officeLabel` still shows their real
// office title in the UI.

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/store/types";

const ROLE_TO_DASHBOARD: Record<string, Role> = {
  president: "PRESIDENT",
  treasurer: "TREASURER",
  administrator: "ADMINISTRATOR",
  imam: "IMAM",
  secretary: "ADMINISTRATOR", // no dedicated Secretary dashboard yet
};

const OFFICE_LABELS: Record<string, string> = {
  president: "President",
  treasurer: "Treasurer",
  administrator: "Administrator",
  imam: "Imam",
  secretary: "Secretary",
};

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  roleKey: string;
  dashboardRole: Role;
  officeLabel: string;
}

/** Returns the logged-in user's resolved role, or null if not authenticated / not provisioned. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
    include: { roles: { include: { role: true } } },
  });
  if (!dbUser) return null;

  const roleKey = dbUser.roles[0]?.role.key ?? "member";
  return {
    id: dbUser.id,
    fullName: dbUser.fullName,
    email: dbUser.email,
    roleKey,
    dashboardRole: ROLE_TO_DASHBOARD[roleKey] ?? "ADMINISTRATOR",
    officeLabel: OFFICE_LABELS[roleKey] ?? roleKey,
  };
}

/** Throws if there's no authenticated + provisioned user — for Server Actions that mutate data. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
