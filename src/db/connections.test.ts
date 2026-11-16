import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, test } from "vitest";

import { createAccount } from "./accounts";
import {
  createConnection,
  getConnection,
  listConnectionAccountMaps,
  listConnections,
  updateConnectionStatus,
  upsertConnectionAccountMap,
} from "./connections";
import { createEntity } from "./entities";
import { getDb } from "./index";
import {
  connectionAccountMaps,
  connections,
  user,
} from "./schema";
import {
  listAccountTransactionRefs,
  saveImportedTransactions,
} from "./imports";
import { markProbableDuplicates } from "@/domain/duplicates";
import { pluggyTransactionsToRows } from "@/integrations/pluggy/map";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../integrations/pluggy/fixtures",
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

describe("connections isolation and sync duplicates", () => {
  test("user A cannot see user B connections; delete cascades", async () => {
    const userA = await createUser("conn-a", "conn-a@example.com");
    const userB = await createUser("conn-b", "conn-b@example.com");
    const entityA = await createEntity(userA.id, {
      type: "pf",
      name: "PF A",
    });
    const entityB = await createEntity(userB.id, {
      type: "pf",
      name: "PF B",
    });

    const connA = await createConnection(userA.id, {
      itemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      entityId: entityA.id,
    });
    const connB = await createConnection(userB.id, {
      itemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      entityId: entityB.id,
    });
    expect(connA).not.toBeNull();
    expect(connB).not.toBeNull();

    expect(await getConnection(userA.id, connB!.id)).toBeNull();
    expect((await listConnections(userA.id)).map((row) => row.id)).toEqual([
      connA!.id,
    ]);

    const accountA = await createAccount(userA.id, {
      name: "Mapped A",
      type: "bank",
      currency: "BRL",
      entityId: entityA.id,
    });
    await upsertConnectionAccountMap(userA.id, {
      connectionId: connA!.id,
      pluggyAccountId: "11111111-1111-4111-8111-111111111111",
      accountId: accountA.id,
    });

    await getDb().delete(user).where(eq(user.id, userA.id));
    expect(
      await getDb()
        .select()
        .from(connections)
        .where(eq(connections.userId, userA.id)),
    ).toHaveLength(0);
    expect(
      await getDb()
        .select()
        .from(connectionAccountMaps)
        .where(eq(connectionAccountMaps.userId, userA.id)),
    ).toHaveLength(0);
  });

  test("syncing recorded pluggy rows twice creates no duplicates", async () => {
    const owner = await createUser("conn-sync", "conn-sync@example.com");
    const entity = await createEntity(owner.id, {
      type: "pf",
      name: "PF Sync",
    });
    const account = await createAccount(owner.id, {
      name: "Conta Sync",
      type: "bank",
      currency: "BRL",
      entityId: entity.id,
    });
    const connection = await createConnection(owner.id, {
      itemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      entityId: entity.id,
    });
    await upsertConnectionAccountMap(owner.id, {
      connectionId: connection!.id,
      pluggyAccountId: "11111111-1111-4111-8111-111111111111",
      accountId: account.id,
    });

    const txs = JSON.parse(
      readFileSync(join(fixturesDir, "transactions.json"), "utf8"),
    ).results;
    const rows = pluggyTransactionsToRows(txs);

    const first = await saveImportedTransactions(owner.id, account.id, rows);
    expect(first).toHaveLength(3);

    const existing = await listAccountTransactionRefs(owner.id, account.id);
    const marked = markProbableDuplicates(rows, existing!);
    expect(marked.every((row) => row.probableDuplicate)).toBe(true);
    const second = await saveImportedTransactions(
      owner.id,
      account.id,
      marked.filter((row) => !row.probableDuplicate),
    );
    expect(second).toEqual([]);

    // OFX-shaped rows for the same date+amount without shared ids still match.
    const ofxLike = [
      {
        date: "2026-11-01",
        amountCents: -8990,
        description: "Pagamento boleto ficticio",
        externalId: "ofx-different-id",
        source: "ofx" as const,
      },
    ];
    const afterOfxMark = markProbableDuplicates(ofxLike, existing!);
    expect(afterOfxMark[0].probableDuplicate).toBe(true);

    await updateConnectionStatus(owner.id, connection!.id, {
      status: "active",
      lastSyncAt: new Date(),
      lastError: null,
    });
    expect(
      (await listConnectionAccountMaps(owner.id, connection!.id)).length,
    ).toBe(1);
  });
});
