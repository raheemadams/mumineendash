// Enrolls members into the standard membership dues plan ($20/month — see
// DEFAULT_MEMBERSHIP_DUES in src/lib/config.ts). Idempotent: a member who
// already has an active plan is skipped, so re-running is safe.
//
// Run: npx tsx scripts/enroll-dues.ts [startDate] [scope]
//   startDate  ISO date the plan begins (default 2026-01-01)
//   scope      "active" (default) | "all"
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mirrors DEFAULT_MEMBERSHIP_DUES in src/lib/config.ts.
const DUES = { amount: 20, frequency: "MONTHLY" as const, graceDays: 15 };

async function main() {
  const startArg = process.argv[2] || "2026-01-01";
  const scope = (process.argv[3] || "active").toLowerCase();
  const startDate = new Date(startArg + "T00:00:00");
  if (Number.isNaN(startDate.getTime())) throw new Error(`Invalid start date: ${startArg}`);

  const where = scope === "all" ? {} : { membershipStatus: "ACTIVE" as const };
  const members = await prisma.member.findMany({ where, select: { id: true } });

  let created = 0, skipped = 0;
  const chunk = 25;
  for (let i = 0; i < members.length; i += chunk) {
    await Promise.all(
      members.slice(i, i + chunk).map(async (m) => {
        const existing = await prisma.duesPlan.findFirst({
          where: { memberId: m.id, isActive: true },
          select: { id: true },
        });
        if (existing) { skipped++; return; }
        await prisma.duesPlan.create({
          data: {
            memberId: m.id,
            frequency: DUES.frequency,
            amount: DUES.amount,
            startDate,
            graceDays: DUES.graceDays,
            isActive: true,
          },
        });
        created++;
      }),
    );
    process.stdout.write(`\rEnrolled ${Math.min(i + chunk, members.length)}/${members.length}...`);
  }

  const totalPlans = await prisma.duesPlan.count({ where: { isActive: true } });
  console.log(`\n\nScope: ${scope}  Start: ${startArg}  ($${DUES.amount}/${DUES.frequency.toLowerCase()})`);
  console.log(`Created ${created}, skipped ${skipped} (already enrolled).`);
  console.log(`Active dues plans in DB: ${totalPlans}.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
