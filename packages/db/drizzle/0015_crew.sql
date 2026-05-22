DO $$ BEGIN
  CREATE TYPE crew_role AS ENUM ('mandor', 'tukang', 'pekerja', 'operator', 'helper', 'driver', 'surveyor', 'security', 'admin', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE crew_status AS ENUM ('active', 'on_leave', 'terminated');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS crew_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  full_name varchar(160) NOT NULL,
  nickname varchar(60),
  phone varchar(32),
  national_id varchar(32),  -- KTP
  role crew_role NOT NULL DEFAULT 'pekerja',
  daily_rate numeric(14,2) NOT NULL DEFAULT 0,
  hourly_rate numeric(14,2) NOT NULL DEFAULT 0,
  status crew_status NOT NULL DEFAULT 'active',
  hire_date date,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crew_org_idx ON crew_member (organization_id, status);

CREATE TABLE IF NOT EXISTS crew_assignment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_member_id uuid NOT NULL REFERENCES crew_member(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  from_date date NOT NULL,
  to_date date,
  role_override crew_role,
  daily_rate_override numeric(14,2),
  notes text,
  assigned_by uuid REFERENCES "user"(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crew_assign_project_idx ON crew_assignment (project_id, from_date);
CREATE INDEX IF NOT EXISTS crew_assign_crew_idx ON crew_assignment (crew_member_id);
