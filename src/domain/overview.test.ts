import { describe, expect, test } from "vitest";

import {
  buildOverviewLedger,
  isCompanyToPersonTransfer,
  monthSummaryCents,
  netWorthHistoryDates,
  toNetWorthAccount,
  transactionBalanceOnOrBefore,
} from "./overview";
import { netWorthCents } from "./networth";

describe("netWorthHistoryDates", () => {
  test("ends of the previous 11 months then today", () => {
    expect(netWorthHistoryDates("2026-11-16")).toEqual([
      "2025-12-31",
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
      "2026-08-31",
      "2026-09-30",
      "2026-10-31",
      "2026-11-16",
    ]);
  });
});

describe("company-to-person transfer month summary", () => {
  const pjToPf = {
    amountCents: 10_000,
    transferId: "t1",
    accountEntityType: "pf" as const,
    otherAccountEntityType: "pj" as const,
  };
  const pjOut = {
    amountCents: -10_000,
    transferId: "t1",
    accountEntityType: "pj" as const,
    otherAccountEntityType: "pf" as const,
  };

  test("detects company to person legs", () => {
    expect(isCompanyToPersonTransfer(pjToPf)).toBe(true);
    expect(isCompanyToPersonTransfer(pjOut)).toBe(true);
    expect(
      isCompanyToPersonTransfer({
        ...pjToPf,
        otherAccountEntityType: "pf",
      }),
    ).toBe(false);
  });

  test("scope pf counts the transfer as money in", () => {
    expect(monthSummaryCents([pjToPf], "pf")).toEqual({
      inCents: 10_000,
      outCents: 0,
      leftCents: 10_000,
    });
  });

  test("scope pj counts the transfer as money out", () => {
    expect(monthSummaryCents([pjOut], "pj")).toEqual({
      inCents: 0,
      outCents: -10_000,
      leftCents: -10_000,
    });
  });

  test("scope all excludes the transfer", () => {
    expect(monthSummaryCents([pjToPf, pjOut], "all")).toEqual({
      inCents: 0,
      outCents: 0,
      leftCents: 0,
    });
  });
});

describe("ledger and history balances", () => {
  test("net total equals assets plus liabilities", () => {
    const accounts = [
      toNetWorthAccount({
        type: "bank",
        amountsByDate: [{ date: "2026-01-01", amountCents: 200_000 }],
        asOfDate: "2026-06-01",
      }),
      toNetWorthAccount({
        type: "credit_card",
        amountsByDate: [{ date: "2026-01-01", amountCents: -12_000 }],
        asOfDate: "2026-06-01",
      }),
      toNetWorthAccount({
        type: "loan",
        amountsByDate: [{ date: "2026-01-01", amountCents: -80_000 }],
        asOfDate: "2026-06-01",
      }),
      toNetWorthAccount({
        type: "property",
        amountsByDate: [],
        acquisitionCostCents: 300_000,
        valuations: [{ date: "2026-01-01", valueCents: 400_000 }],
        asOfDate: "2026-06-01",
      }),
    ];

    const ledger = buildOverviewLedger(accounts, "2026-06-01");
    expect(ledger.netTotalCents).toBe(508_000);
    expect(ledger.netTotalCents).toBe(
      ledger.assetsTotalCents + ledger.liabilitiesTotalCents,
    );
    expect(netWorthCents(accounts, "2026-06-01")).toBe(508_000);
  });

  test("transaction balance respects as-of date", () => {
    expect(
      transactionBalanceOnOrBefore(
        [
          { date: "2026-01-01", amountCents: 100 },
          { date: "2026-03-01", amountCents: 50 },
          { date: "2026-06-01", amountCents: 25 },
        ],
        "2026-03-15",
      ),
    ).toBe(150);
  });
});
