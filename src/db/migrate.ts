import "dotenv/config";

import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const migrationsFolder = "./drizzle";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Run npm run db:up and copy .env.example to .env.",
    );
  }

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzlePostgres(client);
  try {
    await migratePostgres(db, { migrationsFolder });
    console.log("Migrations applied (PostgreSQL).");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
