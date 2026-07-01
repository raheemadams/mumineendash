// Unified PDF statement parser. Detects which bank/payment-app format the
// PDF's extracted text matches and dispatches to the matching adapter, then
// converts the result into the exact `ParsedFile` shape `parseCsv` produces
// (headers + RawRow[]) — so the existing detectColumns/normalizeRows/dedupe
// pipeline handles PDF-sourced rows identically to CSV rows, unmodified.

import type { ParsedFile } from "../parse";
import type { PdfSource, PdfTxnRow } from "./types";
import { extractPdfText } from "./extract-text";
import { isBoaStatement, parseBoaStatement } from "./parsers/boa";
import { isBotStatement, parseBotStatement } from "./parsers/bot";
import { isPaypalStatement, parsePaypalStatement } from "./parsers/paypal";
import { isCashAppStatement, parseCashAppStatement } from "./parsers/cashapp";

export type { PdfSource, PdfTxnRow } from "./types";

export function detectPdfSource(text: string): PdfSource | null {
  if (isBoaStatement(text)) return "boa";
  if (isBotStatement(text)) return "bot";
  if (isPaypalStatement(text)) return "paypal";
  if (isCashAppStatement(text)) return "cashapp";
  return null;
}

export function parseRowsForSource(source: PdfSource, text: string): PdfTxnRow[] {
  switch (source) {
    case "boa":
      return parseBoaStatement(text);
    case "bot":
      return parseBotStatement(text);
    case "paypal":
      return parsePaypalStatement(text);
    case "cashapp":
      return parseCashAppStatement(text);
  }
}

export interface PdfParseResult extends ParsedFile {
  source: PdfSource;
  txnCount: number;
}

export class UnrecognizedPdfError extends Error {
  constructor() {
    super(
      "This PDF doesn't match a supported statement format (Bank of America, Bank of Texas, PayPal, or Cash App).",
    );
    this.name = "UnrecognizedPdfError";
  }
}

/** Extract + detect + parse a statement PDF into CSV-pipeline-compatible rows. */
export async function parsePdfStatement(data: ArrayBuffer): Promise<PdfParseResult> {
  const text = await extractPdfText(data);
  const source = detectPdfSource(text);
  if (!source) throw new UnrecognizedPdfError();

  const txns = parseRowsForSource(source, text);
  const headers = ["Date", "Description", "Amount"];
  const rows = txns.map((t) => ({
    Date: t.date,
    Description: t.description,
    Amount: t.amount.toFixed(2),
  }));

  return { headers, rows, source, txnCount: rows.length };
}
