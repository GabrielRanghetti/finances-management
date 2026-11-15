ALTER TABLE "accounts" ADD COLUMN "institution" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;