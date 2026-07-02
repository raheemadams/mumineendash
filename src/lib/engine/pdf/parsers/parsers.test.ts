import { describe, it, expect } from "vitest";
import { isBoaStatement, parseBoaStatement } from "./boa";
import { isBotStatement, parseBotStatement } from "./bot";
import { isPaypalStatement, parsePaypalStatement } from "./paypal";
import { isCashAppStatement, parseCashAppStatement } from "./cashapp";
import { detectPdfSource } from "../index";

// Fixtures below are structurally faithful reconstructions of the real
// statement layouts (line wrapping, section headers, noise between blocks)
// with synthetic names/amounts — not the organization's actual records.

describe("Bank of America adapter", () => {
  const text = `
BANK OF AMERICA
NIGERIAN MUSLIM ASSOCIATION OF GREATER ! Account # 0000 0000 0000 ! January 1, 2026 to January 31, 2026
Deposits and other credits
Date Description Amount
01/02/26 Zelle payment from JANE DOE for "Bloom"; Conf# abc123 850.00
01/05/26 FORTE DES:256368 ID:CC-0104-3920E INDN:SAMPLE ORG CO
ID:1330903620 CCD
899.52
01/05/26 Counter Credit 569.00
continued on the next page
NIGERIAN MUSLIM ASSOCIATION OF GREATER ! Account # 0000 0000 0000 ! January 1, 2026 to January 31, 2026
Deposits and other credits - continued
Date Description Amount
01/09/26 Zelle payment from SAADAT KHAN for "ZAKAT FOR NEEDY"; Conf# xyz 50.00
Total deposits and other credits $2,368.52
Withdrawals and other debits
Date Description Amount
01/02/26 Zelle payment to IMAM SAMPLE for "Salary payment"; Conf# def456 -2,340.00
Card account # XXXX XXXX XXXX 0000
01/09/26 CHECKCARD 0108 SAMPLE VENDOR CITY ST -1,046.00
Subtotal for card account # XXXX XXXX XXXX 0000 -$1,046.00
Total withdrawals and other debits -$3,386.00
Checks
Date Check # Amount Date Check # Amount
01/09/26 3950 -5,500.00 01/12/26 3953* -250.00
Total checks -$5,750.00
Daily ledger balances
Date Balance ($)
01/01 10,000.00
`;

  it("detects the format", () => {
    expect(isBoaStatement(text)).toBe(true);
  });

  it("parses single-line deposits", () => {
    const rows = parseBoaStatement(text);
    const zelle = rows.find((r) => r.description.includes("JANE DOE"));
    expect(zelle).toMatchObject({ date: "01/02/26", amount: 850 });
  });

  it("recovers a description that wraps across lines with the amount on its own line", () => {
    const rows = parseBoaStatement(text);
    const forte = rows.find((r) => r.description.includes("FORTE"));
    expect(forte?.amount).toBe(899.52);
    expect(forte?.description).toContain("ID:1330903620 CCD");
  });

  it("does not merge page-header/continued noise into the surrounding entries", () => {
    const rows = parseBoaStatement(text);
    const counterCredit = rows.find((r) => r.description === "Counter Credit");
    expect(counterCredit?.amount).toBe(569);
    // the noise between blocks must not have leaked into any description
    for (const r of rows) {
      expect(r.description).not.toMatch(/continued on the next page/i);
      expect(r.description).not.toMatch(/NIGERIAN MUSLIM/i);
    }
  });

  it("continues parsing correctly after a page break with a repeated column header", () => {
    const rows = parseBoaStatement(text);
    const saadat = rows.find((r) => r.description.includes("SAADAT KHAN"));
    expect(saadat).toMatchObject({ date: "01/09/26", amount: 50 });
  });

  it("makes withdrawals negative and skips the card-account sub-header", () => {
    const rows = parseBoaStatement(text);
    const salary = rows.find((r) => r.description.includes("IMAM SAMPLE"));
    expect(salary?.amount).toBe(-2340);
    const checkcard = rows.find((r) => r.description.includes("CHECKCARD"));
    expect(checkcard?.amount).toBe(-1046);
    expect(rows.some((r) => r.description.includes("Card account #"))).toBe(false);
  });

  it("parses two checks packed onto a single line as separate negative entries", () => {
    const rows = parseBoaStatement(text);
    const checks = rows.filter((r) => r.description.startsWith("Check #"));
    expect(checks).toHaveLength(2);
    expect(checks[0]).toMatchObject({ date: "01/09/26", description: "Check #3950", amount: -5500 });
    expect(checks[1]).toMatchObject({ date: "01/12/26", description: "Check #3953", amount: -250 });
  });

  it("stops before the daily ledger balance table", () => {
    const rows = parseBoaStatement(text);
    expect(rows.some((r) => r.description.includes("Balance"))).toBe(false);
  });
});

