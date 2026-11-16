import { and, eq } from "drizzle-orm";

import { getAccount } from "./accounts";
import { getDb, type Database } from "./index";
import { transactions } from "./schema";
import { createTransaction } from "./transactions";
import type { NormalizedImportRow } from "@/importers/types";

export type ImportRowInput = Pick<
  NormalizedImportRow,
  "date" | "amountCents" | "description" | "externalId" | "source"
>;

function requireUserId(userId: string): string {
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

export async function listAccountTransactionRefs(
  userId: string,
  accountId: string,
) {
  const uid = requireUserId(userId);
  const account = await getAccount(uid, accountId);
  if (!account) {
    return null;
  }
  return getDb()
    .select({
      date: transactions.date,
      amountCents: transactions.amountCents,
      externalId: transactions.externalId,
    })
    .from(transactions)
    .where(
      and(eq(transactions.userId, uid), eq(transactions.accountId, accountId)),
    );
}

async function insertImportRows(
  uid: string,
  accountId: string,
  rows: readonly ImportRowInput[],
  executor: Database,
) {
  const created = [];
  for (const row of rows) {
    const saved = await createTransaction(
      uid,
      {
        accountId,
        date: row.date,
        amountCents: row.amountCents,
        description: row.description,
        source: row.source,
        externalId: row.externalId,
      },
      executor,
    );
    if (!saved) {
      throw new Error("import_insert_failed");
    }
    created.push(saved);
  }
  return created;
}

/** All-or-nothing save of import rows. Checks account ownership first. */
export async function saveImportedTransactions(
  userId: string,
  accountId: string,
  rows: readonly ImportRowInput[],
) {
  const uid = requireUserId(userId);
  const account = await getAccount(uid, accountId);
  if (!account) {
    return null;
  }

  if (rows.length === 0) {
    return [];
  }

  const db = getDb();
  return db.transaction(async (tx) =>
    insertImportRows(uid, accountId, rows, tx as unknown as Database),
  );
}

/** All-or-nothing save across several accounts in one transaction. */
export async function saveImportedTransactionGroups(
  userId: string,
  groups: readonly { accountId: string; rows: readonly ImportRowInput[] }[],
) {
  const uid = requireUserId(userId);
  for (const group of groups) {
    const account = await getAccount(uid, group.accountId);
    if (!account) {
      return null;
    }
  }

  const db = getDb();
  return db.transaction(async (tx) => {
    const executor = tx as unknown as Database;
    const created = [];
    for (const group of groups) {
      if (group.rows.length === 0) {
        continue;
      }
      created.push(
        ...(await insertImportRows(
          uid,
          group.accountId,
          group.rows,
          executor,
        )),
      );
    }
    return created;
  });
}
