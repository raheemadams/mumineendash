import { prisma } from "@/lib/prisma";
import { num, isoDate } from "./mappers";
import { createLedgerEntry } from "./transactions";
import type { Attribution, Campaign, Donation, DonationCategory, MosqueEvent } from "@/lib/store/types";
import type { Prisma } from "@prisma/client";

function toDonation(row: Prisma.DonationGetPayload<object>): Donation {
  const attributions: Attribution[] = [];
  if (row.familyId) attributions.push({ type: "FAMILY", targetId: row.familyId });
  if (row.eventId) attributions.push({ type: "EVENT", targetId: row.eventId });

  return {
    id: row.id,
    categoryId: row.categoryId,
    amount: num(row.amount),
    donatedOn: isoDate(row.donatedOn),
    method: row.method,
    isAnonymous: row.isAnonymous,
    memberId: row.memberId,
    campaignId: row.campaignId,
    note: row.note ?? "",
    transactionId: row.transactionId,
    attributions,
  };
}

export async function listDonations(): Promise<Donation[]> {
  const rows = await prisma.donation.findMany({ orderBy: { donatedOn: "desc" } });
  return rows.map(toDonation);
}

export async function listCategories(): Promise<DonationCategory[]> {
  const rows = await prisma.donationCategory.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((c) => ({ id: c.id, key: c.key, name: c.name, taxDeductible: c.isTaxDeductible, sortOrder: c.sortOrder }));
}

export async function listCampaigns(): Promise<Campaign[]> {
  const rows = await prisma.campaign.findMany({ orderBy: { name: "asc" } });
  return rows.map((c) => ({ id: c.id, name: c.name, goalAmount: num(c.goalAmount) }));
}

export async function listEvents(): Promise<MosqueEvent[]> {
  const rows = await prisma.event.findMany({ orderBy: { startsAt: "asc" } });
  return rows.map((e) => ({ id: e.id, name: e.name, startsOn: isoDate(e.startsAt), location: e.location ?? "" }));
}

export interface NewDonationInput {
  categoryId: string;
  amount: number;
  method: string;
  memberId: string | null;
  campaignId: string | null;
  familyId: string | null;
  eventId: string | null;
  accountId: string;
  donatedOn: string;
  note: string;
  isAnonymous: boolean;
}

export async function createDonation(
  data: NewDonationInput,
): Promise<{ donation: Donation; categoryName: string }> {
  const category = await prisma.donationCategory.findUnique({ where: { id: data.categoryId } });
  const member = data.memberId ? await prisma.member.findUnique({ where: { id: data.memberId } }) : null;

  const description = `${category?.name ?? "Donation"}${
    data.isAnonymous ? " (anonymous)" : member ? ` — ${member.fullName}` : ""
  }`;

  const txnId = await createLedgerEntry({
    accountId: data.accountId,
    date: data.donatedOn,
    amount: data.amount,
    direction: "INFLOW",
    description,
    memo: data.note || null,
    category: category?.key ?? null,
    paymentMethod: data.method,
    source: "DONATION",
    memberId: data.isAnonymous ? null : data.memberId,
  });

  const row = await prisma.donation.create({
    data: {
      categoryId: data.categoryId,
      amount: data.amount,
      donatedOn: new Date(data.donatedOn),
      method: data.method as any,
      isAnonymous: data.isAnonymous,
      memberId: data.isAnonymous ? null : data.memberId,
      familyId: data.familyId,
      campaignId: data.campaignId,
      eventId: data.eventId,
      note: data.note,
      transactionId: txnId,
    },
  });

  return { donation: toDonation(row), categoryName: category?.name ?? "Donation" };
}
