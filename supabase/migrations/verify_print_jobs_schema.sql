-- Run in Supabase SQL Editor to verify print_jobs matches the app + PhonePe API.
-- Every row in "required_columns" should show status = OK

WITH required_columns AS (
  SELECT unnest(ARRAY[
    'id', 'shop_id', 'filename', 'file_url', 'total_cost',
    'payment_status', 'job_status', 'customer_name'
  ]) AS column_name
),
optional_columns AS (
  SELECT unnest(ARRAY[
    'customer_email', 'customer_phone', 'payment_method',
    'phonepe_merchant_txn_id', 'phonepe_txn_id', 'pages_per_sheet', 'updated_at'
  ]) AS column_name
)
SELECT
  r.column_name,
  CASE WHEN c.column_name IS NOT NULL THEN 'OK (required)' ELSE 'MISSING — run 20250512000320_printget_core_schema.sql' END AS status
FROM required_columns r
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = 'print_jobs' AND c.column_name = r.column_name
UNION ALL
SELECT
  o.column_name,
  CASE WHEN c.column_name IS NOT NULL THEN 'OK (optional)' ELSE 'missing (optional)' END
FROM optional_columns o
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = 'print_jobs' AND c.column_name = o.column_name
ORDER BY 1;

-- Recent orders (confirm data exists in THIS project)
SELECT id, filename, total_cost, payment_status, job_status, created_at
FROM print_jobs
ORDER BY created_at DESC
LIMIT 5;
