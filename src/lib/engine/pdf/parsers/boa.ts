// Bank of America statement parser.
//
// Layout (see "Sample data/boa.pdf"):
//   Deposits and other credits
//   Date       Description                                    Amount
//   01/02/26   Zelle payment from ... for "Bloom"; Conf# ...   850.00
//   ...
//   Total deposits and other credits    $28,429.55
//
//   Withdrawals and other debits
//   ...same shape, amounts are outflows...
//   Card account # XXXX XXXX XXXX 5630        <- sub-header, not a row
//   01/09/26   CHECKCARD ...                  -1,046.00
//   Total withdrawals and other debits  -$20,274.35
//
//   Checks
//   Date     Check #   Amount    Date     Check #   Amount
//   01/09/26 3950       -5,500.00 01/12/26 3953*     -250.00
//   Total checks   -$5,750.00
//
// Descriptions routinely wrap across 2-3 lines before the amount appears
// (often the amount lands on its own line) — groupByLeadingDate absorbs
// every continuation line into the same block, and lastAmount() pulls the
// trailing dollar figure out of the whole block regardless of which line
// it's actually on.

import type { PdfTxnRow } from "../types";
import { groupByLeadingDate, lastAmount, sliceSection } from "../section";

const DATE_AT_START = /^\d{2}\/\d{2}\/\d{2}\b/;

export function isBoaStatement(text: string): boolean {
  return /bank of america/i.test(text) && /deposits and other credits/i.test(text);
}

function parseRows(lines: string[], sign: 1 | -1): PdfTxnRow[] {
  const entries = groupByLeadingDate(lines, DATE_AT_START);
  const rows: PdfTxnRow[] = [];
  for (const { dateToken, block } of entries) {
    const amount = lastAmount(block);
    if (!amount) continue;
    const description = block
      .slice(dateToken.length)
      .replace(amount.raw, "")
      .replace(/\s+/g, " ")
      .trim();
    rows.push({ date: dateToken, description, amount: sign * amount.value });
  }
  return rows;
}

function parseChecks(lines: string[]): PdfTxnRow[] {
  const joined = lines.join(" ");
  const re = /(\d{2}\/\d{2}\/\d{2})\s+(\S+)\s+(-?[\d,]+\.\d{2})/g;
  const rows: PdfTxnRow[] = [];
  for (const m of joined.matchAll(re)) {
    const [, date, checkNo, amountRaw] = m;
    const amount = Number(amountRaw.replace(/,/g, ""));
    if (!Number.isFinite(amount)) continue;
    rows.push({ date, description: `Check #${checkNo.replace(/\*$/, "")}`, amount: -Math.abs(amount) });
  }
  return rows;
}

export function parseBoaStatement(text: string): PdfTxnRow[] {
  const lines = text.split("\n");

  const deposits = sliceSection(
    lines,
    /^Deposits and other credits$/i,
    /^Total deposits and other credits/i,
  );
  const withdrawals = sliceSection(
    lines,
    /^Withdrawals and other debits$/i,
    /^Total withdrawals and other debits/i,
  );
  const checks = sliceSection(lines, /^Checks$/i, /^Total checks/i);

  return [
    ...parseRows(deposits, 1),
    ...parseRows(withdrawals, -1),
    ...parseChecks(checks),
  ];
}
