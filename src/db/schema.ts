/**
 * Money convention:
 * - Amounts: integer cents (never floats)
 * - Quantities and prices: numeric
 * - Never use floating-point types for money
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

export * from "./auth-schema";

export const entityTypes = ["pf", "pj"] as const;
export type EntityType = (typeof entityTypes)[number];

export const accountTypes = [
  "bank",
  "cash",
  "credit_card",
  "brokerage",
  "loan",
  "property",
  "vehicle",
  "other",
] as const;
export type AccountType = (typeof accountTypes)[number];

export const categoryKinds = ["income", "expense"] as const;
export type CategoryKind = (typeof categoryKinds)[number];

export const transactionSources = ["manual"] as const;
export type TransactionSource = (typeof transactionSources)[number];

export const entities = pgTable(
  "entities",
  {
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
  },
  (table) => [
    // One auto-created default PF per user under concurrent ensureDefaultPfEntity.
    uniqueIndex("entities_user_default_pf_uidx")
      .on(table.userId)
      .where(sql`${table.type} = 'pf' AND ${table.name} = 'Pessoa física'`),
  ],
);

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
  institution: text("institution"),
  /** Day of month when a credit card statement closes (1–31). */
  closingDay: integer("closing_day"),
  /** Acquisition cost for property, vehicle and other (tax / history). */
  acquisitionCostCents: bigint("acquisition_cost_cents", { mode: "number" }),
  acquisitionDate: date("acquisition_date"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  parentId: uuid("parent_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    date: date("date").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    description: text("description").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    transferId: uuid("transfer_id"),
    installmentGroupId: uuid("installment_group_id"),
    source: text("source").notNull().default("manual"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("transactions_account_external_id_uidx").on(
      table.accountId,
      table.externalId,
    ),
  ],
);

export const loanTerms = pgTable(
  "loan_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    principalCents: bigint("principal_cents", { mode: "number" }).notNull(),
    monthlyInterestRate: numeric("monthly_interest_rate", {
      precision: 12,
      scale: 8,
    }).notNull(),
    termMonths: integer("term_months").notNull(),
    firstPaymentDate: date("first_payment_date").notNull(),
    system: text("system").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("loan_terms_account_id_uidx").on(table.accountId),
  ],
);

export const valuations = pgTable("valuations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  valueCents: bigint("value_cents", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
