// Shared helper: slice the lines between two marker lines. Every bank PDF
// adapter uses this to isolate a "Deposits" / "Withdrawals" / "Checks" style
// section before parsing its rows, so unrelated boilerplate (disclosures,
// daily balance tables, check images) never reaches the row parser.

/**
 * Returns the lines strictly between the first line matching `start` and the
 * next line matching `end` after it. If `end` never occurs, returns lines
 * through the end of the section list. Returns [] if `start` isn't found.
 */
export function sliceSection(lines: string[], start: RegExp, end: RegExp): string[] {
  const startIdx = lines.findIndex((l) => start.test(l));
  if (startIdx === -1) return [];
  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => end.test(l));
  return endIdx === -1 ? rest : rest.slice(0, endIdx);
}

const AMOUNT_TOKEN = /-?\$?[\d,]+\.\d{2}\b/;

/** Find the last currency-looking number in a block of text, if any. */
export function lastAmount(text: string): { value: number; raw: string } | null {
  const matches = [...text.matchAll(new RegExp(AMOUNT_TOKEN, "g"))];
  if (matches.length === 0) return null;
  const raw = matches[matches.length - 1][0];
  const value = Number(raw.replace(/[$,]/g, ""));
  return Number.isFinite(value) ? { value: Math.abs(value), raw } : null;
}

const TRAILING_AMOUNT = /-?\$?[\d,]+\.\d{2}\s*$/;

/**
 * Group a section's lines into transaction blocks, one per line matching
 * `dateAtStart`. Lines that don't start a new entry are appended to the
 * current block — this is what recovers descriptions that wrap across 2-3
 * lines in statements like Bank of America's.
 *
 * A block closes the moment its accumulated text ends in a dollar amount
 * (not only when the next date-line appears). This matters because these
 * statements interleave page headers, "continued" markers and disclosure
 * boxes between transaction blocks; waiting for the next date-line would
 * merge that noise into the previous entry's description. Once a block has
 * its amount, anything before the next date-line is orphaned noise and is
 * dropped rather than merged.
 */
export function groupByLeadingDate(
  lines: string[],
  dateAtStart: RegExp,
): { dateToken: string; block: string }[] {
  const entries: { dateToken: string; block: string }[] = [];
  let current: { dateToken: string; parts: string[] } | null = null;
  let closed = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const m = trimmed.match(dateAtStart);
    if (m) {
      if (current) entries.push({ dateToken: current.dateToken, block: current.parts.join(" ") });
      current = { dateToken: m[0], parts: [trimmed] };
      closed = TRAILING_AMOUNT.test(trimmed);
      continue;
    }

    if (!current || closed) continue; // orphan line before/after a block — drop it
    current.parts.push(trimmed);
    if (TRAILING_AMOUNT.test(trimmed)) closed = true;
  }
  if (current) entries.push({ dateToken: current.dateToken, block: current.parts.join(" ") });
  return entries;
}
