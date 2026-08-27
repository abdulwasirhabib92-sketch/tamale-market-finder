-- ============================================================================
-- TAMALE MARKET FINDER (TMF) - COMPLETE SUPABASE DATABASE SCHEMA (v2.0)
-- Run this script in the Supabase SQL Editor to initialize or update the database.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. USER PROFILES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    account_type TEXT DEFAULT 'shopper' CHECK (account_type IN ('shopper', 'trader', 'admin')),
    avatar_url TEXT,
    preferred_market TEXT,
    verification_tier TEXT DEFAULT 'unverified' CHECK (verification_tier IN ('unverified', 'verified', 'trusted')),
    rating_as_trader NUMERIC(3,2) DEFAULT 0.00,
    total_trader_reviews INT DEFAULT 0,
    is_flagged BOOLEAN DEFAULT false,
    strike_count INT DEFAULT 0,
    is_banned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if user_profiles table was previously created
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS verification_tier TEXT DEFAULT 'unverified' CHECK (verification_tier IN ('unverified', 'verified', 'trusted')),
  ADD COLUMN IF NOT EXISTS rating_as_trader NUMERIC(3,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_trader_reviews INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS strike_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;


-- ----------------------------------------------------------------------------
-- 2. SHOPS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    owner_name TEXT,
    shop_name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    address TEXT,
    digital_address TEXT, -- Ghana Post GPS Digital Address (e.g. NT-092-0621)
    whatsapp_number TEXT,
    phone TEXT,
    opening_hours TEXT,
    market_area TEXT,
    is_verified BOOLEAN DEFAULT false,
    cover_image_url TEXT,
    listing_type TEXT DEFAULT 'product' CHECK (listing_type IN ('product', 'service', 'business', 'hotel', 'restaurant')),
    rating_avg NUMERIC(3,2) DEFAULT 0.00,
    rating_count INT DEFAULT 0,
    verification_tier TEXT DEFAULT 'unverified' CHECK (verification_tier IN ('unverified', 'verified', 'trusted')),
    is_active BOOLEAN DEFAULT true,
    is_flagged BOOLEAN DEFAULT false,
    ad_tier TEXT DEFAULT 'free' CHECK (ad_tier IN ('free', 'basic_spotlight', 'premium_top', 'category_featured')),
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if shops table was previously created
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS digital_address TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_tier TEXT DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ad_tier TEXT DEFAULT 'free';


-- ----------------------------------------------------------------------------
-- 3. PRODUCTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    price NUMERIC NOT NULL,
    discount_price NUMERIC DEFAULT NULL,
    description TEXT,
    image_url TEXT,
    in_stock BOOLEAN DEFAULT true,
    stock_quantity INT DEFAULT 10,
    low_stock_threshold INT DEFAULT 3,
    badge_tag TEXT CHECK (badge_tag IN ('deal', 'hot', 'new', 'clearance')),
    rating_avg NUMERIC(3,2) DEFAULT 0.00,
    rating_count INT DEFAULT 0,
    listing_type TEXT DEFAULT 'product',
    created_date TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if products table was previously created
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_quantity INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS discount_price NUMERIC,
  ADD COLUMN IF NOT EXISTS badge_tag TEXT,
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'product';


-- ----------------------------------------------------------------------------
-- 4. FAVORITES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_shop_favorite UNIQUE (user_id, shop_id)
);


-- ----------------------------------------------------------------------------
-- 5. SERVICE LISTINGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_listings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    price_type TEXT DEFAULT 'starting_at' CHECK (price_type IN ('fixed', 'hourly', 'starting_at', 'quote')),
    price_min NUMERIC(10,2),
    price_max NUMERIC(10,2),
    description TEXT,
    service_area TEXT DEFAULT 'Tamale Metropolitan Area',
    availability_hours TEXT,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);


