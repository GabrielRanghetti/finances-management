import { and, eq, inArray } from "drizzle-orm";

import { ensureDefaultPfEntity, listEntities } from "./entities";
import { getDb } from "./index";
import {
  accounts,
  entities,
  type AccountType,
  type EntityType,
} from "./schema";

export type AccountInput = {
  name: string;
  type: AccountType;
  currency: string;
  entityId?: string;
  institution?: string | null;
  closingDay?: number | null;
};

export type AccountListFilter = {
  entityType?: EntityType | "both";
  includeArchived?: boolean;
};

function requireUserId(userId: string): string {
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

export async function listAccounts(
  userId: string,
  filter: AccountListFilter = {},
) {
  const uid = requireUserId(userId);
  const entityType = filter.entityType ?? "both";
  const includeArchived = filter.includeArchived ?? false;

  if (entityType === "both") {
    const conditions = [eq(accounts.userId, uid)];
    if (!includeArchived) {
      conditions.push(eq(accounts.archived, false));
    }
    return getDb()
      .select()
      .from(accounts)
      .where(and(...conditions));
  }

  const userEntities = await listEntities(uid);
  const matchingIds = userEntities
    .filter((entity) => entity.type === entityType)
    .map((entity) => entity.id);

  if (matchingIds.length === 0) {
    return [];
  }

  const conditions = [
    eq(accounts.userId, uid),
    inArray(accounts.entityId, matchingIds),
  ];
  if (!includeArchived) {
    conditions.push(eq(accounts.archived, false));
  }
  return getDb()
    .select()
    .from(accounts)
    .where(and(...conditions));
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
      institution: input.institution ?? null,
      closingDay:
        input.type === "credit_card" ? (input.closingDay ?? null) : null,
    })
    .returning();
  return rows[0];
}

export async function updateAccount(
  userId: string,
  accountId: string,
  input: AccountInput,
) {
  const uid = requireUserId(userId);
  const rows = await getDb()
    .update(accounts)
    .set({
      name: input.name,
      type: input.type,
      currency: input.currency,
      entityId: input.entityId,
      institution: input.institution ?? null,
      closingDay:
        input.type === "credit_card" ? (input.closingDay ?? null) : null,
    })
    .where(and(eq(accounts.userId, uid), eq(accounts.id, accountId)))
    .returning();
  return rows[0] ?? null;
}

export async function archiveAccount(userId: string, accountId: string) {
  const uid = requireUserId(userId);
  const rows = await getDb()
    .update(accounts)
    .set({ archived: true })
    .where(and(eq(accounts.userId, uid), eq(accounts.id, accountId)))
    .returning();
  return rows[0] ?? null;
}

export async function listAccountsWithEntities(
  userId: string,
  filter: AccountListFilter = {},
) {
  const uid = requireUserId(userId);
  const rows = await listAccounts(uid, filter);
  const userEntities = await listEntities(uid);
  const byId = new Map(userEntities.map((entity) => [entity.id, entity]));
  return rows.map((account) => ({
    ...account,
    entity: byId.get(account.entityId) ?? null,
  }));
}

export async function getAccountWithEntity(userId: string, accountId: string) {
  const account = await getAccount(userId, accountId);
  if (!account) {
    return null;
  }
  const rows = await getDb()
    .select()
    .from(entities)
    .where(
      and(eq(entities.userId, userId), eq(entities.id, account.entityId)),
    )
    .limit(1);
  return { ...account, entity: rows[0] ?? null };
}
