-- Runtime error log (server + client) for debugging / QA.
CREATE TABLE IF NOT EXISTS error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source varchar(16) NOT NULL,
  level varchar(16) NOT NULL DEFAULT 'error',
  message text NOT NULL,
  stack text,
  path text,
  method varchar(8),
  status integer,
  url text,
  user_agent text,
  organization_id uuid,
  user_id uuid,
  request_id varchar(64),
  context text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS error_log_created_idx ON error_log (created_at);
