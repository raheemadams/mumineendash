// PayPal "Account Activity" statement parser.
//
// Layout (see "Sample data/paypal.pdf"):
//   DATE       DESCRIPTION                          CURRENCY  AMOUNT  FEES   TOTAL*
//   01/18/2026 Subscription Payment: tawakalitu oyedemi
//              ID: 4S544630YV312535X
//                                                    USD       100.00  -2.48  97.52
//
// The description/ID text and the currency/amount/fees/total figures don't
// always land on the same extracted line (the ID is a smaller sub-line under
// the description). Rather than assume an exact line count per entry, this
// groups by leading date and closes the block once the amount/fees/total
// row appears — the same resilient strategy as the Bank of America parser —
// then strips the known column tokens out of the merged text to recover a
// clean description. TOTAL (not AMOUNT) is used as the ledger amount since
// it's the actual net cash movement after fees.

import type { PdfTxnRow } from "../types";
import { groupByLeadingDate } from "../section";

const DATE_AT_START = /^\d{2}\/\d{2}\/\d{4}\b/;
// Amount  Fees  Total — three currency figures trailing the row, the last
// (possibly negative) pair separated by whitespace.
const TRAILING_FIGURES = /(USD\s+)?(-?[\d,]+\.\d{2}\s*){2,3}$/;

const OUTFLOW_HINTS = /(payment sent|withdrawal|sent to|refund sent|payment to\b)/i;

export function isPaypalStatement(text: string): boolean {
  return /paypal/i.test(text) && /account activity/i.test(text);
}

export function parsePaypalStatement(text: string): PdfTxnRow[] {
  const lines = text.split("\n");
  const startIdx = lines.findIndex((l) => /^DATE\s+DESCRIPTION/i.test(l.trim()));
  const section = startIdx === -1 ? lines : lines.slice(startIdx + 1);

  const entries = groupByLeadingDate(section, DATE_AT_START);
  const rows: PdfTxnRow[] = [];

  for (const { dateToken, block } of entries) {
    const figures = [...block.matchAll(/-?[\d,]+\.\d{2}/g)];
    if (figures.length === 0) continue;
    const total = Number(figures[figures.length - 1][0].replace(/,/g, ""));
    if (!Number.isFinite(total)) continue;

    const description = block
      .slice(dateToken.length)
      .replace(/\bID:\s*\S+/gi, "")
      .replace(/\bUSD\b/gi, "")
      .replace(TRAILING_FIGURES, "")
      .replace(/\s+/g, " ")
      .trim();

    const sign = OUTFLOW_HINTS.test(description) ? -1 : 1;
    rows.push({ date: dateToken, description: description || "PayPal transaction", amount: sign * Math.abs(total) });
  }

  return rows;
}