-- ----------------------------------------------------------------------------
-- 6. BUSINESS LISTINGS TABLE (Hotels, Eateries, Companies, Service Agencies)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_listings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    business_name TEXT NOT NULL,
    business_type TEXT NOT NULL CHECK (business_type IN ('hotel', 'restaurant', 'company', 'service_agency')),
    sub_category TEXT,
    description TEXT,
    address TEXT,
    digital_address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    phone TEXT,
    whatsapp_number TEXT,
    amenities JSONB DEFAULT '[]'::jsonb,
    price_range TEXT CHECK (price_range IN ('$', '$$', '$$$', '$$$$')),
    cover_image_url TEXT,
    gallery_urls JSONB DEFAULT '[]'::jsonb,
    rating_avg NUMERIC(3,2) DEFAULT 0.00,
    rating_count INT DEFAULT 0,
    opening_hours TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);


-- ----------------------------------------------------------------------------
-- 7. ORDERS TABLE (In-App Express Reservation Protocol)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'accepted', 'rejected', 'ready', 'picked_up', 'delivered', 'completed', 'cancelled')),
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    delivery_type TEXT DEFAULT 'pickup' CHECK (delivery_type IN ('pickup', 'local_delivery')),
    buyer_name TEXT NOT NULL,
    buyer_phone TEXT NOT NULL,
    delivery_address TEXT,
    buyer_notes TEXT,
    trader_notes TEXT,
    placed_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);


-- ----------------------------------------------------------------------------
-- 8. ORDER ITEMS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(10,2) NOT NULL,
    image_url TEXT,
    created_date TIMESTAMPTZ DEFAULT NOW()
);


-- ----------------------------------------------------------------------------
-- 9. REVIEWS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE UNIQUE, -- 1 review per completed order
    buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    trader_reply TEXT,
    is_flagged BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'flagged')),
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);


-- ----------------------------------------------------------------------------
-- 10. AD PLACEMENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ad_placements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trader_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    ad_tier TEXT NOT NULL CHECK (ad_tier IN ('basic_spotlight', 'premium_top', 'category_featured')),
    target_category TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    fee_paid_ghs NUMERIC(10,2) NOT NULL,
    payment_reference TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'rejected')),
    admin_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);


-- ----------------------------------------------------------------------------
-- 11. REPORTS TABLE (Anti-Fraud & Moderation Queue)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reported_type TEXT NOT NULL CHECK (reported_type IN ('shop', 'product', 'service', 'review', 'user')),
    target_id UUID NOT NULL,
    reason_category TEXT NOT NULL CHECK (reason_category IN ('fraud', 'fake_listing', 'scam_attempt', 'illegal_goods', 'abusive_content', 'other')),
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
    action_taken TEXT DEFAULT 'none' CHECK (action_taken IN ('none', 'warning_sent', 'item_hidden', 'shop_suspended', 'user_banned')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);


-- ----------------------------------------------------------------------------
-- 12. INDEXES FOR PERFORMANCE
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_shops_location ON shops(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_shops_category ON shops(category);
CREATE INDEX IF NOT EXISTS idx_shops_ad_tier ON shops(ad_tier);
CREATE INDEX IF NOT EXISTS idx_shops_rating ON shops(rating_avg DESC);
CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity, in_stock);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_reviews_shop_id ON reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_ad_placements_status ON ad_placements(status, end_date);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);


-- ----------------------------------------------------------------------------
-- 13. AUTOMATED TRIGGERS & FUNCTIONS
-- ----------------------------------------------------------------------------

-- 13.1 Updated Date Trigger Function
CREATE OR REPLACE FUNCTION update_updated_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_date = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shops_updated_date ON shops;
CREATE TRIGGER shops_updated_date BEFORE UPDATE ON shops FOR EACH ROW EXECUTE FUNCTION update_updated_date();

DROP TRIGGER IF EXISTS user_profiles_updated_date ON user_profiles;
CREATE TRIGGER user_profiles_updated_date BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_date();


-- 13.2 Auto-create user profile on Auth Sign-Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, phone, account_type)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Valued User'),
        NEW.raw_user_meta_data->>'phone',
        COALESCE(NEW.raw_user_meta_data->>'role', 'shopper')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 13.3 Auto-recalculate Shop Rating on New/Updated Review
