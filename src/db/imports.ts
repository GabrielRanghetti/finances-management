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
  return db.transaction(async (tx) => {
    const executor = tx as unknown as Database;
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
  });
}
