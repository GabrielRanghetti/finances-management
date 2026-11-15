import { migrate } from "drizzle-orm/pglite/migrator";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, test, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
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

import AppLayout from "./layout";
import { listEntities } from "@/db/entities";
import { getDb } from "@/db/index";
import { user } from "@/db/schema";

beforeAll(async () => {
  const db = getDb();
  await migrate(db as never, { migrationsFolder: "./drizzle" });
});

describe("app layout default PF entity", () => {
  test("creates a default PF entity for a new signed-in user", async () => {
    const now = new Date();
    const userId = "layout-default-pf-user";
    await getDb().insert(user).values({
      id: userId,
      name: userId,
      email: "layout-pf@example.com",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    expect(await listEntities(userId)).toEqual([]);

    getSession.mockResolvedValue({
      user: { id: userId, email: "layout-pf@example.com", name: userId },
      session: { id: `session-${userId}`, userId },
    });

    await AppLayout({ children: <div>ok</div> });

    const entities = await listEntities(userId);
    expect(entities).toHaveLength(1);
    expect(entities[0]?.type).toBe("pf");
    expect(entities[0]?.name).toBe("Pessoa física");
  });
});
