import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, test } from "vitest";

import { convertForeignCentsToBrl } from "@/domain/fx";

import { getDb } from "./index";
import { lookupFxRate, upsertFxRates } from "./fx-rates";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../integrations/bcb/fixtures",
);

function fixture(name: string) {
  return readFileSync(join(fixturesDir, name), "utf8");
}

beforeAll(async () => {
  const db = getDb();
  await migrate(db as never, { migrationsFolder: "./drizzle" });
});

describe("lookupFxRate", () => {
  test("weekend date uses the latest earlier business day from the fixture", async () => {
    const raw = fixture("cotacao-moeda-periodo-usd.json");
    const fetchImpl: typeof fetch = async () =>
      new Response(raw, { status: 200 });

    // Saturday 14 Nov 2026 — closing PTAX is Friday 13 Nov.
    const result = await lookupFxRate("USD", "2026-11-14", fetchImpl);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      return;
    }
    expect(result.date).toBe("2026-11-13");
    expect(result.buyRate).toBe("5.6512");
    expect(result.sellRate).toBe("5.6518");
    expect(result.usedEarlierDate).toBe(true);

    const brlCents = convertForeignCentsToBrl(
      10_000,
      result.buyRate,
      result.sellRate,
    );
    // 100.00 USD * 5.6512 = 565.12 BRL
    expect(brlCents).toBe(56_512);
  });

  test("exact date converts with that day's PTAX buy rate", async () => {
    await upsertFxRates([
      {
        currency: "USD",
        date: "2026-11-10",
        buyRate: "5.58340",
        sellRate: "5.58400",
      },
    ]);

    const result = await lookupFxRate("USD", "2026-11-10", async () => {
      throw new Error("network should not be called");
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      return;
    }
    expect(result.usedEarlierDate).toBe(false);
    expect(result.buyRate).toBe("5.5834");
    // 100.00 USD * 5.5834 = 558.34 BRL
    expect(
      convertForeignCentsToBrl(10_000, result.buyRate, result.sellRate),
    ).toBe(55_834);
  });

  test("failed fetch returns the last known rate and its date", async () => {
    await upsertFxRates([
      {
        currency: "EUR",
        date: "2026-11-13",
        buyRate: "6.10000",
        sellRate: "6.10100",
      },
    ]);

    const result = await lookupFxRate("EUR", "2026-11-01", async () => {
      throw new Error("offline");
    });
    expect(result).toEqual({
      kind: "stale",
      currency: "EUR",
      date: "2026-11-13",
      buyRate: "6.1",
      sellRate: "6.101",
      requestedDate: "2026-11-01",
    });
  });

  test("BRL needs no lookup", async () => {
    const result = await lookupFxRate("BRL", "2026-11-16", async () => {
      throw new Error("network should not be called");
    });
    expect(result).toMatchObject({
      kind: "ok",
      currency: "BRL",
      buyRate: "1",
      sellRate: "1",
    });
  });

  test("months-old stored rate triggers a fetch for the lookback window", async () => {
    await upsertFxRates([
      {
        currency: "GBP",
        date: "2025-12-31",
        buyRate: "7.00000",
        sellRate: "7.00100",
      },
    ]);

    const requestedUrls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      requestedUrls.push(String(input));
      return new Response(fixture("cotacao-moeda-periodo-usd.json"), {
        status: 200,
      });
    };

    const result = await lookupFxRate("GBP", "2026-11-17", fetchImpl);
    expect(requestedUrls).toHaveLength(1);
    expect(requestedUrls[0]).toContain("@dataInicial='11-03-2026'");
    expect(requestedUrls[0]).toContain("@dataFinalCotacao='11-17-2026'");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      return;
    }
    expect(result.date).toBe("2026-11-13");
    expect(result.buyRate).toBe("5.6512");
    expect(result.usedEarlierDate).toBe(true);
  });

  test("Friday rate is accepted for the following Monday without fetching", async () => {
    await upsertFxRates([
      {
        currency: "CHF",
        date: "2026-11-13",
        buyRate: "6.20000",
        sellRate: "6.20100",
      },
    ]);

    const result = await lookupFxRate("CHF", "2026-11-16", async () => {
      throw new Error("network should not be called");
    });
    expect(result).toEqual({
      kind: "ok",
      currency: "CHF",
      date: "2026-11-13",
      buyRate: "6.2",
      sellRate: "6.201",
      usedEarlierDate: true,
    });
  });

  test("months-old stored rate returns stale when the fetch fails", async () => {
    await upsertFxRates([
      {
        currency: "JPY",
        date: "2025-12-31",
        buyRate: "0.03700",
        sellRate: "0.03710",
      },
    ]);

    const result = await lookupFxRate("JPY", "2026-11-17", async () => {
      throw new Error("offline");
    });
    expect(result).toEqual({
      kind: "stale",
      currency: "JPY",
      date: "2025-12-31",
      buyRate: "0.037",
      sellRate: "0.0371",
      requestedDate: "2026-11-17",
    });
  });
});
