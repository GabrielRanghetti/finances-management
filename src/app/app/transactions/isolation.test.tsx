import { migrate } from "drizzle-orm/pglite/migrator";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";

const { getSession, notFound } = vi.hoisted(() => ({
  getSession: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

import TransactionsListPage from "./page";
import { createAccount } from "@/db/accounts";
import { getDb } from "@/db/index";
import { createTransaction, getTransaction } from "@/db/transactions";
import { user } from "@/db/schema";

beforeAll(async () => {
  const db = getDb();
  await migrate(db as never, { migrationsFolder: "./drizzle" });
});

async function createUser(id: string, email: string) {
  const now = new Date();
  await getDb().insert(user).values({
    id,
    name: id,
    email,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
  return { id, email, name: id };
}

function asSession(u: { id: string; email: string; name: string }) {
  return {
    user: u,
    session: { id: `session-${u.id}`, userId: u.id },
  };
}

describe("transactions route isolation", () => {
  test("list handlers only expose the caller's rows", async () => {
    const userA = await createUser("tx-route-a", "tx-a@example.com");
    const userB = await createUser("tx-route-b", "tx-b@example.com");

    const accountA = await createAccount(userA.id, {
      name: "Conta A",
      type: "bank",
      currency: "BRL",
    });
    const accountB = await createAccount(userB.id, {
      name: "Conta B",
      type: "bank",
      currency: "BRL",
    });

    const txA = await createTransaction(userA.id, {
      accountId: accountA.id,
      date: "2026-01-10",
      amountCents: 1500,
      description: "Receita A",
    });
    const txB = await createTransaction(userB.id, {
      accountId: accountB.id,
      date: "2026-01-10",
      amountCents: 2500,
      description: "Receita B",
    });

    expect(txA).not.toBeNull();
    expect(txB).not.toBeNull();
    expect(await getTransaction(userA.id, txB!.id)).toBeNull();
    expect(await getTransaction(userB.id, txA!.id)).toBeNull();

    getSession.mockResolvedValue(asSession(userA));
    const listHtmlA = renderToStaticMarkup(
      await TransactionsListPage({ searchParams: Promise.resolve({}) }),
    );
    expect(listHtmlA).toContain("Receita A");
    expect(listHtmlA).not.toContain("Receita B");

    getSession.mockResolvedValue(asSession(userB));
    const listHtmlB = renderToStaticMarkup(
      await TransactionsListPage({ searchParams: Promise.resolve({}) }),
    );
    expect(listHtmlB).toContain("Receita B");
    expect(listHtmlB).not.toContain("Receita A");
  });
});
