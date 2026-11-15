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

import EditEntityPage from "./[id]/edit/page";
import EntitiesListPage from "./page";
import { createEntity } from "@/db/entities";
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

describe("entities route isolation", () => {
  test("list and detail handlers only expose the caller's rows", async () => {
    const userA = await createUser("entity-route-a", "entity-a@example.com");
    const userB = await createUser("entity-route-b", "entity-b@example.com");

    const entityA = await createEntity(userA.id, {
      type: "pj",
      name: "Empresa A",
    });
    const entityB = await createEntity(userB.id, {
      type: "pj",
      name: "Empresa B",
    });

    getSession.mockResolvedValue(asSession(userA));
    const listHtmlA = renderToStaticMarkup(await EntitiesListPage());
    expect(listHtmlA).toContain("Empresa A");
    expect(listHtmlA).not.toContain("Empresa B");

    getSession.mockResolvedValue(asSession(userB));
    const listHtmlB = renderToStaticMarkup(await EntitiesListPage());
    expect(listHtmlB).toContain("Empresa B");
    expect(listHtmlB).not.toContain("Empresa A");

    getSession.mockResolvedValue(asSession(userA));
    const detailOwn = renderToStaticMarkup(
      await EditEntityPage({ params: Promise.resolve({ id: entityA.id }) }),
    );
    expect(detailOwn).toContain("Empresa A");

    notFound.mockClear();
    getSession.mockResolvedValue(asSession(userA));
    await expect(
      EditEntityPage({ params: Promise.resolve({ id: entityB.id }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });
});
