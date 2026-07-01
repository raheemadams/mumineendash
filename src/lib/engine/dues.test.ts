import { describe, it, expect } from "vitest";
import { evaluateDues, addMonths, type DuesPlanInput } from "./dues";

const plan = (over: Partial<DuesPlanInput> = {}): DuesPlanInput => ({
  frequency: "MONTHLY",
  amount: 50,
  startDate: new Date("2026-01-01"),
  graceDays: 15,
  active: true,
  ...over,
});

describe("evaluateDues", () => {
  it("is PAID when every elapsed period is covered", () => {
    const today = new Date("2026-03-10");
    const payments = [
      { periodStart: new Date("2026-01-01"), amount: 50 },
      { periodStart: new Date("2026-02-01"), amount: 50 },
      { periodStart: new Date("2026-03-01"), amount: 50 },
    ];
    const r = evaluateDues(plan(), payments, today);
    expect(r.status).toBe("PAID");
    expect(r.balanceDue).toBe(0);
  });

  it("is GRACE_PERIOD when the current period is unpaid but within grace days", () => {
    const today = new Date("2026-03-05"); // 4 days into the March period
    const payments = [
      { periodStart: new Date("2026-01-01"), amount: 50 },
      { periodStart: new Date("2026-02-01"), amount: 50 },
    ];
    const r = evaluateDues(plan(), payments, today);
    expect(r.status).toBe("GRACE_PERIOD");
    expect(r.balanceDue).toBe(50);
  });

  it("is PAST_DUE once an unpaid period passes its grace window", () => {
    const today = new Date("2026-03-20"); // well past Feb + grace
    const payments = [{ periodStart: new Date("2026-01-01"), amount: 50 }];
    const r = evaluateDues(plan(), payments, today);
    expect(r.status).toBe("PAST_DUE");
    expect(r.balanceDue).toBe(100); // Feb + Mar
  });

  it("handles quarterly cadence", () => {
    const today = new Date("2026-07-01");
    const r = evaluateDues(plan({ frequency: "QUARTERLY", amount: 150 }), [], today);
    // Jan, Apr, Jul periods exist by July; none paid
    expect(r.status).toBe("PAST_DUE");
    expect(r.periods.length).toBeGreaterThanOrEqual(3);
  });

  it("reports SUSPENDED for an inactive plan", () => {
    const r = evaluateDues(plan({ active: false }), [], new Date("2026-03-01"));
    expect(r.status).toBe("SUSPENDED");
  });

  it("counts split partial payments toward a period", () => {
    const today = new Date("2026-01-20");
    const payments = [
      { periodStart: new Date("2026-01-01"), amount: 20 },
      { periodStart: new Date("2026-01-01"), amount: 30 },
    ];
    const r = evaluateDues(plan(), payments, today);
    expect(r.status).toBe("PAID");
  });

  it("addMonths rolls the year over", () => {
    expect(addMonths(new Date("2026-11-01"), 3).toISOString().slice(0, 7)).toBe("2027-02");
  });
});
