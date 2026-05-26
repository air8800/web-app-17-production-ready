-- Stores how the shop should identify and separate the customer's print order.
-- ON_PAGE: desktop can add a tiny Order ID mark on the document.
-- SEPARATE_SLIP: desktop/shop should use a separate pickup slip instead.
ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS order_identification text NOT NULL DEFAULT 'ON_PAGE';

ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS customer_name text;

ALTER TABLE print_jobs
  ALTER COLUMN customer_name DROP NOT NULL;

COMMENT ON COLUMN print_jobs.order_identification IS 'ON_PAGE | SEPARATE_SLIP - customer preference for identifying the printed order at pickup';
