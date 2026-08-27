# Tamale Market Finder (TMF) — Comprehensive Platform Expansion Plan

**Project:** Tamale Market Finder (TMF)  
**Version:** 2.0 Architectural Specification & Implementation Roadmap  
**Target Architecture:** Vanilla HTML5/CSS3/JavaScript (ES6+), Supabase (PostgreSQL, Realtime, Auth, RLS, Storage), Leaflet.js (OpenStreetMap), Ghana Post GPS API  
**Author:** Lead Research & System Architect Agent  
**Date:** August 25, 2026  

---

## Executive Summary

The **Tamale Market Finder (TMF)** project has successfully delivered its initial modernized MVP—introducing Supabase authentication, custom role switching (Shopper vs Trader), Ghana Post GPS digital address integration (e.g., `NT-092-0621`), mobile bottom navigation, category carousel filtering, and Leaflet map rendering.

This document presents the **Phase 2 Comprehensive Expansion Plan**, extending TMF from a local directory into a full-fledged, multi-category local marketplace finder and commerce engine for Tamale and greater Ghana. The core philosophy remains unaltered: **the primary value proposition is local product/service discovery and location finding** ("I need product X right now—where is the closest stall selling it?"). The expanded e-commerce and ordering capabilities elevate engagement, build buyer-trader trust, streamline offline fulfillment, and unlock sustainable local monetization.

---

## 1. Expanded Domain Model & Database Architecture

To support inventory counts, offline order reservation, verified customer reviews, multi-type business directory listings, security reporting, and sponsored ads, the underlying PostgreSQL database schema requires substantial additions.

### 1.1 Structural Changes to Existing Tables

#### `user_profiles` Table Updates
- `verification_tier`: `TEXT DEFAULT 'unverified'` (`'unverified'`, `'verified'`, `'trusted'`).
- `rating_as_trader`: `NUMERIC(3,2) DEFAULT 0.00`.
- `total_trader_reviews`: `INT DEFAULT 0`.
- `is_flagged`: `BOOLEAN DEFAULT false`.
- `strike_count`: `INT DEFAULT 0`.
- `is_banned`: `BOOLEAN DEFAULT false`.

#### `shops` Table Updates
- `listing_type`: `TEXT DEFAULT 'product'` (`'product'`, `'service'`, `'business'`, `'hotel'`, `'restaurant'`).
- `rating_avg`: `NUMERIC(3,2) DEFAULT 0.00`.
- `rating_count`: `INT DEFAULT 0`.
- `verification_tier`: `TEXT DEFAULT 'unverified'`.
- `is_active`: `BOOLEAN DEFAULT true`.
- `is_flagged`: `BOOLEAN DEFAULT false`.
- `ad_tier`: `TEXT DEFAULT 'free'` (`'free'`, `'basic_spotlight'`, `'premium_top'`, `'category_featured'`).

#### `products` Table Updates
- `stock_quantity`: `INT DEFAULT 10`.
- `low_stock_threshold`: `INT DEFAULT 3`.
- `discount_price`: `NUMERIC DEFAULT NULL`.
- `badge_tag`: `TEXT DEFAULT NULL` (`'deal'`, `'hot'`, `'new'`, `'clearance'`).
- `rating_avg`: `NUMERIC(3,2) DEFAULT 0.00`.
- `rating_count`: `INT DEFAULT 0`.
- `listing_type`: `TEXT DEFAULT 'product'`.

---

## 2. Complete Supabase SQL Schema & RLS Policies

Run the following SQL DDL in the Supabase SQL Editor to apply schema updates, create new tables, establish foreign keys, index critical columns, create triggers, and set up Row-Level Security (RLS) policies.

