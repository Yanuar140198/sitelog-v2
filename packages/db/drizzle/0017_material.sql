-- Per-project material balance + delivery log
CREATE TABLE IF NOT EXISTS material_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  resource_master_id uuid REFERENCES resource_master(id) ON DELETE SET NULL,
  material_code varchar(64) NOT NULL,
  material_name text NOT NULL,
  satuan varchar(16) NOT NULL,
  qty_ordered numeric(18,4) NOT NULL DEFAULT 0,
  qty_received numeric(18,4) NOT NULL DEFAULT 0,
  qty_used numeric(18,4) NOT NULL DEFAULT 0,
  supplier varchar(160),
  unit_price numeric(18,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS material_stock_unique ON material_stock (project_id, material_code);
CREATE INDEX IF NOT EXISTS material_stock_project ON material_stock (project_id);

CREATE TABLE IF NOT EXISTS material_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  stock_id uuid REFERENCES material_stock(id) ON DELETE SET NULL,
  delivery_date date NOT NULL,
  do_number varchar(64),  -- Delivery Order number
  material_code varchar(64) NOT NULL,
  qty numeric(18,4) NOT NULL,
  unit_price numeric(18,2),
  supplier varchar(160),
  vehicle_plate varchar(32),
  driver_name varchar(120),
  signed_by varchar(120),
  notes text,
  recorded_by_id uuid REFERENCES "user"(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS material_delivery_project_date ON material_delivery (project_id, delivery_date DESC);
