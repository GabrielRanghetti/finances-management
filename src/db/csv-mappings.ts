import { and, eq } from "drizzle-orm";

import { getAccount } from "./accounts";
import { getDb } from "./index";
import {
  csvImportMappings,
  type CsvDateFormat,
  type CsvDecimalSeparator,
} from "./schema";

export type CsvMappingInput = {
  accountId: string;
  dateColumn: number;
  amountColumn: number | null;
  debitColumn: number | null;
  creditColumn: number | null;
  descriptionColumn: number;
  idColumn: number | null;
  dateFormat: CsvDateFormat;
  decimalSeparator: CsvDecimalSeparator;
};

function requireUserId(userId: string): string {
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

export async function getCsvMapping(userId: string, accountId: string) {
  const uid = requireUserId(userId);
  const rows = await getDb()
    .select()
    .from(csvImportMappings)
    .where(
      and(
        eq(csvImportMappings.userId, uid),
        eq(csvImportMappings.accountId, accountId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertCsvMapping(userId: string, input: CsvMappingInput) {
  const uid = requireUserId(userId);
  const account = await getAccount(uid, input.accountId);
  if (!account) {
    return null;
  }

  const existing = await getCsvMapping(uid, input.accountId);
  const values = {
    dateColumn: input.dateColumn,
    amountColumn: input.amountColumn,
    debitColumn: input.debitColumn,
    creditColumn: input.creditColumn,
    descriptionColumn: input.descriptionColumn,
    idColumn: input.idColumn,
    dateFormat: input.dateFormat,
    decimalSeparator: input.decimalSeparator,
    updatedAt: new Date(),
  };

  if (existing) {
    const rows = await getDb()
      .update(csvImportMappings)
      .set(values)
      .where(
        and(
          eq(csvImportMappings.userId, uid),
          eq(csvImportMappings.id, existing.id),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  const rows = await getDb()
    .insert(csvImportMappings)
    .values({
      userId: uid,
      accountId: input.accountId,
      ...values,
    })
    .returning();
  return rows[0] ?? null;
}
