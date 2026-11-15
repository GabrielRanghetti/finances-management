import { describe, expect, test } from "vitest";

import { valuedBalanceOnDate } from "./valuations";

describe("valuedBalanceOnDate", () => {
  test("uses the latest valuation on or before the date", () => {
    const valuations = [
      { date: "2024-01-01", valueCents: 100_000 },
      { date: "2025-06-01", valueCents: 150_000 },
      { date: "2026-01-01", valueCents: 140_000 },
    ];
    expect(valuedBalanceOnDate("2025-12-31", 90_000, valuations)).toBe(150_000);
    expect(valuedBalanceOnDate("2026-01-01", 90_000, valuations)).toBe(140_000);
    expect(valuedBalanceOnDate("2023-12-31", 90_000, valuations)).toBe(90_000);
  });

  test("falls back to acquisition cost when there is no valuation", () => {
    expect(valuedBalanceOnDate("2026-01-01", 250_000, [])).toBe(250_000);
    expect(valuedBalanceOnDate("2026-01-01", null, [])).toBe(0);
  });
});
