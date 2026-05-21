-- Idempotency keys for safe retry of POST mutations.
-- Same (org, key) → returns cached response, never re-executes.

CREATE TABLE IF NOT EXISTS idempotency_key (
  organization_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  key text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  request_hash text NOT NULL,
  response_status integer NOT NULL,
  response_body text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idempotency_key_created_idx ON idempotency_key (created_at);
