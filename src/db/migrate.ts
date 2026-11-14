import "dotenv/config";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { PGLITE_DATA_DIR } from "./index";

const migrationsFolder = "./drizzle";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const client = postgres(databaseUrl, { max: 1 });
    const db = drizzlePostgres(client);
    try {
      await migratePostgres(db, { migrationsFolder });
      console.log("Migrations applied (PostgreSQL).");
    } finally {
      await client.end();
    }
    return;
  }

  const client = new PGlite(PGLITE_DATA_DIR);
  const db = drizzlePglite(client);
  try {
    await migratePglite(db, { migrationsFolder });
    console.log("Migrations applied (PGlite).");
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
