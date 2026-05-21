CREATE TABLE "boq_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" varchar(128) NOT NULL,
	"description" text,
	"category" varchar(64),
	"items" text NOT NULL,
	"published_at" timestamp,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(16) NOT NULL,
	"token" text NOT NULL,
	"p256dh" text,
	"auth_key" text,
	"device_label" varchar(128),
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscription_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "brand_color" varchar(16) DEFAULT '#FF5500' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "brand_secondary" varchar(16) DEFAULT '#0A0A0A' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "custom_domain" varchar(128);--> statement-breakpoint
ALTER TABLE "boq_template" ADD CONSTRAINT "boq_template_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boq_template_org_idx" ON "boq_template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "boq_template_category_idx" ON "boq_template" USING btree ("category");--> statement-breakpoint
CREATE INDEX "push_user_idx" ON "push_subscription" USING btree ("user_id");