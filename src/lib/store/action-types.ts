// Input shapes for store mutations — shared between the client provider and
// the server actions it calls, so both sides agree on the contract.
import type { Member, PastoralKind, PaymentMethod } from "./types";

export interface NewMember {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  type: string;
  status: Member["status"];
  family: string;
}

export interface NewDonation {
  categoryId: string;
  amount: number;
  method: PaymentMethod;
  memberId: string | null;
  campaignId: string | null;
  /** fan-out: also attribute this same gift to a family and/or an event */
  familyId: string | null;
  eventId: string | null;
  accountId: string;
  donatedOn: string;
  note: string;
  isAnonymous: boolean;
}

export interface NewDeposit {
  accountId: string;
  items: { method: PaymentMethod; amount: number; description: string }[];
}

export interface NewPastoralNote {
  memberId: string;
  kind: PastoralKind;
  title: string;
  body: string;
  occurredOn: string;
  isPrivate: boolean;
}
