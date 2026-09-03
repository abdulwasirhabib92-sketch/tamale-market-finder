-- ====================================================================
-- MULTI-CITY MIGRATION: Add city column to all content tables
-- Allows multiple cities to share one Supabase instance
-- ====================================================================

-- Add city column to all content tables (defaults to 'tamale' for existing data)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'tamale';
ALTER TABLE products ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'tamale';
ALTER TABLE service_listings ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'tamale';
ALTER TABLE business_listings ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'tamale';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'tamale';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'tamale';
ALTER TABLE ad_placements ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'tamale';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'tamale';

-- user_profiles: allow users to have profiles per city
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'tamale';

-- Create indexes for city filtering
CREATE INDEX IF NOT EXISTS idx_shops_city ON shops(city);
CREATE INDEX IF NOT EXISTS idx_products_city ON products(city);
CREATE INDEX IF NOT EXISTS idx_service_listings_city ON service_listings(city);
CREATE INDEX IF NOT EXISTS idx_business_listings_city ON business_listings(city);
CREATE INDEX IF NOT EXISTS idx_orders_city ON orders(city);
CREATE INDEX IF NOT EXISTS idx_reviews_city ON reviews(city);
CREATE INDEX IF NOT EXISTS idx_ad_placements_city ON ad_placements(city);

-- Valid city slugs
ALTER TABLE shops ADD CONSTRAINT IF NOT EXISTS chk_shops_city CHECK (city IN ('tamale', 'accra', 'kumasi', 'takoradi', 'cape-coast', 'tema', 'sunyani', 'bolgatanga', 'wa', 'koforidua', 'ho'));
ALTER TABLE products ADD CONSTRAINT IF NOT EXISTS chk_products_city CHECK (city IN ('tamale', 'accra', 'kumasi', 'takoradi', 'cape-coast', 'tema', 'sunyani', 'bolgatanga', 'wa', 'koforidua', 'ho'));
ALTER TABLE service_listings ADD CONSTRAINT IF NOT EXISTS chk_services_city CHECK (city IN ('tamale', 'accra', 'kumasi', 'takoradi', 'cape-coast', 'tema', 'sunyani', 'bolgatanga', 'wa', 'koforidua', 'ho'));
ALTER TABLE business_listings ADD CONSTRAINT IF NOT EXISTS chk_business_city CHECK (city IN ('tamale', 'accra', 'kumasi', 'takoradi', 'cape-coast', 'tema', 'sunyani', 'bolgatanga', 'wa', 'koforidua', 'ho'));
ALTER TABLE orders ADD CONSTRAINT IF NOT EXISTS chk_orders_city CHECK (city IN ('tamale', 'accra', 'kumasi', 'takoradi', 'cape-coast', 'tema', 'sunyani', 'bolgatanga', 'wa', 'koforidua', 'ho'));
ALTER TABLE reviews ADD CONSTRAINT IF NOT EXISTS chk_reviews_city CHECK (city IN ('tamale', 'accra', 'kumasi', 'takoradi', 'cape-coast', 'tema', 'sunyani', 'bolgatanga', 'wa', 'koforidua', 'ho'));

-- Update public_shops view to include city column
CREATE OR REPLACE VIEW public_shops AS
SELECT id, created_by, owner_name, shop_name, category, description,
       latitude, longitude, address, digital_address, whatsapp_number, phone,
       opening_hours, market_area, is_verified, cover_image_url, listing_type,
       rating_avg, rating_count, verification_tier, is_active, is_flagged,
       ad_tier, created_date, ghana_card_verified, updated_date, offers_delivery,
       city
FROM shops
WHERE is_active = true;

GRANT SELECT ON public_shops TO anon, authenticated;

-- v2 additions (post-review fixes)
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'tamale';
CREATE INDEX IF NOT EXISTS idx_support_tickets_city ON support_tickets(city);
