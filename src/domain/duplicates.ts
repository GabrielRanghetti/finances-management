export type ExistingTransactionRef = {
  date: string;
  amountCents: number;
  externalId: string | null;
};

export type DuplicateMarkable = {
  date: string;
  amountCents: number;
  externalId?: string | null;
};

/**
 * Marks probable duplicates among incoming rows.
 * (1) same external id; (2) otherwise same date+amount by multiset count.
 */
export function markProbableDuplicates<T extends DuplicateMarkable>(
  incoming: readonly T[],
  existing: readonly ExistingTransactionRef[],
): Array<T & { probableDuplicate: boolean }> {
  const unused = existing.map((row) => ({ ...row }));

  return incoming.map((row) => {
    const externalId = row.externalId ?? null;
    let matchIndex = -1;

    if (externalId) {
      matchIndex = unused.findIndex((item) => item.externalId === externalId);
    }

    if (matchIndex < 0) {
      matchIndex = unused.findIndex(
        (item) =>
          item.date === row.date && item.amountCents === row.amountCents,
      );
    }

    if (matchIndex >= 0) {
      unused.splice(matchIndex, 1);
      return { ...row, probableDuplicate: true };
    }

    return { ...row, probableDuplicate: false };
  });
}
