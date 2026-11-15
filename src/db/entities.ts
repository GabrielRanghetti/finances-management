import { and, eq } from "drizzle-orm";

import { getDb } from "./index";
import { entities, type EntityType } from "./schema";

export const DEFAULT_PF_ENTITY_NAME = "Pessoa física";

export type EntityInput = {
  type: EntityType;
  name: string;
  documentNumber?: string | null;
};

function requireUserId(userId: string): string {
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

export async function listEntities(userId: string) {
  const uid = requireUserId(userId);
  return getDb().select().from(entities).where(eq(entities.userId, uid));
}

export async function getEntity(userId: string, entityId: string) {
  const uid = requireUserId(userId);
  const rows = await getDb()
    .select()
    .from(entities)
    .where(and(eq(entities.userId, uid), eq(entities.id, entityId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Idempotent: safe under concurrent callers (unique default-PF index). */
export async function ensureDefaultPfEntity(userId: string) {
  const uid = requireUserId(userId);
  const existing = await getDb()
    .select()
    .from(entities)
    .where(and(eq(entities.userId, uid), eq(entities.type, "pf")))
    .limit(1);
  if (existing[0]) {
    return existing[0];
  }

  try {
    const rows = await getDb()
      .insert(entities)
      .values({
        userId: uid,
        type: "pf",
        name: DEFAULT_PF_ENTITY_NAME,
      })
      .returning();
    if (rows[0]) {
      return rows[0];
    }
  } catch (error) {
    // Concurrent insert hit entities_user_default_pf_uidx.
    const raced = await getDb()
      .select()
      .from(entities)
      .where(and(eq(entities.userId, uid), eq(entities.type, "pf")))
      .limit(1);
    if (raced[0]) {
      return raced[0];
    }
    throw error;
  }

  const fallback = await getDb()
    .select()
    .from(entities)
    .where(and(eq(entities.userId, uid), eq(entities.type, "pf")))
    .limit(1);
  return fallback[0]!;
}

export async function createEntity(userId: string, input: EntityInput) {
  const uid = requireUserId(userId);
  const rows = await getDb()
    .insert(entities)
    .values({
      userId: uid,
      type: input.type,
      name: input.name,
      documentNumber: input.documentNumber ?? null,
    })
    .returning();
  return rows[0];
}

export async function updateEntity(
  userId: string,
  entityId: string,
  input: EntityInput,
) {
  const uid = requireUserId(userId);
  const rows = await getDb()
    .update(entities)
    .set({
      type: input.type,
      name: input.name,
      documentNumber: input.documentNumber ?? null,
    })
    .where(and(eq(entities.userId, uid), eq(entities.id, entityId)))
    .returning();
  return rows[0] ?? null;
}
