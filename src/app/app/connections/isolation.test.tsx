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

import ConnectionsPage from "./page";
import ConnectionDetailPage from "./[id]/page";
import { createConnection } from "@/db/connections";
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

describe("connections route isolation", () => {
  test("list and detail only expose the caller's connections", async () => {
    const userA = await createUser("conn-route-a", "conn-route-a@example.com");
    const userB = await createUser("conn-route-b", "conn-route-b@example.com");
    const entityA = await createEntity(userA.id, {
      type: "pf",
      name: "Entidade Conn A",
    });
    const entityB = await createEntity(userB.id, {
      type: "pf",
      name: "Entidade Conn B",
    });
    const connA = await createConnection(userA.id, {
      itemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      entityId: entityA.id,
    });
    const connB = await createConnection(userB.id, {
      itemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      entityId: entityB.id,
    });

    getSession.mockResolvedValue(asSession(userA));
    const listHtml = renderToStaticMarkup(await ConnectionsPage());
    expect(listHtml).toContain("Entidade Conn A");
    expect(listHtml).not.toContain("Entidade Conn B");

    const detailHtml = renderToStaticMarkup(
      await ConnectionDetailPage({
        params: Promise.resolve({ id: connA!.id }),
      }),
    );
    expect(detailHtml).toContain("Entidade Conn A");

    getSession.mockResolvedValue(asSession(userA));
    await expect(
      ConnectionDetailPage({
        params: Promise.resolve({ id: connB!.id }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
