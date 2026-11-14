import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";

import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { messages } from "@/messages/pt-BR";

export const auth = betterAuth({
  appName: messages.appName,
  database: drizzleAdapter(getDb(), {
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
