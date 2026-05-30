-- Reference seed data for fresh databases (CI, new dev setups).
-- schema.sql is schema-only (pg_dump -s), so the seed rows that used to live in
-- the SQL migrations / one-off imports are reproduced here. Idempotent.

-- Global feature flags (mirrors migration 0011_feature_flags).
INSERT INTO feature_flag (key, description, enabled_globally) VALUES
  ('ai-suggest', 'AI scope suggestions in BOQ workspace', true),
  ('beta-realtime', 'Liveblocks realtime co-edit (beta)', false),
  ('saml-sso', 'SAML SSO via Better Auth plugin (enterprise)', false),
  ('custom-report-builder', 'Drag-drop report builder (beta)', false),
  ('mobile-offline-v2', 'Mobile offline sync v2 (perf rewrite)', false)
ON CONFLICT (key) DO NOTHING;

-- Minimal GLOBAL AHSP catalog (organization_id NULL) so the catalog + REST /ahsp
-- are non-empty and the AI explain-rate / productivity features have data.
INSERT INTO ahsp_item (id, organization_id, kode, jenis, satuan, ohp_pct, category) VALUES
  ('00000000-0000-4000-a000-000000000001', NULL, 'A.1.1.1', 'Galian tanah biasa', 'm3', 10, 'galian'),
  ('00000000-0000-4000-a000-000000000002', NULL, 'A.2.1.1', 'Timbunan tanah dipadatkan', 'm3', 10, 'timbunan')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ahsp_resource (id, ahsp_item_id, category, ordinal, resource_code, uraian, koefisien, hsd) VALUES
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001', 'tenaga',    0, 'L.01', 'Pekerja',    0.75, 100000),
  ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000001', 'peralatan', 1, 'E.01', 'Excavator',  0.04, 450000),
  ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000002', 'tenaga',    0, 'L.01', 'Pekerja',    0.50, 100000),
  ('00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000002', 'peralatan', 1, 'E.02', 'Vibro roller', 0.03, 500000)
ON CONFLICT (id) DO NOTHING;
