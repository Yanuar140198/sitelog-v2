DO $$ BEGIN
  CREATE TYPE vo_status AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'implemented', 'invoiced');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE vo_type AS ENUM ('addition', 'deletion', 'substitution', 'time_extension', 'design_change');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS variation_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  vo_number varchar(40) NOT NULL,
  title varchar(200) NOT NULL,
  vo_type vo_type NOT NULL,
  description text NOT NULL,
  justification text,
  cost_impact numeric(18,2) NOT NULL DEFAULT 0,
  time_impact_days integer NOT NULL DEFAULT 0,
  status vo_status NOT NULL DEFAULT 'draft',
  requested_by varchar(160),
  requested_date date,
  submitted_at timestamp,
  reviewed_at timestamp,
  approved_at timestamp,
  approved_by_id uuid REFERENCES "user"(id),
  implemented_at date,
  rejection_reason text,
  reference_documents jsonb DEFAULT '[]',
  notes text,
  created_by_id uuid REFERENCES "user"(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vo_project_number_idx ON variation_order (project_id, vo_number);
CREATE INDEX IF NOT EXISTS vo_status_idx ON variation_order (status);