CREATE OR REPLACE FUNCTION update_shop_rating_on_review()
RETURNS TRIGGER AS $$
DECLARE
    target_shop UUID;
    new_avg NUMERIC(3,2);
    new_count INT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_shop := OLD.shop_id;
    ELSE
        target_shop := NEW.shop_id;
    END IF;

    SELECT COALESCE(AVG(rating), 0.00), COUNT(*)
    INTO new_avg, new_count
    FROM reviews
    WHERE shop_id = target_shop AND status = 'published';

    UPDATE shops
    SET rating_avg = ROUND(new_avg, 2),
        rating_count = new_count
    WHERE id = target_shop;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_shop_rating ON reviews;
CREATE TRIGGER trg_update_shop_rating
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_shop_rating_on_review();


-- 13.4 Stock Decrement & Order Status Change Management
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- When order moves to 'accepted', decrement stock for order items
    IF NEW.status = 'accepted' AND OLD.status = 'placed' THEN
        UPDATE products p
        SET stock_quantity = GREATEST(0, p.stock_quantity - oi.quantity),
            in_stock = (p.stock_quantity - oi.quantity > 0)
        FROM order_items oi
        WHERE oi.order_id = NEW.id AND oi.product_id = p.id;

        NEW.accepted_at = NOW();
    ELSIF NEW.status = 'ready' THEN
        NEW.ready_at = NOW();
    ELSIF NEW.status = 'completed' THEN
        NEW.completed_at = NOW();
    ELSIF NEW.status = 'cancelled' OR NEW.status = 'rejected' THEN
        -- Restore stock if cancelled or rejected after acceptance
        IF OLD.status = 'accepted' OR OLD.status = 'ready' THEN
            UPDATE products p
            SET stock_quantity = p.stock_quantity + oi.quantity,
                in_stock = true
            FROM order_items oi
            WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
        END IF;
        NEW.cancelled_at = NOW();
    END IF;

    NEW.updated_date = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_order_status_change ON orders;
CREATE TRIGGER trg_order_status_change
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION handle_order_status_change();


-- 13.5 Auto-Generate Order Numbers (e.g. TMF-2026-8942)
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := 'TMF-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_order_number ON orders;
CREATE TRIGGER trg_set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION set_order_number();


-- ----------------------------------------------------------------------------
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Shops Policies
DROP POLICY IF EXISTS "Public can read shops" ON shops;
CREATE POLICY "Public can read shops" ON shops FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert own shop" ON shops;
CREATE POLICY "Users can insert own shop" ON shops FOR INSERT WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Users can update own shop" ON shops;
CREATE POLICY "Users can update own shop" ON shops FOR UPDATE USING (auth.uid() = created_by);
DROP POLICY IF EXISTS "Users can delete own shop" ON shops;
CREATE POLICY "Users can delete own shop" ON shops FOR DELETE USING (auth.uid() = created_by);

-- Products Policies
DROP POLICY IF EXISTS "Public can read products" ON products;
CREATE POLICY "Public can read products" ON products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert own products" ON products;
CREATE POLICY "Users can insert own products" ON products FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = products.shop_id AND shops.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Users can update own products" ON products;
CREATE POLICY "Users can update own products" ON products FOR UPDATE USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = products.shop_id AND shops.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Users can delete own products" ON products;
CREATE POLICY "Users can delete own products" ON products FOR DELETE USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = products.shop_id AND shops.created_by = auth.uid())
);

-- User Profiles Policies
DROP POLICY IF EXISTS "Public can read user profiles" ON user_profiles;
CREATE POLICY "Public can read user profiles" ON user_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- Favorites Policies
DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;
CREATE POLICY "Users can view own favorites" ON favorites FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own favorites" ON favorites;
CREATE POLICY "Users can insert own favorites" ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own favorites" ON favorites;
CREATE POLICY "Users can delete own favorites" ON favorites FOR DELETE USING (auth.uid() = user_id);

-- Service Listings Policies
DROP POLICY IF EXISTS "Public can view active services" ON service_listings;
CREATE POLICY "Public can view active services" ON service_listings FOR SELECT USING (is_available = true);
DROP POLICY IF EXISTS "Traders can create service listings" ON service_listings;
CREATE POLICY "Traders can create service listings" ON service_listings FOR INSERT WITH CHECK (auth.uid() = provider_id);
DROP POLICY IF EXISTS "Traders can update own service listings" ON service_listings;
CREATE POLICY "Traders can update own service listings" ON service_listings FOR UPDATE USING (auth.uid() = provider_id);
DROP POLICY IF EXISTS "Traders can delete own service listings" ON service_listings;
CREATE POLICY "Traders can delete own service listings" ON service_listings FOR DELETE USING (auth.uid() = provider_id);

