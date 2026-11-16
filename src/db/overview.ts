import { eq } from "drizzle-orm";

import { convertForeignCentsToBrl } from "@/domain/fx";
import {
  accountBalanceOnDate,
  buildOverviewLedger,
  monthStartDate,
  monthSummaryCents,
  netWorthCents,
  netWorthHistoryDates,
  toNetWorthAccount,
  type MonthSummaryEntry,
  type OverviewLedger,
  type OverviewScope,
} from "@/domain/overview";
import { isValuedAccountType } from "@/domain/valuations";

import { listAccountsWithEntities } from "./accounts";
import { lookupFxRate, type FxLookupResult } from "./fx-rates";
import { getDb } from "./index";
import { transactions, valuations } from "./schema";

export type OverviewFxConversion = {
  accountId: string;
  accountName: string;
  currency: string;
  rateDate: string;
  buyRate: string;
  sellRate: string;
  /** True when the rate is older because the live lookup failed. */
  stale: boolean;
};

export type OverviewExcludedAccount = {
  accountId: string;
  accountName: string;
  currency: string;
};

export type OverviewHistoryPoint = {
  date: string;
  netWorthCents: number;
};

export type OverviewCurrencyRow = {
  currency: string;
  originalCents: number;
  brlCents: number;
};

export type OverviewInstitutionRow = {
  institution: string | null;
  brlCents: number;
};

export type OverviewMonthSummary = {
  inCents: number;
  outCents: number;
  leftCents: number;
};

export type NetWorthOverview = {
  /** Chosen scope. */
  scope: OverviewScope;
  /** As-of date used for "today". */
  asOfDate: string;
  /** Whether the user has any account in this scope. */
  hasAccounts: boolean;
  /** Net worth today in BRL cents (excluded accounts omitted). */
  netWorthCents: number;
  /** Net worth at each of the last 12 month ends (current month uses today). */
  history: OverviewHistoryPoint[];
  /** Assets and liabilities by account class, with subtotals and net. */
  ledger: OverviewLedger;
  /** Original and BRL totals by currency. */
  byCurrency: OverviewCurrencyRow[];
  /** BRL totals by institution. */
  byInstitution: OverviewInstitutionRow[];
  /** Change in the current month (today minus prior month end). */
  changeMonthCents: number;
  /** Change over 12 months (today minus first history point). */
  change12MonthsCents: number;
  /** Money in, out and left for the current month in this scope. */
  monthSummary: OverviewMonthSummary;
  /** FX conversions that contributed to BRL totals. */
  fxConversions: OverviewFxConversion[];
  /** Accounts left out because no PTAX rate exists. */
  excludedAccounts: OverviewExcludedAccount[];
};

function requireUserId(userId: string): string {
  if (!userId) {
    throw new Error("userId is required");
  }
  return userId;
}

function entityFilter(scope: OverviewScope): "pf" | "pj" | "both" {
  return scope === "all" ? "both" : scope;
}

type LoadedAccount = {
  id: string;
  name: string;
  type: string;
  currency: string;
  institution: string | null;
  entityType: "pf" | "pj";
  acquisitionCostCents: number | null;
  amountsByDate: { date: string; amountCents: number }[];
  valuations: { date: string; valueCents: number }[];
};

async function loadScopedAccounts(
  userId: string,
  scope: OverviewScope,
): Promise<LoadedAccount[]> {
  const rows = await listAccountsWithEntities(userId, {
    entityType: entityFilter(scope),
    includeArchived: false,
  });
  if (rows.length === 0) {
    return [];
  }

  const accountIds = new Set(rows.map((row) => row.id));
  const txRows = await getDb()
    .select({
      accountId: transactions.accountId,
      date: transactions.date,
      amountCents: transactions.amountCents,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId));

  const amountsByAccount = new Map<
    string,
    { date: string; amountCents: number }[]
  >();
  for (const tx of txRows) {
    if (!accountIds.has(tx.accountId)) {
      continue;
    }
    const list = amountsByAccount.get(tx.accountId) ?? [];
    list.push({ date: tx.date, amountCents: tx.amountCents });
    amountsByAccount.set(tx.accountId, list);
  }

  const valuationRows = await getDb()
    .select({
      accountId: valuations.accountId,
      date: valuations.date,
      valueCents: valuations.valueCents,
    })
    .from(valuations)
    .where(eq(valuations.userId, userId));

  const valuationsByAccount = new Map<
    string,
    { date: string; valueCents: number }[]
  >();
  for (const row of valuationRows) {
    if (!accountIds.has(row.accountId)) {
      continue;
    }
    const list = valuationsByAccount.get(row.accountId) ?? [];
    list.push({ date: row.date, valueCents: row.valueCents });
    valuationsByAccount.set(row.accountId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    institution: row.institution,
    entityType: row.entity?.type === "pj" ? "pj" : "pf",
    acquisitionCostCents: row.acquisitionCostCents,
    amountsByDate: amountsByAccount.get(row.id) ?? [],
    valuations: valuationsByAccount.get(row.id) ?? [],
  }));
}

