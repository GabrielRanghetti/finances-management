import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, test } from "vitest";

import { createAccount } from "./accounts";
import {
  listAccountTransactionRefs,
  saveImportedTransactions,
} from "./imports";
import { getDb } from "./index";
import { user } from "./schema";
import { listTransactions } from "./transactions";
import { markProbableDuplicates } from "@/domain/duplicates";
import { parseOfx } from "@/importers/ofx";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../importers/fixtures/ofx",
);

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

describe("saveImportedTransactions", () => {
  test("importing the same OFX twice creates no duplicates when skipping marked rows", async () => {
    const owner = await createUser("import-ofx-owner", "import-ofx@example.com");
    const account = await createAccount(owner.id, {
      name: "Conta OFX",
      type: "bank",
      currency: "BRL",
    });

    const parsed = parseOfx(readFileSync(join(fixturesDir, "bank-utf8.ofx")));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const first = await saveImportedTransactions(
      owner.id,
      account.id,
      parsed.rows,
    );
    expect(first).toHaveLength(3);

    const existing = await listAccountTransactionRefs(owner.id, account.id);
    expect(existing).not.toBeNull();
    const marked = markProbableDuplicates(parsed.rows, existing!);
    expect(marked.every((row) => row.probableDuplicate)).toBe(true);

    const toSave = marked.filter((row) => !row.probableDuplicate);
    const second = await saveImportedTransactions(
      owner.id,
      account.id,
      toSave,
    );
    expect(second).toEqual([]);

    const listed = await listTransactions(owner.id, { accountId: account.id });
    expect(listed).toHaveLength(3);
    expect(listed.every((row) => row.source === "ofx")).toBe(true);
  });
});
