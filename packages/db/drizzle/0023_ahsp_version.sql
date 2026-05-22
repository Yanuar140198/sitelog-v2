CREATE TABLE IF NOT EXISTS ahsp_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ahsp_item_id uuid NOT NULL REFERENCES ahsp_item(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by_id uuid REFERENCES "user"(id),
  change_summary varchar(200),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ahsp_version_item_idx ON ahsp_version (ahsp_item_id, version_number DESC);
