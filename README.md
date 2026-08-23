# Tamale Market Finder (TMF)

A lightweight web app that helps customers in Tamale, Ghana find shops selling the products they need — with pinpoint locations on a map. Traders can create accounts and list their products, similar to a simplified Shopify.

## Features

### For Customers
- 🔍 Search for products by name or category
- 📍 See shop locations on an interactive map (OpenStreetMap)
- 🧭 Get directions to any shop
- 📋 Browse products by market area (Central Market, Aboabo, etc.)
- 📱 Mobile-friendly — works great on phones

### For Traders / Shop Owners
- 🏪 Create a shop profile (name, category, location, contact)
- 📦 Add and manage products (name, price, description, photo, stock status)
- 📍 Set shop location using GPS or manual coordinates
- 🆓 Free to join — no fees

## Tech Stack (All Free)
- **Frontend**: HTML, CSS, vanilla JavaScript (no framework)
- **Maps**: Leaflet.js + OpenStreetMap (free, no API key)
- **Backend & Database**: Supabase (free tier — PostgreSQL, Auth, Storage)
- **Hosting**: GitHub Pages (free)

## Quick Start

### 1. Set up Supabase (5 minutes)
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to Settings → API to get your Project URL and anon key
4. Open `app.js` and replace:
   ```js
   const SUPABASE_URL = 'YOUR_SUPABASE_URL';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```
   with your actual credentials

### 2. Create Database Tables
Run this SQL in the Supabase SQL Editor:

```sql
-- Create shops table
CREATE TABLE shops (
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
CREATE TABLE products (
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

-- Enable Row Level Security
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public can read shops and products
CREATE POLICY "Public can read shops" ON shops FOR SELECT USING (true);
CREATE POLICY "Public can read products" ON products FOR SELECT USING (true);

-- Users can manage their own shop
CREATE POLICY "Users can insert own shop" ON shops FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own shop" ON shops FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own shop" ON shops FOR DELETE USING (auth.uid() = created_by);

-- Users can manage products for their own shop
CREATE POLICY "Users can insert own products" ON products FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM shops WHERE shops.id = products.shop_id AND shops.created_by = auth.uid()));
CREATE POLICY "Users can update own products" ON products FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = products.shop_id AND shops.created_by = auth.uid()));
CREATE POLICY "Users can delete own products" ON products FOR DELETE 
    USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = products.shop_id AND shops.created_by = auth.uid()));
```

### 3. Create Storage Bucket
1. In Supabase, go to Storage
2. Create a public bucket named `product-images`
3. Set the bucket to public (so product images are viewable)

### 4. Deploy to GitHub Pages
1. Create a new GitHub repository
2. Upload all files (`index.html`, `styles.css`, `app.js`)
3. Go to Settings → Pages
4. Set source to "Deploy from a branch" → `main` → `/ (root)`
5. Your app will be live at `https://YOUR_USERNAME.github.io/REPO_NAME/`

## Demo Mode
The app works in demo mode without Supabase configured — it shows sample Tamale shops (yam seller, textile shop, phone accessories, fresh produce) so you can test the UI immediately.

## Trade Categories (Tamale-specific)
- 🌾 Grains & Cereals (maize, yam, rice, millet)
- 🥩 Meat & Livestock
- 🧵 Textiles & Smocks (Dagomba smocks, Guinea brocade)
- 📱 Electronics & Phones
- 🔨 Hardware & Building Materials
- 🍎 Fresh Produce
- 💊 Pharmacy & Health
- 🍳 Cooked Food & Restaurants
- 🎨 Crafts & Artifacts
- 🧴 Cosmetics & Toiletries
- 🛠️ Tools & Equipment
- 📦 General Goods

## Market Areas
- Tamale Central Market (largest in Northern Ghana)
- Aboabo Market (major yam & cereal hub)
- Old Market
- Lamashegu
- Kukuo
- Other areas

## Future Plans
- Trader verification badges
- Customer reviews & ratings
- WhatsApp integration (contact trader directly)
- Offline mode for poor connectivity
- Dagbani language support
- SMS notifications for traders

## License
MIT License — feel free to use and modify.

## Created for
Abdul Wasir Habib — Tamale, Northern Ghana 🇬🇭
