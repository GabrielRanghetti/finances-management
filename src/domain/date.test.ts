import { describe, expect, test } from "vitest";

import { todayInSaoPaulo } from "./date";

describe("todayInSaoPaulo", () => {
  test("returns the same calendar date in Brasília at 23:30 BRT when UTC is already tomorrow", () => {
    // 2026-11-16 23:30:00 in America/Sao_Paulo (UTC-3) is 2026-11-17 02:30:00Z
    const lateNightBrt = new Date("2026-11-16T23:30:00-03:00");
    expect(lateNightBrt.toISOString().slice(0, 10)).toBe("2026-11-17");
    expect(todayInSaoPaulo(lateNightBrt)).toBe("2026-11-16");
  });

  test("formats daytime dates in America/Sao_Paulo as YYYY-MM-DD", () => {
    const middayBrt = new Date("2026-03-05T15:00:00-03:00");
    expect(todayInSaoPaulo(middayBrt)).toBe("2026-03-05");
  });
});
