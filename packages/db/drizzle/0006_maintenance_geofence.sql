CREATE TYPE "public"."maintenance_kind" AS ENUM('scheduled', 'breakdown', 'inspection', 'oil_change', 'tire', 'overhaul');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('planned', 'in_progress', 'completed', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TABLE "unit_maintenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"kind" "maintenance_kind" NOT NULL,
	"status" "maintenance_status" DEFAULT 'planned' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"due_at_hm" numeric(10, 1),
	"due_at_date" timestamp,
	"interval_hm" numeric(10, 1),
	"interval_days" integer,
	"performed_at" timestamp,
	"performed_at_hm" numeric(10, 1),
	"cost" numeric(14, 2),
	"vendor" varchar(128),
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "site_lat" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "site_lng" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "geofence_radius_m" numeric(8, 0);--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "currency" varchar(3);--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "fx_rate_to_org" numeric(14, 6);--> statement-breakpoint
ALTER TABLE "unit_maintenance" ADD CONSTRAINT "unit_maintenance_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "maint_unit_idx" ON "unit_maintenance" USING btree ("unit_id","status");--> statement-breakpoint
CREATE INDEX "maint_due_idx" ON "unit_maintenance" USING btree ("due_at_date");