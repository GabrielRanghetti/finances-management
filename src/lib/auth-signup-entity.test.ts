import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, test } from "vitest";

import { DEFAULT_PF_ENTITY_NAME, listEntities } from "@/db/entities";
import { getDb } from "@/db/index";
import { auth } from "@/lib/auth";

beforeAll(async () => {
  const db = getDb();
  await migrate(db as never, { migrationsFolder: "./drizzle" });
});

describe("default PF entity on sign-up", () => {
  test("a newly signed-up user has one PF entity before any page loads", async () => {
    const email = `signup-pf-${Date.now()}@example.com`;
    const result = await auth.api.signUpEmail({
      body: {
        name: "Usuário novo",
        email,
        password: "password12345",
      },
      headers: new Headers({
        origin: "http://localhost:3000",
        "content-type": "application/json",
      }),
    });

    expect(result.user.id).toBeTruthy();

    const entities = await listEntities(result.user.id);
    expect(entities).toHaveLength(1);
    expect(entities[0]?.type).toBe("pf");
    expect(entities[0]?.name).toBe(DEFAULT_PF_ENTITY_NAME);
  });
});
