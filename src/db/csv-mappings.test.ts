import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, test } from "vitest";

import { createAccount } from "./accounts";
import { getCsvMapping, upsertCsvMapping } from "./csv-mappings";
import { getDb } from "./index";
import { csvImportMappings, user } from "./schema";
import { eq } from "drizzle-orm";

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

describe("csv import mappings", () => {
  test("saves a mapping per account and reuses it", async () => {
    const owner = await createUser("csv-map-owner", "csv-map@example.com");
    const account = await createAccount(owner.id, {
      name: "Conta CSV",
      type: "bank",
      currency: "BRL",
    });

    const saved = await upsertCsvMapping(owner.id, {
      accountId: account.id,
      dateColumn: 0,
      amountColumn: 1,
      debitColumn: null,
      creditColumn: null,
      descriptionColumn: 3,
      idColumn: 2,
      dateFormat: "dd/mm/yyyy",
      decimalSeparator: ".",
    });
    expect(saved).not.toBeNull();

    const loaded = await getCsvMapping(owner.id, account.id);
    expect(loaded?.dateColumn).toBe(0);
    expect(loaded?.amountColumn).toBe(1);
    expect(loaded?.descriptionColumn).toBe(3);
    expect(loaded?.idColumn).toBe(2);
    expect(loaded?.dateFormat).toBe("dd/mm/yyyy");
    expect(loaded?.decimalSeparator).toBe(".");

    const updated = await upsertCsvMapping(owner.id, {
      accountId: account.id,
      dateColumn: 0,
      amountColumn: null,
      debitColumn: 2,
      creditColumn: 3,
      descriptionColumn: 1,
      idColumn: 4,
      dateFormat: "dd/mm/yyyy",
      decimalSeparator: ",",
    });
    expect(updated?.id).toBe(saved!.id);
    expect(updated?.decimalSeparator).toBe(",");
    expect(updated?.debitColumn).toBe(2);
  });

  test("user A cannot read user B mapping; deleting user removes mappings", async () => {
    const userA = await createUser("csv-map-a", "csv-a@example.com");
    const userB = await createUser("csv-map-b", "csv-b@example.com");
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

    await upsertCsvMapping(userA.id, {
      accountId: accountA.id,
      dateColumn: 0,
      amountColumn: 1,
      debitColumn: null,
      creditColumn: null,
      descriptionColumn: 2,
      idColumn: null,
      dateFormat: "dd/mm/yyyy",
      decimalSeparator: ",",
    });
    await upsertCsvMapping(userB.id, {
      accountId: accountB.id,
      dateColumn: 0,
      amountColumn: 1,
      debitColumn: null,
      creditColumn: null,
      descriptionColumn: 2,
      idColumn: null,
      dateFormat: "yyyy-mm-dd",
      decimalSeparator: ".",
    });

    expect(await getCsvMapping(userA.id, accountB.id)).toBeNull();
    expect(await getCsvMapping(userB.id, accountA.id)).toBeNull();

    await getDb().delete(user).where(eq(user.id, userA.id));
    const remaining = await getDb()
      .select()
      .from(csvImportMappings)
      .where(eq(csvImportMappings.userId, userA.id));
    expect(remaining).toHaveLength(0);
  });
});
