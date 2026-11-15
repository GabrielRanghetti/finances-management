/**
 * Money convention:
 * - Amounts: integer cents (never floats)
 * - Quantities and prices: numeric
 * - Never use floating-point types for money
 */
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export * from "./auth-schema";

export const entityTypes = ["pf", "pj"] as const;
export type EntityType = (typeof entityTypes)[number];

export const entities = pgTable("entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  documentNumber: text("document_number"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  currency: text("currency").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
