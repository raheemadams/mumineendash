// Domain types for the in-memory store. Dates are ISO strings so the whole
// state serializes cleanly to localStorage. At the boundaries where the pure
// engine wants `Date`, callers convert with `new Date(iso)`.
//
// This file is the contract the UI codes against. When Supabase is added, the
// Prisma models map 1:1 onto these shapes — only the store implementation
// changes, not a single page.

export type ISO = string;

export type Direction = "INFLOW" | "OUTFLOW" | "TRANSFER";
export type TxnSource = "IMPORT" | "MANUAL" | "DONATION" | "DUES" | "DEPOSIT" | "SYSTEM";
export type ReconStatus = "UNRECONCILED" | "PENDING" | "RECONCILED" | "EXCLUDED";

export type PaymentMethod =
  | "CASH"
  | "CHECK"
  | "BANK_TRANSFER"
  | "PAYPAL"
  | "ZELLE"
  | "ACH"
  | "WIRE"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "SQUARE"
  | "STRIPE"
  | "OTHER";

export type MemberStatus = "ACTIVE" | "INACTIVE" | "PENDING" | "SUSPENDED" | "DECEASED" | "MOVED_AWAY";
export type DuesFrequency = "MONTHLY" | "QUARTERLY" | "YEARLY" | "CUSTOM";
export type DuesStatus = "PAID" | "UPCOMING" | "PAST_DUE" | "GRACE_PERIOD" | "SUSPENDED";

/** Viewing role — drives which dashboard renders and what's visible. */
export type Role = "PRESIDENT" | "TREASURER" | "ADMINISTRATOR" | "IMAM";

/** Donation attribution fan-out — one donation can hit several targets at once. */
export type AttributionType = "MEMBER" | "FAMILY" | "CAMPAIGN" | "EVENT";

export interface Attribution {
  type: AttributionType;
  targetId: string;
}

export type PastoralKind =
  | "VISIT"
  | "FUNERAL"
  | "MARRIAGE"
  | "SHAHADA"
  | "COUNSELING"
  | "PRAYER_REQUEST"
  | "VOLUNTEER_REQUEST";

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: string;
  mask: string;
  openingBalance: number;
}

export interface Family {
  id: string;
  familyName: string;
}

export interface Member {
  id: string;
  memberCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  status: MemberStatus;
  type: string;
  joined: ISO;
  familyId: string | null;
  family: string;
  notes?: string;
}

export interface Txn {
  id: string;
  accountId: string;
  date: ISO;
  amount: number; // always positive
  direction: Direction;
  description: string | null;
  memo: string | null;
  referenceNumber: string | null;
  category: string | null;
  paymentMethod: PaymentMethod | null;
  source: TxnSource;
  reconStatus: ReconStatus;
  dedupeHash: string | null;
  memberId: string | null;
  depositBatchId: string | null;
}

export interface DonationCategory {
  id: string;
  key: string;
  name: string;
  taxDeductible: boolean;
  sortOrder: number;
}

export interface Donation {
  id: string;
  categoryId: string;
  amount: number;
  donatedOn: ISO;
  method: PaymentMethod;
  isAnonymous: boolean;
  memberId: string | null;
  campaignId: string | null;
  note: string;
  transactionId: string | null;
  /** Fan-out: the same donation can also be attributed to a family and/or event. */
  attributions: Attribution[];
}

export interface Campaign {
  id: string;
  name: string;
  goalAmount: number;
}

export interface MosqueEvent {
  id: string;
  name: string;
  startsOn: ISO;
  location: string;
}

export interface PastoralNote {
  id: string;
  memberId: string;
  authorId: string;
  kind: PastoralKind;
  title: string;
  body: string;
  occurredOn: ISO;
  isPrivate: boolean;
  createdAt: ISO;
}

export interface DuesPlan {
  id: string;
  memberId: string;
  frequency: DuesFrequency;
  amount: number;
  startDate: ISO;
  graceDays: number;
  active: boolean;
}

export interface DuesPayment {
  id: string;
  planId: string;
  memberId: string;
  periodStart: ISO;
  periodEnd: ISO;
  amount: number;
  paidOn: ISO;
  method: PaymentMethod;
  transactionId: string | null;
}

export interface DepositItem {
  method: PaymentMethod;
  amount: number;
  description: string;
  memberId?: string | null;
}

export interface Deposit {
  id: string;
  code: string;
  status: "PENDING_BANK_DEPOSIT" | "DEPOSITED" | "RECONCILED";
  expectedTotal: number;
  depositedOn: ISO | null;
  accountId: string;
  items: DepositItem[];
  reconciledTxnId: string | null;
}

export interface AuditEntry {
  id: string;
  at: ISO;
  actor: string;
  action: string; // create | update | reconcile | import | delete
  entityType: string;
  entityId: string;
  summary: string;
}

export interface AppState {
  currentRole: Role;
  members: Member[];
  families: Family[];
  accounts: Account[];
  categories: DonationCategory[];
  donations: Donation[];
  campaigns: Campaign[];
  events: MosqueEvent[];
  duesPlans: DuesPlan[];
  duesPayments: DuesPayment[];
  ledger: Txn[];
  deposits: Deposit[];
  pastoralNotes: PastoralNote[];
  audit: AuditEntry[];
  /** notification ids the user has dismissed/read — notifications themselves are derived live */
  readNotificationIds: string[];
}
