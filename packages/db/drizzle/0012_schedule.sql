-- Schedule + baseline tracking for S-curve + Gantt views (Primavera-style).

-- Per-scope dates: planned, actual, baseline
ALTER TABLE boq_item ADD COLUMN IF NOT EXISTS planned_start date;
ALTER TABLE boq_item ADD COLUMN IF NOT EXISTS planned_finish date;
ALTER TABLE boq_item ADD COLUMN IF NOT EXISTS actual_start date;
ALTER TABLE boq_item ADD COLUMN IF NOT EXISTS actual_finish date;
ALTER TABLE boq_item ADD COLUMN IF NOT EXISTS baseline_start date;
ALTER TABLE boq_item ADD COLUMN IF NOT EXISTS baseline_finish date;
ALTER TABLE boq_item ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

-- Project-level data date (cut-off for S-curve calc)
ALTER TABLE project ADD COLUMN IF NOT EXISTS data_date date;
ALTER TABLE project ADD COLUMN IF NOT EXISTS baseline_set_at timestamp;

-- Baseline history (audit trail for rebases)
CREATE TABLE IF NOT EXISTS schedule_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  set_by uuid REFERENCES "user"(id),
  set_at timestamp NOT NULL DEFAULT now(),
  notes text,
  snapshot jsonb NOT NULL,  -- { items: [{ boqItemId, plannedStart, plannedFinish, qty, rate }] }
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_baseline_project_idx ON schedule_baseline (project_id, set_at DESC);

-- Seed planned dates for existing items: spread evenly between project start/finish
UPDATE boq_item bi SET
  planned_start = COALESCE(p.start_date, CURRENT_DATE),
  planned_finish = COALESCE(p.finish_date, CURRENT_DATE + INTERVAL '90 days')
FROM project p
WHERE bi.project_id = p.id AND bi.planned_start IS NULL;
