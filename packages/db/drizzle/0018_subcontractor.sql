DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('draft', 'submitted', 'verified', 'approved', 'paid', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS subcontractor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  npwp varchar(32),
  contact_person varchar(120),
  phone varchar(32),
  email varchar(160),
  address text,
  bank_name varchar(80),
  bank_account varchar(40),
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subcon_org_idx ON subcontractor (organization_id);

CREATE TABLE IF NOT EXISTS subcontract (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  subcontractor_id uuid NOT NULL REFERENCES subcontractor(id) ON DELETE RESTRICT,
  contract_number varchar(80),
  scope_description text NOT NULL,
  contract_value numeric(18,2) NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  retention_pct numeric(5,2) NOT NULL DEFAULT 5,
  notes text,
  signed_at date,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subcontract_project_idx ON subcontract (project_id);

CREATE TABLE IF NOT EXISTS subcontractor_invoice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontract_id uuid NOT NULL REFERENCES subcontract(id) ON DELETE CASCADE,
  invoice_number varchar(80) NOT NULL,
  invoice_date date NOT NULL,
  progress_pct numeric(5,2) NOT NULL DEFAULT 0,
  gross_amount numeric(18,2) NOT NULL,
  retention_amount numeric(18,2) NOT NULL DEFAULT 0,
  ppn_amount numeric(18,2) NOT NULL DEFAULT 0,
  net_amount numeric(18,2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  paid_date date,
  paid_amount numeric(18,2),
  notes text,
  submitted_by_id uuid REFERENCES "user"(id),
  approved_by_id uuid REFERENCES "user"(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subcon_inv_subcontract ON subcontractor_invoice (subcontract_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS subcon_inv_status ON subcontractor_invoice (status);