```sql
-- ============================================================================
-- TAMALE MARKET FINDER (TMF) - PHASE 2 EXPANSION SCHEMA
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ALTER EXISTING TABLES TO SUPPORT NEW EXPANSION FEATURES
-- ----------------------------------------------------------------------------

-- Update user_profiles table
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS verification_tier TEXT DEFAULT 'unverified' CHECK (verification_tier IN ('unverified', 'verified', 'trusted')),
  ADD COLUMN IF NOT EXISTS rating_as_trader NUMERIC(3,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_trader_reviews INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS strike_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- Update shops table
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'product' CHECK (listing_type IN ('product', 'service', 'business', 'hotel', 'restaurant')),
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_tier TEXT DEFAULT 'unverified' CHECK (verification_tier IN ('unverified', 'verified', 'trusted')),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ad_tier TEXT DEFAULT 'free' CHECK (ad_tier IN ('free', 'basic_spotlight', 'premium_top', 'category_featured'));

-- Update products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_quantity INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS discount_price NUMERIC,
  ADD COLUMN IF NOT EXISTS badge_tag TEXT CHECK (badge_tag IN ('deal', 'hot', 'new', 'clearance')),
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS rating_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'product';

-- ----------------------------------------------------------------------------
-- 2. CREATE NEW EXPANSION TABLES
-- ----------------------------------------------------------------------------

-- Table 2.1: service_listings (Services like barbers, mechanics, electricians)
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

-- Table 2.2: business_listings (Hotels, Eateries, Service Agencies, Companies)
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

-- Table 2.3: orders (In-app reservation/express interest orders)
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

-- Table 2.4: order_items (Line items for each order)
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

-- Table 2.5: reviews (Verified ratings & reviews)
CREATE TABLE IF NOT EXISTS reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE UNIQUE, -- 1 review per order
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

-- Table 2.6: ad_placements (Trader spotlight & advertising applications)
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

-- Table 2.7: reports (Anti-fraud & security reporting)
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
-- 3. INDEXES FOR HIGH-PERFORMANCE SEARCH & FILTERING
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
-- 4. AUTOMATED POSTGRESQL TRIGGERS & FUNCTIONS
-- ----------------------------------------------------------------------------

-- Function: Auto-recalculate Shop Rating on New/Updated Review
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


-- Function: Decrement product stock when order is accepted
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
        -- Restore stock if rejected after acceptance
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


-- Function: Generate readable Order Number (e.g. TMF-2026-8942)
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
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

-- Enable RLS on all new tables
ALTER TABLE service_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 5.1 Service Listings Policies
CREATE POLICY "Public can view active services" ON service_listings FOR SELECT USING (is_available = true);
CREATE POLICY "Traders can create service listings" ON service_listings FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "Traders can update own service listings" ON service_listings FOR UPDATE USING (auth.uid() = provider_id);
CREATE POLICY "Traders can delete own service listings" ON service_listings FOR DELETE USING (auth.uid() = provider_id);

-- 5.2 Business Listings Policies
CREATE POLICY "Public can view business listings" ON business_listings FOR SELECT USING (true);
CREATE POLICY "Owners can manage business listings" ON business_listings FOR ALL USING (auth.uid() = owner_id);

-- 5.3 Orders Policies
CREATE POLICY "Buyers can view own orders" ON orders FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Traders can view orders for their shop" ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = orders.shop_id AND shops.created_by = auth.uid())
);
CREATE POLICY "Buyers can insert orders" ON orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Buyers and Traders can update relevant orders" ON orders FOR UPDATE USING (
    auth.uid() = buyer_id OR EXISTS (SELECT 1 FROM shops WHERE shops.id = orders.shop_id AND shops.created_by = auth.uid())
);

-- 5.4 Order Items Policies
CREATE POLICY "Users can view relevant order items" ON order_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_items.order_id 
        AND (orders.buyer_id = auth.uid() OR EXISTS (SELECT 1 FROM shops WHERE shops.id = orders.shop_id AND shops.created_by = auth.uid()))
    )
);
CREATE POLICY "Buyers can insert order items" ON order_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.buyer_id = auth.uid())
);

-- 5.5 Reviews Policies
CREATE POLICY "Public can view published reviews" ON reviews FOR SELECT USING (status = 'published');
CREATE POLICY "Buyers can create reviews for completed orders" ON reviews FOR INSERT WITH CHECK (
    auth.uid() = buyer_id AND EXISTS (
        SELECT 1 FROM orders WHERE orders.id = reviews.order_id AND orders.buyer_id = auth.uid() AND orders.status = 'completed'
    )
);
CREATE POLICY "Traders can reply to reviews for their shop" ON reviews FOR UPDATE USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = reviews.shop_id AND shops.created_by = auth.uid())
);

-- 5.6 Ad Placements Policies
CREATE POLICY "Traders can view own ad placements" ON ad_placements FOR SELECT USING (auth.uid() = trader_id);
CREATE POLICY "Public can view active ads" ON ad_placements FOR SELECT USING (status = 'active');
CREATE POLICY "Traders can submit ad placements" ON ad_placements FOR INSERT WITH CHECK (auth.uid() = trader_id);

-- 5.7 Reports Policies
CREATE POLICY "Users can view own submitted reports" ON reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Authenticated users can submit reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
```

