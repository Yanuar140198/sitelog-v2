-- Centralized resource catalog. Region price tiers via resource_master_price.
DO $$ BEGIN
  CREATE TYPE resource_master_category AS ENUM ('tenaga', 'bahan', 'peralatan');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS resource_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organization(id) ON DELETE CASCADE,  -- null = global
  kode varchar(32) NOT NULL,
  nama text NOT NULL,
  category resource_master_category NOT NULL,
  satuan varchar(16) NOT NULL,
  default_hsd numeric(18,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS resource_master_org_kode ON resource_master (COALESCE(organization_id::text, ''), kode);

CREATE TABLE IF NOT EXISTS resource_master_price (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES resource_master(id) ON DELETE CASCADE,
  region varchar(64) NOT NULL,  -- 'JAKARTA', 'SULAWESI', 'KALIMANTAN', etc
  hsd numeric(18,2) NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resource_master_price_resource ON resource_master_price (resource_id, region, effective_from DESC);

-- Add resource_master_id column to ahsp_resource for optional lookup
ALTER TABLE ahsp_resource ADD COLUMN IF NOT EXISTS resource_master_id uuid REFERENCES resource_master(id) ON DELETE SET NULL;

-- Backfill resource_master from distinct ahsp_resource rows
INSERT INTO resource_master (kode, nama, category, satuan, default_hsd, organization_id)
SELECT DISTINCT ON (resource_code)
  resource_code,
  uraian,
  category::text::resource_master_category,
  COALESCE(satuan, '-'),
  hsd,
  NULL
FROM ahsp_resource
ORDER BY resource_code, ahsp_item_id
ON CONFLICT DO NOTHING;

-- Link ahsp_resource rows to master via resource_code match
UPDATE ahsp_resource ar SET resource_master_id = rm.id
FROM resource_master rm
WHERE ar.resource_code = rm.kode AND rm.organization_id IS NULL
  AND ar.resource_master_id IS NULL;
