import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import {
  buildCotacaoMoedaPeriodoUrl,
  parseCotacaoMoedaPeriodo,
  fetchCotacaoMoedaPeriodo,
  toPtaxDateParam,
} from "./ptax";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string) {
  return readFileSync(join(fixturesDir, name), "utf8");
}

describe("ptax client", () => {
  test("formats Olinda date params and URL", () => {
    expect(toPtaxDateParam("2026-11-10")).toBe("11-10-2026");
    const url = buildCotacaoMoedaPeriodoUrl("USD", "2026-11-10", "2026-11-13");
    expect(url).toContain("CotacaoMoedaPeriodo");
    expect(url).toContain("USD");
    expect(url).toContain("11-10-2026");
    expect(url).toContain("11-13-2026");
  });

  test("parses Fechamento quotes from recorded fixture without floats", () => {
    const raw = fixture("cotacao-moeda-periodo-usd.json");
    const quotes = parseCotacaoMoedaPeriodo(raw, "USD");
    expect(quotes).toEqual([
      {
        currency: "USD",
        date: "2026-11-10",
        buyRate: "5.58340",
        sellRate: "5.58400",
      },
      {
        currency: "USD",
        date: "2026-11-11",
        buyRate: "5.56000",
        sellRate: "5.56060",
      },
      {
        currency: "USD",
        date: "2026-11-12",
        buyRate: "5.61370",
        sellRate: "5.61430",
      },
      {
        currency: "USD",
        date: "2026-11-13",
        buyRate: "5.65120",
        sellRate: "5.65180",
      },
    ]);
  });

  test("fetchCotacaoMoedaPeriodo uses the injected fetch", async () => {
    const raw = fixture("cotacao-moeda-periodo-usd.json");
    const fetchImpl: typeof fetch = async () =>
      new Response(raw, { status: 200 });
    const quotes = await fetchCotacaoMoedaPeriodo(
      "USD",
      "2026-11-10",
      "2026-11-13",
      fetchImpl,
    );
    expect(quotes).toHaveLength(4);
    expect(quotes[3]?.buyRate).toBe("5.65120");
  });
});
