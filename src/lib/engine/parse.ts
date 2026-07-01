// Thin CSV parsing wrapper. Keeps the engine's pure functions free of any
// file/format concern — this is the only spot that knows about CSV text.

import Papa from "papaparse";
import type { RawRow } from "./types";

export interface ParsedFile {
  headers: string[];
  rows: RawRow[];
}

/** Parse CSV text into header + object rows. Empty trailing rows are dropped. */
export function parseCsv(text: string): ParsedFile {
  const result = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const rows = (result.data ?? []).filter((r) =>
    Object.values(r).some((v) => v != null && String(v).trim() !== ""),
  );
  const headers = result.meta.fields?.map((f) => f.trim()) ?? [];
  return { headers, rows };
}
