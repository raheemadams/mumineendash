// Wipes all member/financial/activity data so the app can start fresh with
// real congregation data. Deliberately keeps: Users, Roles, Permissions,
// RolePermission, UserRole (the 5 office logins keep working), the
// DonationCategory reference list, and FinancialAccount rows (so accounts
// exist with their configured opening balance, just no transaction history).
//
// Deletion order matters — children before parents to satisfy FK constraints.
// Run with: npx tsx scripts/reset-data.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deletions: [string, () => Promise<{ count: number }>][] = [
    ["DonationAttribution", () => prisma.donationAttribution.deleteMany()],
    ["Notification", () => prisma.notification.deleteMany()],
    ["PastoralNote", () => prisma.pastoralNote.deleteMany()],
    ["AuditLog", () => prisma.auditLog.deleteMany()],
    ["DuesPayment", () => prisma.duesPayment.deleteMany()],
    ["Donation", () => prisma.donation.deleteMany()],
    ["Transaction", () => prisma.transaction.deleteMany()],
    ["DepositBatchItem", () => prisma.depositBatchItem.deleteMany()],
    ["DepositBatch", () => prisma.depositBatch.deleteMany()],
    ["ImportBatch", () => prisma.importBatch.deleteMany()],
    ["ImportMapping", () => prisma.importMapping.deleteMany()],
    ["DuesPlan", () => prisma.duesPlan.deleteMany()],
    ["Member", () => prisma.member.deleteMany()],
    ["Family", () => prisma.family.deleteMany()],
    ["Campaign", () => prisma.campaign.deleteMany()],
    ["Event", () => prisma.event.deleteMany()],
    ["Fund", () => prisma.fund.deleteMany()],
  ];

  for (const [label, run] of deletions) {
    const { count } = await run();
    console.log(`Deleted ${count} row(s) from ${label}`);
  }

  console.log("\nKept intact: User, Role, Permission, RolePermission, UserRole, DonationCategory, FinancialAccount");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