---

## 3. UI/UX Plan for New Features

The application UI will expand into an e-commerce-inspired hybrid experience while keeping **Search & Map Location** front-and-center.

```
+-----------------------------------------------------------------------+
|  [Logo: Tamale Market Finder]  [🔍 Search product/service/GPS...]  [👤] |
+-----------------------------------------------------------------------+
|  [🔥 Spotlight / Paid Featured Ads Banner Carousel]                  |
+-----------------------------------------------------------------------+
|  Categories: ( All | Products | Services | Hotels/Eateries | Businesses) |
|  Pills: (🌾 Grains | 🧵 Smocks | 📱 Tech |  Barber | 🛠️ Mechanics )  |
+-----------------------------------------------------------------------+
|  Layout: [ 📋 List View ]  [ 🗺️ Interactive Map ]                     |
+-----------------------------------------------------------------------+
|  POPULAR NEAR YOU (Location-boosted)                                  |
|  +-------------------+ +-------------------+ +--------------------+   |
|  | [Img] 🔥 Spotlight| | [Img] 🟢 In Stock | | [Img] ⚡ Deal      |   |
|  | Yam Regulator GHS40| | Dagomba Smock    | | Auto Repair Service|   |
|  | St. 2, Aboabo Mkt | | Central Mkt GHS250| | Lamashegu Area   |   |
|  | ⭐ 4.8 (14 reviews) | | ⭐ 4.9 (42 rev)  | | ⭐ 5.0 (8 rev)     |   |
|  | [🛒 Reserve/Order]| | [🛒 Reserve/Order]| | [📞 Contact Trader]|   |
|  +-------------------+ +-------------------+ +--------------------+   |
+-----------------------------------------------------------------------+
| MOBILE BOTTOM NAV: [🔍 Explore]  [🛒 Orders]  [🗺️ Map]  [❤️ Saved] [👤 Account] |
+-----------------------------------------------------------------------+
```

### 3.1 Feature Breakdown & Visual Elements

#### 1. Temu-Like Stock Management UI
- **Product Card Badges:**
  - `In Stock`: Green pill (`🟢 12 available`).
  - `Low Stock`: Urgency pulse badge (`🔥 Only 3 left - Order soon!`).
  - `Out of Stock`: Greyed out card with opacity `0.6` and `[ Out of Stock ]` overlay tag.
- **Trader Dashboard Controls:**
  - Quick inline stock counter (`[-] 3 [+]`) for instant inventory adjustments without opening full edit modals.
  - One-tap toggle for `In Stock` / `Out of Stock`.

#### 2. In-App Ordering System UI (Offline/In-Person Fulfillment)
- **Cart & Express Reserve Modal:**
  - Drawer slide-up showing selected items, quantity selector, fulfillment choice (`Pickup at Stall` vs `Local Delivery`), buyer contact phone, and optional notes for trader.
- **Order Status Flow Badges:**
  - `Placed` (Yellow ⏳): Pending trader review.
  - `Accepted` (Blue 👍): Trader confirmed item is reserved at stall.
  - `Ready` (Purple 📦): Item ready for pickup at digital address / stall.
  - `Picked Up / Delivered` (Teal 🚚): Item received.
  - `Completed` (Green ✅): Transaction concluded; triggers review invitation.
