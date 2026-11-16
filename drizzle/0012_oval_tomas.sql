CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"currency" text NOT NULL,
	"date" date NOT NULL,
	"buy_rate" numeric(18, 8) NOT NULL,
	"sell_rate" numeric(18, 8) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rates_currency_date_uidx" ON "fx_rates" USING btree ("currency","date");