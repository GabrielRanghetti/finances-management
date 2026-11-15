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
  });
});
