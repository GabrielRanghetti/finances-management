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

import AccountDetailPage from "./[id]/page";
import AccountsListPage from "./page";
import { createAccount } from "@/db/accounts";
import { getDb } from "@/db/index";
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

describe("accounts route isolation", () => {
  test("list and detail handlers only expose the caller's rows", async () => {
    const userA = await createUser("route-user-a", "route-a@example.com");
    const userB = await createUser("route-user-b", "route-b@example.com");

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

    getSession.mockResolvedValue(asSession(userA));
    const listHtmlA = renderToStaticMarkup(await AccountsListPage());
    expect(listHtmlA).toContain("Conta A (BRL)");
    expect(listHtmlA).not.toContain("Conta B");

    getSession.mockResolvedValue(asSession(userB));
    const listHtmlB = renderToStaticMarkup(await AccountsListPage());
    expect(listHtmlB).toContain("Conta B (BRL)");
    expect(listHtmlB).not.toContain("Conta A");

    getSession.mockResolvedValue(asSession(userA));
    const detailOwn = renderToStaticMarkup(
      await AccountDetailPage({ params: Promise.resolve({ id: accountA.id }) }),
    );
    expect(detailOwn).toContain("Conta A");
    expect(detailOwn).toContain("BRL");

    notFound.mockClear();
    getSession.mockResolvedValue(asSession(userA));
    await expect(
      AccountDetailPage({ params: Promise.resolve({ id: accountB.id }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });
});
