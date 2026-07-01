// Seeds foundational reference data + the same demo dataset the app used to
// ship with in its localStorage store (src/lib/store/seed.ts), so the app
// looks identical after switching from localStorage to Supabase.
// Run with `npm run db:seed` once DATABASE_URL points at a Postgres instance.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLES = [
  ["president", "President"],
  ["vice_president", "Vice President"],
  ["treasurer", "Treasurer"],
  ["assistant_treasurer", "Assistant Treasurer"],
  ["secretary", "Secretary"],
  ["administrator", "Administrator"],
  ["imam", "Imam"],
  ["committee_head", "Committee Head"],
  ["volunteer", "Volunteer"],
  ["member", "Member"],
];

const PERMISSIONS = [
  "members.read", "members.write",
  "donations.read", "donations.write",
  "dues.read", "dues.write",
  "accounts.read", "accounts.write",
  "transactions.read", "transactions.write",
  "imports.run", "reconciliation.manage",
  "reports.read", "reports.export",
  "audit.read", "settings.manage",
];

const DONATION_CATEGORIES = [
  ["general", "General Donation"],
  ["zakat", "Zakat"],
  ["sadaqah", "Sadaqah"],
  ["building_fund", "Building Fund"],
  ["ramadan", "Ramadan"],
  ["eid", "Eid"],
  ["school", "School"],
  ["youth", "Youth Program"],
  ["funeral", "Funeral"],
  ["special_appeal", "Special Appeal"],
  ["investment", "Investment Fund"],
];

const ACCOUNTS: { key: string; name: string; institution: string; type: any; mask: string; openingBalance: number }[] = [
  { key: "acct-boa", name: "Bank of America — Operating", institution: "Bank of America", type: "CHECKING", mask: "4821", openingBalance: 80000 },
  { key: "acct-bot", name: "Bank of Texas — Building Fund", institution: "Bank of Texas", type: "SAVINGS", mask: "9930", openingBalance: 150000 },
  { key: "acct-paypal", name: "PayPal", institution: "PayPal", type: "PAYPAL", mask: "0000", openingBalance: 2600 },
  { key: "acct-cash", name: "Cash Box", institution: "On-site", type: "CASH_BOX", mask: "0000", openingBalance: 0 },
];

async function seedReferenceData() {
  for (const [key, name] of ROLES) {
    await prisma.role.upsert({ where: { key }, update: {}, create: { key, name, isSystem: true } });
  }

  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }

  const allPerms = await prisma.permission.findMany();
  const treasurer = await prisma.role.findUniqueOrThrow({ where: { key: "treasurer" } });
  for (const p of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: treasurer.id, permissionId: p.id } },
      update: {},
      create: { roleId: treasurer.id, permissionId: p.id },
    });
  }

  for (let i = 0; i < DONATION_CATEGORIES.length; i++) {
    const [key, name] = DONATION_CATEGORIES[i];
    await prisma.donationCategory.upsert({ where: { key }, update: {}, create: { key, name, sortOrder: i } });
  }

  console.log("✓ Seeded roles, permissions, and donation categories.");
}

/**
 * Accounts are seeded unconditionally, every run — unlike the rest of the
 * demo dataset, this always syncs `openingBalance` to the values above even
 * if the row already exists, so re-running the seed can't silently leave a
 * stale $0 balance from before this dataset had opening balances.
 */
async function seedAccounts(): Promise<Map<string, string>> {
  const accountId = new Map<string, string>();
  for (const a of ACCOUNTS) {
    const existing = await prisma.financialAccount.findFirst({ where: { name: a.name } });
    const account = existing
      ? await prisma.financialAccount.update({ where: { id: existing.id }, data: { openingBalance: a.openingBalance } })
      : await prisma.financialAccount.create({
          data: { name: a.name, institution: a.institution, type: a.type, accountMask: a.mask, openingBalance: a.openingBalance },
        });
    accountId.set(a.key, account.id);
  }
  return accountId;
}

