import { and, eq } from "drizzle-orm";

import { getDb } from "./index";
import { entities, type EntityType } from "./schema";

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
  const rows = await getDb()
    .insert(entities)
    .values({
      userId: uid,
      type: "pf",
      name: "Pessoa física",
    })
    .returning();
  return rows[0];
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