type ConvertedAccount = {
  account: LoadedAccount;
  balanceOriginalCents: number;
  balanceBrlCents: number;
  included: boolean;
};

function asBrlNetWorthAccount(
  account: LoadedAccount,
  brlCents: number,
  asOfDate: string,
) {
  if (account.currency.toUpperCase() === "BRL") {
    return toNetWorthAccount({
      type: account.type,
      amountsByDate: account.amountsByDate,
      acquisitionCostCents: account.acquisitionCostCents,
      valuations: account.valuations,
      asOfDate,
    });
  }
  if (isValuedAccountType(account.type)) {
    return {
      type: account.type,
      transactionBalanceCents: 0,
      acquisitionCostCents: brlCents,
      valuations: [],
    };
  }
  return {
    type: account.type,
    transactionBalanceCents: brlCents,
  };
}

async function convertAccountsOnDate(
  loaded: readonly LoadedAccount[],
  asOfDate: string,
  fetchImpl: typeof fetch,
): Promise<{
  converted: ConvertedAccount[];
  fxConversions: OverviewFxConversion[];
  excludedAccounts: OverviewExcludedAccount[];
}> {
  const fxConversions: OverviewFxConversion[] = [];
  const excludedAccounts: OverviewExcludedAccount[] = [];
  const converted: ConvertedAccount[] = [];
  const rateCache = new Map<string, FxLookupResult>();

  for (const account of loaded) {
    const nw = toNetWorthAccount({
      type: account.type,
      amountsByDate: account.amountsByDate,
      acquisitionCostCents: account.acquisitionCostCents,
      valuations: account.valuations,
      asOfDate,
    });
    const balanceOriginalCents = accountBalanceOnDate(nw, asOfDate);
    const currency = account.currency.toUpperCase();

    if (currency === "BRL") {
      converted.push({
        account,
        balanceOriginalCents,
        balanceBrlCents: balanceOriginalCents,
        included: true,
      });
      continue;
    }

    const cacheKey = `${currency}:${asOfDate}`;
    let rate = rateCache.get(cacheKey);
    if (!rate) {
      rate = await lookupFxRate(currency, asOfDate, fetchImpl);
      rateCache.set(cacheKey, rate);
    }

    if (rate.kind === "missing") {
      excludedAccounts.push({
        accountId: account.id,
        accountName: account.name,
        currency,
      });
      converted.push({
        account,
        balanceOriginalCents,
        balanceBrlCents: 0,
        included: false,
      });
      continue;
    }

    const brlCents = convertForeignCentsToBrl(
      balanceOriginalCents,
      rate.buyRate,
      rate.sellRate,
    );
    fxConversions.push({
      accountId: account.id,
      accountName: account.name,
      currency,
      rateDate: rate.date,
      buyRate: rate.buyRate,
      sellRate: rate.sellRate,
      stale: rate.kind === "stale",
    });
    converted.push({
      account,
      balanceOriginalCents,
      balanceBrlCents: brlCents,
      included: true,
    });
  }

  return { converted, fxConversions, excludedAccounts };
}

async function monthSummaryForScope(
  userId: string,
  loaded: readonly LoadedAccount[],
  scope: OverviewScope,
  today: string,
): Promise<OverviewMonthSummary> {
  const start = monthStartDate(today);
  const accountById = new Map(loaded.map((account) => [account.id, account]));
  const scopedIds = new Set(loaded.map((account) => account.id));

  const allAccounts = await listAccountsWithEntities(userId, {
    entityType: "both",
    includeArchived: true,
  });
  const entityByAccountId = new Map(
    allAccounts.map((account) => [
      account.id,
      (account.entity?.type === "pj" ? "pj" : "pf") as "pf" | "pj",
    ]),
  );

  const rows = await getDb()
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      amountCents: transactions.amountCents,
      transferId: transactions.transferId,
      date: transactions.date,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId));

  const byTransfer = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.transferId) {
      continue;
    }
    const list = byTransfer.get(row.transferId) ?? [];
    list.push(row);
    byTransfer.set(row.transferId, list);
  }

  const entries: MonthSummaryEntry[] = [];
  for (const row of rows) {
    if (!scopedIds.has(row.accountId)) {
      continue;
    }
    if (row.date < start || row.date > today) {
      continue;
    }
    const account = accountById.get(row.accountId)!;
    let otherAccountEntityType: "pf" | "pj" | null = null;
    if (row.transferId) {
      const mates = byTransfer.get(row.transferId) ?? [];
      const other = mates.find((mate) => mate.id !== row.id);
      if (other) {
        otherAccountEntityType = entityByAccountId.get(other.accountId) ?? null;
      }
    }
    entries.push({
      amountCents: row.amountCents,
      transferId: row.transferId,
      accountEntityType: account.entityType,
      otherAccountEntityType,
    });
  }

  return monthSummaryCents(entries, scope);
}

