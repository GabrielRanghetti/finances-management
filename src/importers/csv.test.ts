import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import {
  parseCsv,
  parseCsvAmountToCents,
  parseCsvDate,
} from "./csv";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "csv",
);

describe("parseCsvDate", () => {
  test("parses Brazilian and ISO dates", () => {
    expect(parseCsvDate("31/12/2026", "dd/mm/yyyy")).toBe("2026-12-31");
    expect(parseCsvDate("2026-12-31", "yyyy-mm-dd")).toBe("2026-12-31");
  });
});

describe("parseCsvAmountToCents", () => {
  test("parses Brazilian and dot decimals", () => {
    expect(parseCsvAmountToCents("1.234,56", ",")).toBe(123456);
    expect(parseCsvAmountToCents("-89.90", ".")).toBe(-8990);
  });
});

describe("parseCsv", () => {
  test("parses Nubank account extrato columns", () => {
    const text = readFileSync(
      join(fixturesDir, "nubank-account.csv"),
      "utf8",
    );
    const result = parseCsv(text, {
      dateColumn: 0,
      amountColumn: 1,
      debitColumn: null,
      creditColumn: null,
      descriptionColumn: 3,
      idColumn: 2,
      dateFormat: "dd/mm/yyyy",
      decimalSeparator: ".",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows).toEqual([
      {
        date: "2026-10-05",
        amountCents: -8990,
        description: "Pagamento de boleto ficticio",
        externalId: "6a2c1111-2222-3333-4444-555555555555",
        source: "csv",
      },
      {
        date: "2026-10-10",
        amountCents: 450000,
        description: "Transferencia recebida ficticia",
        externalId: "6a1f1111-2222-3333-4444-666666666666",
        source: "csv",
      },
      {
        date: "2026-10-15",
        amountCents: -123045,
        description: "Pagamento de fatura ficticia",
        externalId: "6a3d1111-2222-3333-4444-777777777777",
        source: "csv",
      },
    ]);
  });

  test("parses Brazilian formats with debit/credit columns", () => {
    const text = readFileSync(
      join(fixturesDir, "brazilian-generic.csv"),
      "utf8",
    );
    const result = parseCsv(text, {
      dateColumn: 0,
      amountColumn: null,
      debitColumn: 2,
      creditColumn: 3,
      descriptionColumn: 1,
      idColumn: 4,
      dateFormat: "dd/mm/yyyy",
      decimalSeparator: ",",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rows).toEqual([
      {
        date: "2026-12-31",
        amountCents: -123456,
        description: "Compra supermercado exemplo",
        externalId: "br-001",
        source: "csv",
      },
      {
        date: "2026-12-31",
        amountCents: 500000,
        description: "Salario ficticio",
        externalId: "br-002",
        source: "csv",
      },
      {
        date: "2027-01-01",
        amountCents: -1250,
        description: "Taxa bancaria exemplo",
        externalId: "br-003",
        source: "csv",
      },
    ]);
  });
});
