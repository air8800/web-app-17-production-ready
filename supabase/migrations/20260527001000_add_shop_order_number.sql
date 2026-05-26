-- Simple per-shop pickup order number.
-- Each shop starts at 1000, then continues 1001, 1002, ...
ALTER TABLE print_jobs
  ADD COLUMN IF NOT EXISTS shop_order_number integer;

CREATE TABLE IF NOT EXISTS shop_order_counters (
  shop_id uuid PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  next_number integer NOT NULL DEFAULT 1000
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_print_jobs_shop_order_number
  ON print_jobs(shop_id, shop_order_number)
  WHERE shop_order_number IS NOT NULL;

CREATE OR REPLACE FUNCTION assign_shop_order_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.shop_order_number IS NULL THEN
    INSERT INTO shop_order_counters (shop_id, next_number)
    VALUES (NEW.shop_id, 1001)
    ON CONFLICT (shop_id)
    DO UPDATE SET next_number = shop_order_counters.next_number + 1
    RETURNING next_number - 1
      INTO NEW.shop_order_number
      ;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_assign_shop_order_number ON print_jobs;
CREATE TRIGGER trg_assign_shop_order_number
BEFORE INSERT ON print_jobs
FOR EACH ROW
EXECUTE FUNCTION assign_shop_order_number();

COMMENT ON COLUMN print_jobs.shop_order_number IS 'Simple pickup order number scoped per shop, starting from 1000';
COMMENT ON TABLE shop_order_counters IS 'Atomic per-shop counter for simple pickup order numbers';
