// Creates one shared login per office (President, Treasurer, Administrator,
// Imam, Secretary) — not per person. When someone rotates out of a role, the
// office keeps the same login; just share the password with whoever takes
// over (or re-run this script with FORCE_RESET=1 to rotate it).
//
// Run with: npx tsx scripts/seed-office-accounts.ts
// Requires SUPABASE_URL + SUPABASE_SECRET_KEY in .env (server-only — the
// secret/service-role key must never reach the browser).
//
// Passwords are generated fresh each run and printed ONCE to the terminal —
// they are not saved anywhere by this script. Store them somewhere safe
// (a password manager, or a printed sheet in a locked office drawer) before
// closing this terminal.

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DOMAIN = "masjidulmumineen.org";

const OFFICES: { roleKey: string; label: string }[] = [
  { roleKey: "president", label: "President" },
  { roleKey: "treasurer", label: "Treasurer" },
  { roleKey: "administrator", label: "Administrator" },
  { roleKey: "imam", label: "Imam" },
  { roleKey: "secretary", label: "Secretary" },
];

const FORCE_RESET = process.env.FORCE_RESET === "1";

function generatePassword(length = 16): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => charset[b % charset.length]).join("");
}

async function findAuthUserByEmail(email: string) {
  // supabase-js has no "get by email" admin call, so page through listUsers.
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) return null;
    page++;
  }
}

async function main() {
  const results: { email: string; password: string | null; status: string }[] = [];

  const roles = await prisma.role.findMany({ where: { key: { in: OFFICES.map((o) => o.roleKey) } } });
  const roleIdByKey = new Map(roles.map((r) => [r.key, r.id]));

  for (const office of OFFICES) {
    const email = `${office.roleKey}@${DOMAIN}`;
    const roleId = roleIdByKey.get(office.roleKey);
    if (!roleId) {
      results.push({ email, password: null, status: `SKIPPED — no Role row for key "${office.roleKey}"` });
      continue;
    }

    let authUserId: string;
    let password: string | null = null;

    const existingAuthUser = await findAuthUserByEmail(email);
    if (existingAuthUser && !FORCE_RESET) {
      authUserId = existingAuthUser.id;
    } else if (existingAuthUser && FORCE_RESET) {
      password = generatePassword();
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, { password });
      if (error) throw error;
      authUserId = data.user.id;
    } else {
      password = generatePassword();
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { office: office.label },
      });
      if (error) throw error;
      authUserId = data.user.id;
    }

    const dbUser = await prisma.user.upsert({
      where: { email },
      update: { authId: authUserId, fullName: `${office.label} Office` },
      create: { email, authId: authUserId, fullName: `${office.label} Office` },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: dbUser.id, roleId } },
      update: {},
      create: { userId: dbUser.id, roleId },
    });

    results.push({
      email,
      password,
      status: password ? (existingAuthUser ? "password reset" : "created") : "already provisioned",
    });
  }

  console.log("\nOffice accounts:");
  console.table(results);
  if (results.some((r) => r.password)) {
    console.log(
      "\n⚠ Passwords above are shown ONCE and not saved anywhere. Copy them now — e.g. into a password manager or a printed sheet kept in a locked office drawer.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
