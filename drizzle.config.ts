import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  ...(databaseUrl
    ? { dbCredentials: { url: databaseUrl } }
    : {
        driver: "pglite",
        dbCredentials: { url: "./.pglite-data" },
      }),
});
