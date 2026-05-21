CREATE TABLE "public_share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"token" text NOT NULL,
	"label" varchar(128),
	"include_kpi" text DEFAULT 'true' NOT NULL,
	"include_entries" text DEFAULT 'false' NOT NULL,
	"expires_at" timestamp,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "public_share_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "public_share" ADD CONSTRAINT "public_share_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_share" ADD CONSTRAINT "public_share_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_share_project_idx" ON "public_share" USING btree ("project_id");