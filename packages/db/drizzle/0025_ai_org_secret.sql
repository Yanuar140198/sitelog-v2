-- Per-org encrypted third-party credentials (BYO keys), e.g. each org's own
-- Anthropic API key for the AI assistant. Only ciphertext/iv/auth_tag are stored.
CREATE TABLE IF NOT EXISTS org_secret (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  provider varchar(32) NOT NULL,
  ciphertext text NOT NULL,
  iv varchar(32) NOT NULL,
  auth_tag varchar(32) NOT NULL,
  hint varchar(12),
  created_by_id uuid REFERENCES "user"(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS org_secret_provider_idx ON org_secret (organization_id, provider);