/** id -> real DB id maps, so the demo dataset's cross-references resolve. */
async function seedDemoData(accountId: Map<string, string>) {
  // Skip the REST of the demo dataset if it already exists (re-running seed
  // shouldn't duplicate members/donations/etc — accounts are handled above).
  const existing = await prisma.member.findFirst({ where: { memberCode: "MUM-0001" } });
  if (existing) {
    console.log("↷ Demo dataset already present, skipping.");
    return;
  }

  const actor = await prisma.user.upsert({
    where: { email: "raheem@masjidulmumineen.org" },
    update: {},
    create: { email: "raheem@masjidulmumineen.org", fullName: "Raheem Adams" },
  });

  const familyDefs = [
    ["f1", "Ali"], ["f2", "Khan"], ["f3", "Adams"], ["f4", "Hassan"], ["f5", "Siddiqui"],
  ] as const;
  const familyId = new Map<string, string>();
  for (const [key, familyName] of familyDefs) {
    const family = await prisma.family.create({ data: { familyName } });
    familyId.set(key, family.id);
  }

  const memberDefs = [
    ["m1", "MUM-0001", "Ahmed", "Ali", "ACTIVE", "FAMILY", "2019-03-12", "f1"],
    ["m2", "MUM-0002", "Fatima", "Khan", "ACTIVE", "REGULAR", "2020-07-01", "f2"],
    ["m3", "MUM-0003", "Yusuf", "Adams", "ACTIVE", "LIFETIME", "2015-01-20", "f3"],
    ["m4", "MUM-0004", "Mariam", "Hassan", "PENDING", "STUDENT", "2026-05-30", "f4"],
    ["m5", "MUM-0005", "Omar", "Siddiqui", "INACTIVE", "REGULAR", "2018-11-08", "f5"],
    ["m6", "MUM-0006", "Layla", "Ali", "ACTIVE", "FAMILY", "2019-03-12", "f1"],
  ] as const;
  const memberId = new Map<string, string>();
  for (const [key, memberCode, firstName, lastName, status, type, joined, famKey] of memberDefs) {
    const member = await prisma.member.create({
      data: {
        memberCode,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        phone: "(555) 010-0000",
        membershipStatus: status as any,
        membershipType: type as any,
        dateJoined: new Date(joined),
        familyId: familyId.get(famKey),
      },
    });
    memberId.set(key, member.id);
  }

  const campaignDefs = [
    ["camp1", "New Wing Building Appeal", 250000],
    ["camp2", "Ramadan 2026 Iftar Fund", 40000],
  ] as const;
  const campaignId = new Map<string, string>();
  for (const [key, name, goalAmount] of campaignDefs) {
    const campaign = await prisma.campaign.create({ data: { name, goalAmount } });
    campaignId.set(key, campaign.id);
  }

  const eventDefs = [
    ["ev1", "Eid Bazaar", "2026-06-14", "Main Hall"],
    ["ev2", "Friday Jumu'ah Khutbah", "2026-07-03", "Main Hall"],
    ["ev3", "Youth Iftar Night", "2026-07-10", "Community Center"],
  ] as const;
  const eventId = new Map<string, string>();
  for (const [key, name, startsOn, location] of eventDefs) {
    const event = await prisma.event.create({ data: { name, startsAt: new Date(startsOn), location } });
    eventId.set(key, event.id);
  }

  const ledgerDefs = [
    ["t1", "acct-boa", "2026-06-09", 1700, "INFLOW", "BRANCH DEPOSIT FRIDAY COLLECTION", null, "general", "DEPOSIT"],
    ["t2", "acct-boa", "2026-06-07", 150, "INFLOW", "ZELLE FROM AHMED ALI", "ZL88231", "general", "DONATION"],
    ["t3", "acct-boa", "2026-06-05", 1200, "OUTFLOW", "CHECK 1041 RENT", "1041", "rent", "IMPORT"],
    ["t4", "acct-paypal", "2026-06-04", 500, "INFLOW", "PAYPAL DONATION BUILDING FUND", "PP-77ac", "building_fund", "DONATION"],
    ["t5", "acct-boa", "2026-06-03", 89.5, "OUTFLOW", "UTILITY ACH ELECTRIC CO", null, "utilities", "IMPORT"],
    ["t6", "acct-bot", "2026-06-01", 5000, "INFLOW", "WIRE BUILDING FUND APPEAL", "WR-2201", "building_fund", "IMPORT"],
    ["t7", "acct-boa", "2026-05-30", 250, "INFLOW", "ZELLE FROM FATIMA KHAN ZAKAT", "ZL88102", "zakat", "DONATION"],
  ] as const;
  const txnId = new Map<string, string>();
  for (const [key, acctKey, date, amount, direction, description, referenceNumber, category, source] of ledgerDefs) {
    const txn = await prisma.transaction.create({
      data: {
        accountId: accountId.get(acctKey)!,
        date: new Date(date),
        amount,
        direction: direction as any,
        deposit: direction === "INFLOW" ? amount : null,
        withdrawal: direction === "OUTFLOW" ? amount : null,
        description,
        referenceNumber,
        category,
        source: source as any,
      },
    });
    txnId.set(key, txn.id);
  }

  const categoryByKey = new Map<string, string>();
  for (const cat of await prisma.donationCategory.findMany()) categoryByKey.set(cat.key, cat.id);

  // Fan-out example: dn1 attributes to a member, their family, AND a campaign at once
  // (Donation's own memberId/familyId/campaignId/eventId columns carry the simple case).
  const donationDefs = [
    ["dn1", "building_fund", 500, "2026-06-04", "PAYPAL", "m3", "camp1", null, "t4", "f3"],
    ["dn2", "zakat", 250, "2026-05-30", "ZELLE", "m2", null, null, "t7", null],
    ["dn3", "general", 150, "2026-06-07", "ZELLE", "m1", null, "ev1", "t2", "f1"],
  ] as const;
  for (const [, catKey, amount, donatedOn, method, memKey, campKey, evKey, txKey, famKey] of donationDefs) {
    await prisma.donation.create({
      data: {
        categoryId: categoryByKey.get(catKey)!,
        amount,
        donatedOn: new Date(donatedOn),
        method: method as any,
        memberId: memKey ? memberId.get(memKey) : null,
        familyId: famKey ? familyId.get(famKey) : null,
        campaignId: campKey ? campaignId.get(campKey) : null,
        eventId: evKey ? eventId.get(evKey) : null,
        transactionId: txnId.get(txKey),
      },
    });
  }

  const duesPlanDefs = [
    ["dp1", "m1", "MONTHLY", 50, "2026-01-01", 15],
    ["dp2", "m2", "MONTHLY", 50, "2026-01-01", 15],
    ["dp3", "m5", "MONTHLY", 50, "2025-01-01", 15],
    ["dp4", "m3", "YEARLY", 600, "2026-01-01", 30],
  ] as const;
  const duesPlanId = new Map<string, string>();
  for (const [key, memKey, frequency, amount, startDate, graceDays] of duesPlanDefs) {
    const plan = await prisma.duesPlan.create({
      data: { memberId: memberId.get(memKey), frequency: frequency as any, amount, startDate: new Date(startDate), graceDays },
    });
    duesPlanId.set(key, plan.id);
  }

  function periodEnd(periodStart: string): Date {
    const end = new Date(periodStart);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(end.getUTCDate() - 1);
    return end;
  }

  const duesPaymentDefs = [
    ["dp1", "m1", "2026-01-01", 50], ["dp1", "m1", "2026-02-01", 50], ["dp1", "m1", "2026-03-01", 50],
    ["dp1", "m1", "2026-04-01", 50], ["dp1", "m1", "2026-05-01", 50], ["dp1", "m1", "2026-06-01", 50],
    ["dp2", "m2", "2026-01-01", 50], ["dp2", "m2", "2026-02-01", 50], ["dp2", "m2", "2026-03-01", 50],
    ["dp2", "m2", "2026-04-01", 50], ["dp4", "m3", "2026-01-01", 600],
    // m5 (Omar) has paid nothing on a 2025 plan → deeply past due
  ] as const;
  for (const [planKey, memKey, periodStart, amount] of duesPaymentDefs) {
    await prisma.duesPayment.create({
      data: {
        duesPlanId: duesPlanId.get(planKey)!,
        memberId: memberId.get(memKey),
        periodStart: new Date(periodStart),
        periodEnd: periodEnd(periodStart),
        amount,
        paidOn: new Date(periodStart),
        status: "PAID",
      },
    });
  }

  await prisma.depositBatch.create({
    data: {
      depositCode: "2026-014",
      accountId: accountId.get("acct-boa"),
      status: "DEPOSITED",
      expectedTotal: 1700,
      depositedOn: new Date("2026-06-07"),
      items: {
        create: [
          { method: "CASH", amount: 500, description: "Friday cash collection" },
          { method: "CHECK", amount: 1200, description: "2 checks" },
        ],
      },
    },
  });
  await prisma.depositBatch.create({
    data: {
      depositCode: "2026-015",
      accountId: accountId.get("acct-boa"),
      status: "PENDING_BANK_DEPOSIT",
      expectedTotal: 845,
      items: {
        create: [
          { method: "CASH", amount: 345, description: "Jumu'ah cash" },
          { method: "ZELLE", amount: 500, description: "Eid screenshots" },
        ],
      },
    },
  });

  const pastoralNoteDefs = [
    ["m5", "VISIT", "Hospital visit", "Visited Omar after his surgery. Family requested continued prayers.", "2026-06-02"],
    ["m4", "COUNSELING", "Pre-membership counseling", "Met with Mariam to discuss community involvement before her membership is finalized.", "2026-05-28"],
  ] as const;
  for (const [memKey, kind, title, body, occurredOn] of pastoralNoteDefs) {
    await prisma.pastoralNote.create({
      data: { memberId: memberId.get(memKey), authorId: actor.id, kind, title, body, occurredOn: new Date(occurredOn) },
    });
  }

  console.log("✓ Seeded demo dataset: 6 members, 3 donations, 4 dues plans, 7 ledger entries, 2 deposit batches, 2 pastoral notes.");
}

async function main() {
  await seedReferenceData();
  const accountId = await seedAccounts();
  await seedDemoData(accountId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
