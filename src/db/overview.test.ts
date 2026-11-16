import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, test } from "vitest";

import { createAccount } from "./accounts";
import { createEntity } from "./entities";
import { upsertFxRates } from "./fx-rates";
import { getDb } from "./index";
import { createLoanWithTerms } from "./loans";
import { getNetWorthOverview } from "./overview";
import { user } from "./schema";
import {
  createTransaction,
  createTransfer,
} from "./transactions";
import { createValuation } from "./valuations";

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

const offlineFetch: typeof fetch = async () => {
  throw new Error("network should not be called");
};

describe("getNetWorthOverview", () => {
  test("total equals balances plus valuations minus liabilities", async () => {
    const owner = await createUser("overview-total", "overview-total@example.com");
    const pf = await createEntity(owner.id, { type: "pf", name: "PF" });
    const bank = await createAccount(owner.id, {
      name: "Banco",
      type: "bank",
      currency: "BRL",
      entityId: pf.id,
      institution: "Banco X",
    });
    const card = await createAccount(owner.id, {
      name: "Cartão",
      type: "credit_card",
      currency: "BRL",
      entityId: pf.id,
      closingDay: 10,
    });
    const house = await createAccount(owner.id, {
      name: "Casa",
      type: "property",
      currency: "BRL",
      entityId: pf.id,
      acquisitionCostCents: 300_000,
      acquisitionDate: "2024-01-01",
    });

    await createTransaction(owner.id, {
      accountId: bank.id,
      date: "2026-01-15",
      amountCents: 200_000,
      description: "Salário",
    });
    await createTransaction(owner.id, {
      accountId: card.id,
      date: "2026-02-01",
      amountCents: -12_000,
      description: "Fatura",
    });
    await createValuation(owner.id, {
      accountId: house.id,
      date: "2026-03-01",
      valueCents: 400_000,
    });

    const overview = await getNetWorthOverview(
      owner.id,
      "all",
      "2026-06-01",
      offlineFetch,
    );
    expect(overview.netWorthCents).toBe(588_000);
    expect(overview.ledger.netTotalCents).toBe(588_000);
    expect(overview.ledger.assetsTotalCents).toBe(600_000);
    expect(overview.ledger.liabilitiesTotalCents).toBe(-12_000);
  });

  test("history matches seeded balances on chosen dates", async () => {
    const owner = await createUser(
      "overview-history",
      "overview-history@example.com",
    );
    const pf = await createEntity(owner.id, { type: "pf", name: "PF" });
    const bank = await createAccount(owner.id, {
      name: "Banco",
      type: "bank",
      currency: "BRL",
      entityId: pf.id,
    });

    await createTransaction(owner.id, {
      accountId: bank.id,
      date: "2026-01-10",
      amountCents: 100_000,
      description: "Aporte",
    });
    await createTransaction(owner.id, {
      accountId: bank.id,
      date: "2026-03-10",
      amountCents: 50_000,
      description: "Aporte 2",
    });

    const overview = await getNetWorthOverview(
      owner.id,
      "pf",
      "2026-04-15",
      offlineFetch,
    );
    const byDate = new Map(
      overview.history.map((point) => [point.date, point.netWorthCents]),
    );
    expect(byDate.get("2025-12-31")).toBe(0);
    expect(byDate.get("2026-01-31")).toBe(100_000);
    expect(byDate.get("2026-02-28")).toBe(100_000);
    expect(byDate.get("2026-03-31")).toBe(150_000);
    expect(byDate.get("2026-04-15")).toBe(150_000);
  });

  test("each scope includes only accounts of the chosen entity type", async () => {
    const owner = await createUser("overview-scope", "overview-scope@example.com");
    const pf = await createEntity(owner.id, { type: "pf", name: "PF" });
    const pj = await createEntity(owner.id, { type: "pj", name: "PJ" });
    const pfBank = await createAccount(owner.id, {
      name: "PF Banco",
      type: "bank",
      currency: "BRL",
      entityId: pf.id,
    });
    const pjBank = await createAccount(owner.id, {
      name: "PJ Banco",
      type: "bank",
      currency: "BRL",
      entityId: pj.id,
    });
    await createTransaction(owner.id, {
      accountId: pfBank.id,
      date: "2026-05-01",
      amountCents: 10_000,
      description: "PF",
    });
    await createTransaction(owner.id, {
      accountId: pjBank.id,
      date: "2026-05-01",
      amountCents: 90_000,
      description: "PJ",
    });

    const pfOverview = await getNetWorthOverview(
      owner.id,
      "pf",
      "2026-05-15",
      offlineFetch,
    );
    const pjOverview = await getNetWorthOverview(
      owner.id,
      "pj",
      "2026-05-15",
      offlineFetch,
    );
    const allOverview = await getNetWorthOverview(
      owner.id,
      "all",
      "2026-05-15",
      offlineFetch,
    );

    expect(pfOverview.netWorthCents).toBe(10_000);
    expect(pjOverview.netWorthCents).toBe(90_000);
    expect(allOverview.netWorthCents).toBe(100_000);
  });

  test("company-to-person transfer month summary for all scopes", async () => {
    const owner = await createUser(
      "overview-transfer",
      "overview-transfer@example.com",
    );
    const pf = await createEntity(owner.id, { type: "pf", name: "PF" });
    const pj = await createEntity(owner.id, { type: "pj", name: "PJ" });
    const pfBank = await createAccount(owner.id, {
      name: "PF Banco",
      type: "bank",
      currency: "BRL",
      entityId: pf.id,
    });
    const pjBank = await createAccount(owner.id, {
      name: "PJ Banco",
      type: "bank",
      currency: "BRL",
      entityId: pj.id,
    });

    await createTransaction(owner.id, {
      accountId: pjBank.id,
      date: "2026-11-01",
      amountCents: 50_000,
      description: "Caixa PJ",
    });
    await createTransfer(owner.id, {
      fromAccountId: pjBank.id,
      toAccountId: pfBank.id,
      date: "2026-11-10",
      amountCents: 20_000,
      description: "Pró-labore",
    });

    const pfOverview = await getNetWorthOverview(
      owner.id,
      "pf",
      "2026-11-16",
      offlineFetch,
    );
    const pjOverview = await getNetWorthOverview(
      owner.id,
      "pj",
      "2026-11-16",
      offlineFetch,
    );
    const allOverview = await getNetWorthOverview(
      owner.id,
      "all",
      "2026-11-16",
      offlineFetch,
    );

    expect(pfOverview.monthSummary).toEqual({
      inCents: 20_000,
      outCents: 0,
      leftCents: 20_000,
    });
    expect(pjOverview.monthSummary).toEqual({
      inCents: 50_000,
      outCents: -20_000,
      leftCents: 30_000,
    });
    expect(allOverview.monthSummary).toEqual({
      inCents: 50_000,
      outCents: 0,
      leftCents: 50_000,
    });
  });

  test("two-user isolation on the overview entry function", async () => {
    const userA = await createUser("overview-a", "overview-a@example.com");
    const userB = await createUser("overview-b", "overview-b@example.com");
    const entityA = await createEntity(userA.id, { type: "pf", name: "A" });
    const entityB = await createEntity(userB.id, { type: "pf", name: "B" });
    const accountA = await createAccount(userA.id, {
      name: "A",
      type: "bank",
      currency: "BRL",
      entityId: entityA.id,
    });
    const accountB = await createAccount(userB.id, {
      name: "B",
      type: "bank",
      currency: "BRL",
      entityId: entityB.id,
    });
    await createTransaction(userA.id, {
      accountId: accountA.id,
      date: "2026-11-01",
      amountCents: 1_000,
      description: "A",
    });
    await createTransaction(userB.id, {
      accountId: accountB.id,
      date: "2026-11-01",
      amountCents: 9_000,
      description: "B",
    });

    const overviewA = await getNetWorthOverview(
      userA.id,
      "all",
      "2026-11-16",
      offlineFetch,
    );
    const overviewB = await getNetWorthOverview(
      userB.id,
      "all",
      "2026-11-16",
      offlineFetch,
    );
    expect(overviewA.netWorthCents).toBe(1_000);
    expect(overviewB.netWorthCents).toBe(9_000);
  });

  test("loan opening stays out of month summary; interest and net worth count", async () => {
    const owner = await createUser(
      "overview-loan-opening",
      "overview-loan-opening@example.com",
    );
    const pf = await createEntity(owner.id, { type: "pf", name: "PF" });
    const loan = await createAccount(owner.id, {
      name: "Empréstimo",
      type: "loan",
      currency: "BRL",
      entityId: pf.id,
    });
    const created = await createLoanWithTerms(owner.id, {
      accountId: loan.id,
      principalCents: 800_000,
      monthlyInterestRate: 0.01,
      termMonths: 12,
      firstPaymentDate: "2026-11-10",
      system: "sac",
    });
    expect(created).not.toBeNull();

    await createTransaction(owner.id, {
      accountId: loan.id,
      date: "2026-11-15",
      amountCents: -5_000,
      description: "Juros",
    });

    const overview = await getNetWorthOverview(
      owner.id,
      "pf",
      "2026-11-16",
      offlineFetch,
    );

    expect(overview.monthSummary).toEqual({
      inCents: 0,
      outCents: -5_000,
      leftCents: -5_000,
    });
    expect(overview.netWorthCents).toBe(-805_000);
  });

  test("foreign balance uses stored PTAX for the as-of date", async () => {
    const owner = await createUser("overview-fx", "overview-fx@example.com");
    const pf = await createEntity(owner.id, { type: "pf", name: "PF" });
    const usd = await createAccount(owner.id, {
      name: "USD",
      type: "bank",
      currency: "USD",
      entityId: pf.id,
    });
    await upsertFxRates([
      {
        currency: "USD",
        date: "2026-11-13",
        buyRate: "5.00",
        sellRate: "5.10",
      },
    ]);
    await createTransaction(owner.id, {
      accountId: usd.id,
      date: "2026-11-01",
      amountCents: 10_000,
      description: "USD",
    });

    const overview = await getNetWorthOverview(
      owner.id,
      "pf",
      "2026-11-13",
      offlineFetch,
    );
    expect(overview.netWorthCents).toBe(50_000);
    expect(overview.fxConversions[0]?.rateDate).toBe("2026-11-13");
    expect(overview.excludedAccounts).toEqual([]);
  });
});
