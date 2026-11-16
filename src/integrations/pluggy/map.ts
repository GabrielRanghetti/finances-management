import type { NormalizedImportRow } from "@/importers/types";

import type { PluggyTransaction } from "./client";

/** Pluggy amounts are already signed floats in account currency. */
export function pluggyAmountToCents(amount: number): number {
  return Math.round(amount * 100);
}

export function pluggyDateToIso(date: string): string {
  return date.slice(0, 10);
}

export function pluggyTransactionsToRows(
  transactions: readonly PluggyTransaction[],
): NormalizedImportRow[] {
  return transactions.map((tx) => ({
    date: pluggyDateToIso(tx.date),
    amountCents: pluggyAmountToCents(tx.amount),
    description: tx.description.trim() || "Pluggy",
    externalId: tx.id,
    source: "pluggy" as const,
  }));
}

const FAILED_STATUSES = new Set([
  "LOGIN_ERROR",
  "OUTDATED",
  "WAITING_USER_INPUT",
  "WAITING_USER_ACTION",
]);

export function isPluggyConnectionFailed(item: {
  status: string;
  error: unknown;
}): boolean {
  if (item.error) {
    return true;
  }
  return FAILED_STATUSES.has(item.status);
}
