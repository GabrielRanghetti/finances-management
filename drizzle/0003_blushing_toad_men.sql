CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"document_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "entity_id" uuid;--> statement-breakpoint
INSERT INTO "entities" ("user_id", "type", "name")
SELECT DISTINCT "user_id", 'pf', 'Pessoa física'
FROM "accounts"
WHERE "user_id" NOT IN (SELECT "user_id" FROM "entities" WHERE "type" = 'pf');--> statement-breakpoint
UPDATE "accounts" AS a
SET "entity_id" = e."id"
FROM "entities" AS e
WHERE e."user_id" = a."user_id" AND e."type" = 'pf' AND a."entity_id" IS NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "entity_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE restrict ON UPDATE no action;
