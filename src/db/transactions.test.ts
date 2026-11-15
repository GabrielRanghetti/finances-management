import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, test } from "vitest";

import { createAccount } from "./accounts";
import { getDb } from "./index";
import { user } from "./schema";
import {
  createTransaction,
  createTransfer,
  deleteTransaction,
  getTransaction,
  getTransferPair,
  listTransactions,
  updateTransaction,
  updateTransfer,
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

describe("transaction update and delete", () => {
  test("updates income/expense and deletes a single entry", async () => {
    const owner = await createUser("tx-edit-owner", "tx-edit@example.com");
    const account = await createAccount(owner.id, {
      name: "Conta",
      type: "bank",
      currency: "BRL",
    });

    const created = await createTransaction(owner.id, {
      accountId: account.id,
      date: "2026-03-01",
      amountCents: 1000,
      description: "Antes",
    });
    expect(created).not.toBeNull();

    const updated = await updateTransaction(owner.id, created!.id, {
      accountId: account.id,
      date: "2026-03-02",
      amountCents: 2500,
      description: "Depois",
    });
    expect(updated?.amountCents).toBe(2500);
    expect(updated?.description).toBe("Depois");
    expect(updated?.date).toBe("2026-03-02");

    const deleted = await deleteTransaction(owner.id, created!.id);
    expect(deleted).toHaveLength(1);
    expect(await getTransaction(owner.id, created!.id)).toBeNull();
  });

  test("editing a transfer updates both sides; deleting one side deletes the pair", async () => {
    const owner = await createUser("tx-transfer-owner", "tx-tr@example.com");
    const from = await createAccount(owner.id, {
      name: "Origem",
      type: "bank",
      currency: "BRL",
    });
    const to = await createAccount(owner.id, {
      name: "Destino",
      type: "bank",
      currency: "BRL",
    });
    const other = await createAccount(owner.id, {
      name: "Outra",
      type: "cash",
      currency: "BRL",
    });

    const created = await createTransfer(owner.id, {
      fromAccountId: from.id,
      toAccountId: to.id,
      date: "2026-03-10",
      amountCents: 5000,
      description: "Transferência",
    });
    expect(created?.transactions).toHaveLength(2);

    const updated = await updateTransfer(owner.id, created!.transferId, {
      fromAccountId: from.id,
      toAccountId: other.id,
      date: "2026-03-11",
      amountCents: 7500,
      description: "Transferência editada",
    });
    expect(updated?.transactions).toHaveLength(2);

    const pair = await getTransferPair(owner.id, created!.transactions[0].id);
    expect(pair?.from.amountCents).toBe(-7500);
    expect(pair?.to.amountCents).toBe(7500);
    expect(pair?.from.date).toBe("2026-03-11");
    expect(pair?.to.date).toBe("2026-03-11");
    expect(pair?.to.accountId).toBe(other.id);
    expect(pair?.from.description).toBe("Transferência editada");
    expect(pair?.to.description).toBe("Transferência editada");

    const deleted = await deleteTransaction(owner.id, pair!.from.id);
    expect(deleted).toHaveLength(2);
    expect(await listTransactions(owner.id)).toHaveLength(0);
  });

  test("user cannot update or delete another user's transaction by id", async () => {
    const userA = await createUser("tx-iso-a", "tx-iso-a@example.com");
    const userB = await createUser("tx-iso-b", "tx-iso-b@example.com");

    const accountA = await createAccount(userA.id, {
      name: "A",
      type: "bank",
      currency: "BRL",
    });
    const accountB = await createAccount(userB.id, {
      name: "B",
      type: "bank",
      currency: "BRL",
    });
    const accountB2 = await createAccount(userB.id, {
      name: "B2",
      type: "cash",
      currency: "BRL",
    });

    const txA = await createTransaction(userA.id, {
      accountId: accountA.id,
      date: "2026-04-01",
      amountCents: 1000,
      description: "A",
    });
    const transferB = await createTransfer(userB.id, {
      fromAccountId: accountB.id,
      toAccountId: accountB2.id,
      date: "2026-04-01",
      amountCents: 3000,
      description: "B transfer",
    });

    expect(
      await updateTransaction(userB.id, txA!.id, {
        accountId: accountB.id,
        date: "2026-04-02",
        amountCents: 9999,
        description: "hacked",
      }),
    ).toBeNull();
    expect(await getTransaction(userA.id, txA!.id)).toMatchObject({
      amountCents: 1000,
      description: "A",
    });

    expect(await deleteTransaction(userB.id, txA!.id)).toBeNull();
    expect(await getTransaction(userA.id, txA!.id)).not.toBeNull();

    expect(
      await updateTransfer(userA.id, transferB!.transferId, {
        fromAccountId: accountA.id,
        toAccountId: accountA.id,
        date: "2026-04-02",
        amountCents: 1,
        description: "hacked",
      }),
    ).toBeNull();
    expect(
      await deleteTransaction(userA.id, transferB!.transactions[0].id),
    ).toBeNull();
    expect(await listTransactions(userB.id)).toHaveLength(2);
  });
});
