-- ============================================
-- Tamale Market Finder — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================

-- Create shops table
CREATE TABLE IF NOT EXISTS shops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_by UUID REFERENCES auth.users(id),
    owner_name TEXT,
    shop_name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    address TEXT,
    phone TEXT,
    opening_hours TEXT,
    market_area TEXT,
    created_date TIMESTAMPTZ DEFAULT NOW(),
    updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    price NUMERIC,
    description TEXT,
    image_url TEXT,
    in_stock BOOLEAN DEFAULT true,
    created_date TIMESTAMPTZ DEFAULT NOW()
);

-- Create updated_date trigger function
CREATE OR REPLACE FUNCTION update_updated_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_date = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to shops
DROP TRIGGER IF EXISTS shops_updated_date ON shops;
CREATE TRIGGER shops_updated_date
    BEFORE UPDATE ON shops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_date();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public can read shops and products
CREATE POLICY "Public can read shops" ON shops FOR SELECT USING (true);
CREATE POLICY "Public can read products" ON products FOR SELECT USING (true);

-- Users can manage their own shop
CREATE POLICY "Users can insert own shop" ON shops FOR INSERT 
    WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own shop" ON shops FOR UPDATE 
    USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own shop" ON shops FOR DELETE 
    USING (auth.uid() = created_by);

-- Users can manage products for their own shop
CREATE POLICY "Users can insert own products" ON products FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = products.shop_id 
        AND shops.created_by = auth.uid()
    ));
CREATE POLICY "Users can update own products" ON products FOR UPDATE 
    USING (EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = products.shop_id 
        AND shops.created_by = auth.uid()
    ));
CREATE POLICY "Users can delete own products" ON products FOR DELETE 
    USING (EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = products.shop_id 
        AND shops.created_by = auth.uid()
    ));

-- ============================================
-- Storage Bucket Policy
-- ============================================
-- Create the product-images bucket (public)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to product-images
CREATE POLICY "Authenticated users can upload product images" 
    ON storage.objects FOR INSERT 
    TO authenticated 
    WITH CHECK (bucket_id = 'product-images');

-- Allow public to read product images
CREATE POLICY "Public can read product images" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'product-images');

-- Allow users to delete their own product images
CREATE POLICY "Users can delete own product images" 
    ON storage.objects FOR DELETE 
    TO authenticated 
    USING (bucket_id = 'product-images');

-- ============================================
-- Sample Data (optional — for testing)
-- ============================================
-- Uncomment to add demo shops (no auth needed for reading)

-- INSERT INTO shops (shop_name, category, market_area, address, phone, opening_hours, description, latitude, longitude)
-- VALUES 
--     ('Aboabo Yam Market', 'Grains & Cereals', 'Aboabo Market', 'Aboabo Market, Tamale', '024 000 0000', '6am-6pm daily', 'Fresh yam and cereals from across Northern Ghana', 9.3960, -0.8370),
--     ('Dagbon Smocks & Textiles', 'Textiles & Smocks', 'Central Market', 'Tamale Central Market', '020 000 0000', '8am-7pm daily', 'Traditional Dagomba smocks, Guinea brocade, and local fabrics', 9.4060, -0.8450),
--     ('Tamale Phone Hub', 'Electronics & Phones', 'Central Market', 'Central Market, Tamale', '055 000 0000', '8am-8pm daily', 'Phones, accessories, and repairs', 9.4040, -0.8430);
