// Ledger categories — the "purpose of the money" picked per transaction on the
// Ledger page. Income purposes apply to inflows, expense purposes to outflows;
// "Others" is available to either. These feed the Reports income/expense
// breakdowns directly (Transaction.category is grouped there).

export const INCOME_CATEGORIES = [
  "General Donation",
  "Jumah Donation",
  "Membership Dues",
  "Ramadan",
  "Sadaqa",
  "Zakat",
] as const;

export const EXPENSE_CATEGORIES = [
  "Administrative Expenses",
  "Bank Charges",
  "BLOOM Expense",
  "Fiqh / Halaqa Expense",
  "Hall Rental",
  "Maintenance Expense",
  "Mumineen HUB Expense",
  "Ramadan Expense",
  "Supplies",
  "Technology Expense",
  "Utilities",
  "Lawncare",
] as const;

export const OTHER_CATEGORY = "Others";

export type CategoryKind = "INCOME" | "EXPENSE" | "BOTH";

/** Seed defaults — the starting purpose list. Editable afterward via the
 *  Categories admin page (stored in the LedgerCategory table). */
export const DEFAULT_LEDGER_CATEGORIES: { name: string; kind: CategoryKind }[] = [
  ...INCOME_CATEGORIES.map((name) => ({ name, kind: "INCOME" as const })),
  ...EXPENSE_CATEGORIES.map((name) => ({ name, kind: "EXPENSE" as const })),
  { name: OTHER_CATEGORY, kind: "BOTH" as const },
];

/** All valid category values (used to validate saves and build filters). */
export const ALL_CATEGORIES: string[] = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
  OTHER_CATEGORY,
];

/** The purposes offered for a given ledger direction. */
export function categoriesForDirection(direction: string): string[] {
  if (direction === "OUTFLOW") return [...EXPENSE_CATEGORIES, OTHER_CATEGORY];
  if (direction === "INFLOW") return [...INCOME_CATEGORIES, OTHER_CATEGORY];
  return ALL_CATEGORIES;
}
