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

/**
 * A shared broadcast address used as a placeholder on many imported members.
 * It's not an individual inbox, so outreach emails skip it (and blank emails).
 */
export const PLACEHOLDER_EMAIL = "mumineenbroadcast@gmail.com";

/** Online payment / donation page (MohID) linked from the outreach "Pay" button. */
export const PAYMENT_URL =
  "https://us.mohid.co/tx/houston/masjidulmumineenhous/masjid/online/donation";

/** Label shown on the payment button in outreach emails. */
export const PAYMENT_BUTTON_LABEL = "Pay / Renew Membership";

/** True when the address looks like a real, individually-deliverable email. */
export function isDeliverableEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  return e.length > 0 && e !== PLACEHOLDER_EMAIL && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
}
