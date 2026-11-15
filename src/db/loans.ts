import { and, eq } from "drizzle-orm";

import { getAccount } from "./accounts";
import { ensureDefaultCategories, ensureNamedCategory } from "./categories";
import { getDb } from "./index";
import { loanTerms } from "./schema";
import {
  createTransaction,
  createTransfer,
  listAccountAmounts,
  listTransactions,
} from "./transactions";
import {
  buildLoanSchedule,
  loanSystems,
  type LoanSystem,
} from "@/domain/loans";
import { accountBalanceCents } from "@/domain/money";

export type LoanTermsInput = {
  accountId: string;
  principalCents: number;
  monthlyInterestRate: number;
  termMonths: number;
  firstPaymentDate: string;
  system: LoanSystem;
};

function requireUserId(userId: string): string {
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

function parseRate(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

export async function getLoanTerms(userId: string, accountId: string) {
  const uid = requireUserId(userId);
  const rows = await getDb()
    .select()
    .from(loanTerms)
    .where(and(eq(loanTerms.userId, uid), eq(loanTerms.accountId, accountId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listLoanTerms(userId: string) {
  const uid = requireUserId(userId);
  return getDb().select().from(loanTerms).where(eq(loanTerms.userId, uid));
}

export async function createLoanWithTerms(
  userId: string,
  input: LoanTermsInput,
) {
  const uid = requireUserId(userId);
  if (
    input.principalCents <= 0 ||
    input.termMonths < 1 ||
    input.monthlyInterestRate < 0 ||
    !loanSystems.includes(input.system)
  ) {
    return null;
  }

  const account = await getAccount(uid, input.accountId);
  if (!account || account.type !== "loan") {
    return null;
  }
  const existing = await getLoanTerms(uid, input.accountId);
  if (existing) {
    return null;
  }

  const [terms] = await getDb()
    .insert(loanTerms)
    .values({
      userId: uid,
      accountId: input.accountId,
      principalCents: input.principalCents,
      monthlyInterestRate: String(input.monthlyInterestRate),
      termMonths: input.termMonths,
      firstPaymentDate: input.firstPaymentDate,
      system: input.system,
    })
    .returning();

  const opening = await createTransaction(uid, {
    accountId: input.accountId,
    date: input.firstPaymentDate,
    amountCents: -input.principalCents,
    description: "Principal",
  });
  if (!opening) {
    return null;
  }

  return { terms, opening };
}

export function scheduleForTerms(terms: {
  principalCents: number;
  monthlyInterestRate: string | number;
  termMonths: number;
  firstPaymentDate: string;
  system: string;
}) {
  return buildLoanSchedule({
    principalCents: terms.principalCents,
    monthlyInterestRate: parseRate(terms.monthlyInterestRate),
    termMonths: terms.termMonths,
    firstPaymentDate: terms.firstPaymentDate,
    system: terms.system as LoanSystem,
  });
}

/** How many installment payments have been recorded on the loan account. */
export async function countPaidInstallments(
  userId: string,
  accountId: string,
) {
  const uid = requireUserId(userId);
  const txs = await listTransactions(uid, { accountId });
  // Each payment posts a transfer credit onto the loan account.
  return txs.filter(
    (row) => row.transferId !== null && row.amountCents > 0,
  ).length;
}

export async function recordLoanPayment(
  userId: string,
  input: {
    loanAccountId: string;
    fromAccountId: string;
    installment: number;
  },
) {
  const uid = requireUserId(userId);
  const terms = await getLoanTerms(uid, input.loanAccountId);
  if (!terms) {
    return null;
  }

  const schedule = scheduleForTerms(terms);
  const line = schedule.find((row) => row.installment === input.installment);
  if (!line) {
    return null;
  }

  const paid = await countPaidInstallments(uid, input.loanAccountId);
  if (input.installment !== paid + 1) {
    return null;
  }

  const fromAccount = await getAccount(uid, input.fromAccountId);
  const loanAccount = await getAccount(uid, input.loanAccountId);
  if (!fromAccount || !loanAccount || fromAccount.id === loanAccount.id) {
    return null;
  }

  await ensureDefaultCategories(uid);
  const juros = await ensureNamedCategory(uid, "Juros", "expense");
  if (!juros) {
    return null;
  }

  const interest =
    line.interestCents === 0
      ? null
      : await createTransaction(uid, {
          accountId: input.loanAccountId,
          date: line.date,
          amountCents: 0 - line.interestCents,
          description: `Juros ${input.installment}/${terms.termMonths}`,
          categoryId: juros.id,
        });
  if (line.interestCents > 0 && !interest) {
    return null;
  }

  const transfer = await createTransfer(uid, {
    fromAccountId: input.fromAccountId,
    toAccountId: input.loanAccountId,
    date: line.date,
    amountCents: line.paymentCents,
    description: `Parcela ${input.installment}/${terms.termMonths}`,
  });
  if (!transfer) {
    return null;
  }

  const amounts = (await listAccountAmounts(uid, input.loanAccountId)) ?? [];
  const balanceCents = accountBalanceCents(amounts);

  return {
    interest,
    transfer,
    outstandingCents: line.outstandingCents,
    balanceCents,
  };
}
