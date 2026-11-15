import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, test } from "vitest";

import { createAccount, getAccount, listAccounts } from "./accounts";
import {
  createEntity,
  getEntity,
  listEntities,
} from "./entities";
import { getDb } from "./index";
import { user } from "./schema";
import {
  createLoanWithTerms,
  getLoanTerms,
  listLoanTerms,
} from "./loans";
import {
  cancelInstallmentGroup,
  createInstallmentPurchase,
  createTransaction,
  getTransaction,
  listInstallmentGroup,
  listTransactions,
} from "./transactions";

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

describe("user data isolation", () => {
  test("list and detail routes only return the caller's rows", async () => {
    const userA = await createUser("user-a", "a@example.com");
    const userB = await createUser("user-b", "b@example.com");

    const entityA = await createEntity(userA.id, {
      type: "pj",
      name: "Empresa A",
    });
    const entityB = await createEntity(userB.id, {
      type: "pj",
      name: "Empresa B",
    });

    const accountA = await createAccount(userA.id, {
      name: "Conta A",
      type: "bank",
      currency: "BRL",
      entityId: entityA.id,
    });
    const accountB = await createAccount(userB.id, {
      name: "Conta B",
      type: "bank",
      currency: "BRL",
      entityId: entityB.id,
    });

    // List route: src/app/app/accounts/page.tsx → listAccounts(session.user.id)
    const listForA = await listAccounts(userA.id);
    const listForB = await listAccounts(userB.id);

    expect(listForA.map((row) => row.id)).toEqual([accountA.id]);
    expect(listForB.map((row) => row.id)).toEqual([accountB.id]);
    expect(listForA.every((row) => row.userId === userA.id)).toBe(true);
    expect(listForB.every((row) => row.userId === userB.id)).toBe(true);

    // Detail route: src/app/app/accounts/[id]/page.tsx → getAccount(session.user.id, id)
    const detailOwn = await getAccount(userA.id, accountA.id);
    expect(detailOwn?.id).toBe(accountA.id);

    // User A must not find user B's account (page calls notFound())
    const detailCross = await getAccount(userA.id, accountB.id);
    expect(detailCross).toBeNull();

    // Entities list/detail
    const entitiesA = await listEntities(userA.id);
    const entitiesB = await listEntities(userB.id);
    expect(entitiesA.map((row) => row.id)).toContain(entityA.id);
    expect(entitiesA.map((row) => row.id)).not.toContain(entityB.id);
    expect(entitiesB.map((row) => row.id)).toContain(entityB.id);
    expect(entitiesB.map((row) => row.id)).not.toContain(entityA.id);

    expect(await getEntity(userA.id, entityA.id)).not.toBeNull();
    expect(await getEntity(userA.id, entityB.id)).toBeNull();

    const txA = await createTransaction(userA.id, {
      accountId: accountA.id,
      date: "2026-02-01",
      amountCents: 1000,
      description: "Tx A",
    });
    const txB = await createTransaction(userB.id, {
      accountId: accountB.id,
      date: "2026-02-01",
      amountCents: 2000,
      description: "Tx B",
    });

    const txListA = await listTransactions(userA.id);
    const txListB = await listTransactions(userB.id);
    expect(txListA.map((row) => row.id)).toEqual([txA!.id]);
    expect(txListB.map((row) => row.id)).toEqual([txB!.id]);
    expect(await getTransaction(userA.id, txB!.id)).toBeNull();

    const cardA = await createAccount(userA.id, {
      name: "Cartão A",
      type: "credit_card",
      currency: "BRL",
      entityId: entityA.id,
      closingDay: 10,
    });
    const cardB = await createAccount(userB.id, {
      name: "Cartão B",
      type: "credit_card",
      currency: "BRL",
      entityId: entityB.id,
      closingDay: 5,
    });
    const installmentsA = await createInstallmentPurchase(userA.id, {
      accountId: cardA.id,
      date: "2026-02-01",
      amountCents: 1000,
      description: "Loja A",
      installmentCount: 2,
    });
    const installmentsB = await createInstallmentPurchase(userB.id, {
      accountId: cardB.id,
      date: "2026-02-01",
      amountCents: 2000,
      description: "Loja B",
      installmentCount: 2,
    });
    expect(installmentsA).not.toBeNull();
    expect(installmentsB).not.toBeNull();

    const groupA = await listInstallmentGroup(
      userA.id,
      installmentsA!.installmentGroupId,
    );
    const groupCross = await listInstallmentGroup(
      userA.id,
      installmentsB!.installmentGroupId,
    );
    expect(groupA).toHaveLength(2);
    expect(groupCross).toHaveLength(0);
    expect(
      await cancelInstallmentGroup(
        userA.id,
        installmentsB!.installmentGroupId,
      ),
    ).toBeNull();
    expect(
      await listInstallmentGroup(userB.id, installmentsB!.installmentGroupId),
    ).toHaveLength(2);

    const loanA = await createAccount(userA.id, {
      name: "Empréstimo A",
      type: "loan",
      currency: "BRL",
      entityId: entityA.id,
    });
    const loanB = await createAccount(userB.id, {
      name: "Empréstimo B",
      type: "loan",
      currency: "BRL",
      entityId: entityB.id,
    });
    await createLoanWithTerms(userA.id, {
      accountId: loanA.id,
      principalCents: 50_000,
      monthlyInterestRate: 0.01,
      termMonths: 2,
      firstPaymentDate: "2026-05-01",
      system: "sac",
    });
    await createLoanWithTerms(userB.id, {
      accountId: loanB.id,
      principalCents: 60_000,
      monthlyInterestRate: 0.01,
      termMonths: 2,
      firstPaymentDate: "2026-05-01",
      system: "price",
    });
    expect(await listLoanTerms(userA.id)).toHaveLength(1);
    expect(await getLoanTerms(userA.id, loanB.id)).toBeNull();
  });
});
