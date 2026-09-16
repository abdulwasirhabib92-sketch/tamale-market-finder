-- ================================================================
-- TMF FIX SCRIPT — order validation + secure stock decrement
-- Paste the WHOLE file into: Supabase Dashboard → SQL Editor → Run
-- Date: 2026-09-16
--
-- Fixes:
--   1. "Price mismatch" rejection of DISCOUNTED products
--      (the old trigger only accepted products.price; the app correctly
--       charges COALESCE(discount_price, price))
--   2. Stock never decreased after a buyer order — buyers cannot UPDATE
--      products (RLS blocks them), so ordering now goes through the
--      SECURITY DEFINER function decrement_product_stock().
--
-- IMPORTANT: this replaces ALL triggers on the orders table with the
-- canonical set (order number, insert validation, status bookkeeping).
-- ================================================================

-- ---------------------------------------------------------------
-- STEP 1 (read-only): show which triggers exist on orders right now.
-- Screenshot / copy this result — it documents what we replaced.
-- ---------------------------------------------------------------
SELECT t.tgname AS trigger_name, p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'orders'::regclass AND NOT t.tgisinternal;

-- ---------------------------------------------------------------
-- STEP 2: drop ALL triggers on orders (full set is recreated below)
-- ---------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT tgname FROM pg_trigger
             WHERE t.tgrelid = 'orders'::regclass AND NOT tgisinternal
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON orders', r.tgname);
        RAISE NOTICE 'Dropped trigger: %', r.tgname;
    END LOOP;
END $$;

-- ---------------------------------------------------------------
-- STEP 3: auto-generate order numbers (unchanged, from the repo schema)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := 'TMF-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION set_order_number();

-- ---------------------------------------------------------------
-- STEP 4: canonical insert validation.
-- NOW ACCEPTS the selling price = COALESCE(discount_price, price),
-- blocks overselling, invalid delivery types and bad quantities.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_order_insert()
RETURNS TRIGGER AS $$
DECLARE
    actual_price NUMERIC;
    available     INTEGER;
BEGIN
    SELECT COALESCE(discount_price, price), stock_quantity
      INTO actual_price, available
      FROM products
     WHERE id = NEW.product_id;

    IF actual_price IS NULL THEN
        RAISE EXCEPTION 'Product not found: %', NEW.product_id;
    END IF;

    IF NEW.unit_price <> actual_price THEN
        RAISE EXCEPTION 'Price mismatch: submitted %, actual %', NEW.unit_price, actual_price;
    END IF;

    IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be at least 1';
    END IF;

    IF NEW.quantity > available THEN
        RAISE EXCEPTION 'Not enough stock: % requested, % available', NEW.quantity, available;
    END IF;

    IF NEW.delivery_type NOT IN ('delivery', 'pickup') THEN
        RAISE EXCEPTION 'Invalid delivery type: %', NEW.delivery_type;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_validate_order_insert
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION validate_order_insert();

-- ---------------------------------------------------------------
-- STEP 5: status-change bookkeeping (timestamps only — stock is now
-- reserved at placement via decrement_product_stock, and the trader
-- app logic restores stock on reject/cancel).
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'accepted' THEN
        NEW.accepted_at = NOW();
    ELSIF NEW.status = 'ready' THEN
        NEW.ready_at = NOW();
    ELSIF NEW.status = 'completed' THEN
        NEW.completed_at = NOW();
    ELSIF NEW.status IN ('cancelled', 'rejected') THEN
        NEW.cancelled_at = NOW();
    END IF;

    NEW.updated_date = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_order_status_change
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION handle_order_status_change();

-- ---------------------------------------------------------------
-- STEP 6: secure stock decrement for buyers (app.js calls this RPC).
-- SECURITY DEFINER = bypasses RLS but only to decrement stock, and it
-- validates stock atomically (no race condition between two buyers).
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION decrement_product_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
DECLARE
    remaining INTEGER;
BEGIN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be at least 1';
    END IF;

    UPDATE products
       SET stock_quantity = stock_quantity - p_quantity,
           in_stock = (stock_quantity - p_quantity) > 0
     WHERE id = p_product_id
    RETURNING stock_quantity INTO remaining;

    IF remaining IS NULL THEN
        RAISE EXCEPTION 'Product not found: %', p_product_id;
    END IF;

    IF remaining < 0 THEN
        RAISE EXCEPTION 'Not enough stock for product %', p_product_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION decrement_product_stock(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION decrement_product_stock(UUID, INTEGER) TO authenticated;

-- ---------------------------------------------------------------
-- DONE. Verify with:
--   SELECT * FROM pg_trigger WHERE tgrelid = 'orders'::regclass AND NOT tgisinternal;
-- Expected: trg_set_order_number, trg_validate_order_insert, trg_order_status_change
-- ---------------------------------------------------------------
