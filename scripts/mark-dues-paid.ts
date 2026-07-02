// Marks active dues plans as paid for every period from the plan's start
// through the "as-of" date (default today) — i.e. brings current members up to
// date. Period starts are generated the same way the dues engine does
// (src/lib/engine/dues.ts) so payments line up exactly with periods.
//
// Idempotent: a period that already has a payment for the plan is skipped.
//
// Run: npx tsx scripts/mark-dues-paid.ts [asOfDate]
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function addMonthsUTC(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}
function addDaysUTC(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
const key = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const asOf = process.argv[2] ? new Date(process.argv[2] + "T23:59:59Z") : new Date();
  const plans = await prisma.duesPlan.findMany({
    where: { isActive: true, frequency: "MONTHLY" },
    select: { id: true, memberId: true, amount: true, startDate: true },
  });

  // Existing payments per plan, keyed by period start, so re-runs don't duplicate.
  const existing = await prisma.duesPayment.findMany({ select: { duesPlanId: true, periodStart: true } });
  const have = new Set(existing.map((e) => `${e.duesPlanId}|${key(new Date(e.periodStart))}`));

  const toCreate: {
    duesPlanId: string; memberId: string | null; periodStart: Date; periodEnd: Date;
    amount: number; paidOn: Date; status: "PAID";
  }[] = [];

  for (const p of plans) {
    let cursor = new Date(p.startDate);
    let guard = 0;
    while (guard++ < 600 && cursor.getTime() <= asOf.getTime()) {
      const start = new Date(cursor);
      if (!have.has(`${p.id}|${key(start)}`)) {
        toCreate.push({
          duesPlanId: p.id,
          memberId: p.memberId,
          periodStart: start,
          periodEnd: addDaysUTC(addMonthsUTC(start, 1), -1),
          amount: Number(p.amount),
          paidOn: start,
          status: "PAID",
        });
      }
      cursor = addMonthsUTC(cursor, 1);
    }
  }

  console.log(`Plans: ${plans.length}. Payments to record: ${toCreate.length}.`);
  const batch = 500;
  for (let i = 0; i < toCreate.length; i += batch) {
    await prisma.duesPayment.createMany({ data: toCreate.slice(i, i + batch) });
    process.stdout.write(`\rRecorded ${Math.min(i + batch, toCreate.length)}/${toCreate.length}...`);
  }
  const total = await prisma.duesPayment.count();
  console.log(`\nDone. Dues payments in DB: ${total}.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
