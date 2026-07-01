import { describe, it, expect } from "vitest";
import { parseAmount, parseDate } from "./money";
import { detectColumns } from "./detect";
import { parseCsv } from "./parse";
import { normalizeRows } from "./normalize";
import {
  detectDuplicates,
  dedupeHash,
  descriptionSimilarity,
} from "./dedupe";
import { findDepositMatches, bestAutoMatch } from "./reconcile";
import type { LedgerTxn, MappingConfig } from "./types";

const ACCOUNT = "acct-boa";

describe("money.parseAmount", () => {
  it("parses US currency, negatives, parens and CR/DR", () => {
    expect(parseAmount("$1,200.00")).toBe(1200);
    expect(parseAmount("(45.00)")).toBe(-45);
    expect(parseAmount("-45")).toBe(-45);
    expect(parseAmount("45.00 CR")).toBe(45);
    expect(parseAmount("45.00 DR")).toBe(-45);
    expect(parseAmount("1.234,56")).toBe(1234.56); // european
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("n/a")).toBeNull();
  });
});

describe("money.parseDate", () => {
  it("handles common bank formats", () => {
    expect(parseDate("2026-03-05")?.toISOString().slice(0, 10)).toBe("2026-03-05");
    expect(parseDate("03/05/2026")?.toISOString().slice(0, 10)).toBe("2026-03-05");
    expect(parseDate("3/5/26")?.toISOString().slice(0, 10)).toBe("2026-03-05");
    expect(parseDate("05/03/2026", "DD/MM/YYYY")?.toISOString().slice(0, 10)).toBe("2026-03-05");
    expect(parseDate("Jan 5, 2026")?.toISOString().slice(0, 10)).toBe("2026-01-05");
    expect(parseDate("garbage")).toBeNull();
  });
});

describe("detectColumns", () => {
  it("detects a single-amount layout (Bank of America style)", () => {
    const d = detectColumns(["Date", "Description", "Amount", "Running Bal."]);
    expect(d.amountStyle).toBe("single");
    expect(d.fieldMap.date).toBe("Date");
    expect(d.fieldMap.amount).toBe("Amount");
    expect(d.fieldMap.description).toBe("Description");
  });

  it("detects a debit/credit layout", () => {
    const d = detectColumns(["Transaction Date", "Memo", "Debit", "Credit", "Reference No"]);
    expect(d.amountStyle).toBe("debit_credit");
    expect(d.fieldMap.debit).toBe("Debit");
    expect(d.fieldMap.credit).toBe("Credit");
    expect(d.fieldMap.reference).toBe("Reference No");
  });
});

describe("normalizeRows", () => {
  it("normalizes a single signed-amount statement into the ledger shape", () => {
    const csv = [
      "Date,Description,Amount",
      "03/05/2026,ZELLE FROM AHMED ALI,150.00",
      "03/06/2026,CHECK 1023 RENT,-1200.00",
    ].join("\n");
    const { headers, rows } = parseCsv(csv);
    const det = detectColumns(headers);
    const cfg: MappingConfig = {
      fieldMap: det.fieldMap,
      amountStyle: det.amountStyle,
      accountId: ACCOUNT,
    };
    const { rows: norm, errors } = normalizeRows(rows, cfg);
    expect(errors).toHaveLength(0);
    expect(norm).toHaveLength(2);

    expect(norm[0].direction).toBe("INFLOW");
    expect(norm[0].amount).toBe(150);
    expect(norm[0].deposit).toBe(150);
    expect(norm[0].withdrawal).toBeNull();

    expect(norm[1].direction).toBe("OUTFLOW");
    expect(norm[1].amount).toBe(1200);
    expect(norm[1].withdrawal).toBe(1200);
  });

  it("normalizes a debit/credit statement", () => {
    const csv = [
      "Transaction Date,Memo,Debit,Credit",
      "2026-03-05,Donation,,500.00",
      "2026-03-07,Utilities,89.50,",
    ].join("\n");
    const { headers, rows } = parseCsv(csv);
    const det = detectColumns(headers);
    const { rows: norm } = normalizeRows(rows, {
      fieldMap: det.fieldMap,
      amountStyle: det.amountStyle,
      accountId: ACCOUNT,
    });
    expect(norm[0].direction).toBe("INFLOW");
    expect(norm[0].amount).toBe(500);
    expect(norm[1].direction).toBe("OUTFLOW");
    expect(norm[1].amount).toBe(89.5);
  });

  it("collects errors for unparseable rows instead of throwing", () => {
    const csv = ["Date,Description,Amount", "not-a-date,Bad,100", "03/05/2026,Good,"].join("\n");
    const { headers, rows } = parseCsv(csv);
    const det = detectColumns(headers);
    const res = normalizeRows(rows, {
      fieldMap: det.fieldMap,
      amountStyle: det.amountStyle,
      accountId: ACCOUNT,
    });
    expect(res.rows).toHaveLength(0);
    expect(res.errors).toHaveLength(2);
  });
});

