import { and, eq, sql } from "drizzle-orm";

import { getAccount } from "./accounts";
import { getDb } from "./index";
import { valuations } from "./schema";
import { isValuedAccountType } from "@/domain/valuations";

export type ValuationInput = {
  accountId: string;
  date: string;
  valueCents: number;
};

function requireUserId(userId: string): string {
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

export async function listValuations(userId: string, accountId?: string) {
  const uid = requireUserId(userId);
  const conditions = [eq(valuations.userId, uid)];
  if (accountId) {
    conditions.push(eq(valuations.accountId, accountId));
  }
  return getDb()
    .select()
    .from(valuations)
    .where(and(...conditions))
    .orderBy(sql`${valuations.date} desc, ${valuations.createdAt} desc`);
}

export async function getValuation(userId: string, valuationId: string) {
  const uid = requireUserId(userId);
  const rows = await getDb()
    .select()
    .from(valuations)
    .where(and(eq(valuations.userId, uid), eq(valuations.id, valuationId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createValuation(userId: string, input: ValuationInput) {
  const uid = requireUserId(userId);
  if (input.valueCents < 0) {
    return null;
  }
  const account = await getAccount(uid, input.accountId);
  if (!account || !isValuedAccountType(account.type)) {
    return null;
  }

  const rows = await getDb()
    .insert(valuations)
    .values({
      userId: uid,
      accountId: input.accountId,
      date: input.date,
      valueCents: input.valueCents,
    })
    .returning();
  return rows[0];
}

export async function updateValuation(
  userId: string,
  valuationId: string,
  input: ValuationInput,
) {
  const uid = requireUserId(userId);
  if (input.valueCents < 0) {
    return null;
  }
  const existing = await getValuation(uid, valuationId);
  if (!existing) {
    return null;
  }
  const account = await getAccount(uid, input.accountId);
  if (!account || !isValuedAccountType(account.type)) {
    return null;
  }

  const rows = await getDb()
    .update(valuations)
    .set({
      accountId: input.accountId,
      date: input.date,
      valueCents: input.valueCents,
    })
    .where(and(eq(valuations.userId, uid), eq(valuations.id, valuationId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteValuation(userId: string, valuationId: string) {
  const uid = requireUserId(userId);
  const rows = await getDb()
    .delete(valuations)
    .where(and(eq(valuations.userId, uid), eq(valuations.id, valuationId)))
    .returning();
  return rows[0] ?? null;
}
