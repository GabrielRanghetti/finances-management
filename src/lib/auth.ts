import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";

import { getDb, type Database } from "@/db";
import * as schema from "@/db/schema";
import { messages } from "@/messages/pt-BR";

/** Defer getDb() until the adapter actually queries — avoids opening a DB during `next build`. */
function lazyDb(): Database {
  return new Proxy({} as Database, {
    get(_target, prop) {
      const db = getDb();
      const value = Reflect.get(db as object, prop, db);
      return typeof value === "function"
        ? (value as (...args: never[]) => unknown).bind(db)
        : value;
    },
  });
}

export const auth = betterAuth({
  appName: messages.appName,
  database: drizzleAdapter(lazyDb(), {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  plugins: [
    twoFactor({
      issuer: messages.appName,
    }),
    passkey(),
    nextCookies(),
  ],
});
