import type { AppState } from "./types";

// Initial demo dataset. Rich enough to exercise every screen: members with
// dues plans in different states, donations already posted to the ledger,
// imported bank lines, and cash deposits awaiting reconciliation.

export function seedState(): AppState {
  return {
    currentRole: "TREASURER",
    readNotificationIds: [],

    families: [
      { id: "f1", familyName: "Ali" },
      { id: "f2", familyName: "Khan" },
      { id: "f3", familyName: "Adams" },
      { id: "f4", familyName: "Hassan" },
      { id: "f5", familyName: "Siddiqui" },
    ],

    accounts: [
      { id: "acct-boa", name: "Bank of America — Operating", institution: "Bank of America", type: "CHECKING", mask: "4821", openingBalance: 80000 },
      { id: "acct-bot", name: "Bank of Texas — Building Fund", institution: "Bank of Texas", type: "SAVINGS", mask: "9930", openingBalance: 150000 },
      { id: "acct-paypal", name: "PayPal", institution: "PayPal", type: "PAYPAL", mask: "0000", openingBalance: 2600 },
      { id: "acct-cash", name: "Cash Box", institution: "On-site", type: "CASH_BOX", mask: "0000", openingBalance: 0 },
    ],

    members: [
      m("m1", "MUM-0001", "Ahmed", "Ali", "ACTIVE", "FAMILY", "2019-03-12", "f1", "Ali"),
      m("m2", "MUM-0002", "Fatima", "Khan", "ACTIVE", "REGULAR", "2020-07-01", "f2", "Khan"),
      m("m3", "MUM-0003", "Yusuf", "Adams", "ACTIVE", "LIFETIME", "2015-01-20", "f3", "Adams"),
      m("m4", "MUM-0004", "Mariam", "Hassan", "PENDING", "STUDENT", "2026-05-30", "f4", "Hassan"),
      m("m5", "MUM-0005", "Omar", "Siddiqui", "INACTIVE", "REGULAR", "2018-11-08", "f5", "Siddiqui"),
      m("m6", "MUM-0006", "Layla", "Ali", "ACTIVE", "FAMILY", "2019-03-12", "f1", "Ali"),
    ],

    categories: [
      cat("c1", "general", "General Donation", 0),
      cat("c2", "zakat", "Zakat", 1),
      cat("c3", "sadaqah", "Sadaqah", 2),
      cat("c4", "building_fund", "Building Fund", 3),
      cat("c5", "ramadan", "Ramadan", 4),
      cat("c6", "school", "School", 5),
      cat("c7", "youth", "Youth Program", 6),
      cat("c8", "funeral", "Funeral", 7),
    ],

    campaigns: [
      { id: "camp1", name: "New Wing Building Appeal", goalAmount: 250000 },
      { id: "camp2", name: "Ramadan 2026 Iftar Fund", goalAmount: 40000 },
    ],

    events: [
      { id: "ev1", name: "Eid Bazaar", startsOn: "2026-06-14", location: "Main Hall" },
      { id: "ev2", name: "Friday Jumu'ah Khutbah", startsOn: "2026-07-03", location: "Main Hall" },
      { id: "ev3", name: "Youth Iftar Night", startsOn: "2026-07-10", location: "Community Center" },
    ],

    donations: [
      // Fan-out example: one gift attributed to a member, their family, AND a campaign at once.
      don("dn1", "c4", 500, "2026-06-04", "PAYPAL", "m3", "camp1", "t4", [
        { type: "FAMILY", targetId: "f3" },
      ]),
      don("dn2", "c2", 250, "2026-05-30", "ZELLE", "m2", null, "t7", []),
      don("dn3", "c1", 150, "2026-06-07", "ZELLE", "m1", null, "t2", [
        { type: "FAMILY", targetId: "f1" },
        { type: "EVENT", targetId: "ev1" },
      ]),
    ],

    duesPlans: [
      { id: "dp1", memberId: "m1", frequency: "MONTHLY", amount: 50, startDate: "2026-01-01", graceDays: 15, active: true },
      { id: "dp2", memberId: "m2", frequency: "MONTHLY", amount: 50, startDate: "2026-01-01", graceDays: 15, active: true },
      { id: "dp3", memberId: "m5", frequency: "MONTHLY", amount: 50, startDate: "2025-01-01", graceDays: 15, active: true },
      { id: "dp4", memberId: "m3", frequency: "YEARLY", amount: 600, startDate: "2026-01-01", graceDays: 30, active: true },
    ],

    duesPayments: [
      pay("p1", "dp1", "m1", "2026-01-01", 50, "t-seed1"),
      pay("p2", "dp1", "m1", "2026-02-01", 50, null),
      pay("p3", "dp1", "m1", "2026-03-01", 50, null),
      pay("p4", "dp1", "m1", "2026-04-01", 50, null),
      pay("p5", "dp1", "m1", "2026-05-01", 50, null),
      pay("p6", "dp1", "m1", "2026-06-01", 50, null),
      pay("p7", "dp2", "m2", "2026-01-01", 50, null),
      pay("p8", "dp2", "m2", "2026-02-01", 50, null),
      pay("p9", "dp2", "m2", "2026-03-01", 50, null),
      pay("p10", "dp2", "m2", "2026-04-01", 50, null),
      pay("p11", "dp4", "m3", "2026-01-01", 600, null),
      // m5 (Omar) has paid nothing on a 2025 plan → deeply past due
    ],

    ledger: [
      txn("t1", "acct-boa", "2026-06-09", 1700, "INFLOW", "BRANCH DEPOSIT FRIDAY COLLECTION", null, "general", "DEPOSIT"),
      txn("t2", "acct-boa", "2026-06-07", 150, "INFLOW", "ZELLE FROM AHMED ALI", "ZL88231", "general", "DONATION"),
      txn("t3", "acct-boa", "2026-06-05", 1200, "OUTFLOW", "CHECK 1041 RENT", "1041", "rent", "IMPORT"),
      txn("t4", "acct-paypal", "2026-06-04", 500, "INFLOW", "PAYPAL DONATION BUILDING FUND", "PP-77ac", "building_fund", "DONATION"),
      txn("t5", "acct-boa", "2026-06-03", 89.5, "OUTFLOW", "UTILITY ACH ELECTRIC CO", null, "utilities", "IMPORT"),
      txn("t6", "acct-bot", "2026-06-01", 5000, "INFLOW", "WIRE BUILDING FUND APPEAL", "WR-2201", "building_fund", "IMPORT"),
      txn("t7", "acct-boa", "2026-05-30", 250, "INFLOW", "ZELLE FROM FATIMA KHAN ZAKAT", "ZL88102", "zakat", "DONATION"),
    ],

    deposits: [
      {
        id: "d1",
        code: "2026-014",
        status: "DEPOSITED",
        expectedTotal: 1700,
        depositedOn: "2026-06-07",
        accountId: "acct-boa",
        reconciledTxnId: null,
        items: [
          { method: "CASH", amount: 500, description: "Friday cash collection" },
          { method: "CHECK", amount: 1200, description: "2 checks" },
        ],
      },
      {
        id: "d2",
        code: "2026-015",
        status: "PENDING_BANK_DEPOSIT",
        expectedTotal: 845,
        depositedOn: null,
        accountId: "acct-boa",
        reconciledTxnId: null,
        items: [
          { method: "CASH", amount: 345, description: "Jumu'ah cash" },
          { method: "ZELLE", amount: 500, description: "Eid screenshots" },
        ],
      },
    ],

    pastoralNotes: [
      {
        id: "pn1",
        memberId: "m5",
        authorId: "imam1",
        kind: "VISIT",
        title: "Hospital visit",
        body: "Visited Omar after his surgery. Family requested continued prayers.",
        occurredOn: "2026-06-02",
        isPrivate: true,
        createdAt: "2026-06-02T18:00:00.000Z",
      },
      {
        id: "pn2",
        memberId: "m4",
        authorId: "imam1",
        kind: "COUNSELING",
        title: "Pre-membership counseling",
        body: "Met with Mariam to discuss community involvement before her membership is finalized.",
        occurredOn: "2026-05-28",
        isPrivate: true,
        createdAt: "2026-05-28T15:00:00.000Z",
      },
    ],

    audit: [
      {
        id: "a1",
        at: "2026-06-09T16:30:00.000Z",
        actor: "Raheem Adams",
        action: "import",
        entityType: "ImportBatch",
        entityId: "ib-001",
        summary: "Imported 12 rows from Bank of America statement",
      },
    ],
  };
}

