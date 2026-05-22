DO $$ BEGIN
  CREATE TYPE qc_result AS ENUM ('pass', 'fail', 'pending', 'retest_required');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS qc_test (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  test_date date NOT NULL,
  test_type varchar(80) NOT NULL,  -- 'Sand Cone Density', 'Slump', 'Concrete Cube 7d', 'CBR', 'Asphalt Extraction', 'Gradation'
  station varchar(64),              -- 'STA 0+200 RT'
  location_description text,
  sample_code varchar(80),
  spec_target text,                 -- 'MDD 95%' or 'Slump 12±2 cm' — free text
  spec_min numeric(14,4),           -- optional numeric range
  spec_max numeric(14,4),
  actual_value numeric(14,4),
  actual_text text,                 -- for non-numeric (e.g. visual)
  unit varchar(16),                 -- '%', 'cm', 'mpa', 'g/cm3'
  result qc_result NOT NULL DEFAULT 'pending',
  notes text,
  tested_by varchar(120),
  inspector_id uuid REFERENCES "user"(id),
  retest_of_id uuid REFERENCES qc_test(id) ON DELETE SET NULL,  -- link to original test if this is a retest
  photo_keys jsonb DEFAULT '[]',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qc_project_date_idx ON qc_test (project_id, test_date DESC);
CREATE INDEX IF NOT EXISTS qc_result_idx ON qc_test (project_id, result);
CREATE INDEX IF NOT EXISTS qc_type_idx ON qc_test (test_type);
