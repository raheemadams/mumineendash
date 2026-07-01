// Normalization: raw rows + a field mapping -> standardized ledger rows.
// This is the step that enforces "the database is the source of truth":
// after this, nothing downstream ever looks at the original statement shape.

import { parseAmount, parseDate, round2 } from "./money";
import { dedupeHash } from "./dedupe";
import type {
  Direction,
  MappingConfig,
  NormalizeResult,
  NormalizedTxn,
  RawRow,
} from "./types";

function val(row: RawRow, key: string | undefined): string {
  if (!key) return "";
  // tolerate header whitespace differences
  if (row[key] !== undefined) return row[key];
  const found = Object.keys(row).find((k) => k.trim() === key.trim());
  return found ? row[found] : "";
}

/** Resolve amount + direction from either a single signed column or debit/credit. */
function resolveAmount(
  row: RawRow,
  cfg: MappingConfig,
): { amount: number; direction: Direction } | null {
  const { fieldMap, amountStyle } = cfg;

  if (amountStyle === "debit_credit") {
    const debit = parseAmount(val(row, fieldMap.debit));
    const credit = parseAmount(val(row, fieldMap.credit));
    const d = Math.abs(debit ?? 0);
    const c = Math.abs(credit ?? 0);
    if (d === 0 && c === 0) return null;
    if (c >= d) return { amount: round2(c), direction: "INFLOW" };
    return { amount: round2(d), direction: "OUTFLOW" };
  }

  const signed = parseAmount(val(row, fieldMap.amount));
  if (signed === null) return null;
  if (signed === 0) return { amount: 0, direction: "INFLOW" };
  return {
    amount: round2(Math.abs(signed)),
    direction: signed >= 0 ? "INFLOW" : "OUTFLOW",
  };
}

export function normalizeRow(
  row: RawRow,
  rawRowIndex: number,
  cfg: MappingConfig,
): NormalizedTxn | { error: string } {
  const date = parseDate(val(row, cfg.fieldMap.date), cfg.dateFormat);
  if (!date) return { error: `Unparseable date: "${val(row, cfg.fieldMap.date)}"` };

  const resolved = resolveAmount(row, cfg);
  if (!resolved) return { error: "Row has no parseable amount" };

  const description = val(row, cfg.fieldMap.description).trim() || null;
  const memo = val(row, cfg.fieldMap.memo).trim() || null;
  const referenceNumber = val(row, cfg.fieldMap.reference).trim() || null;

  const { amount, direction } = resolved;
  const deposit = direction === "INFLOW" ? amount : null;
  const withdrawal = direction === "OUTFLOW" ? amount : null;

  const txn: NormalizedTxn = {
    accountId: cfg.accountId,
    rawRowIndex,
    date,
    amount,
    direction,
    deposit,
    withdrawal,
    description,
    memo,
    referenceNumber,
    dedupeHash: "",
  };
  txn.dedupeHash = dedupeHash(txn);
  return txn;
}

export function normalizeRows(rows: RawRow[], cfg: MappingConfig): NormalizeResult {
  const out: NormalizeResult = { rows: [], errors: [] };
  rows.forEach((row, i) => {
    const result = normalizeRow(row, i, cfg);
    if ("error" in result) {
      out.errors.push({ rawRowIndex: i, message: result.error, raw: row });
    } else {
      out.rows.push(result);
    }
  });
  return out;
}
