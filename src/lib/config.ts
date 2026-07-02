// Organization-wide defaults.

import type { DuesFrequency } from "@/lib/store/types";

/**
 * Standard membership dues: $20 per month. This is the default cadence/amount
 * a new member's dues plan is created with, and what the Dues page shows as the
 * baseline membership fee.
 */
export const DEFAULT_MEMBERSHIP_DUES: {
  amount: number;
  frequency: DuesFrequency;
  graceDays: number;
} = {
  amount: 20,
  frequency: "MONTHLY",
  graceDays: 15,
};
