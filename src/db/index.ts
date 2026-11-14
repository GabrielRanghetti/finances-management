import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const PGLITE_DATA_DIR = "./.pglite-data";

export type Database =
  | ReturnType<typeof drizzlePglite<typeof schema>>
  | ReturnType<typeof drizzlePostgres<typeof schema>>;

let dbInstance: Database | undefined;
let pgliteClient: PGlite | undefined;
let postgresClient: ReturnType<typeof postgres> | undefined;

export function getDb(): Database {
  if (dbInstance) {
    return dbInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    postgresClient = postgres(databaseUrl);
    dbInstance = drizzlePostgres(postgresClient, { schema });
    return dbInstance;
  }

  pgliteClient = new PGlite(PGLITE_DATA_DIR);
  dbInstance = drizzlePglite(pgliteClient, { schema });
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (postgresClient) {
    await postgresClient.end();
    postgresClient = undefined;
  }
  if (pgliteClient) {
    await pgliteClient.close();
    pgliteClient = undefined;
  }
  dbInstance = undefined;
}

export { PGLITE_DATA_DIR };