- **Trader Order Portal:**
  - Dedicated tab in Trader Dashboard with filter tabs (`Pending`, `Active`, `Completed`, `Cancelled`). Buttons: `[Accept Order]`, `[Mark Ready]`, `[Complete Order]`, `[Reject]`.

#### 3. Reviews & Ratings System UI
- **Rating Components:**
  - Dynamic 5-star rendered SVGs on shop headers and product cards.
  - Average score + total rating count tag (e.g., `⭐ 4.8 (34 reviews)`).
- **Review Submission Modal:**
  - Automatically pops up when order reaches `Completed` state.
  - Star rating input (1 to 5), text box, and photo upload optionality.
  - Review displays verified buyer badge (`✓ Verified Buyer`).

#### 4. E-Commerce Discovery Grid (Temu / Jiji Inspired)
- **Featured Spotlight Banner Carousel:** Top section showcasing `ad_tier = 'basic_spotlight'` items.
- **"Popular Near You" Section:** Sorted by proximity GPS formula + high rating.
- **"New Arrivals":** Sorted by `created_date DESC`.
- **Deal & Discount Tags:** Red slash price visualization (e.g., `~GHS 120~  GHS 95 [ 20% OFF ]`).

#### 5. Multi-Domain Listings (Beyond Products)
- **Unified Switcher Tabs:** `Products`, `Services`, `Hotels & Lodging`, `Eateries & Restaurants`, `Companies & Offices`.
- **Services UI:** Shows hourly/starting rates, service radiuses, and "Book Service Inquiry" WhatsApp/Order actions.
- **Business/Hotel UI:** Displays amenity icons (WiFi 📶, Parking 🅿️, AC ❄️), digital address, and booking contact.

---

## 4. API & Data Flow for Ordering System

Since transactions occur **in-person / offline** (cash, MoMo on delivery/pickup), the ordering engine acts as an express reservation protocol that locks stock and establishes buyer-trader communication.

```
[BUYER]                                  [SUPABASE DB]                              [TRADER]
   |                                           |                                       |
   |-- 1. Tap "Reserve / Order Now" ---------->|                                       |
   |   (selects product, qty, pickup type)    |                                       |
   |                                           |-- 2. Insert order (status='placed') ->|
   |                                           |   Trigger sends Web Push / Toast --->|
   |                                           |                                       |
   |                                           |<-- 3. Trader views dashboard --------|
   |                                           |-- 4. Tap "Accept Order" ------------->|
   |                                           |   (Trigger: decrement stock_quantity) |
   |<-- 5. Status updated to 'accepted' -------|                                       |
   |    (Notification: "Stall ready for pickup")                                      |
   |                                           |                                       |
   |-- 6. Buyer visits stall (Ghana Post GPS)  |                                       |
   |    (Exchanges cash / MoMo in person)      |                                       |
   |                                           |<-- 7. Trader taps "Complete Order" ---|
   |<-- 8. Status updated to 'completed' ------|                                       |
   |                                           |                                       |
   |-- 9. Open Review Modal ------------------>|                                       |
   |    (Submits 5-star rating & comment)     |-- 10. Trigger updates shop rating_avg |
```

### Edge Case Handling Protocol:
1. **Trader Rejection:** Trader taps `Reject` (e.g., item damaged or sold over counter). Order status set to `rejected`, stock restored, buyer notified via toast/SMS.
2. **Order Expiration:** If an order remains in `placed` state for > 24 hours without trader response, an automated client/server cron sets status to `cancelled` and releases any temporary stock lock.
3. **Out-of-Stock Prevention:** Database check before order insert enforces `product.stock_quantity >= requested_qty` and `product.in_stock = true`.

---

## 5. Ranking Algorithm Design & Pseudo-Code

Search results in TMF are sorted by a multi-factor scoring function that balances **proximity**, **relevance**, **ratings**, **ad placement tier**, **stock availability**, and **seller verification**.

### 5.1 Mathematical Scoring Formula

