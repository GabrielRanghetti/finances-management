import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, test } from "vitest";

import { createAccount } from "./accounts";
import { getDb } from "./index";
import { user } from "./schema";
import {
  createValuation,
  deleteValuation,
  getValuation,
  listValuations,
  updateValuation,
} from "./valuations";
import { netWorthCents } from "@/domain/networth";

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

describe("valuations", () => {
  test("crud and net worth from valuation date", async () => {
    const owner = await createUser("val-owner", "val@example.com");
    const property = await createAccount(owner.id, {
      name: "Apartamento",
      type: "property",
      currency: "BRL",
      acquisitionCostCents: 300_000,
      acquisitionDate: "2020-01-15",
    });

    const created = await createValuation(owner.id, {
      accountId: property.id,
      date: "2025-01-01",
      valueCents: 350_000,
    });
    expect(created).not.toBeNull();

    const updated = await updateValuation(owner.id, created!.id, {
      accountId: property.id,
      date: "2025-01-01",
      valueCents: 360_000,
    });
    expect(updated?.valueCents).toBe(360_000);

    await createValuation(owner.id, {
      accountId: property.id,
      date: "2026-01-01",
      valueCents: 400_000,
    });

    const history = await listValuations(owner.id, property.id);
    expect(history).toHaveLength(2);

    const accounts = [
      {
        type: "property" as const,
        transactionBalanceCents: 0,
        acquisitionCostCents: property.acquisitionCostCents,
        valuations: history.map((row) => ({
          date: row.date,
          valueCents: row.valueCents,
        })),
      },
    ];
    expect(netWorthCents(accounts, "2024-12-31")).toBe(300_000);
    expect(netWorthCents(accounts, "2025-06-01")).toBe(360_000);
    expect(netWorthCents(accounts, "2026-06-01")).toBe(400_000);

    expect(await deleteValuation(owner.id, created!.id)).not.toBeNull();
    expect(await getValuation(owner.id, created!.id)).toBeNull();
  });

  test("valuations are user-scoped", async () => {
    const userA = await createUser("val-a", "val-a@example.com");
    const userB = await createUser("val-b", "val-b@example.com");
    const propA = await createAccount(userA.id, {
      name: "Imóvel A",
      type: "property",
      currency: "BRL",
      acquisitionCostCents: 100_000,
      acquisitionDate: "2021-01-01",
    });
    const propB = await createAccount(userB.id, {
      name: "Imóvel B",
      type: "property",
      currency: "BRL",
      acquisitionCostCents: 200_000,
      acquisitionDate: "2021-01-01",
    });
    const valA = await createValuation(userA.id, {
      accountId: propA.id,
      date: "2026-01-01",
      valueCents: 110_000,
    });
    const valB = await createValuation(userB.id, {
      accountId: propB.id,
      date: "2026-01-01",
      valueCents: 220_000,
    });

    expect(await listValuations(userA.id)).toHaveLength(1);
    expect(await getValuation(userA.id, valB!.id)).toBeNull();
    expect(await deleteValuation(userA.id, valB!.id)).toBeNull();
    expect(await getValuation(userB.id, valB!.id)).not.toBeNull();
    expect(valA).not.toBeNull();
  });
});
