// Bank of Texas statement parser.
//
// Layout (see "Sample data/bot.pdf"):
//   DEPOSITS
//   Date                                            Amount
//   01-02 NMA OPERATING ACH PAY -SETT-0014DBIQ       2,070.00
//   ...
//   WITHDRAWALS
//   Date                                            Amount
//   01-02 RETURN SETTLE RETURN                       25.00
//   ...
//   CHECKS (* Indicates a break in check number sequence)
//   (RTND Indicates a RETURNED CHECK)
//   *** No Checks *** | <table of Date Check# Amount>
//
// Every entry is a single line — no wrapped descriptions here. The one
// wrinkle is that dates are "MM-DD" with no year, so the year is inferred
// from the statement period printed in the header ("Statement Period:
// 01-01-26 to 01-31-26").

import type { PdfTxnRow } from "../types";
import { lastAmount, sliceSection } from "../section";

const DATE_AT_START = /^(\d{2})-(\d{2})\b/;

export function isBotStatement(text: string): boolean {
  return /bank of texas/i.test(text) && /(DEPOSITS|WITHDRAWALS)/.test(text);
}

function inferYears(text: string): { month: number; year: number }[] {
  const m = text.match(/Statement Period:?\s*(?:from\s*)?(\d{2})-(\d{2})-(\d{2})\s*(?:to|through)\s*(\d{2})-(\d{2})-(\d{2})/i);
  if (!m) {
    const now = new Date();
    return [{ month: now.getMonth() + 1, year: now.getFullYear() }];
  }
  const [, sm, , sy, em, , ey] = m;
  return [
    { month: Number(sm), year: 2000 + Number(sy) },
    { month: Number(em), year: 2000 + Number(ey) },
  ];
}

function resolveYear(month: number, anchors: { month: number; year: number }[]): number {
  const match = anchors.find((a) => a.month === month);
  return (match ?? anchors[anchors.length - 1]).year;
}

const HEADER_LINE = /^Date\s+Amount$/i;

function parseRows(lines: string[], sign: 1 | -1, anchors: { month: number; year: number }[]): PdfTxnRow[] {
  const rows: PdfTxnRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const m = line.match(DATE_AT_START);
    if (!m) continue;
    const amount = lastAmount(line);
    if (!amount) continue;

    const month = Number(m[1]);
    const year = resolveYear(month, anchors);
    const date = `${String(month).padStart(2, "0")}/${m[2]}/${year}`;
    let description = line.slice(m[0].length, line.length - amount.raw.length).trim();

    // Some rows render the description on the line immediately before the
    // date+amount line rather than inline (a sub-pixel baseline mismatch in
    // the source PDF's fixed-width layout) — recover it from there instead.
    if (!description) {
      const prev = lines[i - 1]?.trim();
      if (prev && !DATE_AT_START.test(prev) && !HEADER_LINE.test(prev)) description = prev;
    }

    rows.push({ date, description: description || "Transaction", amount: sign * amount.value });
  }
  return rows;
}

export function parseBotStatement(text: string): PdfTxnRow[] {
  const lines = text.split("\n");
  const anchors = inferYears(text);

  const deposits = sliceSection(lines, /^DEPOSITS$/i, /^WITHDRAWALS$/i);
  const withdrawals = sliceSection(lines, /^WITHDRAWALS$/i, /^CHECKS\b/i);
  const checks = sliceSection(lines, /^CHECKS\b/i, /^DAILY ACCOUNT BALANCE/i);

  return [
    ...parseRows(deposits, 1, anchors),
    ...parseRows(withdrawals, -1, anchors),
    ...parseRows(checks, -1, anchors),
  ];
}
