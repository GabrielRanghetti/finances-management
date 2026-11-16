import { describe, expect, test } from "vitest";

import { accountBalanceOnDate, netWorthCents } from "./networth";

describe("netWorthCents", () => {
  test("sums transaction balances for banks, cards and loans", () => {
    expect(
      netWorthCents(
        [
          { type: "bank", transactionBalanceCents: 200_000 },
          { type: "credit_card", transactionBalanceCents: -12_000 },
          { type: "loan", transactionBalanceCents: -80_000 },
        ],
        "2026-06-01",
      ),
    ).toBe(108_000);
  });

  test("valuations change net worth from that date on", () => {
    const accounts = [
      { type: "bank", transactionBalanceCents: 50_000 },
      {
        type: "property",
        transactionBalanceCents: 0,
        acquisitionCostCents: 300_000,
        valuations: [
          { date: "2025-01-01", valueCents: 320_000 },
          { date: "2026-01-01", valueCents: 400_000 },
        ],
      },
    ];

    expect(netWorthCents(accounts, "2024-12-31")).toBe(350_000);
    expect(netWorthCents(accounts, "2025-06-01")).toBe(370_000);
    expect(netWorthCents(accounts, "2026-06-01")).toBe(450_000);
  });
});

describe("accountBalanceOnDate", () => {
  test("property uses valuation, bank uses transactions", () => {
    expect(
      accountBalanceOnDate(
        {
          type: "property",
          transactionBalanceCents: 999,
          acquisitionCostCents: 100,
          valuations: [{ date: "2026-01-01", valueCents: 200 }],
        },
        "2026-02-01",
      ),
    ).toBe(200);
    expect(
      accountBalanceOnDate(
        { type: "bank", transactionBalanceCents: 1_500 },
        "2026-02-01",
      ),
    ).toBe(1_500);
  });
});
