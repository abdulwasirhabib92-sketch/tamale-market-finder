# Tamale Market Finder — Research & Project Plan

## Date: August 23, 2026
## Prepared for: Abdul Wasir Habib

---

## 1. Market Research: Tamale, Ghana

### Key Markets
- **Tamale Central Market** — Largest market in Northern Ghana. Located in the heart of Tamale. Sells agricultural products, livestock, textiles, electronics, and various goods.
- **Aboabo Market** — Major sub-market within the Tamale Central Market area. One of the biggest yam and cereal markets in the Northern Region. Traders come from across Ghana and Burkina Faso.
- **Old Market Side** — The traditional section of Tamale Central Market.

### Economy & Trade
- Tamale's economy is based on **agriculture, trading, teaching, and manufacturing**.
- Major product categories: grains (maize, yam, rice), livestock, textiles/smocks, traditional crafts, electronics, hardware, food items, pharmaceuticals.
- Tamale is a key **transportation and logistics hub** for Northern Ghana.
- Periodic market days exist in surrounding communities (e.g., Nyankpala every 6 days, Tatale).
- The Northern Business Fair and other trade expos are held in Tamale regularly.

### Digital Landscape
- Ghana internet penetration: **74.6%** (26.3 million users as of end 2025).
- **Mobile-first** — Ghana leads globally in time spent on mobile internet.
- ~70% of mobile connections are broadband (3G–5G).
- Existing platforms: Jiji, Tonaton, Hubtel, Plendify, Glovo, Kurom Marketplace.
- **Gap**: No platform specifically focuses on helping customers locate physical stores/shops in Tamale by product. Most existing apps are classifieds or delivery — not store locators.

### Competitive Advantage
- Hyperlocal focus on **Tamale and Northern Ghana** (competitors are national/general).
- **Store locator + product search** — not just classifieds, but finding WHERE to buy.
- Free for customers, simple onboarding for traders.
- Lightweight — works well on low-end smartphones and slower connections.

---

## 2. App Concept

### Name (working): Tamale Market Finder (TMF)

### Two-sided platform:

#### Customer Side (Shopper)
- Search for a product (e.g., "yam", "fabric", "phone charger")
- See list of shops/stores that have that product
- View each shop's location on a map (pinpoint)
- Get directions to the shop
- See shop details: name, location, opening hours, contact, product list

#### Trader Side (Shop Owner)
- Create an account (shop name, location, contact, category)
- Add products to their shop (name, price, description, photo, availability)
- Their shop and products become visible on the platform
- Simple dashboard — like a mini Shopify

---

## 3. Technical Architecture (Simple & Cost-Effective)

### Hosting: GitHub Pages (FREE)
- Static frontend hosted on GitHub Pages
- No server hosting costs

### Frontend: HTML + CSS + JavaScript
- Responsive web app (works on mobile and desktop)
- No framework dependency — vanilla JS or lightweight (Alpine.js or similar)
- Works on low-end devices and slow connections

### Maps: Leaflet.js (FREE, open-source)
- Open-source mapping library
- Uses OpenStreetMap tiles (free)
- No API key needed, no usage limits
- Pinpoint shop locations with markers

### Backend & Database: Supabase (FREE TIER)
- PostgreSQL database (free tier: 500MB, 50K MAU)
- Authentication (email/password for traders)
- Storage for product images (1GB free)
- Real-time updates
- REST API — no server code needed

### Image Handling
- Product photos uploaded via Supabase Storage
- Optimized for mobile (compress before upload)

### Total Monthly Cost: ¢0 (free tiers)
- GitHub Pages: Free
- Leaflet + OpenStreetMap: Free
- Supabase free tier: Free (sufficient for launch)
- Domain (optional): ~$10/year for custom domain

---

## 4. Database Schema (Supabase/PostgreSQL)

### Table: shops
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| owner_name | text | Shop owner's name |
| shop_name | text | Shop/business name |
| category | text | Trade category (e.g., groceries, textiles, electronics) |
| description | text | Short shop description |
| latitude | numeric | GPS latitude |
| longitude | numeric | GPS longitude |
| address | text | Physical address/landmark |
| phone | text | Contact phone |
| opening_hours | text | e.g., "8am–6pm daily" |
| market_area | text | e.g., "Central Market", "Aboabo" |
| created_date | timestamp | Auto |
| updated_date | timestamp | Auto |

### Table: products
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| shop_id | UUID (FK) | References shops.id |
| name | text | Product name |
| category | text | Product category |
| price | numeric | Price in GHS |
| description | text | Product details |
| image_url | text | Product photo URL |
| in_stock | boolean | Availability |
| created_date | timestamp | Auto |

### Table: shop_categories (reference)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| name | text | e.g., "Groceries", "Textiles", "Electronics" |
| icon | text | Emoji or icon name |

---

## 5. Trade Categories (Tamale-specific)

Based on research, the main trade categories in Tamale:

1. 🌾 Grains & Cereals (maize, rice, yam, millet)
2. 🥩 Meat & Livestock
3. 🧵 Textiles & Smocks (local fabrics, Guinea brocade)
4. 📱 Electronics & Phones
5. 🔨 Hardware & Building Materials
6. 🍎 Fresh Produce (fruits, vegetables)
7. 💊 Pharmacy & Health
8. 🍳 Cooked Food & Restaurants
9. 🎨 Crafts & Artifacts
10. 🧴 Cosmetics & Toiletries
11. 🛠️ Tools & Equipment
12. 📦 General Goods

---

## 6. Development Phases

### Phase 1: MVP (Weeks 1–2)
- Set up GitHub repo
- Set up Supabase project (database + auth)
- Build customer search page (search product → see shops on map)
- Build trader registration + dashboard (add shop, add products)
- Mobile-responsive design

### Phase 2: Enhancement (Weeks 3–4)
- Shop detail pages with product galleries
- Directions to shop (Leaflet routing)
- Category browsing
- Search filters (by market area, category, price range)
- Image upload for products

### Phase 3: Growth (Future)
- Trader verification/badges
- Customer reviews/ratings
- WhatsApp integration (contact trader directly)
- Offline mode (cached data for poor connectivity)
- SMS notifications for traders
- Multi-language support (Dagbani + English)

---

## 7. Key Design Principles

- **Mobile-first**: Most users in Tamale will access via phone
- **Low-bandwidth friendly**: Minimal images, lazy loading, compressed assets
- **Simple UX**: Traders may not be tech-savvy — minimal steps to onboard
- **Dagbani-friendly**: Consider local language support in future
- **Offline-resilient**: Cache shop data so users can still browse without connection

---

## 8. Getting Started Checklist

1. Create GitHub repository
2. Set up Supabase project (free)
3. Build database tables
4. Build frontend (HTML/CSS/JS)
5. Deploy to GitHub Pages
6. Test with sample data (a few real Tamale shops)
7. Share with initial traders for onboarding
