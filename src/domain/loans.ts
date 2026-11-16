import { addMonths } from "./installments";

export const loanSystems = ["price", "sac"] as const;
export type LoanSystem = (typeof loanSystems)[number];

export type LoanScheduleLine = {
  installment: number;
  date: string;
  paymentCents: number;
  interestCents: number;
  amortizationCents: number;
  outstandingCents: number;
};

export type LoanTermsInput = {
  principalCents: number;
  monthlyInterestRate: number;
  termMonths: number;
  firstPaymentDate: string;
  system: LoanSystem;
};

function assertTerms(terms: LoanTermsInput) {
  if (
    !Number.isInteger(terms.principalCents) ||
    terms.principalCents <= 0 ||
    !Number.isInteger(terms.termMonths) ||
    terms.termMonths < 1 ||
    !(terms.monthlyInterestRate >= 0) ||
    !Number.isFinite(terms.monthlyInterestRate)
  ) {
    throw new Error("invalid loan terms");
  }
}

function pricePaymentCents(
  principalCents: number,
  monthlyInterestRate: number,
  termMonths: number,
): number {
  if (monthlyInterestRate === 0) {
    return Math.round(principalCents / termMonths);
  }
  const factor = (1 + monthlyInterestRate) ** termMonths;
  const payment =
    (principalCents * monthlyInterestRate * factor) / (factor - 1);
  return Math.round(payment);
}

/** Build the amortization schedule. The last line absorbs rounding so balance ends at 0. */
export function buildLoanSchedule(terms: LoanTermsInput): LoanScheduleLine[] {
  assertTerms(terms);
  const { principalCents, monthlyInterestRate, termMonths, system } = terms;
  const lines: LoanScheduleLine[] = [];
  let outstanding = principalCents;

  if (system === "sac") {
    const baseAmortization = Math.floor(principalCents / termMonths);
    for (let installment = 1; installment <= termMonths; installment += 1) {
      const interestCents = Math.round(outstanding * monthlyInterestRate);
      const amortizationCents =
        installment === termMonths
          ? outstanding
          : Math.min(baseAmortization, outstanding);
      const paymentCents = interestCents + amortizationCents;
      outstanding -= amortizationCents;
      lines.push({
        installment,
        date: addMonths(terms.firstPaymentDate, installment - 1),
        paymentCents,
        interestCents,
        amortizationCents,
        outstandingCents: outstanding,
      });
    }
    return lines;
  }

  const payment = pricePaymentCents(
    principalCents,
    monthlyInterestRate,
    termMonths,
  );
  for (let installment = 1; installment <= termMonths; installment += 1) {
    const interestCents = Math.round(outstanding * monthlyInterestRate);
    if (installment === termMonths) {
      const amortizationCents = outstanding;
      lines.push({
        installment,
        date: addMonths(terms.firstPaymentDate, installment - 1),
        paymentCents: interestCents + amortizationCents,
        interestCents,
        amortizationCents,
        outstandingCents: 0,
      });
      outstanding = 0;
      break;
    }
    const amortizationCents = Math.min(payment - interestCents, outstanding);
    outstanding -= amortizationCents;
    lines.push({
      installment,
      date: addMonths(terms.firstPaymentDate, installment - 1),
      paymentCents: interestCents + amortizationCents,
      interestCents,
      amortizationCents,
      outstandingCents: outstanding,
    });
  }
  return lines;
}
