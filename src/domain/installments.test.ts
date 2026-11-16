import { describe, expect, test } from "vitest";

import {
  addMonths,
  installmentBaseDescription,
  installmentDates,
  installmentDescription,
  splitInstallmentAmounts,
  statementPeriodContaining,
  statementTotalCents,
} from "./installments";

describe("splitInstallmentAmounts", () => {
  test("splits evenly when divisible", () => {
    expect(splitInstallmentAmounts(10000, 4)).toEqual([2500, 2500, 2500, 2500]);
  });

  test("puts remainder on the first installment", () => {
    expect(splitInstallmentAmounts(10001, 3)).toEqual([3335, 3333, 3333]);
    expect(splitInstallmentAmounts(10000, 3).reduce((a, b) => a + b, 0)).toBe(
      10000,
    );
    expect(splitInstallmentAmounts(10000, 3)[0]).toBe(3334);
  });

  test("ten installments sum to the purchase total", () => {
    const amounts = splitInstallmentAmounts(123456, 10);
    expect(amounts).toHaveLength(10);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(123456);
    expect(amounts[0]).toBe(12351);
    expect(amounts.slice(1).every((amount) => amount === 12345)).toBe(true);
  });
});

describe("installment dates and descriptions", () => {
  test("schedules one date per month from the purchase date", () => {
    expect(installmentDates("2026-01-15", 3)).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
    ]);
  });

  test("clamps end-of-month dates", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  test("formats installment descriptions", () => {
    expect(installmentDescription("Loja", 3, 10)).toBe("Loja 3/10");
    expect(installmentBaseDescription("Loja 3/10")).toBe("Loja");
  });
});

describe("statementPeriodContaining", () => {
  test("period ends on the closing day", () => {
    expect(statementPeriodContaining(10, "2026-03-05")).toEqual({
      from: "2026-02-11",
      to: "2026-03-10",
    });
    expect(statementPeriodContaining(10, "2026-03-10")).toEqual({
      from: "2026-02-11",
      to: "2026-03-10",
    });
    expect(statementPeriodContaining(10, "2026-03-11")).toEqual({
      from: "2026-03-11",
      to: "2026-04-10",
    });
  });

  test("statement total is the sum of amounts", () => {
    expect(statementTotalCents([-1000, -2500, 100])).toBe(-3400);
  });
});