/**
 * Net worth overview for one user and scope.
 *
 * - scope: pf, pj or all
 * - asOfDate: the "today" date used for balances and the current history point
 * - hasAccounts: whether any account exists in the scope
 * - netWorthCents: BRL total today (excluded foreign accounts omitted)
 * - history: 12 points of net worth in BRL cents with dates
 * - ledger: assets/liabilities by class with subtotals and net
 * - byCurrency / byInstitution: breakdown tables
 * - changeMonthCents / change12MonthsCents: period deltas
 * - monthSummary: in / out / left for the current month
 * - fxConversions: rate used per foreign account (stale when lookup failed)
 * - excludedAccounts: foreign accounts with no usable rate
 */
export async function getNetWorthOverview(
  userId: string,
  scope: OverviewScope,
  asOfDate: string,
  fetchImpl: typeof fetch = fetch,
): Promise<NetWorthOverview> {
  const uid = requireUserId(userId);
  const loaded = await loadScopedAccounts(uid, scope);
  const historyDates = netWorthHistoryDates(asOfDate);
  const emptyLedger = buildOverviewLedger([], asOfDate);

  if (loaded.length === 0) {
    return {
      scope,
      asOfDate,
      hasAccounts: false,
      netWorthCents: 0,
      history: historyDates.map((date) => ({ date, netWorthCents: 0 })),
      ledger: emptyLedger,
      byCurrency: [],
      byInstitution: [],
      changeMonthCents: 0,
      change12MonthsCents: 0,
      monthSummary: { inCents: 0, outCents: 0, leftCents: 0 },
      fxConversions: [],
      excludedAccounts: [],
    };
  }

  const history: OverviewHistoryPoint[] = [];
  for (const date of historyDates) {
    const { converted } = await convertAccountsOnDate(loaded, date, fetchImpl);
    const nwAccounts = converted
      .filter((row) => row.included)
      .map((row) =>
        asBrlNetWorthAccount(row.account, row.balanceBrlCents, date),
      );
    history.push({
      date,
      netWorthCents: netWorthCents(nwAccounts, date),
    });
  }

  const todayPack = await convertAccountsOnDate(loaded, asOfDate, fetchImpl);
  const todayAccounts = todayPack.converted
    .filter((row) => row.included)
    .map((row) =>
      asBrlNetWorthAccount(row.account, row.balanceBrlCents, asOfDate),
    );
  const todayNet = netWorthCents(todayAccounts, asOfDate);
  const ledger = buildOverviewLedger(todayAccounts, asOfDate);

  const currencyMap = new Map<string, OverviewCurrencyRow>();
  const institutionMap = new Map<string | null, number>();
  for (const row of todayPack.converted) {
    if (!row.included) {
      continue;
    }
    const currency = row.account.currency.toUpperCase();
    const existing = currencyMap.get(currency) ?? {
      currency,
      originalCents: 0,
      brlCents: 0,
    };
    existing.originalCents += row.balanceOriginalCents;
    existing.brlCents += row.balanceBrlCents;
    currencyMap.set(currency, existing);
    institutionMap.set(
      row.account.institution,
      (institutionMap.get(row.account.institution) ?? 0) + row.balanceBrlCents,
    );
  }

  const monthSummary = await monthSummaryForScope(
    uid,
    loaded,
    scope,
    asOfDate,
  );
  const first = history[0]?.netWorthCents ?? 0;
  const priorMonth = history[history.length - 2]?.netWorthCents ?? 0;

  return {
    scope,
    asOfDate,
    hasAccounts: true,
    netWorthCents: todayNet,
    history,
    ledger,
    byCurrency: [...currencyMap.values()].sort((a, b) =>
      a.currency.localeCompare(b.currency),
    ),
    byInstitution: [...institutionMap.entries()]
      .map(([institution, brlCents]) => ({ institution, brlCents }))
      .sort((a, b) =>
        String(a.institution).localeCompare(String(b.institution)),
      ),
    changeMonthCents: todayNet - priorMonth,
    change12MonthsCents: todayNet - first,
    monthSummary,
    fxConversions: todayPack.fxConversions,
    excludedAccounts: todayPack.excludedAccounts,
  };
}
