import { describe, expect, test } from "vitest";

import { netWorthCents } from "./networth";

describe("netWorthCents", () => {
  test("sums assets and liabilities", () => {
    expect(netWorthCents([100_000, 50_000, -30_000, -5_000])).toBe(115_000);
  });

  test("loans and cards reduce net worth", () => {
    const bank = 200_000;
    const card = -12_000;
    const loan = -80_000;
    expect(netWorthCents([bank, card, loan])).toBe(108_000);
  });
});