function m(
  id: string, memberCode: string, firstName: string, lastName: string,
  status: any, type: string, joined: string, familyId: string, family: string,
) {
  return {
    id, memberCode, firstName, lastName,
    fullName: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
    phone: "(555) 010-0000",
    status, type, joined, familyId, family,
  };
}

function cat(id: string, key: string, name: string, sortOrder: number) {
  return { id, key, name, taxDeductible: true, sortOrder };
}

function don(
  id: string, categoryId: string, amount: number, donatedOn: string,
  method: any, memberId: string | null, campaignId: string | null, transactionId: string | null,
  attributions: { type: any; targetId: string }[] = [],
) {
  return { id, categoryId, amount, donatedOn, method, isAnonymous: false, memberId, campaignId, note: "", transactionId, attributions };
}

function pay(id: string, planId: string, memberId: string, periodStart: string, amount: number, transactionId: string | null) {
  const end = new Date(periodStart);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { id, planId, memberId, periodStart, periodEnd: end.toISOString().slice(0, 10), amount, paidOn: periodStart, method: "CASH" as const, transactionId };
}

function txn(
  id: string, accountId: string, date: string, amount: number,
  direction: any, description: string, referenceNumber: string | null,
  category: string, source: any,
) {
  return {
    id, accountId, date, amount, direction, description,
    memo: null, referenceNumber, category,
    paymentMethod: null, source, reconStatus: "UNRECONCILED" as const,
    dedupeHash: null, memberId: null, depositBatchId: null,
  };
}
