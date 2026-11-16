import { describe, expect, test } from "vitest";

import {
  accountBalanceCents,
  formatBalanceCentsToBrl,
  formatCentsToBrl,
  formatSignedCentsToBrl,
  incomeExpenseTotals,
  parseBrlToCents,
  totalsByCategory,
} from "./money";

describe("parseBrlToCents", () => {
  test("parses Brazilian thousand and decimal separators", () => {
    expect(parseBrlToCents("1.234,56")).toBe(123456);
    expect(parseBrlToCents("10,00")).toBe(1000);
    expect(parseBrlToCents("0,50")).toBe(50);
    expect(parseBrlToCents("100")).toBe(10000);
  });

  test("parses negatives", () => {
    expect(parseBrlToCents("-1.234,56")).toBe(-123456);
  });

  test("rejects invalid input", () => {
    expect(() => parseBrlToCents("")).toThrow();
    expect(() => parseBrlToCents("abc")).toThrow();
    expect(() => parseBrlToCents("1.234.56")).toThrow();
  });
});

describe("formatCentsToBrl", () => {
  test("formats cents", () => {
    expect(formatCentsToBrl(123456)).toBe("1.234,56");
    expect(formatCentsToBrl(-50)).toBe("-0,50");
  });

  test("formats signed cents with plus and unicode minus", () => {
    expect(formatSignedCentsToBrl(738000)).toBe("+7.380,00");
    expect(formatSignedCentsToBrl(738000, true)).toBe("+ R$ 7.380,00");
    expect(formatSignedCentsToBrl(-41237)).toBe("−412,37");
    expect(formatSignedCentsToBrl(-41237, true)).toBe("− R$ 412,37");
    expect(formatSignedCentsToBrl(0)).toBe("0,00");
    expect(formatSignedCentsToBrl(0, true)).toBe("R$ 0,00");
  });

  test("formats balances unsigned when non-negative and with unicode minus when negative", () => {
    expect(formatBalanceCentsToBrl(45638000)).toBe("456.380,00");
    expect(formatBalanceCentsToBrl(45638000, true)).toBe("R$ 456.380,00");
    expect(formatBalanceCentsToBrl(-31899000)).toBe("−318.990,00");
    expect(formatBalanceCentsToBrl(-31899000, true)).toBe("− R$ 318.990,00");
    expect(formatBalanceCentsToBrl(0, true)).toBe("R$ 0,00");
  });
});

describe("ledger aggregates", () => {
  test("balance is the sum of amounts", () => {
    expect(accountBalanceCents([1000, -250, 50])).toBe(800);
  });

  test("transfers are excluded from income and expense totals", () => {
    const totals = incomeExpenseTotals([
      { amountCents: 5000, categoryId: "sal", transferId: null },
      { amountCents: -1200, categoryId: "food", transferId: null },
      { amountCents: -3000, categoryId: "prolabore", transferId: "t1" },
      { amountCents: 3000, categoryId: "prolabore", transferId: "t1" },
    ]);
    expect(totals.incomeCents).toBe(5000);
    expect(totals.expenseCents).toBe(-1200);
  });

  test("totals by category match non-transfer entries", () => {
    const totals = totalsByCategory([
      { amountCents: 5000, categoryId: "sal", transferId: null },
      { amountCents: -700, categoryId: "food", transferId: null },
      { amountCents: -500, categoryId: "food", transferId: null },
      { amountCents: -100, categoryId: "food", transferId: "t1" },
    ]);
    expect(totals.get("sal")).toBe(5000);
    expect(totals.get("food")).toBe(-1200);
  });
});
