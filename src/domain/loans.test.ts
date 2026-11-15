import { describe, expect, test } from "vitest";

import { buildLoanSchedule } from "./loans";

describe("buildLoanSchedule SAC", () => {
  test("matches a hand-worked 4-month example", () => {
    // P=1000,00; i=1%/mês; n=4 → amortização R$ 250,00
    const schedule = buildLoanSchedule({
      principalCents: 100_000,
      monthlyInterestRate: 0.01,
      termMonths: 4,
      firstPaymentDate: "2026-02-01",
      system: "sac",
    });

    expect(schedule).toEqual([
      {
        installment: 1,
        date: "2026-02-01",
        paymentCents: 26_000,
        interestCents: 1_000,
        amortizationCents: 25_000,
        outstandingCents: 75_000,
      },
      {
        installment: 2,
        date: "2026-03-01",
        paymentCents: 25_750,
        interestCents: 750,
        amortizationCents: 25_000,
        outstandingCents: 50_000,
      },
      {
        installment: 3,
        date: "2026-04-01",
        paymentCents: 25_500,
        interestCents: 500,
        amortizationCents: 25_000,
        outstandingCents: 25_000,
      },
      {
        installment: 4,
        date: "2026-05-01",
        paymentCents: 25_250,
        interestCents: 250,
        amortizationCents: 25_000,
        outstandingCents: 0,
      },
    ]);
  });

  test("last installment absorbs principal remainder", () => {
    const schedule = buildLoanSchedule({
      principalCents: 100_001,
      monthlyInterestRate: 0,
      termMonths: 3,
      firstPaymentDate: "2026-01-10",
      system: "sac",
    });
    expect(schedule.map((line) => line.amortizationCents)).toEqual([
      33_333, 33_333, 33_335,
    ]);
    expect(schedule.at(-1)?.outstandingCents).toBe(0);
  });
});

describe("buildLoanSchedule Price", () => {
  test("matches a hand-worked 3-month example", () => {
    // P=1000,00; i=2%/mês; n=3
    // PMT = round(100000 * 0.02 * 1.02^3 / (1.02^3 - 1)) = 34675
    const schedule = buildLoanSchedule({
      principalCents: 100_000,
      monthlyInterestRate: 0.02,
      termMonths: 3,
      firstPaymentDate: "2026-01-15",
      system: "price",
    });

    expect(schedule).toEqual([
      {
        installment: 1,
        date: "2026-01-15",
        paymentCents: 34_675,
        interestCents: 2_000,
        amortizationCents: 32_675,
        outstandingCents: 67_325,
      },
      {
        installment: 2,
        date: "2026-02-15",
        paymentCents: 34_675,
        interestCents: 1_347,
        amortizationCents: 33_328,
        outstandingCents: 33_997,
      },
      {
        installment: 3,
        date: "2026-03-15",
        paymentCents: 34_677,
        interestCents: 680,
        amortizationCents: 33_997,
        outstandingCents: 0,
      },
    ]);
  });
});
