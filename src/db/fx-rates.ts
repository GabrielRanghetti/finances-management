import { and, desc, eq, lte } from "drizzle-orm";

import {
  fetchCotacaoMoedaPeriodo,
  type PtaxClosingQuote,
} from "@/integrations/bcb/ptax";

import { getDb } from "./index";
import { fxRates } from "./schema";

export type StoredFxRate = {
  currency: string;
  date: string;
  buyRate: string;
  sellRate: string;
};

export type FxLookupOk = StoredFxRate & {
  kind: "ok";
  /** True when the returned rate date is earlier than the requested date. */
  usedEarlierDate: boolean;
};

export type FxLookupStale = StoredFxRate & {
  kind: "stale";
  requestedDate: string;
};

export type FxLookupMissing = {
  kind: "missing";
  currency: string;
  requestedDate: string;
};

export type FxLookupResult = FxLookupOk | FxLookupStale | FxLookupMissing;

const LOOKBACK_DAYS = 14;

/** Trim trailing zeros that numeric(18,8) adds on read. */
export function normalizeRateString(rate: string): string {
  if (!rate.includes(".")) {
    return rate;
  }
  return rate.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function rowToStored(row: {
  currency: string;
  date: string;
  buyRate: string;
  sellRate: string;
}): StoredFxRate {
  return {
    currency: row.currency,
    date: row.date,
    buyRate: normalizeRateString(row.buyRate),
    sellRate: normalizeRateString(row.sellRate),
  };
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function findRateOnOrBefore(
  currency: string,
  date: string,
): Promise<StoredFxRate | null> {
  const rows = await getDb()
    .select({
      currency: fxRates.currency,
      date: fxRates.date,
      buyRate: fxRates.buyRate,
      sellRate: fxRates.sellRate,
    })
    .from(fxRates)
    .where(
      and(eq(fxRates.currency, currency), lte(fxRates.date, date)),
    )
    .orderBy(desc(fxRates.date))
    .limit(1);
  const row = rows[0];
  return row ? rowToStored(row) : null;
}

async function findLatestRate(currency: string): Promise<StoredFxRate | null> {
  const rows = await getDb()
    .select({
      currency: fxRates.currency,
      date: fxRates.date,
      buyRate: fxRates.buyRate,
      sellRate: fxRates.sellRate,
    })
    .from(fxRates)
    .where(eq(fxRates.currency, currency))
    .orderBy(desc(fxRates.date))
    .limit(1);
  const row = rows[0];
  return row ? rowToStored(row) : null;
}

export async function upsertFxRates(
  quotes: readonly PtaxClosingQuote[],
): Promise<void> {
  if (quotes.length === 0) {
    return;
  }
  for (const quote of quotes) {
    await getDb()
      .insert(fxRates)
      .values({
        currency: quote.currency,
        date: quote.date,
        buyRate: quote.buyRate,
        sellRate: quote.sellRate,
      })
      .onConflictDoUpdate({
        target: [fxRates.currency, fxRates.date],
        set: {
          buyRate: quote.buyRate,
          sellRate: quote.sellRate,
        },
      });
  }
}

/**
 * Look up PTAX for a currency on a date. BRL needs no lookup.
 * Uses the stored rate for that date or the latest earlier business day;
 * fetches and stores from BCB when the local window is empty; on fetch
 * failure returns the latest stored rate as stale; otherwise missing.
 */
export async function lookupFxRate(
  currency: string,
  date: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FxLookupResult> {
  const code = currency.toUpperCase();
  if (code === "BRL") {
    return {
      kind: "ok",
      currency: "BRL",
      date,
      buyRate: "1",
      sellRate: "1",
      usedEarlierDate: false,
    };
  }

  const stored = await findRateOnOrBefore(code, date);
  if (stored) {
    return {
      kind: "ok",
      ...stored,
      usedEarlierDate: stored.date !== date,
    };
  }

  const startDate = addDaysIso(date, -LOOKBACK_DAYS);
  try {
    const quotes = await fetchCotacaoMoedaPeriodo(
      code,
      startDate,
      date,
      fetchImpl,
    );
    await upsertFxRates(quotes);
  } catch {
    const latest = await findLatestRate(code);
    if (latest) {
      return {
        kind: "stale",
        ...latest,
        requestedDate: date,
      };
    }
    return { kind: "missing", currency: code, requestedDate: date };
  }

  const afterFetch = await findRateOnOrBefore(code, date);
  if (afterFetch) {
    return {
      kind: "ok",
      ...afterFetch,
      usedEarlierDate: afterFetch.date !== date,
    };
  }

  const latest = await findLatestRate(code);
  if (latest) {
    return {
      kind: "stale",
      ...latest,
      requestedDate: date,
    };
  }
  return { kind: "missing", currency: code, requestedDate: date };
}
