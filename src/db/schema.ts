/**
 * Money convention:
 * - Amounts: integer cents (never floats)
 * - Quantities and prices: numeric
 * - Never use floating-point types for money
 */
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export * from "./auth-schema";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  currency: text("currency").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
