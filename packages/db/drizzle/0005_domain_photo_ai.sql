ALTER TABLE "organization" ADD COLUMN "custom_domain_verify_token" varchar(64);--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "custom_domain_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "entry_photo" ADD COLUMN "ai_caption" text;--> statement-breakpoint
ALTER TABLE "entry_photo" ADD COLUMN "ai_tags" text;--> statement-breakpoint
ALTER TABLE "entry_photo" ADD COLUMN "ai_progress_pct" numeric(5, 1);--> statement-breakpoint
ALTER TABLE "entry_photo" ADD COLUMN "ai_analyzed_at" timestamp;