import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export const PGLITE_DATA_DIR = path.join(process.cwd(), ".pglite-data");

export type Database =
  | ReturnType<typeof drizzlePglite<typeof schema>>
  | ReturnType<typeof drizzlePostgres<typeof schema>>;

type DbGlobal = {
  db?: Database;
  pglite?: PGlite;
  postgres?: ReturnType<typeof postgres>;
};

const globalForDb = globalThis as typeof globalThis & DbGlobal;

export function getDb(): Database {
  if (globalForDb.db) {
    return globalForDb.db;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    globalForDb.postgres = postgres(databaseUrl);
    globalForDb.db = drizzlePostgres(globalForDb.postgres, { schema });
    return globalForDb.db;
  }

  globalForDb.pglite =
    process.env.PGLITE_MEMORY === "1"
      ? new PGlite()
      : new PGlite(PGLITE_DATA_DIR);
  globalForDb.db = drizzlePglite(globalForDb.pglite, { schema });
  return globalForDb.db;
}

export async function closeDb(): Promise<void> {
  if (globalForDb.postgres) {
    await globalForDb.postgres.end();
    globalForDb.postgres = undefined;
  }
  if (globalForDb.pglite) {
    await globalForDb.pglite.close();
    globalForDb.pglite = undefined;
  }
  globalForDb.db = undefined;
}

