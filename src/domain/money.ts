/** Parse Brazilian currency input like "1.234,56" or "10,00" into integer cents. */
export function parseBrlToCents(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("empty");
  }

  const negative = trimmed.startsWith("-");
  const raw = negative ? trimmed.slice(1) : trimmed;
  // Accept: 1234 | 1234,5 | 1234,56 | 1.234,56
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(raw)) {
    throw new Error("invalid");
  }

  const [wholePart, fractionPart = ""] = raw.replace(/\./g, "").split(",");
  const cents =
    Number(wholePart) * 100 + Number((fractionPart + "00").slice(0, 2));
  return negative ? -cents : cents;
}

export function formatCentsToBrl(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  const wholeFormatted = whole
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${wholeFormatted},${fraction}`;
}

export function accountBalanceCents(amounts: readonly number[]): number {
  return amounts.reduce((sum, amount) => sum + amount, 0);
}

export type LedgerEntry = {
  amountCents: number;
  categoryId: string | null;
  transferId: string | null;
};

/** Transfers are neither income nor expense. */
export function incomeExpenseTotals(entries: readonly LedgerEntry[]): {
  incomeCents: number;
  expenseCents: number;
} {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const entry of entries) {
    if (entry.transferId) {
      continue;
    }
    if (entry.amountCents > 0) {
      incomeCents += entry.amountCents;
    } else if (entry.amountCents < 0) {
      expenseCents += entry.amountCents;
    }
  }
  return { incomeCents, expenseCents };
}

export function totalsByCategory(
  entries: readonly LedgerEntry[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.transferId || !entry.categoryId) {
      continue;
    }
    totals.set(
      entry.categoryId,
      (totals.get(entry.categoryId) ?? 0) + entry.amountCents,
    );
  }
  return totals;
}