$$	ext{Score} = \left( W_{	ext{dist}} \cdot S_{	ext{dist}} + W_{	ext{rate}} \cdot S_{	ext{bayes}} + W_{	ext{pop}} \cdot S_{	ext{pop}} + W_{	ext{ver}} \cdot S_{	ext{ver}} + W_{	ext{ad}} \cdot S_{	ext{ad}} ight) \cdot M_{	ext{stock}}$$

Where:
- $S_{	ext{dist}} = \max\left(0, 1 - rac{	ext{Distance in km}}{25}ight)$ (Distance decay factor over 25km radius).
- $S_{	ext{bayes}} = rac{v \cdot R + m \cdot C}{v + m}$ (Bayesian average: $v$ = shop ratings count, $R$ = shop average rating, $m = 5$ prior weight, $C = 4.0$ baseline score).
- $S_{	ext{pop}} = \min\left(1.0, rac{	ext{Rating Count}}{50}ight)$ (Logarithmic review volume normalization).
- $S_{	ext{ver}} = 1.0$ (Trusted), $0.5$ (Verified), $0.0$ (Unverified).
- $S_{	ext{ad}} = 3.0$ (`premium_top`), $2.0$ (`category_featured`), $1.5$ (`basic_spotlight`), $0.0$ (`free`).
- $M_{	ext{stock}} = 1.0$ if in stock, $0.2$ if out of stock.

### 5.2 Algorithm Implementation Pseudo-Code

```javascript
/**
 * Calculates the combined ranking score for a shop or product listing.
 * @param {Object} item - Shop or product record with joined trader profile
 * @param {Object} userLoc - { latitude, longitude } of user (or market center)
 * @returns {number} Score used for sorting search results (descending)
 */
function calculateSearchRankScore(item, userLoc) {
    // 1. Distance Calculation (Haversine formula in KM)
    let distKm = 999;
    if (userLoc && userLoc.latitude && item.latitude) {
        distKm = calculateHaversineDistance(
            userLoc.latitude, userLoc.longitude,
            item.latitude, item.longitude
        );
    }
    const distScore = Math.max(0, 1 - (distKm / 25)); // Normalized 0-1 within 25km

    // 2. Bayesian Average Rating Calculation
    const v = item.rating_count || 0;
    const R = item.rating_avg || 0.0;
    const m = 5;    // Prior weight constant
    const C = 4.0;  // System baseline average
    const bayesRating = (v * R + m * C) / (v + m);
    const ratingScore = bayesRating / 5.0; // Normalized 0-1

    // 3. Review Volume Popularity Score
    const popScore = Math.min(1.0, v / 50.0);

    // 4. Verification Tier Boost
    let verScore = 0.0;
    if (item.verification_tier === 'trusted') verScore = 1.0;
    else if (item.verification_tier === 'verified') verScore = 0.5;

    // 5. Ad Placement Tier Boost
    let adScore = 0.0;
    if (item.ad_tier === 'premium_top') adScore = 3.0;
    else if (item.ad_tier === 'category_featured') adScore = 2.0;
    else if (item.ad_tier === 'basic_spotlight') adScore = 1.5;

    // 6. Stock Availability Multiplier
    const stockMultiplier = (item.in_stock && item.stock_quantity > 0) ? 1.0 : 0.2;

    // Weights Configuration
    const W_DIST = 0.35; // Location finding is core!
    const W_RATE = 0.25;
    const W_POP  = 0.10;
    const W_VER  = 0.10;
    const W_AD   = 0.20;

    const baseScore = (W_DIST * distScore) + 
                      (W_RATE * ratingScore) + 
                      (W_POP * popScore) + 
                      (W_VER * verScore) + 
                      (W_AD * adScore);

    return baseScore * stockMultiplier;
}
```

---

## 6. Security Architecture & Anti-Fraud Monitoring Plan

To maintain ecosystem integrity, prevent fake listings, eliminate scam attempts, and block cyber threats, TMF adopts a multi-layered trust & safety architecture.

