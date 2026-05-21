CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'estimator', 'scheduler', 'supervisor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."resource_category" AS ENUM('tenaga', 'bahan', 'peralatan');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'on_hold', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."fleet_role" AS ENUM('primary', 'backup', 'standby', 'spare');--> statement-breakpoint
CREATE TYPE "public"."shift" AS ENUM('day', 'night', 'all');--> statement-breakpoint
CREATE TYPE "public"."weather" AS ENUM('clear', 'cloudy', 'rain_light', 'rain_heavy', 'storm');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'paused');--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"token" text NOT NULL,
	"invited_by_id" uuid,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"logo" text,
	"currency" varchar(3) DEFAULT 'IDR' NOT NULL,
	"locale" varchar(8) DEFAULT 'id-ID' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Jakarta' NOT NULL,
	"plan" varchar(32) DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" varchar(255),
	"image" text,
	"password_hash" text,
	"totp_secret" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "ahsp_input" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ahsp_item_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"kode" varchar(64) NOT NULL,
	"variable" varchar(64),
	"uraian" text NOT NULL,
	"nilai" numeric(18, 6),
	"satuan" varchar(32),
	"sumber" text
);
--> statement-breakpoint
CREATE TABLE "ahsp_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"kode" varchar(32) NOT NULL,
	"label" varchar(64),
	"source_kode" varchar(64),
	"item_no" varchar(32),
	"section" varchar(128),
	"jenis" varchar(255) NOT NULL,
	"deskripsi" text,
	"satuan" varchar(16) NOT NULL,
	"ohp_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ahsp_koefisien" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ahsp_item_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"kode" varchar(64) NOT NULL,
	"variable" varchar(64),
	"uraian" text,
	"nilai" numeric(18, 8),
	"satuan" varchar(32),
	"formula" text
);
--> statement-breakpoint
CREATE TABLE "ahsp_resource" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ahsp_item_id" uuid NOT NULL,
	"category" "resource_category" NOT NULL,
	"ordinal" integer NOT NULL,
	"resource_code" varchar(32) NOT NULL,
	"uraian" text NOT NULL,
	"koefisien" numeric(18, 8) NOT NULL,
	"satuan" varchar(32),
	"hsd" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"client" varchar(255),
	"location" text,
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"start_date" date,
	"finish_date" date,
	"duration_days" numeric(8, 1),
	"fleet_design" text,
	"plan_land_clearing" numeric(14, 2) DEFAULT '0' NOT NULL,
	"plan_cut_soil" numeric(14, 2) DEFAULT '0' NOT NULL,
	"plan_cut_rock" numeric(14, 2) DEFAULT '0' NOT NULL,
	"plan_fill" numeric(14, 2) DEFAULT '0' NOT NULL,
	"target_cut_daily" numeric(14, 2) DEFAULT '0' NOT NULL,
	"target_fill_daily" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cached_boq_subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"cached_grand_total" numeric(18, 2) DEFAULT '0' NOT NULL,
	"cached_spi" numeric(6, 4),
	"cached_cpi" numeric(6, 4),
	"cached_earned_value" numeric(18, 2) DEFAULT '0' NOT NULL,
	"cached_progress_pct" numeric(6, 2) DEFAULT '0' NOT NULL,
	"markup_pct" numeric(6, 2) DEFAULT '0' NOT NULL,
	"contingency_pct" numeric(6, 2) DEFAULT '0' NOT NULL,
	"ppn_pct" numeric(6, 2) DEFAULT '11' NOT NULL,
	"deleted_at" timestamp,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_on_project" varchar(64),
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boq_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"ahsp_item_id" uuid NOT NULL,
	"ordinal" integer DEFAULT 0 NOT NULL,
	"quantity" numeric(18, 4) DEFAULT '0' NOT NULL,
	"unit_rate_override" numeric(18, 2),
	"note" text,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boq_resource_override" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"ahsp_item_id" uuid NOT NULL,
	"resource_code" varchar(32) NOT NULL,
	"koefisien" numeric(18, 8),
	"hsd" numeric(18, 2),
	"note" text,
	"updated_by_id" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boq_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"label" varchar(128),
	"snapshot" text NOT NULL,
	"notes" text,
	"created_by_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_fleet_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"role" "fleet_role" DEFAULT 'primary' NOT NULL,
	"note" text,
	"assigned_by_id" uuid,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"unassigned_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "unit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"nomor" varchar(64) NOT NULL,
	"fleet" varchar(64),
	"jenis_alat" varchar(64),
	"brand" varchar(64),
	"model" varchar(64),
	"capacity" varchar(64),
	"vendor" varchar(128),
	"rate_per_hour" numeric(14, 2),
	"external_tracking_id" varchar(128),
	"tracking_provider" varchar(32),
	"active" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"shift" "shift" DEFAULT 'day' NOT NULL,
	"weather" "weather",
	"effective_hours" numeric(5, 2),
	"workforce" integer,
	"notes" text,
	"submitted_at_lat" numeric(10, 7),
	"submitted_at_lng" numeric(10, 7),
	"app_version" varchar(32),
	"submitted_by_id" uuid,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "entry_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_entry_id" uuid NOT NULL,
	"ahsp_item_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"satuan" varchar(16),
	"station" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "entry_equipment_util" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_entry_id" uuid NOT NULL,
	"unit_id" uuid,
	"hm_start" numeric(10, 1),
	"hm_end" numeric(10, 1),
	"hm_work" numeric(6, 1),
	"hm_idle" numeric(6, 1),
	"hm_breakdown" numeric(6, 1),
	"fuel_liters" numeric(8, 2),
	"odometer_km" numeric(10, 1),
	"trips" integer,
	"status" varchar(32),
	"note" text
);
--> statement-breakpoint
CREATE TABLE "entry_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_entry_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"url" text,
	"caption" text,
	"taken_at" timestamp,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"stripe_customer_id" varchar(128),
	"stripe_subscription_id" varchar(128),
	"stripe_price_id" varchar(128),
	"plan" varchar(32) DEFAULT 'trial' NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"seats" integer DEFAULT 5 NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" text DEFAULT 'false' NOT NULL,
	"trial_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "usage_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"metric" varchar(64) NOT NULL,
	"value" numeric(18, 2) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"reported_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"actor_id" uuid,
	"action" varchar(64) NOT NULL,
	"resource" varchar(64) NOT NULL,
	"resource_id" varchar(64),
	"diff" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"user_id" uuid,
	"success" text DEFAULT 'false' NOT NULL,
	"reason" varchar(128),
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ahsp_input" ADD CONSTRAINT "ahsp_input_ahsp_item_id_ahsp_item_id_fk" FOREIGN KEY ("ahsp_item_id") REFERENCES "public"."ahsp_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ahsp_item" ADD CONSTRAINT "ahsp_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ahsp_koefisien" ADD CONSTRAINT "ahsp_koefisien_ahsp_item_id_ahsp_item_id_fk" FOREIGN KEY ("ahsp_item_id") REFERENCES "public"."ahsp_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ahsp_resource" ADD CONSTRAINT "ahsp_resource_ahsp_item_id_ahsp_item_id_fk" FOREIGN KEY ("ahsp_item_id") REFERENCES "public"."ahsp_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment" ADD CONSTRAINT "project_assignment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignment" ADD CONSTRAINT "project_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_item" ADD CONSTRAINT "boq_item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_item" ADD CONSTRAINT "boq_item_ahsp_item_id_ahsp_item_id_fk" FOREIGN KEY ("ahsp_item_id") REFERENCES "public"."ahsp_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_item" ADD CONSTRAINT "boq_item_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_resource_override" ADD CONSTRAINT "boq_resource_override_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_resource_override" ADD CONSTRAINT "boq_resource_override_ahsp_item_id_ahsp_item_id_fk" FOREIGN KEY ("ahsp_item_id") REFERENCES "public"."ahsp_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_resource_override" ADD CONSTRAINT "boq_resource_override_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_version" ADD CONSTRAINT "boq_version_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boq_version" ADD CONSTRAINT "boq_version_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_fleet_assignment" ADD CONSTRAINT "project_fleet_assignment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_fleet_assignment" ADD CONSTRAINT "project_fleet_assignment_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_fleet_assignment" ADD CONSTRAINT "project_fleet_assignment_assigned_by_id_user_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit" ADD CONSTRAINT "unit_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_entry" ADD CONSTRAINT "daily_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_entry" ADD CONSTRAINT "daily_entry_submitted_by_id_user_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_activity" ADD CONSTRAINT "entry_activity_daily_entry_id_daily_entry_id_fk" FOREIGN KEY ("daily_entry_id") REFERENCES "public"."daily_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_activity" ADD CONSTRAINT "entry_activity_ahsp_item_id_ahsp_item_id_fk" FOREIGN KEY ("ahsp_item_id") REFERENCES "public"."ahsp_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_equipment_util" ADD CONSTRAINT "entry_equipment_util_daily_entry_id_daily_entry_id_fk" FOREIGN KEY ("daily_entry_id") REFERENCES "public"."daily_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_equipment_util" ADD CONSTRAINT "entry_equipment_util_unit_id_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_photo" ADD CONSTRAINT "entry_photo_daily_entry_id_daily_entry_id_fk" FOREIGN KEY ("daily_entry_id") REFERENCES "public"."daily_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_record" ADD CONSTRAINT "usage_record_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_log" ADD CONSTRAINT "login_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitation_org_email_idx" ON "invitation" USING btree ("organization_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_unique" ON "membership" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "membership_org_idx" ON "membership" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_slug_idx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ahsp_input_item_idx" ON "ahsp_input" USING btree ("ahsp_item_id","ordinal");--> statement-breakpoint
CREATE INDEX "ahsp_item_org_kode_idx" ON "ahsp_item" USING btree ("organization_id","kode");--> statement-breakpoint
CREATE INDEX "ahsp_item_section_idx" ON "ahsp_item" USING btree ("section");--> statement-breakpoint
CREATE INDEX "ahsp_koef_item_idx" ON "ahsp_koefisien" USING btree ("ahsp_item_id","ordinal");--> statement-breakpoint
CREATE INDEX "ahsp_resource_item_idx" ON "ahsp_resource" USING btree ("ahsp_item_id","category","ordinal");--> statement-breakpoint
CREATE INDEX "ahsp_resource_code_idx" ON "ahsp_resource" USING btree ("resource_code");--> statement-breakpoint
CREATE INDEX "project_org_code_idx" ON "project" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "project_org_status_idx" ON "project" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "proj_assign_idx" ON "project_assignment" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "boq_item_unique" ON "boq_item" USING btree ("project_id","ahsp_item_id");--> statement-breakpoint
CREATE INDEX "boq_item_project_idx" ON "boq_item" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "boq_resource_override_unique" ON "boq_resource_override" USING btree ("project_id","ahsp_item_id","resource_code");--> statement-breakpoint
CREATE INDEX "boq_resource_override_project_idx" ON "boq_resource_override" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "boq_version_unique" ON "boq_version" USING btree ("project_id","version_number");--> statement-breakpoint
CREATE UNIQUE INDEX "proj_fleet_unique" ON "project_fleet_assignment" USING btree ("project_id","unit_id");--> statement-breakpoint
CREATE INDEX "proj_fleet_project_idx" ON "project_fleet_assignment" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_org_nomor_idx" ON "unit" USING btree ("organization_id","nomor");--> statement-breakpoint
CREATE INDEX "unit_org_jenis_idx" ON "unit" USING btree ("organization_id","jenis_alat");--> statement-breakpoint
CREATE INDEX "daily_entry_project_date_idx" ON "daily_entry" USING btree ("project_id","entry_date");--> statement-breakpoint
CREATE INDEX "daily_entry_submitter_idx" ON "daily_entry" USING btree ("submitted_by_id","submitted_at");--> statement-breakpoint
CREATE INDEX "entry_activity_entry_idx" ON "entry_activity" USING btree ("daily_entry_id");--> statement-breakpoint
CREATE INDEX "entry_activity_ahsp_idx" ON "entry_activity" USING btree ("ahsp_item_id");--> statement-breakpoint
CREATE INDEX "entry_eq_util_entry_idx" ON "entry_equipment_util" USING btree ("daily_entry_id");--> statement-breakpoint
CREATE INDEX "entry_eq_util_unit_idx" ON "entry_equipment_util" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "entry_photo_entry_idx" ON "entry_photo" USING btree ("daily_entry_id");--> statement-breakpoint
CREATE INDEX "subscription_stripe_idx" ON "subscription" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "usage_org_metric_period_idx" ON "usage_record" USING btree ("organization_id","metric","period_start");--> statement-breakpoint
CREATE INDEX "audit_org_created_idx" ON "audit_log" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_resource_idx" ON "audit_log" USING btree ("resource","resource_id");--> statement-breakpoint
CREATE INDEX "login_log_email_idx" ON "login_log" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "login_log_user_idx" ON "login_log" USING btree ("user_id","created_at");