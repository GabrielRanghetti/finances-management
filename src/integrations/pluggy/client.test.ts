import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import {
  createPluggyApiKey,
  extractPluggyItemId,
  listPluggyAccounts,
  listPluggyTransactions,
  getPluggyItem,
} from "./client";
import {
  isPluggyConnectionFailed,
  pluggyTransactionsToRows,
} from "./map";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixture(name: string) {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8"));
}

describe("extractPluggyItemId", () => {
  test("accepts UUID and URL containing UUID", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(extractPluggyItemId(id)).toBe(id);
    expect(
      extractPluggyItemId(`https://my.pluggy.ai/items/${id}`),
    ).toBe(id);
  });
});

describe("pluggy client with recorded fixtures", () => {
  test("parses auth, accounts, transactions and maps rows", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/auth")) {
        return new Response(JSON.stringify({ apiKey: "test-key" }), {
          status: 200,
        });
      }
      if (url.includes("/items/")) {
        return new Response(JSON.stringify(fixture("item.json")), {
          status: 200,
        });
      }
      if (url.includes("/accounts")) {
        return new Response(JSON.stringify(fixture("accounts.json")), {
          status: 200,
        });
      }
      if (url.includes("/v2/transactions")) {
        return new Response(JSON.stringify(fixture("transactions.json")), {
          status: 200,
        });
      }
      return new Response("not found", { status: 404 });
    };

    process.env.PLUGGY_API_CLIENT_ID = "test-id";
    process.env.PLUGGY_API_CLIENT_SECRET = "test-secret";

    const apiKey = await createPluggyApiKey(fetchImpl);
    expect(apiKey).toBe("test-key");

    const item = await getPluggyItem(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      apiKey,
      fetchImpl,
    );
    expect(isPluggyConnectionFailed(item)).toBe(false);

    const accounts = await listPluggyAccounts(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      apiKey,
      fetchImpl,
    );
    expect(accounts).toHaveLength(2);

    const txs = await listPluggyTransactions(
      accounts[0].id,
      "2026-11-01",
      "2026-11-15",
      apiKey,
      fetchImpl,
    );
    const rows = pluggyTransactionsToRows(txs);
    expect(rows).toEqual([
      {
        date: "2026-11-01",
        amountCents: -8990,
        description: "Pagamento boleto ficticio",
        externalId: "33333333-3333-4333-8333-333333333333",
        source: "pluggy",
      },
      {
        date: "2026-11-05",
        amountCents: 250000,
        description: "Transferencia recebida ficticia",
        externalId: "44444444-4444-4444-8444-444444444444",
        source: "pluggy",
      },
      {
        date: "2026-11-05",
        amountCents: -8990,
        description: "Mesmo valor segunda vez",
        externalId: "55555555-5555-4555-8555-555555555555",
        source: "pluggy",
      },
    ]);
    expect(calls.some((url) => url.includes("/auth"))).toBe(true);
  });

  test("failed item is detected", () => {
    expect(isPluggyConnectionFailed(fixture("item-error.json"))).toBe(true);
  });
});