```
+-----------------------------------------------------------------------+
|                       SECURITY & INTEGRITY LAYER                      |
+-----------------------------------------------------------------------+
|  [Tier 1: Identity & Verification]  Unverified -> Verified -> Trusted  |
|  [Tier 2: User Reporting Engine]    Flag button on items/shops        |
|  [Tier 3: Automated AI Agent Scan]  Keyword, Price, & GPS Anomaly Job |
|  [Tier 4: Client & RLS Rate Limits] Max 5 reviews/hr, 10 orders/hr     |
|  [Tier 5: Admin Moderation Portal]  Review queue, suspend, ban action |
+-----------------------------------------------------------------------+
```

### 6.1 Verification Tier Framework
1. **Unverified (Default):** User registers with email/phone. Can browse, save favorites, and place basic orders. Stalls marked with plain badge.
2. **Verified Trader (`✓ Verified`):** Trader provides valid Ghana Phone Number (OTP verified) + valid Ghana Post Digital Address verified via geolocation check.
3. **Trusted Trader (`⭐ Trusted`):** Physical stall verified by TMF field agents or community leaders in Tamale Central Market / Aboabo. Gains highest search score boost and green badge.

### 6.2 Automated AI Monitoring Agent Protocol
The background AI Agent runs scheduled jobs (every 15 minutes) scanning all newly created listings and reviews against an automated policy filter:

```javascript
// Pseudo-code for Automated AI Monitoring Task
async function runAutomatedSecurityScan(supabaseClient) {
    const SUSPICIOUS_KEYWORDS = [
        'wire transfer', 'western union', 'send money first', 'bitcoin', 'crypto',
        'guns', 'weapons', 'counterfeit', 'stolen', 'hacked', 'lottery', 'voodoo'
    ];

    // 1. Fetch unflagged listings
    const { data: listings } = await supabaseClient
        .from('products')
        .select('id, name, description, price, shop_id')
        .eq('is_flagged', false);

    for (const item of listings) {
        let flagReason = null;

        // Keyword Scan
        const fullText = (item.name + " " + item.description).toLowerCase();
        if (SUSPICIOUS_KEYWORDS.some(kw => fullText.includes(kw))) {
            flagReason = 'Prohibited content / scam keywords detected';
        }

        // Anomaly Scan: Absurdly low price for high-value items
        if (item.name.toLowerCase().includes('iphone') && item.price < 50) {
            flagReason = 'Price anomaly: Suspected counterfeit or scam';
        }

        if (flagReason) {
            // Flag item and submit automated report
            await supabaseClient.from('products').update({ is_flagged: true }).eq('id', item.id);
            await supabaseClient.from('reports').insert({
                reporter_id: null, // System AI bot ID
                reported_type: 'product',
                target_id: item.id,
                reason_category: 'scam_attempt',
                description: `[AI SCANNER DETECTED]: ${flagReason}`,
                status: 'pending'
            });
        }
    }
}
```

### 6.3 Admin Moderation Dashboard Spec
- **Flagged Queue:** Shows all items flagged by users or the AI Scanner with reason, confidence score, and sample text.
- **Action Toolbar:** `[Approve & Dismiss]`, `[Hide Listing]`, `[Issue Trader Warning]`, `[Ban Trader Account]`.
- **User Risk Scores:** Computes risk based on report count, rejected orders ratio, and account age.

---

## 7. Advertising & Spotlight System Design

The advertising engine allows local merchants and brands in Tamale to boost their visibility while keeping organic search results accurate and unbiased.

### 7.1 Tiered Ad Matrix & Placement Specifications

| Ad Tier | Visual Placement | Perks & Features | Pricing (GHS) |
| :--- | :--- | :--- | :--- |
| **Basic Spotlight** | Hero Carousel on Home & Explore Page | Listed in top banner carousel; "🔥 Spotlight" badge | **GHS 25 / 7 Days**<br>(GHS 80 / Month) |
| **Category Featured**| Top of Category Filter Results | Pins stall to position #1-#3 in specific category | **GHS 40 / 7 Days**<br>(GHS 130 / Month) |
| **Premium Top** | Top of All Search Results & Map Pins | Priority #1 overall ranking boost, gold map pin | **GHS 70 / 7 Days**<br>(GHS 220 / Month) |

