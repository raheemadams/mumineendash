// Cash App "Account Statement" parser.
//
// Layout (see "Sample data/Cashapp.pdf"):
//   March 2026
//   Account Statement
//   ...
//   Transactions
//   Date   Description                                    Details          Fee     Amount
//   Mar 13 From Bukola Ajayi, including processing fee    Cash App payment $0.54   + $14.46
//
// Every entry is one line. Dates are "Mon DD" with no year — inferred from
// the "<Month> <Year>" statement header line. Amounts carry an explicit
// leading sign ("+ $14.46" / "- $12.00").

import type { PdfTxnRow } from "../types";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DATE_AT_START = /^([A-Za-z]{3})\s+(\d{1,2})\b/;
const TRAILING_AMOUNT = /([+-])\s*\$?(-?[\d,]+\.\d{2})\s*$/;

export function isCashAppStatement(text: string): boolean {
  return /cash app/i.test(text) && /account statement/i.test(text);
}

function statementYear(text: string): number {
  const m = text.match(/^[A-Za-z]+\s+(\d{4})\s*$/m);
  if (m) return Number(m[1]);
  return new Date().getFullYear();
}

export function parseCashAppStatement(text: string): PdfTxnRow[] {
  const year = statementYear(text);
  const lines = text.split("\n");

  const startIdx = lines.findIndex((l) => /^Date\s+Description\s+Details\s+Fee\s+Amount/i.test(l.trim()));
  const section = startIdx === -1 ? lines : lines.slice(startIdx + 1);

  const rows: PdfTxnRow[] = [];
  for (const raw of section) {
    const line = raw.trim();
    const dateMatch = line.match(DATE_AT_START);
    const amountMatch = line.match(TRAILING_AMOUNT);
    if (!dateMatch || !amountMatch) continue;

    const monthIdx = MONTHS.indexOf(dateMatch[1].toLowerCase().slice(0, 3));
    if (monthIdx === -1) continue;

    const date = `${String(monthIdx + 1).padStart(2, "0")}/${dateMatch[2].padStart(2, "0")}/${year}`;
    const sign = amountMatch[1] === "-" ? -1 : 1;
    const amount = Number(amountMatch[2].replace(/,/g, ""));
    if (!Number.isFinite(amount)) continue;

    const description = line
      .slice(dateMatch[0].length, line.length - amountMatch[0].length)
      .replace(/\$[\d,]+\.\d{2}/g, "") // drop the Fee column figure
      .replace(/\s+/g, " ")
      .trim();

    rows.push({ date, description: description || "Cash App transaction", amount: sign * Math.abs(amount) });
  }

  return rows;
}