-- Business Listings Policies
DROP POLICY IF EXISTS "Public can view business listings" ON business_listings;
CREATE POLICY "Public can view business listings" ON business_listings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Owners can manage business listings" ON business_listings;
CREATE POLICY "Owners can manage business listings" ON business_listings FOR ALL USING (auth.uid() = owner_id);

-- Orders Policies
DROP POLICY IF EXISTS "Buyers can view own orders" ON orders;
CREATE POLICY "Buyers can view own orders" ON orders FOR SELECT USING (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Traders can view orders for their shop" ON orders;
CREATE POLICY "Traders can view orders for their shop" ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = orders.shop_id AND shops.created_by = auth.uid())
);
DROP POLICY IF EXISTS "Buyers can insert orders" ON orders;
CREATE POLICY "Buyers can insert orders" ON orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Buyers and Traders can update relevant orders" ON orders;
CREATE POLICY "Buyers and Traders can update relevant orders" ON orders FOR UPDATE USING (
    auth.uid() = buyer_id OR EXISTS (SELECT 1 FROM shops WHERE shops.id = orders.shop_id AND shops.created_by = auth.uid())
);

-- Order Items Policies
DROP POLICY IF EXISTS "Users can view relevant order items" ON order_items;
CREATE POLICY "Users can view relevant order items" ON order_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_items.order_id 
        AND (orders.buyer_id = auth.uid() OR EXISTS (SELECT 1 FROM shops WHERE shops.id = orders.shop_id AND shops.created_by = auth.uid()))
    )
);
DROP POLICY IF EXISTS "Buyers can insert order items" ON order_items;
CREATE POLICY "Buyers can insert order items" ON order_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.buyer_id = auth.uid())
);

-- Reviews Policies
DROP POLICY IF EXISTS "Public can view published reviews" ON reviews;
CREATE POLICY "Public can view published reviews" ON reviews FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "Buyers can create reviews for completed orders" ON reviews;
CREATE POLICY "Buyers can create reviews for completed orders" ON reviews FOR INSERT WITH CHECK (
    auth.uid() = buyer_id AND EXISTS (
        SELECT 1 FROM orders WHERE orders.id = reviews.order_id AND orders.buyer_id = auth.uid() AND orders.status = 'completed'
    )
);
DROP POLICY IF EXISTS "Traders can reply to reviews for their shop" ON reviews;
CREATE POLICY "Traders can reply to reviews for their shop" ON reviews FOR UPDATE USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = reviews.shop_id AND shops.created_by = auth.uid())
);

-- Ad Placements Policies
DROP POLICY IF EXISTS "Traders can view own ad placements" ON ad_placements;
CREATE POLICY "Traders can view own ad placements" ON ad_placements FOR SELECT USING (auth.uid() = trader_id);
DROP POLICY IF EXISTS "Public can view active ads" ON ad_placements;
CREATE POLICY "Public can view active ads" ON ad_placements FOR SELECT USING (status = 'active');
DROP POLICY IF EXISTS "Traders can submit ad placements" ON ad_placements;
CREATE POLICY "Traders can submit ad placements" ON ad_placements FOR INSERT WITH CHECK (auth.uid() = trader_id);

-- Reports Policies
DROP POLICY IF EXISTS "Users can view own submitted reports" ON reports;
CREATE POLICY "Users can view own submitted reports" ON reports FOR SELECT USING (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "Authenticated users can submit reports" ON reports;
CREATE POLICY "Authenticated users can submit reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);


-- ----------------------------------------------------------------------------
-- 15. STORAGE BUCKET CONFIGURATION
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images" 
    ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Public can read product images" ON storage.objects;
CREATE POLICY "Public can read product images" 
    ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;
CREATE POLICY "Users can delete own product images" 
    ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images');
