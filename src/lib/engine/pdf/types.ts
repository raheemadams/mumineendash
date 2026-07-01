// Output of every per-bank PDF adapter: a signed amount so it flows straight
// into the CSV pipeline's "single amount column" mode — the same shape
// `detectColumns`/`normalizeRows` already handle for CSV uploads.

export interface PdfTxnRow {
  date: string; // as found in the statement; parseDate() handles the format
  description: string;
  amount: number; // signed: positive = inflow, negative = outflow
}

export type PdfSource = "boa" | "bot" | "paypal" | "cashapp";
