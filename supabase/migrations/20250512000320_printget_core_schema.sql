/*
  PrintGet core schema — shops, cost_configs, print_jobs
  Safe to run multiple times (IF NOT EXISTS / conditional alters).

  Run in Supabase → SQL Editor on the SAME project as VITE_SUPABASE_URL.
*/

-- ── shops ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  email text,
  operating_hours jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── cost_configs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  paper_size text NOT NULL,
  color_mode text NOT NULL,
  print_type text NOT NULL,
  base_price numeric(10, 2) NOT NULL DEFAULT 0,
  bulk_tiers jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_configs_shop_id ON cost_configs(shop_id);

-- ── print_jobs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  filename text NOT NULL,
  file_url text,
  copies integer NOT NULL DEFAULT 1,
  paper_size text NOT NULL,
  color_mode text NOT NULL,
  print_type text NOT NULL,
  pages_per_sheet integer NOT NULL DEFAULT 1 CHECK (pages_per_sheet IN (1, 2)),
  customer_name text,
  customer_email text,
  customer_phone text,
  total_cost numeric(10, 2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending',
  payment_method text DEFAULT 'Pay at Shop',
  job_status text NOT NULL DEFAULT 'pending',
  recipe jsonb,
  total_pages integer,
  selected_pages text,
  order_identification text NOT NULL DEFAULT 'ON_PAGE',
  has_edits boolean NOT NULL DEFAULT false,
  estimated_completion timestamptz,
  phonepe_txn_id text,
  phonepe_merchant_txn_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_shop_id ON print_jobs(shop_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON print_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_phonepe_merchant_txn_id ON print_jobs(phonepe_merchant_txn_id);

-- Legacy DBs used "status" instead of "job_status"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'print_jobs' AND column_name = 'status'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'print_jobs' AND column_name = 'job_status'
  ) THEN
    ALTER TABLE print_jobs RENAME COLUMN status TO job_status;
  END IF;
END $$;

-- Add any columns missing on older partial schemas
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS pages_per_sheet integer NOT NULL DEFAULT 1;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE print_jobs ALTER COLUMN customer_name DROP NOT NULL;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'Pay at Shop';
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS job_status text NOT NULL DEFAULT 'pending';
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS recipe jsonb;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS total_pages integer;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS selected_pages text;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS order_identification text NOT NULL DEFAULT 'ON_PAGE';
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS has_edits boolean NOT NULL DEFAULT false;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS estimated_completion timestamptz;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS phonepe_txn_id text;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS phonepe_merchant_txn_id text;
ALTER TABLE print_jobs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ── RLS (anon key used by the web app) ──────────────────────────────────────
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active shops" ON shops;
CREATE POLICY "Public read active shops" ON shops
  FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public read active cost configs" ON cost_configs;
CREATE POLICY "Public read active cost configs" ON cost_configs
  FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public insert print jobs" ON print_jobs;
CREATE POLICY "Public insert print jobs" ON print_jobs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public read print jobs" ON print_jobs;
CREATE POLICY "Public read print jobs" ON print_jobs
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public update print jobs" ON print_jobs;
CREATE POLICY "Public update print jobs" ON print_jobs
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
