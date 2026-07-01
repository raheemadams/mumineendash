// Cash-deposit reconciliation — count the money exactly once.
//
// The admin collects cash/checks/Zelle into a DepositBatch (expected total).
// Later the bank statement is imported and produces a deposit Transaction.
// We match the batch to that bank line so the cash is recognized ONCE: the
// batch holds the member-level attribution, the bank line is the cleared
// movement. No second income is created — they are linked.

import type { LedgerTxn } from "./types";

export interface DepositForMatch {
  id: string;
  accountId: string | null;
  expectedTotal: number;
  /** when the admin physically deposited the money */
  depositedOn: Date | null;
}

export interface ReconcileCandidate {
  transaction: LedgerTxn;
  score: number; // 0..1
  reasons: string[];
}

const AUTO_RECONCILE_THRESHOLD = 0.9;

function daysApart(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

/**
 * Rank unreconciled bank inflows as matches for a deposit batch.
 * Only INFLOW lines on the same account with the same amount qualify.
 */
export function findDepositMatches(
  deposit: DepositForMatch,
  ledger: LedgerTxn[],
): ReconcileCandidate[] {
  const candidates: ReconcileCandidate[] = [];

  for (const txn of ledger) {
    if (txn.direction !== "INFLOW") continue;
    if (deposit.accountId && txn.accountId !== deposit.accountId) continue;
    if (Math.abs(txn.amount - deposit.expectedTotal) > 0.005) continue;

    const reasons: string[] = [`amount ${txn.amount.toFixed(2)} matches deposit total`];
    let score = 0.7; // exact amount + account is already a strong signal

    if (deposit.depositedOn) {
      const dd = daysApart(txn.date, deposit.depositedOn);
      // Banks often post 0–4 business days after the physical deposit.
      if (dd === 0) {
        score += 0.3;
        reasons.push("posted same day as deposit");
      } else if (dd <= 2) {
        score += 0.22;
        reasons.push(`posted ${Math.round(dd)} day(s) after deposit`);
      } else if (dd <= 5) {
        score += 0.12;
        reasons.push(`posted ${Math.round(dd)} days after deposit`);
      } else if (dd <= 10) {
        score += 0.04;
      } else {
        // far apart — keep but weak
        reasons.push(`posted ${Math.round(dd)} days from deposit`);
      }
    }

    candidates.push({ transaction: txn, score: Math.min(1, score), reasons });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export function bestAutoMatch(
  deposit: DepositForMatch,
  ledger: LedgerTxn[],
): ReconcileCandidate | null {
  const ranked = findDepositMatches(deposit, ledger);
  const top = ranked[0];
  if (top && top.score >= AUTO_RECONCILE_THRESHOLD) {
    // require it to be unambiguous: clearly ahead of the runner-up
    const second = ranked[1];
    if (!second || top.score - second.score >= 0.1) return top;
  }
  return null;
}

export { AUTO_RECONCILE_THRESHOLD };
