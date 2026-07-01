// Shared Prisma-row -> store-shape conversion helpers. Prisma returns Decimal
// objects and Date instances; the store (and every page built against it)
// works with plain numbers and ISO strings. Isolating the conversion here
// keeps every repository file free of this bookkeeping.

import type { Decimal } from "@prisma/client/runtime/library";

export function num(d: Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === "number" ? d : Number(d);
}

export function numOrNull(d: Decimal | number | null | undefined): number | null {
  if (d === null || d === undefined) return null;
  return typeof d === "number" ? d : Number(d);
}

export function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/** Date-only ISO (YYYY-MM-DD) for fields the UI treats as calendar dates. */
export function isoDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}
