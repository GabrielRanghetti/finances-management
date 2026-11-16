import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import {
  parseOfx,
  parseOfxAmountToCents,
  parseOfxDate,
} from "./ofx";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "ofx",
);

describe("parseOfxDate", () => {
  test("parses OFX datetime with timezone suffix", () => {
    expect(parseOfxDate("20261005000000[-3:BRT]")).toBe("2026-10-05");
  });
});

describe("parseOfxAmountToCents", () => {
  test("parses signed dot decimals", () => {
    expect(parseOfxAmountToCents("-150.40")).toBe(-15040);
    expect(parseOfxAmountToCents("2500.00")).toBe(250000);
    expect(parseOfxAmountToCents("10")).toBe(1000);
  });
});

describe("parseOfx", () => {
  test("parses bank STMTRS UTF-8 fixture", () => {
    const bytes = readFileSync(join(fixturesDir, "bank-utf8.ofx"));
    const result = parseOfx(bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.ledgerBalanceCents).toBe(123456);
    expect(result.rows).toEqual([
      {
        date: "2026-10-05",
        amountCents: -15040,
        description: "Pagamento boleto loja exemplo",
        externalId: "aaaaaaaa-bbbb-cccc-dddd-111111111111",
        source: "ofx",
      },
      {
        date: "2026-10-10",
        amountCents: 250000,
        description: "Transferencia recebida cliente ficticio",
        externalId: "aaaaaaaa-bbbb-cccc-dddd-222222222222",
        source: "ofx",
      },
      {
        date: "2026-10-15",
        amountCents: -4250,
        description: "Compra mercado ficticio",
        externalId: "aaaaaaaa-bbbb-cccc-dddd-333333333333",
        source: "ofx",
      },
    ]);
  });

  test("parses card CCSTMTRS with charset 1252", () => {
    const bytes = readFileSync(join(fixturesDir, "card-cp1252.ofx"));
    const result = parseOfx(bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.ledgerBalanceCents).toBe(-32045);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[1]).toMatchObject({
      date: "2026-10-12",
      amountCents: -1500,
      externalId: "cccccccc-dddd-eeee-ffff-555555555555",
      source: "ofx",
    });
    expect(result.rows[1].description).toContain("Café");
    expect(result.rows[1].description).toContain("açúcar");
  });

  test("rejects non-OFX content", () => {
    expect(parseOfx("not an ofx file").ok).toBe(false);
  });
});