describe("Bank of Texas adapter", () => {
  const text = `
BANK OF TEXAS
Statement Period: 01-01-26 to 01-31-26
DEPOSITS
Date Amount
01-02 SAMPLE ORG OPERATING ACH PAY -SETT-0000 2,070.00
01-27 SAMPLE ORG OPERATING ACH PAY -SETT-0000 775.00
WITHDRAWALS
Date Amount
01-02 RETURN SETTLE RETURN 25.00
01-15 BANK OF TEXAS ANALYSIS 1 224.41
CHECKS (* Indicates a break in check number sequence)
(RTND Indicates a RETURNED CHECK)
*** No Checks ***
DAILY ACCOUNT BALANCE
Date Balance
12-31 10,000.00
`;

  it("detects the format", () => {
    expect(isBotStatement(text)).toBe(true);
  });

  it("infers the year from the statement period header", () => {
    const rows = parseBotStatement(text);
    const deposit = rows.find((r) => r.description.includes("2,070".replace(",", "")) || r.amount === 2070);
    expect(deposit?.date).toBe("01/02/2026");
  });

  it("splits deposits (positive) and withdrawals (negative)", () => {
    const rows = parseBotStatement(text);
    expect(rows.find((r) => r.amount === 2070)?.amount).toBeGreaterThan(0);
    expect(rows.find((r) => r.description.includes("ANALYSIS"))?.amount).toBe(-224.41);
  });

  it("produces zero rows for an empty checks section", () => {
    const rows = parseBotStatement(text);
    expect(rows.some((r) => r.description.includes("No Checks"))).toBe(false);
  });

  it("recovers a description that renders on the line before the date+amount line", () => {
    // A real extraction quirk: some rows land the description on its own
    // line immediately before "MM-DD amount", with nothing inline.
    const splitText = `
BANK OF TEXAS
Statement Period: 01-01-26 to 01-31-26
DEPOSITS
Date Amount
SAMPLE ORG OPERATING ACH PAY -SETT-0000
01-02 2,070.00
WITHDRAWALS
Date Amount
`;
    const rows = parseBotStatement(splitText);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "01/02/2026",
      description: "SAMPLE ORG OPERATING ACH PAY -SETT-0000",
      amount: 2070,
    });
  });
});

describe("PayPal adapter", () => {
  const text = `
PayPal Account ID
banking@example.org
PAYPAL ACCOUNT
ACCOUNT ACTIVITY
DATE DESCRIPTION CURRENCY AMOUNT FEES TOTAL*
01/18/2026 Subscription Payment: sample donor
ID: 4S544630YV000000X
USD 100.00 -2.48 97.52
01/23/2026 Donation Payment: another donor
ID: 12373030U00000000
USD 500.00 -10.44 489.56
`;

  it("detects the format", () => {
    expect(isPaypalStatement(text)).toBe(true);
  });

  it("uses TOTAL (net of fees), not gross AMOUNT, as the ledger amount", () => {
    const rows = parsePaypalStatement(text);
    const sub = rows.find((r) => r.description.includes("sample donor"));
    expect(sub?.amount).toBe(97.52); // not 100.00
  });

  it("strips the ID line and column figures out of the description", () => {
    const rows = parsePaypalStatement(text);
    const sub = rows.find((r) => r.description.includes("sample donor"));
    expect(sub?.description).not.toMatch(/ID:/);
    expect(sub?.description).not.toMatch(/USD/);
    expect(sub?.description).toBe("Subscription Payment: sample donor");
  });

  it("parses a second entry independently", () => {
    const rows = parsePaypalStatement(text);
    const donation = rows.find((r) => r.description.includes("another donor"));
    expect(donation?.amount).toBe(489.56);
    expect(donation?.date).toBe("01/23/2026");
  });
});

describe("Cash App adapter", () => {
  const text = `
March 2026
Account Statement
Cash App
Transactions
Date Description Details Fee Amount
Mar 13 From Sample Donor, including processing fee Cash App payment $0.54 + $14.46
Mar 20 From Another Donor, including processing fee Cash App payment $2.75 + $97.25
`;

  it("detects the format", () => {
    expect(isCashAppStatement(text)).toBe(true);
  });

  it("records the gross gift and posts the fee as a separate expense", () => {
    const rows = parseCashAppStatement(text);
    // 2 payments → 2 gross inflows + 2 fee expense lines
    expect(rows).toHaveLength(4);

    // $14.46 net + $0.54 fee = $15.00 gross
    expect(rows[0]).toMatchObject({ date: "03/13/2026", amount: 15 });
    expect(rows[1]).toMatchObject({ date: "03/13/2026", amount: -0.54 });
    expect(rows[1].description).toMatch(/processing fee/i);
    expect(rows[1].description).toContain("Sample Donor");

    // $97.25 net + $2.75 fee = $100.00 gross
    expect(rows[2]).toMatchObject({ date: "03/20/2026", amount: 100 });
    expect(rows[3]).toMatchObject({ date: "03/20/2026", amount: -2.75 });
  });

  it("drops the Fee column figure from the gift description", () => {
    const rows = parseCashAppStatement(text);
    expect(rows[0].description).not.toMatch(/\$0\.54/);
    expect(rows[0].description).toContain("Sample Donor");
  });
});

describe("detectPdfSource", () => {
  it("returns null for an unrecognized layout", () => {
    expect(detectPdfSource("just some random text with no bank markers")).toBeNull();
  });

  it("picks the right adapter for each sample format", () => {
    expect(detectPdfSource("BANK OF AMERICA\nDeposits and other credits")).toBe("boa");
    expect(detectPdfSource("bank of texas\nDEPOSITS\nWITHDRAWALS")).toBe("bot");
    expect(detectPdfSource("PayPal\nAccount Activity")).toBe("paypal");
    expect(detectPdfSource("Cash App\nAccount Statement")).toBe("cashapp");
  });
});
