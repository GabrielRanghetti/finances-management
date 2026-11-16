import {
  accountBalanceOnDate,
  netWorthCents,
  type NetWorthAccount,
} from "./networth";
import { isValuedAccountType } from "./valuations";

export type OverviewScope = "pf" | "pj" | "all";

export const liabilityAccountTypes = ["credit_card", "loan"] as const;

export function isLiabilityAccountType(type: string): boolean {
  return (liabilityAccountTypes as readonly string[]).includes(type);
}

/** Last day of each of the previous 11 months, then `today` for the current month. */
export function netWorthHistoryDates(today: string): string[] {
  const [year, month] = today.split("-").map(Number);
  const dates: string[] = [];
  for (let i = 11; i >= 1; i -= 1) {
    // Day 0 of month (month - i + 1) is the last day of (month - i).
    const d = new Date(Date.UTC(year, month - i, 0));
    dates.push(d.toISOString().slice(0, 10));
  }
  dates.push(today);
  return dates;
}

/** First calendar day of the month containing `today`. */
export function monthStartDate(today: string): string {
  return `${today.slice(0, 8)}01`;
}

export type MonthSummaryEntry = {
  amountCents: number;
  transferId: string | null;
  accountEntityType: "pf" | "pj";
  /** Entity type of the other leg when this row is a transfer. */
  otherAccountEntityType: "pf" | "pj" | null;
};

/** Company → person transfer: money in for pf, money out for pj, neither for all. */
export function isCompanyToPersonTransfer(entry: MonthSummaryEntry): boolean {
  if (!entry.transferId || !entry.otherAccountEntityType) {
    return false;
  }
  if (
    entry.accountEntityType === "pf" &&
    entry.amountCents > 0 &&
    entry.otherAccountEntityType === "pj"
  ) {
    return true;
  }
  if (
    entry.accountEntityType === "pj" &&
    entry.amountCents < 0 &&
    entry.otherAccountEntityType === "pf"
  ) {
    return true;
  }
  return false;
}

/**
 * Month cash summary for a scope. Transfers are excluded except company→person,
 * which counts as money in (pf), money out (pj), or neither (all).
 */
export function monthSummaryCents(
  entries: readonly MonthSummaryEntry[],
  scope: OverviewScope,
): { inCents: number; outCents: number; leftCents: number } {
  let inCents = 0;
  let outCents = 0;

  for (const entry of entries) {
    if (entry.transferId) {
      if (!isCompanyToPersonTransfer(entry) || scope === "all") {
        continue;
      }
      if (scope === "pf" && entry.amountCents > 0) {
        inCents += entry.amountCents;
      } else if (scope === "pj" && entry.amountCents < 0) {
        outCents += entry.amountCents;
      }
      continue;
    }
    if (entry.amountCents > 0) {
      inCents += entry.amountCents;
    } else if (entry.amountCents < 0) {
      outCents += entry.amountCents;
    }
  }

  return { inCents, outCents, leftCents: inCents + outCents };
}

export type LedgerClassRow = {
  accountClass: string;
  balanceCents: number;
};

export type OverviewLedger = {
  assets: LedgerClassRow[];
  assetsTotalCents: number;
  liabilities: LedgerClassRow[];
  liabilitiesTotalCents: number;
  netTotalCents: number;
};

/** Group balances by account type into assets and liabilities. */
export function buildOverviewLedger(
  accounts: readonly (NetWorthAccount & { type: string })[],
  asOfDate: string,
): OverviewLedger {
  const assetMap = new Map<string, number>();
  const liabilityMap = new Map<string, number>();

  for (const account of accounts) {
    const balance = accountBalanceOnDate(account, asOfDate);
    const target = isLiabilityAccountType(account.type)
      ? liabilityMap
      : assetMap;
    target.set(account.type, (target.get(account.type) ?? 0) + balance);
  }

  const assets = [...assetMap.entries()]
    .map(([accountClass, balanceCents]) => ({ accountClass, balanceCents }))
    .sort((a, b) => a.accountClass.localeCompare(b.accountClass));
  const liabilities = [...liabilityMap.entries()]
    .map(([accountClass, balanceCents]) => ({ accountClass, balanceCents }))
    .sort((a, b) => a.accountClass.localeCompare(b.accountClass));

  const assetsTotalCents = assets.reduce((sum, row) => sum + row.balanceCents, 0);
  const liabilitiesTotalCents = liabilities.reduce(
    (sum, row) => sum + row.balanceCents,
    0,
  );

  return {
    assets,
    assetsTotalCents,
    liabilities,
    liabilitiesTotalCents,
    netTotalCents: assetsTotalCents + liabilitiesTotalCents,
  };
}

export function transactionBalanceOnOrBefore(
  amountsByDate: readonly { date: string; amountCents: number }[],
  asOfDate: string,
): number {
  let sum = 0;
  for (const row of amountsByDate) {
    if (row.date <= asOfDate) {
      sum += row.amountCents;
    }
  }
  return sum;
}

export function toNetWorthAccount(input: {
  type: string;
  amountsByDate: readonly { date: string; amountCents: number }[];
  acquisitionCostCents?: number | null;
  valuations?: readonly { date: string; valueCents: number }[];
  asOfDate: string;
}): NetWorthAccount {
  if (isValuedAccountType(input.type)) {
    return {
      type: input.type,
      transactionBalanceCents: 0,
      acquisitionCostCents: input.acquisitionCostCents,
      valuations: input.valuations ?? [],
    };
  }
  return {
    type: input.type,
    transactionBalanceCents: transactionBalanceOnOrBefore(
      input.amountsByDate,
      input.asOfDate,
    ),
  };
}

export { netWorthCents, accountBalanceOnDate };
