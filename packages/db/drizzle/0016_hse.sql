DO $$ BEGIN
  CREATE TYPE hse_severity AS ENUM ('near_miss', 'first_aid', 'medical', 'lost_time', 'fatality', 'property_damage', 'environmental');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE hse_status AS ENUM ('open', 'investigating', 'corrective_action', 'closed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS hse_incident (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  incident_date date NOT NULL,
  incident_time time,
  severity hse_severity NOT NULL,
  incident_type varchar(80) NOT NULL,
  location text NOT NULL,
  description text NOT NULL,
  involved_persons text,
  immediate_action text,
  root_cause text,
  corrective_action text,
  status hse_status NOT NULL DEFAULT 'open',
  reported_by_id uuid REFERENCES "user"(id),
  closed_at timestamp,
  closed_by_id uuid REFERENCES "user"(id),
  photo_keys jsonb DEFAULT '[]',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hse_project_date_idx ON hse_incident (project_id, incident_date DESC);
CREATE INDEX IF NOT EXISTS hse_severity_idx ON hse_incident (severity, status);
