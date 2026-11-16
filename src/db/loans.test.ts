import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, test, vi } from "vitest";

import { createAccount } from "./accounts";
import { getDb } from "./index";
import {
  countPaidInstallments,
  createLoanWithTerms,
  getLoanTerms,
  listLoanTerms,
  recordLoanPayment,
  scheduleForTerms,
} from "./loans";
import { user } from "./schema";
import * as transactionsDb from "./transactions";
import { listAccountAmounts, listTransactions } from "./transactions";
import { accountBalanceCents } from "@/domain/money";
import { netWorthCents } from "@/domain/networth";
import { messages } from "@/messages/pt-BR";

beforeAll(async () => {
  const db = getDb();
  await migrate(db as never, { migrationsFolder: "./drizzle" });
});

async function createUser(id: string, email: string) {
  const now = new Date();
  await getDb().insert(user).values({
    id,
    name: id,
    email,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
  return { id };
}

describe("loans ledger", () => {
  test("opening principal and payments track the schedule outstanding balance", async () => {
    const owner = await createUser("loan-owner", "loan@example.com");
    const bank = await createAccount(owner.id, {
      name: "Conta",
      type: "bank",
      currency: "BRL",
    });
    await createAccount(owner.id, {
      // seed funds via later transfer source balance is not required for ledger math
      name: "Caixa",
      type: "cash",
      currency: "BRL",
    });
    // Fund the bank so transfers are just ledger entries (no balance check).
    const { createTransaction } = await import("./transactions");
    await createTransaction(owner.id, {
      accountId: bank.id,
      date: "2026-01-01",
      amountCents: 500_000,
      description: "Saldo",
    });

    const loanAccount = await createAccount(owner.id, {
      name: "Financiamento",
      type: "loan",
      currency: "BRL",
    });
    const created = await createLoanWithTerms(owner.id, {
      accountId: loanAccount.id,
      principalCents: 100_000,
      monthlyInterestRate: 0.01,
      termMonths: 4,
      firstPaymentDate: "2026-02-01",
      system: "sac",
    });
    expect(created).not.toBeNull();

    const terms = await getLoanTerms(owner.id, loanAccount.id);
    expect(terms?.principalCents).toBe(100_000);

    let amounts =
      (await listAccountAmounts(owner.id, loanAccount.id)) ?? [];
    expect(accountBalanceCents(amounts)).toBe(-100_000);

    const schedule = scheduleForTerms(terms!);
    for (const line of schedule) {
      const paid = await recordLoanPayment(owner.id, {
        loanAccountId: loanAccount.id,
        fromAccountId: bank.id,
        installment: line.installment,
      });
      expect(paid).not.toBeNull();
      // balance + outstanding === 0 (avoids Object.is(+0, -0) false negatives)
      expect(paid!.balanceCents + line.outstandingCents).toBe(0);
      amounts = (await listAccountAmounts(owner.id, loanAccount.id)) ?? [];
      expect(accountBalanceCents(amounts) + line.outstandingCents).toBe(0);
    }

    expect(await countPaidInstallments(owner.id, loanAccount.id)).toBe(4);
    amounts = (await listAccountAmounts(owner.id, loanAccount.id)) ?? [];
    expect(accountBalanceCents(amounts)).toBe(0);

    const bankAmounts = (await listAccountAmounts(owner.id, bank.id)) ?? [];
    const loanAmounts = amounts;
    expect(
      netWorthCents(
        [
          {
            type: "bank",
            transactionBalanceCents: accountBalanceCents(bankAmounts),
          },
          {
            type: "loan",
            transactionBalanceCents: accountBalanceCents(loanAmounts),
          },
        ],
        "2026-12-31",
      ),
    ).toBe(accountBalanceCents(bankAmounts));
  });

  test("loan terms are user-scoped", async () => {
    const userA = await createUser("loan-a", "loan-a@example.com");
    const userB = await createUser("loan-b", "loan-b@example.com");
    const loanA = await createAccount(userA.id, {
      name: "Empréstimo A",
      type: "loan",
      currency: "BRL",
    });
    const loanB = await createAccount(userB.id, {
      name: "Empréstimo B",
      type: "loan",
      currency: "BRL",
    });
    await createLoanWithTerms(userA.id, {
      accountId: loanA.id,
      principalCents: 10_000,
      monthlyInterestRate: 0,
      termMonths: 2,
      firstPaymentDate: "2026-03-01",
      system: "price",
    });
    await createLoanWithTerms(userB.id, {
      accountId: loanB.id,
      principalCents: 20_000,
      monthlyInterestRate: 0,
      termMonths: 2,
      firstPaymentDate: "2026-03-01",
      system: "sac",
    });

    expect(await listLoanTerms(userA.id)).toHaveLength(1);
    expect(await getLoanTerms(userA.id, loanB.id)).toBeNull();
    expect(await getLoanTerms(userB.id, loanA.id)).toBeNull();
  });

  test("payment rolls back interest charge when transfer write fails", async () => {
    const owner = await createUser("loan-atomic", "loan-atomic@example.com");
    const bank = await createAccount(owner.id, {
      name: "Conta",
      type: "bank",
      currency: "BRL",
    });
    await transactionsDb.createTransaction(owner.id, {
      accountId: bank.id,
      date: "2026-01-01",
      amountCents: 500_000,
      description: "Saldo",
    });
    const loanAccount = await createAccount(owner.id, {
      name: "Financiamento",
      type: "loan",
      currency: "BRL",
    });
    await createLoanWithTerms(owner.id, {
      accountId: loanAccount.id,
      principalCents: 100_000,
      monthlyInterestRate: 0.01,
      termMonths: 4,
      firstPaymentDate: "2026-02-01",
      system: "sac",
    });

    const transferSpy = vi
      .spyOn(transactionsDb, "createTransfer")
      .mockResolvedValueOnce(null);

    const paid = await recordLoanPayment(owner.id, {
      loanAccountId: loanAccount.id,
      fromAccountId: bank.id,
      installment: 1,
    });
    transferSpy.mockRestore();

    expect(paid).toBeNull();
    const txs = await listTransactions(owner.id, {
      accountId: loanAccount.id,
    });
    expect(
      txs.filter((row) =>
        row.description.startsWith(`${messages.accounts.loanInterest} `),
      ),
    ).toHaveLength(0);
    expect(await countPaidInstallments(owner.id, loanAccount.id)).toBe(0);
  });
});
