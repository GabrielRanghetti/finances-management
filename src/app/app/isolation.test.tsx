import { migrate } from "drizzle-orm/pglite/migrator";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
    "aria-current"?: "true" | "false" | "page";
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

import AppHomePage from "./page";
import { createAccount } from "@/db/accounts";
import { createEntity } from "@/db/entities";
import { getDb } from "@/db/index";
import { user } from "@/db/schema";
import { createTransaction } from "@/db/transactions";

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

describe("overview route isolation and scope toggle", () => {
  test("overview route only exposes the signed-in user's balances and institutions", async () => {
    const userA = await createUser(
      "overview-route-a",
      "overview-route-a@example.com",
    );
    const userB = await createUser(
      "overview-route-b",
      "overview-route-b@example.com",
    );

    const entityA = await createEntity(userA.id, {
      type: "pf",
      name: "PF A",
    });
    const entityB = await createEntity(userB.id, {
      type: "pf",
      name: "PF B",
    });

    const accountA = await createAccount(userA.id, {
      name: "Conta Alfa",
      type: "bank",
      currency: "BRL",
      entityId: entityA.id,
      institution: "Banco Alfa Exclusivo",
    });
    const accountB = await createAccount(userB.id, {
      name: "Conta Beta",
      type: "bank",
      currency: "BRL",
      entityId: entityB.id,
      institution: "Banco Beta Secreto",
    });

    const today = new Date().toISOString().slice(0, 10);
    await createTransaction(userA.id, {
      accountId: accountA.id,
      date: today,
      amountCents: 123_456,
      description: "Depósito A",
    });
    await createTransaction(userB.id, {
      accountId: accountB.id,
      date: today,
      amountCents: 987_654,
      description: "Depósito B",
    });

    getSession.mockResolvedValue(asSession(userA));
    const htmlA = renderToStaticMarkup(
      await AppHomePage({ searchParams: Promise.resolve({}) }),
    );
    expect(htmlA).toContain("1.234,56");
    expect(htmlA).toContain("Banco Alfa Exclusivo");
    expect(htmlA).not.toContain("9.876,54");
    expect(htmlA).not.toContain("Banco Beta Secreto");

    getSession.mockResolvedValue(asSession(userB));
    const htmlB = renderToStaticMarkup(
      await AppHomePage({ searchParams: Promise.resolve({}) }),
    );
    expect(htmlB).toContain("9.876,54");
    expect(htmlB).toContain("Banco Beta Secreto");
    expect(htmlB).not.toContain("1.234,56");
    expect(htmlB).not.toContain("Banco Alfa Exclusivo");
  });

  test("renders the three scope links with the active one marked aria-current=true", async () => {
    const viewer = await createUser(
      "overview-scope-links",
      "overview-scope-links@example.com",
    );
    getSession.mockResolvedValue(asSession(viewer));

    const defaultHtml = renderToStaticMarkup(
      await AppHomePage({ searchParams: Promise.resolve({}) }),
    );
    expect(defaultHtml).toMatch(
      /<a href="\/app\?scope=pf"[^>]*>Pessoal<\/a>/,
    );
    expect(defaultHtml).toMatch(
      /<a href="\/app\?scope=pj"[^>]*>Empresa<\/a>/,
    );
    expect(defaultHtml).toMatch(
      /<a href="\/app\?scope=all" aria-current="true"[^>]*>Tudo<\/a>/,
    );

    const pfHtml = renderToStaticMarkup(
      await AppHomePage({ searchParams: Promise.resolve({ scope: "pf" }) }),
    );
    expect(pfHtml).toMatch(
      /<a href="\/app\?scope=pf" aria-current="true"[^>]*>Pessoal<\/a>/,
    );
    expect(pfHtml).not.toMatch(
      /<a href="\/app\?scope=pj" aria-current="true"/,
    );
    expect(pfHtml).not.toMatch(
      /<a href="\/app\?scope=all" aria-current="true"/,
    );

    const pjHtml = renderToStaticMarkup(
      await AppHomePage({ searchParams: Promise.resolve({ scope: "pj" }) }),
    );
    expect(pjHtml).toMatch(
      /<a href="\/app\?scope=pj" aria-current="true"[^>]*>Empresa<\/a>/,
    );
    expect(pjHtml).not.toMatch(
      /<a href="\/app\?scope=pf" aria-current="true"/,
    );
    expect(pjHtml).not.toMatch(
      /<a href="\/app\?scope=all" aria-current="true"/,
    );
  });
});
