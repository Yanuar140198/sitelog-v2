-- Feature flags for gradual rollout + per-org gating.
-- Two-tier resolution: per-org override (feature_flag_override) → global default (feature_flag).

CREATE TABLE IF NOT EXISTS feature_flag (
  key text PRIMARY KEY,
  description text,
  enabled_globally boolean NOT NULL DEFAULT false,
  rollout_pct integer NOT NULL DEFAULT 0 CHECK (rollout_pct >= 0 AND rollout_pct <= 100),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_flag_override (
  organization_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  flag_key text NOT NULL REFERENCES feature_flag(key) ON DELETE CASCADE,
  enabled boolean NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, flag_key)
);

CREATE INDEX IF NOT EXISTS feature_flag_override_org_idx ON feature_flag_override (organization_id);

-- Seed common flags
INSERT INTO feature_flag (key, description, enabled_globally) VALUES
  ('ai-suggest', 'AI scope suggestions in BOQ workspace', true),
  ('beta-realtime', 'Liveblocks realtime co-edit (beta)', false),
  ('saml-sso', 'SAML SSO via Better Auth plugin (enterprise)', false),
  ('custom-report-builder', 'Drag-drop report builder (beta)', false),
  ('mobile-offline-v2', 'Mobile offline sync v2 (perf rewrite)', false)
ON CONFLICT (key) DO NOTHING;
