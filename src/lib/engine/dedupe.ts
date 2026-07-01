// Duplicate detection — the safeguard against double accounting.
//
// Two layers:
//  1. dedupeHash: a fast exact fingerprint (account|date|amount|direction|ref)
//     used as a DB index for O(1) "have I seen this exact line" checks.
//  2. scoreDuplicate: a fuzzy 0..1 confidence combining amount, date
//     proximity, reference match and description similarity, for the cases
//     where a line was re-exported with a slightly different description.

import type { Direction, DuplicateVerdict, LedgerTxn, NormalizedTxn } from "./types";

export const AUTO_DUPLICATE_THRESHOLD = 0.95;
export const REVIEW_DUPLICATE_THRESHOLD = 0.75;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizeDescription(s: string | null): string {
  return (s ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Stable exact fingerprint for a row. When a reference number is available
 * it alone disambiguates same-amount/same-day rows. When it isn't — common
 * for PDF-sourced statements (Bank of Texas, Cash App) and CSVs with no
 * reference column — falling back to an empty string would make every
 * same-amount/same-day transaction hash identically, false-flagging
 * distinct donors who happened to give the same amount on the same day as
 * duplicates of each other. Falling back to the normalized description
 * instead keeps the fingerprint exact-match only for genuinely identical
 * rows (e.g. a literal re-import of the same file).
 */
export function dedupeHash(t: {
  accountId: string;
  date: Date;
  amount: number;
  direction: Direction;
  referenceNumber: string | null;
  description?: string | null;
}): string {
  const ref = (t.referenceNumber ?? "").trim().toLowerCase();
  const disambiguator = ref || normalizeDescription(t.description ?? null);
  return [t.accountId, ymd(t.date), t.amount.toFixed(2), t.direction, disambiguator].join("|");
}

/** Token-based Jaccard similarity, resilient to bank description noise. */
export function descriptionSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const norm = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 1),
    );
  const sa = norm(a);
  const sb = norm(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / (sa.size + sb.size - inter);
}

function daysApart(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

/**
 * Score how likely `candidate` duplicates `existing` (0..1).
 * Amount + direction must match for any meaningful score — a different amount
 * is a different transaction, full stop.
 */
export function scoreDuplicate(
  candidate: NormalizedTxn,
  existing: LedgerTxn,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  if (candidate.accountId !== existing.accountId) return { score: 0, reasons };
  if (candidate.direction !== existing.direction) return { score: 0, reasons };
  if (Math.abs(candidate.amount - existing.amount) > 0.005) return { score: 0, reasons };

  reasons.push(`amount ${candidate.amount.toFixed(2)} matches`);
  let score = 0.5; // amount + direction + account aligned

  // Date proximity — same day is strongest, decays over a week.
  const dd = daysApart(candidate.date, existing.date);
  if (dd === 0) {
    score += 0.25;
    reasons.push("same date");
  } else if (dd <= 1) {
    score += 0.18;
    reasons.push("1 day apart");
  } else if (dd <= 3) {
    score += 0.1;
    reasons.push(`${Math.round(dd)} days apart`);
  } else if (dd <= 7) {
    score += 0.03;
  }

  // Reference number is a strong signal when present on both.
  const cRef = (candidate.referenceNumber ?? "").trim().toLowerCase();
  const eRef = (existing.referenceNumber ?? "").trim().toLowerCase();
  if (cRef && eRef) {
    if (cRef === eRef) {
      score += 0.2;
      reasons.push("reference matches");
    } else {
      score -= 0.15; // different refs ⇒ probably distinct
      reasons.push("reference differs");
    }
  }

  // Description similarity tops it off.
  const sim = descriptionSimilarity(candidate.description, existing.description);
  if (sim > 0) {
    score += sim * 0.15;
    if (sim > 0.6) reasons.push(`description ${(sim * 100) | 0}% similar`);
  }

  return { score: Math.max(0, Math.min(1, score)), reasons };
}

/**
 * For each candidate, find the best-matching existing ledger row and decide
 * whether it is a duplicate. `existing` is the set already in the ledger for
 * the same account.
 */
export function detectDuplicates(
  candidates: NormalizedTxn[],
  existing: LedgerTxn[],
  autoThreshold = AUTO_DUPLICATE_THRESHOLD,
): DuplicateVerdict[] {
  // Index existing by exact hash for fast certain hits.
  const byHash = new Map<string, LedgerTxn>();
  for (const e of existing) if (e.dedupeHash) byHash.set(e.dedupeHash, e);

  // Also dedupe within the incoming batch itself.
  const seenInBatch = new Map<string, NormalizedTxn>();

  return candidates.map((candidate) => {
    // 1) exact hash hit against the ledger
    const exact = byHash.get(candidate.dedupeHash);
    if (exact) {
      return {
        candidate,
        matchId: exact.id,
        score: 1,
        isDuplicate: true,
        reasons: ["exact fingerprint match"],
      };
    }

    // 2) duplicate within this same upload
    const inBatch = seenInBatch.get(candidate.dedupeHash);
    if (inBatch) {
      return {
        candidate,
        matchId: null,
        score: 1,
        isDuplicate: true,
        reasons: ["duplicate row within this import"],
      };
    }
    seenInBatch.set(candidate.dedupeHash, candidate);

    // 3) fuzzy scan
    let best: { id: string | null; score: number; reasons: string[] } = {
      id: null,
      score: 0,
      reasons: [],
    };
    for (const e of existing) {
      const { score, reasons } = scoreDuplicate(candidate, e);
      if (score > best.score) best = { id: e.id, score, reasons };
    }

    return {
      candidate,
      matchId: best.score >= REVIEW_DUPLICATE_THRESHOLD ? best.id : null,
      score: best.score,
      isDuplicate: best.score >= autoThreshold,
      reasons: best.reasons,
    };
  });
}
