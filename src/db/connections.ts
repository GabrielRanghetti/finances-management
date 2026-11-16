import { and, eq } from "drizzle-orm";

import { getAccount } from "./accounts";
import { getEntity } from "./entities";
import { getDb } from "./index";
import {
  connectionAccountMaps,
  connections,
  type ConnectionStatus,
} from "./schema";

function requireUserId(userId: string): string {
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

export async function listConnections(userId: string) {
  const uid = requireUserId(userId);
  return getDb()
    .select()
    .from(connections)
    .where(eq(connections.userId, uid));
}

export async function getConnection(userId: string, connectionId: string) {
  const uid = requireUserId(userId);
  const rows = await getDb()
    .select()
    .from(connections)
    .where(
      and(eq(connections.userId, uid), eq(connections.id, connectionId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createConnection(
  userId: string,
  input: { itemId: string; entityId: string; provider?: string },
) {
  const uid = requireUserId(userId);
  const entity = await getEntity(uid, input.entityId);
  if (!entity) {
    return null;
  }

  const rows = await getDb()
    .insert(connections)
    .values({
      userId: uid,
      provider: input.provider ?? "pluggy",
      itemId: input.itemId,
      entityId: input.entityId,
      status: "active",
      lastError: null,
    })
    .returning();
  return rows[0];
}

export async function updateConnectionStatus(
  userId: string,
  connectionId: string,
  input: {
    status: ConnectionStatus;
    lastError?: string | null;
    lastSyncAt?: Date | null;
  },
) {
  const uid = requireUserId(userId);
  const patch: {
    status: ConnectionStatus;
    lastError: string | null;
    updatedAt: Date;
    lastSyncAt?: Date | null;
  } = {
    status: input.status,
    lastError: input.lastError ?? null,
    updatedAt: new Date(),
  };
  if (input.lastSyncAt !== undefined) {
    patch.lastSyncAt = input.lastSyncAt;
  }
  const rows = await getDb()
    .update(connections)
    .set(patch)
    .where(
      and(eq(connections.userId, uid), eq(connections.id, connectionId)),
    )
    .returning();
  return rows[0] ?? null;
}

export async function listConnectionAccountMaps(
  userId: string,
  connectionId: string,
) {
  const uid = requireUserId(userId);
  return getDb()
    .select()
    .from(connectionAccountMaps)
    .where(
      and(
        eq(connectionAccountMaps.userId, uid),
        eq(connectionAccountMaps.connectionId, connectionId),
      ),
    );
}

export async function upsertConnectionAccountMap(
  userId: string,
  input: {
    connectionId: string;
    pluggyAccountId: string;
    accountId: string;
  },
) {
  const uid = requireUserId(userId);
  const connection = await getConnection(uid, input.connectionId);
  if (!connection) {
    return null;
  }
  const account = await getAccount(uid, input.accountId);
  if (!account) {
    return null;
  }

  const existing = await getDb()
    .select()
    .from(connectionAccountMaps)
    .where(
      and(
        eq(connectionAccountMaps.userId, uid),
        eq(connectionAccountMaps.connectionId, input.connectionId),
        eq(connectionAccountMaps.pluggyAccountId, input.pluggyAccountId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const rows = await getDb()
      .update(connectionAccountMaps)
      .set({ accountId: input.accountId })
      .where(
        and(
          eq(connectionAccountMaps.userId, uid),
          eq(connectionAccountMaps.id, existing[0].id),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  const rows = await getDb()
    .insert(connectionAccountMaps)
    .values({
      userId: uid,
      connectionId: input.connectionId,
      pluggyAccountId: input.pluggyAccountId,
      accountId: input.accountId,
    })
    .returning();
  return rows[0];
}
