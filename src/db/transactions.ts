import { and, eq, gte, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getAccount } from "./accounts";
import { getCategory } from "./categories";
import { getDb } from "./index";
import { accounts, entities, transactions } from "./schema";

export type TransactionInput = {
  accountId: string;
  date: string;
  amountCents: number;
  description: string;
  categoryId?: string | null;
  notes?: string | null;
};

export type TransferInput = {
  fromAccountId: string;
  toAccountId: string;
  date: string;
  amountCents: number;
  description: string;
  categoryId?: string | null;
  notes?: string | null;
};

export type TransactionListFilter = {
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
  entityType?: "pf" | "pj" | "both";
};

function requireUserId(userId: string): string {
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

export async function listTransactions(
  userId: string,
  filter: TransactionListFilter = {},
) {
  const uid = requireUserId(userId);
  const conditions = [eq(transactions.userId, uid)];

  if (filter.from) {
    conditions.push(gte(transactions.date, filter.from));
  }
  if (filter.to) {
    conditions.push(lte(transactions.date, filter.to));
  }
  if (filter.accountId) {
    conditions.push(eq(transactions.accountId, filter.accountId));
  }
  if (filter.categoryId) {
    conditions.push(eq(transactions.categoryId, filter.categoryId));
  }

  if (filter.entityType && filter.entityType !== "both") {
    const rows = await getDb()
      .select({
        id: transactions.id,
        userId: transactions.userId,
        accountId: transactions.accountId,
        date: transactions.date,
        amountCents: transactions.amountCents,
        description: transactions.description,
        categoryId: transactions.categoryId,
        notes: transactions.notes,
        transferId: transactions.transferId,
        installmentGroupId: transactions.installmentGroupId,
        source: transactions.source,
        externalId: transactions.externalId,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .innerJoin(entities, eq(accounts.entityId, entities.id))
      .where(
        and(
          ...conditions,
          eq(accounts.userId, uid),
          eq(entities.userId, uid),
          eq(entities.type, filter.entityType),
        ),
      )
      .orderBy(sql`${transactions.date} desc, ${transactions.createdAt} desc`);
    return rows;
  }

  return getDb()
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(sql`${transactions.date} desc, ${transactions.createdAt} desc`);
}

export async function getTransaction(userId: string, transactionId: string) {
  const uid = requireUserId(userId);
  const rows = await getDb()
    .select()
    .from(transactions)
    .where(
      and(eq(transactions.userId, uid), eq(transactions.id, transactionId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listAccountAmounts(userId: string, accountId: string) {
  const uid = requireUserId(userId);
  const account = await getAccount(uid, accountId);
  if (!account) {
    return null;
  }
  const rows = await getDb()
    .select({ amountCents: transactions.amountCents })
    .from(transactions)
    .where(
      and(eq(transactions.userId, uid), eq(transactions.accountId, accountId)),
    );
  return rows.map((row) => row.amountCents);
}

export async function createTransaction(userId: string, input: TransactionInput) {
  const uid = requireUserId(userId);
  const account = await getAccount(uid, input.accountId);
  if (!account) {
    return null;
  }
  if (input.categoryId) {
    const category = await getCategory(uid, input.categoryId);
    if (!category) {
      return null;
    }
  }

  const rows = await getDb()
    .insert(transactions)
    .values({
      userId: uid,
      accountId: input.accountId,
      date: input.date,
      amountCents: input.amountCents,
      description: input.description,
      categoryId: input.categoryId ?? null,
      notes: input.notes ?? null,
      source: "manual",
    })
    .returning();
  return rows[0];
}

export async function createTransfer(userId: string, input: TransferInput) {
  const uid = requireUserId(userId);
  if (input.fromAccountId === input.toAccountId || input.amountCents <= 0) {
    return null;
  }

  const fromAccount = await getAccount(uid, input.fromAccountId);
  const toAccount = await getAccount(uid, input.toAccountId);
  if (!fromAccount || !toAccount) {
    return null;
  }
  if (input.categoryId) {
    const category = await getCategory(uid, input.categoryId);
    if (!category) {
      return null;
    }
  }

  const transferId = randomUUID();
  const rows = await getDb()
    .insert(transactions)
    .values([
      {
        userId: uid,
        accountId: input.fromAccountId,
        date: input.date,
        amountCents: -input.amountCents,
        description: input.description,
        categoryId: input.categoryId ?? null,
        notes: input.notes ?? null,
        transferId,
        source: "manual",
      },
      {
        userId: uid,
        accountId: input.toAccountId,
        date: input.date,
        amountCents: input.amountCents,
        description: input.description,
        categoryId: input.categoryId ?? null,
        notes: input.notes ?? null,
        transferId,
        source: "manual",
      },
    ])
    .returning();
  return { transferId, transactions: rows };
}

export async function getTransferPair(userId: string, transactionId: string) {
  const uid = requireUserId(userId);
  const one = await getTransaction(uid, transactionId);
  if (!one?.transferId) {
    return null;
  }
  const pair = await getDb()
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, uid),
        eq(transactions.transferId, one.transferId),
      ),
    );
  if (pair.length !== 2) {
    return null;
  }
  const from = pair.find((row) => row.amountCents < 0) ?? null;
  const to = pair.find((row) => row.amountCents > 0) ?? null;
  if (!from || !to) {
    return null;
  }
  return { transferId: one.transferId, from, to };
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  input: TransactionInput,
) {
  const uid = requireUserId(userId);
  const existing = await getTransaction(uid, transactionId);
  if (!existing || existing.transferId) {
    return null;
  }
  const account = await getAccount(uid, input.accountId);
  if (!account) {
    return null;
  }
  if (input.categoryId) {
    const category = await getCategory(uid, input.categoryId);
    if (!category) {
      return null;
    }
  }

  const rows = await getDb()
    .update(transactions)
    .set({
      accountId: input.accountId,
      date: input.date,
      amountCents: input.amountCents,
      description: input.description,
      categoryId: input.categoryId ?? null,
      notes: input.notes ?? null,
    })
    .where(
      and(eq(transactions.userId, uid), eq(transactions.id, transactionId)),
    )
    .returning();
  return rows[0] ?? null;
}

export async function updateTransfer(
  userId: string,
  transferId: string,
  input: TransferInput,
) {
  const uid = requireUserId(userId);
  if (input.fromAccountId === input.toAccountId || input.amountCents <= 0) {
    return null;
  }

  const pair = await getDb()
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, uid),
        eq(transactions.transferId, transferId),
      ),
    );
  if (pair.length !== 2) {
    return null;
  }

  const fromAccount = await getAccount(uid, input.fromAccountId);
  const toAccount = await getAccount(uid, input.toAccountId);
  if (!fromAccount || !toAccount) {
    return null;
  }
  if (input.categoryId) {
    const category = await getCategory(uid, input.categoryId);
    if (!category) {
      return null;
    }
  }

  const from = pair.find((row) => row.amountCents < 0);
  const to = pair.find((row) => row.amountCents > 0);
  if (!from || !to) {
    return null;
  }

  const shared = {
    date: input.date,
    description: input.description,
    categoryId: input.categoryId ?? null,
    notes: input.notes ?? null,
  };

  const [fromUpdated] = await getDb()
    .update(transactions)
    .set({
      ...shared,
      accountId: input.fromAccountId,
      amountCents: -input.amountCents,
    })
    .where(and(eq(transactions.userId, uid), eq(transactions.id, from.id)))
    .returning();
  const [toUpdated] = await getDb()
    .update(transactions)
    .set({
      ...shared,
      accountId: input.toAccountId,
      amountCents: input.amountCents,
    })
    .where(and(eq(transactions.userId, uid), eq(transactions.id, to.id)))
    .returning();

  return { transferId, transactions: [fromUpdated, toUpdated] };
}

export async function deleteTransaction(userId: string, transactionId: string) {
  const uid = requireUserId(userId);
  const existing = await getTransaction(uid, transactionId);
  if (!existing) {
    return null;
  }

  if (existing.transferId) {
    const rows = await getDb()
      .delete(transactions)
      .where(
        and(
          eq(transactions.userId, uid),
          eq(transactions.transferId, existing.transferId),
        ),
      )
      .returning();
    return rows;
  }

  const rows = await getDb()
    .delete(transactions)
    .where(
      and(eq(transactions.userId, uid), eq(transactions.id, transactionId)),
    )
    .returning();
  return rows;
}
