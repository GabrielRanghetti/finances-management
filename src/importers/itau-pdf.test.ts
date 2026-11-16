import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { parseItauStatementText } from "./itau-pdf";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "pdf",
);

describe("parseItauStatementText", () => {
  test("parses anonymized Itaú extracted-text fixture", () => {
    const text = readFileSync(join(fixturesDir, "itau-extrato.txt"), "utf8");
    const result = parseItauStatementText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows).toEqual([
      {
        date: "2026-11-02",
        amountCents: 15000,
        description: "TED 123.4567.LOJA EXEMPLO S A",
        externalId: null,
        source: "pdf",
      },
      {
        date: "2026-11-05",
        amountCents: -123456,
        description: "FINANC IMOBILIARIO 001/120",
        externalId: null,
        source: "pdf",
      },
      {
        date: "2026-11-05",
        amountCents: 321,
        description: "REND PAGO APLIC AUT MAIS",
        externalId: null,
        source: "pdf",
      },
      {
        date: "2026-11-10",
        amountCents: -50000,
        description: "PAG BOLETO ITAU UNIBANCO S/A",
        externalId: null,
        source: "pdf",
      },
      {
        date: "2026-11-10",
        amountCents: 110,
        description: "REND PAGO APLIC AUT MAIS",
        externalId: null,
        source: "pdf",
      },
      {
        date: "2026-11-12",
        amountCents: 200000,
        description: "TED 987.6543",
        externalId: null,
        source: "pdf",
      },
    ]);
  });

  test("rejects unrecognized text", () => {
    expect(parseItauStatementText("nota fiscal qualquer").ok).toBe(false);
  });

  test("importing the same fixture twice marks all as duplicates by date+amount", async () => {
    const { markProbableDuplicates } = await import("@/domain/duplicates");
    const text = readFileSync(join(fixturesDir, "itau-extrato.txt"), "utf8");
    const result = parseItauStatementText(text);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const existing = result.rows.map((row) => ({
      date: row.date,
      amountCents: row.amountCents,
      externalId: null as string | null,
    }));
    const marked = markProbableDuplicates(result.rows, existing);
    expect(marked.every((row) => row.probableDuplicate)).toBe(true);
  });
});
