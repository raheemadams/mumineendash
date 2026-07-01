// ════════════════════════════════════════════════════════════════════════
// Import / normalization engine — shared types.
//
// These types describe the pipeline that turns a raw bank statement into
// standardized internal ledger rows. None of this touches the database; it
// is pure data so it can be unit-tested in isolation and reused on the
// server, in a worker, or in a preview UI.
// ════════════════════════════════════════════════════════════════════════

export type RawRow = Record<string, string>;

/** Where money sits relative to the mosque. */
export type Direction = "INFLOW" | "OUTFLOW" | "TRANSFER";

/** Whether amounts live in one signed column or split debit/credit columns. */
export type AmountStyle = "single" | "debit_credit";

/** Internal field -> source column header. Saved once per account/source. */
export interface FieldMap {
  date: string;
  description?: string;
  /** signed amount column (used when amountStyle === "single") */
  amount?: string;
  /** money out / withdrawal column (amountStyle === "debit_credit") */
  debit?: string;
  /** money in / deposit column (amountStyle === "debit_credit") */
  credit?: string;
  reference?: string;
  memo?: string;
}

export interface MappingConfig {
  fieldMap: FieldMap;
  amountStyle: AmountStyle;
  /** e.g. "MM/DD/YYYY". When omitted the parser auto-detects common formats. */
  dateFormat?: string;
  /** accountId the rows belong to — flows through to the ledger. */
  accountId: string;
}

/** A normalized ledger row, ready to persist as a Transaction. */
export interface NormalizedTxn {
  accountId: string;
  rawRowIndex: number;
  date: Date;
  amount: number; // always positive
  direction: Direction;
  deposit: number | null;
  withdrawal: number | null;
  description: string | null;
  memo: string | null;
  referenceNumber: string | null;
  dedupeHash: string;
}

export interface NormalizeError {
  rawRowIndex: number;
  message: string;
  raw: RawRow;
}

export interface NormalizeResult {
  rows: NormalizedTxn[];
  errors: NormalizeError[];
}

/** An existing ledger row, as far as dedupe/reconcile care. */
export interface LedgerTxn {
  id: string;
  accountId: string;
  date: Date;
  amount: number;
  direction: Direction;
  description: string | null;
  referenceNumber: string | null;
  dedupeHash: string | null;
}

export interface DuplicateVerdict {
  candidate: NormalizedTxn;
  matchId: string | null;
  score: number; // 0..1
  isDuplicate: boolean; // score >= auto threshold
  reasons: string[];
}
