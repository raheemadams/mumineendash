// Column auto-detection. Given the header row of a parsed statement, guess
// which columns map to internal fields and whether amounts are single or
// split. The user confirms/overrides on the mapping screen — this just makes
// the common case one click.

import type { AmountStyle, FieldMap } from "./types";

const PATTERNS: Record<keyof FieldMap, RegExp[]> = {
  date: [/^(transaction\s*)?date$/i, /post(ing|ed)?\s*date/i, /\bdate\b/i],
  description: [/desc/i, /memo/i, /detail/i, /narrat/i, /name/i, /payee/i],
  amount: [/^amount$/i, /^amt$/i, /net\s*amount/i, /^value$/i],
  debit: [/debit/i, /withdrawal/i, /money\s*out/i, /\bout\b/i, /charge/i],
  credit: [/credit/i, /deposit/i, /money\s*in/i, /\bin\b/i, /payment/i],
  reference: [/ref(erence)?(\s*(no|number|#))?/i, /confirmation/i, /\bid\b/i, /check\s*#?/i],
  memo: [/memo/i, /note/i],
};

export interface Detection {
  fieldMap: FieldMap;
  amountStyle: AmountStyle;
  /** headers that were not mapped to anything */
  unmapped: string[];
}

export function detectColumns(headers: string[]): Detection {
  const clean = headers.map((h) => (h ?? "").trim());
  const used = new Set<string>();

  function pick(field: keyof FieldMap): string | undefined {
    for (const re of PATTERNS[field]) {
      const hit = clean.find((h) => h && !used.has(h) && re.test(h));
      if (hit) {
        used.add(hit);
        return hit;
      }
    }
    return undefined;
  }

  // Order matters: claim the specific debit/credit before generic description.
  const date = pick("date");
  const debit = pick("debit");
  const credit = pick("credit");
  const amount = pick("amount");
  const reference = pick("reference");
  const description = pick("description");
  const memo = pick("memo");

  const amountStyle: AmountStyle = debit || credit ? "debit_credit" : "single";

  const fieldMap: FieldMap = {
    date: date ?? clean[0] ?? "",
    description,
    amount,
    debit,
    credit,
    reference,
    memo,
  };

  const unmapped = clean.filter((h) => h && !used.has(h));
  return { fieldMap, amountStyle, unmapped };
}
