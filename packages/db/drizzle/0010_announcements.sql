-- Platform-wide announcements broadcast to all users.
-- Set by super-admin via /superadmin/announcements (TBD UI).

CREATE TABLE IF NOT EXISTS announcement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  starts_at timestamp NOT NULL DEFAULT now(),
  ends_at timestamp,
  dismissible boolean NOT NULL DEFAULT true,
  created_by_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcement_active_idx
  ON announcement (starts_at, ends_at);
