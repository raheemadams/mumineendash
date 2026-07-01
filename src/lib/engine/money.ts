// Money + date parsing helpers. Bank exports are messy: "$1,200.00", "(45.00)"
// for negatives, "1.234,56" in some locales, trailing "CR"/"DR", etc.

/**
 * Parse a currency-ish string into a number. Returns null when there is no
 * parseable numeric content. Handles:
 *   "$1,200.00" -> 1200, "(45.00)" -> -45, "-45" -> -45, "45.00 CR" -> 45.
 */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;

  let s = input.trim();
  if (!s) return null;

  let sign = 1;

  // Parenthesized negatives: (1,200.00)
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }

  // Trailing CR/DR markers
  const upper = s.toUpperCase();
  if (/\bDR\b/.test(upper)) sign *= -1;
  s = s.replace(/\b(CR|DR)\b/gi, "");

  // Leading explicit sign
  if (s.includes("-")) sign *= -1;

  // Strip everything that is not a digit or separator
  s = s.replace(/[^0-9.,]/g, "");
  if (!s) return null;

  // Decide decimal separator: if both "," and "." appear, the last one wins.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // European: 1.234,56
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // US: 1,234.56
      s = s.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    // Only commas. Treat as thousands unless it looks like 2-decimal cents.
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length === 2) {
      s = parts[0] + "." + parts[1];
    } else {
      s = s.replace(/,/g, "");
    }
  }

  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return round2(sign * n);
}

/** Round to 2 decimal places, avoiding float drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parse a date from a bank export. Supports MM/DD/YYYY, M/D/YY, YYYY-MM-DD,
 * "Jan 5, 2026", "05-Jan-2026". When `format` is "DD/MM/YYYY" the
 * day/month order is forced. Returns null if unparseable.
 */
export function parseDate(input: string | Date | null | undefined, format?: string): Date | null {
  if (input === null || input === undefined) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;

  const s = String(input).trim();
  if (!s) return null;

  // ISO first: YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return makeDate(+iso[1], +iso[2] - 1, +iso[3]);
  }

  // Named month: "Jan 5, 2026" or "5 Jan 2026" or "05-Jan-2026"
  const named = s.match(/(\d{1,2})[ \-]?([A-Za-z]{3,})[, \-]+(\d{2,4})/) ||
    s.match(/([A-Za-z]{3,})[ \-]+(\d{1,2})[, \-]+(\d{2,4})/);
  if (named) {
    const monIdx = /^[A-Za-z]/.test(named[1]) ? 1 : 2;
    const dayIdx = monIdx === 1 ? 2 : 1;
    const mon = MONTHS[named[monIdx].slice(0, 3).toLowerCase()];
    if (mon !== undefined) {
      return makeDate(normYear(+named[3]), mon, +named[dayIdx]);
    }
  }

  // Numeric slash/dash: MM/DD/YYYY by default.
  const parts = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (parts) {
    let month = +parts[1];
    let day = +parts[2];
    const dayFirst = format?.toUpperCase().startsWith("DD");
    if (dayFirst) {
      [day, month] = [+parts[1], +parts[2]];
    }
    return makeDate(normYear(+parts[3]), month - 1, day);
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function normYear(y: number): number {
  if (y < 100) return y >= 70 ? 1900 + y : 2000 + y;
  return y;
}

function makeDate(year: number, monthIdx: number, day: number): Date | null {
  if (monthIdx < 0 || monthIdx > 11 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, monthIdx, day));
  return Number.isNaN(d.getTime()) ? null : d;
}
