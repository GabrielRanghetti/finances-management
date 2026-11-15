import { and, eq } from "drizzle-orm";

import { ensureDefaultPfEntity } from "./entities";
import { getDb } from "./index";
import { accounts } from "./schema";

export type AccountInput = {
  name: string;
  type: string;
  currency: string;
  entityId?: string;
};

function requireUserId(userId: string): string {
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

export async function listAccounts(userId: string, entityId?: string) {
  const uid = requireUserId(userId);
  if (entityId) {
    return getDb()
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, uid), eq(accounts.entityId, entityId)));
  }
  return getDb().select().from(accounts).where(eq(accounts.userId, uid));
}

export async function getAccount(userId: string, accountId: string) {
  const uid = requireUserId(userId);
  const rows = await getDb()
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, uid), eq(accounts.id, accountId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createAccount(userId: string, input: AccountInput) {
  const uid = requireUserId(userId);
  const entityId =
    input.entityId ?? (await ensureDefaultPfEntity(uid)).id;
  const rows = await getDb()
    .insert(accounts)
    .values({
      userId: uid,
      entityId,
      name: input.name,
      type: input.type,
      currency: input.currency,
    })
    .returning();
  return rows[0];
}
