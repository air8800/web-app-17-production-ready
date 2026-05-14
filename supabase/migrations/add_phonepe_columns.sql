-- Migration: Add PhonePe payment tracking columns to print_jobs
-- Run this in Supabase SQL Editor

ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS payment_method        TEXT DEFAULT 'Pay at Shop',
  ADD COLUMN IF NOT EXISTS phonepe_txn_id        TEXT,
  ADD COLUMN IF NOT EXISTS phonepe_merchant_txn_id TEXT;

-- Index for fast webhook lookup
CREATE INDEX IF NOT EXISTS idx_print_jobs_phonepe_merchant_txn_id
  ON print_jobs(phonepe_merchant_txn_id);

-- Optional: Add comment for documentation
COMMENT ON COLUMN print_jobs.payment_method IS 'PhonePe | Pay at Shop';
COMMENT ON COLUMN print_jobs.phonepe_txn_id IS 'PhonePe internal transaction ID (from their response)';
COMMENT ON COLUMN print_jobs.phonepe_merchant_txn_id IS 'Our merchant transaction ID sent to PhonePe (PG_{jobId}_{ts})';
