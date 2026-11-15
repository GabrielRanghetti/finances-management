import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, test } from "vitest";

import { createAccount } from "./accounts";
import { getDb } from "./index";
import { user } from "./schema";
import {
  cancelInstallmentGroup,
  createInstallmentPurchase,
  listInstallmentGroup,
  listTransactions,
  updateInstallmentGroup,
} from "./transactions";
import { statementPeriodContaining } from "@/domain/installments";

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

describe("credit card installments", () => {
  test("creates N dated parcels that sum to the purchase and can be edited or cancelled", async () => {
    const owner = await createUser("inst-owner", "inst@example.com");
    const card = await createAccount(owner.id, {
      name: "Nubank",
      type: "credit_card",
      currency: "BRL",
      closingDay: 10,
    });

    const created = await createInstallmentPurchase(owner.id, {
      accountId: card.id,
      date: "2026-01-15",
      amountCents: 10001,
      description: "Loja",
      installmentCount: 10,
    });
    expect(created?.transactions).toHaveLength(10);

    const group = await listInstallmentGroup(
      owner.id,
      created!.installmentGroupId,
    );
    expect(group).toHaveLength(10);
    expect(group.map((row) => row.date)).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
      "2026-05-15",
      "2026-06-15",
      "2026-07-15",
      "2026-08-15",
      "2026-09-15",
      "2026-10-15",
    ]);
    expect(group.map((row) => row.description)).toEqual([
      "Loja 1/10",
      "Loja 2/10",
      "Loja 3/10",
      "Loja 4/10",
      "Loja 5/10",
      "Loja 6/10",
      "Loja 7/10",
      "Loja 8/10",
      "Loja 9/10",
      "Loja 10/10",
    ]);
    expect(group.reduce((sum, row) => sum + row.amountCents, 0)).toBe(-10001);
    expect(group[0].amountCents).toBe(-1001);

    // Purchase on Jan 15 (after closing day 10) lands on the Feb 10 statement.
    const period = statementPeriodContaining(10, "2026-01-15");
    expect(period).toEqual({ from: "2026-01-11", to: "2026-02-10" });
    const febStatement = await listTransactions(owner.id, {
      accountId: card.id,
      from: period.from,
      to: period.to,
    });
    expect(febStatement).toHaveLength(1);
    expect(febStatement[0].description).toBe("Loja 1/10");
    expect(febStatement[0].amountCents).toBe(-1001);

    const marStatement = await listTransactions(owner.id, {
      accountId: card.id,
      from: "2026-02-11",
      to: "2026-03-10",
    });
    expect(marStatement).toHaveLength(1);
    expect(marStatement[0].description).toBe("Loja 2/10");

    const updated = await updateInstallmentGroup(
      owner.id,
      created!.installmentGroupId,
      { description: "Mercado" },
    );
    expect(updated?.[0].description).toBe("Mercado 1/10");
    expect(updated?.[2].description).toBe("Mercado 3/10");

    const cancelled = await cancelInstallmentGroup(
      owner.id,
      created!.installmentGroupId,
    );
    expect(cancelled).toHaveLength(10);
    expect(await listInstallmentGroup(owner.id, created!.installmentGroupId)).toEqual(
      [],
    );
  });
});
