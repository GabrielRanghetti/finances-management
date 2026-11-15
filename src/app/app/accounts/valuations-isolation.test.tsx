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

import EditValuationPage from "./[id]/valuations/[valuationId]/edit/page";
import NewValuationPage from "./[id]/valuations/new/page";
import { createAccount } from "@/db/accounts";
import { getDb } from "@/db/index";
import { user } from "@/db/schema";
import { createValuation } from "@/db/valuations";

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

describe("valuations route isolation", () => {
  test("detail routes only expose the caller's valuations", async () => {
    const userA = await createUser("val-route-a", "val-route-a@example.com");
    const userB = await createUser("val-route-b", "val-route-b@example.com");

    const propA = await createAccount(userA.id, {
      name: "Casa A",
      type: "property",
      currency: "BRL",
      acquisitionCostCents: 100_000,
      acquisitionDate: "2020-01-01",
    });
    const propB = await createAccount(userB.id, {
      name: "Casa B",
      type: "property",
      currency: "BRL",
      acquisitionCostCents: 200_000,
      acquisitionDate: "2020-01-01",
    });
    const valA = await createValuation(userA.id, {
      accountId: propA.id,
      date: "2026-01-01",
      valueCents: 150_000,
    });
    const valB = await createValuation(userB.id, {
      accountId: propB.id,
      date: "2026-01-01",
      valueCents: 250_000,
    });

    getSession.mockResolvedValue(asSession(userA));
    const ownNew = renderToStaticMarkup(
      await NewValuationPage({ params: Promise.resolve({ id: propA.id }) }),
    );
    expect(ownNew).toContain("Nova avaliação");

    notFound.mockClear();
    await expect(
      NewValuationPage({ params: Promise.resolve({ id: propB.id }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    getSession.mockResolvedValue(asSession(userA));
    const ownEdit = renderToStaticMarkup(
      await EditValuationPage({
        params: Promise.resolve({
          id: propA.id,
          valuationId: valA!.id,
        }),
      }),
    );
    expect(ownEdit).toContain("Editar avaliação");

    notFound.mockClear();
    await expect(
      EditValuationPage({
        params: Promise.resolve({
          id: propA.id,
          valuationId: valB!.id,
        }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
