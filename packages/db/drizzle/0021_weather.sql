DO $$ BEGIN
  CREATE TYPE weather_condition AS ENUM ('cerah', 'berawan', 'gerimis', 'hujan_ringan', 'hujan_sedang', 'hujan_lebat', 'badai', 'kabut');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS weather_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  morning weather_condition,
  afternoon weather_condition,
  evening weather_condition,
  rainfall_mm numeric(6,1),
  temp_min_c numeric(4,1),
  temp_max_c numeric(4,1),
  wind_kmh numeric(5,1),
  work_disrupted_hours numeric(4,1) NOT NULL DEFAULT 0,
  rain_delay_claimed boolean NOT NULL DEFAULT false,
  rain_delay_approved boolean NOT NULL DEFAULT false,
  notes text,
  recorded_by_id uuid REFERENCES "user"(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS weather_project_date_unique ON weather_log (project_id, log_date);
CREATE INDEX IF NOT EXISTS weather_project_date_idx ON weather_log (project_id, log_date DESC);
