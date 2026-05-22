ALTER TABLE ahsp_item ADD COLUMN IF NOT EXISTS archived_at timestamp;
CREATE INDEX IF NOT EXISTS ahsp_item_archived_idx ON ahsp_item (archived_at) WHERE archived_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS ahsp_pin (
  user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  ahsp_item_id uuid NOT NULL REFERENCES ahsp_item(id) ON DELETE CASCADE,
  pinned_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ahsp_item_id)
);
CREATE INDEX IF NOT EXISTS ahsp_pin_user_idx ON ahsp_pin (user_id);