### 7.2 Ad Booking Workflow & Admin Approval
1. **Trader Applies:** Trader navigates to `Account -> Trader Dashboard -> Advertising`, chooses item/shop, selects tier & duration, and submits reference code.
2. **Pending State:** Ad status set to `pending`.
3. **Admin Verification:** TMF admin checks payment (MoMo transaction reference) and content quality.
4. **Activation:** Admin approves; ad status set to `active`, setting `shops.ad_tier` and `start_date` / `end_date`. PostgreSQL trigger automatically reverts `ad_tier` to `'free'` when `end_date` passes.

---

## 8. Business Model & Revenue Recommendations

To ensure long-term sustainability while remaining 100% free for buyers and basic local traders, TMF utilizes a **Freemium Marketplace & Local B2B Subscription** revenue model tailored to Northern Ghana.

```
+-----------------------------------------------------------------------+
|                    TMF LOCAL REVENUE ENGINE (GHS)                     |
+-----------------------------------------------------------------------+
|  1. Trader Ad Spotlights       -> GHS 25 - GHS 220 / campaign         |
|  2. Premium Trader Membership -> GHS 35 / month (Analytics, Verification)
|  3. Service Listing Subscriptions-> GHS 40 / month (Barbers, Mechanics) |
|  4. Local Brand Banners       -> GHS 300 / month (Telcos, Banks, Dist.)|
+-----------------------------------------------------------------------+
```

### 8.1 Detailed Revenue Streams
1. **Spotlight & Advertising Fees:** Estimated GHS 1,500 - 3,500/month across 50 active advertisers.
2. **Trader Premium Subscription (GHS 35/month):**
   - Verified Trader Badge.
   - Analytics Dashboard (shop views, search impressions, WhatsApp click counts).
   - Priority listing over unverified free accounts.
3. **Service Directory Subscriptions (GHS 40/month):**
   - Dedicated service profile for non-retail professionals (electricians, plumbers, mechanics, beauticians).
4. **Market Directory Partnerships:**
   - Sponsored banner spaces for telecom networks (MTN, Telecel), local financial institutions, and agricultural distributors in Tamale.

---

## 9. Implementation Priority & Phased Roadmap

To execute this expansion systematically without breaking existing functionality, work is divided into six sequential phases.

```
[Phase 1: DB Schema & DDL] ---> [Phase 2: Stock Management] ---> [Phase 3: Ordering Engine]
                                                                          |
[Phase 6: Ads & Monetization] <-- [Phase 5: Security & Admin] <-- [Phase 4: Multi-Domain UI]
```

### Phase Breakdown

#### Phase 1: Database Schema Expansion (Immediate Priority)
- Execute complete DDL script in Supabase SQL Editor.
- Verify RLS policies, indexes, and PostgreSQL triggers.

#### Phase 2: Stock Management & Urgency Badges
- Update product cards in `index.html` and `app.js` with inventory pills (`🟢 In Stock`, `🔥 Only X Left`).
- Add inline quick stock editor in Trader Dashboard.

#### Phase 3: In-App Ordering & Reservation Engine
- Implement cart modal and checkout reservation drawer.
- Create order state management UI for both buyers (`My Orders`) and traders (`Trader Dashboard -> Orders`).
- Wire up order status transition triggers and stock decrement logic.

#### Phase 4: Multi-Domain Directory UI & Reviews Engine
- Introduce category switcher tabs (`Products`, `Services`, `Hotels/Eateries`, `Businesses`).
- Implement post-completion star review modal and shop average rating display.
- Integrate Bayesian ranking algorithm into search results sorting.

#### Phase 5: Security Architecture & Moderation Portal
- Build user flag/report modals on items.
- Implement background AI scanner script for scam/keyword detection.
- Add Admin Moderation tab for queue resolution and user verification tier management.

#### Phase 6: Advertising System & Monetization
- Add Ad Placement application form in Trader Dashboard.
- Build Admin Ad Approval tab.
- Implement spotlight banner carousel on explore page header.

---
*End of Specification — Prepared for Implementation.*