describe("dedupe", () => {
  const cfg: MappingConfig = {
    fieldMap: { date: "Date", description: "Description", amount: "Amount", reference: "Ref" },
    amountStyle: "single",
    accountId: ACCOUNT,
  };

  function makeLedger(rows: string[]): LedgerTxn[] {
    const csv = ["Date,Description,Amount,Ref", ...rows].join("\n");
    const { rows: parsed } = parseCsv(csv);
    return normalizeRows(parsed, cfg).rows.map((t, i) => ({
      id: `L${i}`,
      accountId: t.accountId,
      date: t.date,
      amount: t.amount,
      direction: t.direction,
      description: t.description,
      referenceNumber: t.referenceNumber,
      dedupeHash: t.dedupeHash,
    }));
  }

  it("catches an exact re-import via fingerprint", () => {
    const existing = makeLedger(["03/05/2026,ZELLE AHMED,150.00,TXN9001"]);
    const incoming = normalizeRows(
      parseCsv("Date,Description,Amount,Ref\n03/05/2026,ZELLE AHMED,150.00,TXN9001").rows,
      cfg,
    ).rows;
    const verdicts = detectDuplicates(incoming, existing);
    expect(verdicts[0].isDuplicate).toBe(true);
    expect(verdicts[0].score).toBe(1);
    expect(verdicts[0].matchId).toBe("L0");
  });

  it("flags a fuzzy duplicate (same amount/date, noisier description)", () => {
    const existing = makeLedger(["03/05/2026,ZELLE FROM AHMED ALI,150.00,"]);
    const incoming = normalizeRows(
      parseCsv("Date,Description,Amount,Ref\n03/05/2026,ZELLE PAYMENT AHMED ALI ID123,150.00,").rows,
      cfg,
    ).rows;
    const v = detectDuplicates(incoming, existing)[0];
    expect(v.score).toBeGreaterThanOrEqual(0.75);
  });

  it("does NOT flag a different amount as duplicate", () => {
    const existing = makeLedger(["03/05/2026,ZELLE AHMED,150.00,"]);
    const incoming = normalizeRows(
      parseCsv("Date,Description,Amount,Ref\n03/05/2026,ZELLE AHMED,151.00,").rows,
      cfg,
    ).rows;
    const v = detectDuplicates(incoming, existing)[0];
    expect(v.isDuplicate).toBe(false);
    expect(v.score).toBe(0);
  });

  it("catches duplicate rows within a single import", () => {
    const incoming = normalizeRows(
      parseCsv(
        "Date,Description,Amount,Ref\n03/05/2026,DONATION,100.00,A1\n03/05/2026,DONATION,100.00,A1",
      ).rows,
      cfg,
    ).rows;
    const verdicts = detectDuplicates(incoming, []);
    expect(verdicts[0].isDuplicate).toBe(false);
    expect(verdicts[1].isDuplicate).toBe(true);
    expect(verdicts[1].reasons[0]).toMatch(/within this import/);
  });

  it("dedupeHash is stable and direction-sensitive", () => {
    const base = {
      accountId: ACCOUNT,
      date: new Date("2026-03-05"),
      amount: 150,
      direction: "INFLOW" as const,
      referenceNumber: "X1",
    };
    expect(dedupeHash(base)).toBe(dedupeHash({ ...base }));
    expect(dedupeHash(base)).not.toBe(dedupeHash({ ...base, direction: "OUTFLOW" }));
  });

  it("does not fingerprint two different donors as duplicates just because they share an amount/date with no reference number", () => {
    // Real-world case (Cash App / Bank of Texas PDFs have no per-line reference
    // number): two distinct donors giving the same amount on the same day must
    // not collide into one hash, or the second donation gets silently dropped.
    const idris = {
      accountId: ACCOUNT,
      date: new Date("2026-03-20"),
      amount: 9.59,
      direction: "INFLOW" as const,
      referenceNumber: null,
      description: "From Idris, including processing fee",
    };
    const finna = { ...idris, description: "From Finna Henna, including processing fee" };
    expect(dedupeHash(idris)).not.toBe(dedupeHash(finna));
  });

  it("still fingerprints a literal re-import (same amount/date/description, no reference) as identical", () => {
    const a = {
      accountId: ACCOUNT,
      date: new Date("2026-03-20"),
      amount: 9.59,
      direction: "INFLOW" as const,
      referenceNumber: null,
      description: "From Idris, including processing fee",
    };
    expect(dedupeHash(a)).toBe(dedupeHash({ ...a }));
  });

  it("descriptionSimilarity is token based", () => {
    expect(descriptionSimilarity("ZELLE FROM AHMED", "ZELLE AHMED")).toBeGreaterThan(0.4);
    expect(descriptionSimilarity("RENT", "UTILITIES")).toBe(0);
  });
});

describe("reconcile (cash deposit <-> bank line)", () => {
  const ledger: LedgerTxn[] = [
    {
      id: "T1",
      accountId: ACCOUNT,
      date: new Date("2026-03-09"),
      amount: 1700,
      direction: "INFLOW",
      description: "BRANCH DEPOSIT",
      referenceNumber: null,
      dedupeHash: "h1",
    },
    {
      id: "T2",
      accountId: ACCOUNT,
      date: new Date("2026-03-09"),
      amount: 250,
      direction: "INFLOW",
      description: "ZELLE",
      referenceNumber: null,
      dedupeHash: "h2",
    },
  ];

  it("matches a deposit batch to the right bank inflow by amount + date", () => {
    const matches = findDepositMatches(
      { id: "D1", accountId: ACCOUNT, expectedTotal: 1700, depositedOn: new Date("2026-03-07") },
      ledger,
    );
    expect(matches[0].transaction.id).toBe("T1");
    expect(matches[0].score).toBeGreaterThan(0.8);
  });

  it("auto-matches when unambiguous, abstains when not", () => {
    const auto = bestAutoMatch(
      { id: "D1", accountId: ACCOUNT, expectedTotal: 1700, depositedOn: new Date("2026-03-09") },
      ledger,
    );
    expect(auto?.transaction.id).toBe("T1");

    // no bank line of this amount -> no match
    const none = bestAutoMatch(
      { id: "D2", accountId: ACCOUNT, expectedTotal: 9999, depositedOn: new Date("2026-03-09") },
      ledger,
    );
    expect(none).toBeNull();
  });
});
