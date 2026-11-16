CREATE TABLE "csv_import_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"date_column" integer NOT NULL,
	"amount_column" integer,
	"debit_column" integer,
	"credit_column" integer,
	"description_column" integer NOT NULL,
	"id_column" integer,
	"date_format" text NOT NULL,
	"decimal_separator" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "csv_import_mappings" ADD CONSTRAINT "csv_import_mappings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "csv_import_mappings" ADD CONSTRAINT "csv_import_mappings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "csv_import_mappings_account_id_uidx" ON "csv_import_mappings" USING btree ("account_id");