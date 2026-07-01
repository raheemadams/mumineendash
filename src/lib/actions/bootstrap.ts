"use server";

// Loads every data array the store needs, in parallel. Called once on
// mount and again after every mutation — at this data scale a full refetch
// is simpler and just as fast as hand-merging partial updates, and it keeps
// every action's implementation trivial to reason about.

import { listMembers, listFamilies } from "@/lib/db/members";
import { listAccounts } from "@/lib/db/accounts";
import { listCategories, listDonations, listCampaigns, listEvents } from "@/lib/db/donations";
import { listDuesPlans, listDuesPayments } from "@/lib/db/dues";
import { listTransactions } from "@/lib/db/transactions";
import { listDeposits } from "@/lib/db/deposits";
import { listPastoralNotes } from "@/lib/db/pastoral";
import { listAuditLog } from "@/lib/db/audit";
import type { AppState } from "@/lib/store/types";

export type BootstrapState = Omit<AppState, "currentRole" | "readNotificationIds">;

export async function loadAppState(): Promise<BootstrapState> {
  const [
    members,
    families,
    accounts,
    categories,
    donations,
    campaigns,
    events,
    duesPlans,
    duesPayments,
    ledger,
    deposits,
    pastoralNotes,
    audit,
  ] = await Promise.all([
    listMembers(),
    listFamilies(),
    listAccounts(),
    listCategories(),
    listDonations(),
    listCampaigns(),
    listEvents(),
    listDuesPlans(),
    listDuesPayments(),
    listTransactions(),
    listDeposits(),
    listPastoralNotes(),
    listAuditLog(),
  ]);

  return {
    members,
    families,
    accounts,
    categories,
    donations,
    campaigns,
    events,
    duesPlans,
    duesPayments,
    ledger,
    deposits,
    pastoralNotes,
    audit,
  };
}
