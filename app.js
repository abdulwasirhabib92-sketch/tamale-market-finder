/* ====================================================================
   TAMALE MARKET FINDER (TMF) - PHASE 2 JAVASCRIPT ENGINE
   Target: Vanilla JS (ES6+), Leaflet.js, Supabase JS v2, Ghana Post GPS
   ==================================================================== */

// ====================================================================
// 1. CONFIGURATION & CONSTANTS
// ====================================================================
const SUPABASE_URL = "https://djcajmglxkmhbipmweps.sbClient.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqY2FqbWdseGttaGJpcG13ZXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTE3NDcsImV4cCI6MjA5NjQyNzc0N30.ccaT6pQW8Dbqy1LC97p2hH0Q7CuYtWJwnoDgrOdwAX4";

const DEMO_MODE = SUPABASE_URL.includes("YOUR_SUPABASE_PROJECT_URL");

let sbClient = null;

// Global Application State
let currentUser = null;
let userProfile = {
    full_name: "Wasir Habib",
    phone: "0244123456",
    account_type: "shopper", // shopper | trader | admin
    verification_tier: "unverified"
};
let userFavorites = new Set();
let userShop = null;

// Search & Filter State
let currentDomain = "product"; // product | service | hotel | eatery | company
let currentCategory = "";
let currentSearchQuery = "";
let currentMarketFilter = "";
let currentStatusFilter = "";
let userLocation = { latitude: 9.4075, longitude: -0.8357 }; // Tamale Central default

// View State
let mobileViewMode = "list"; // list | map
let leafletMap = null;
let mapMarkers = [];

// Escape for inline JS strings (onclick handlers)
function escapeJs(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");
}

// HTML Escape function to prevent XSS
function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Rate Limiting Storage
let gpsRequestCount = 0;
let lastGpsRequestReset = Date.now();

// ====================================================================
// 2. DEMO STORE (MOCK DATABASE FOR UNCONNECTED MVP MODE)
// ====================================================================
const demoStore = {
    shops: [
        {
            id: "shop-1",
            created_by: "user-trader-1",
            owner_name: "Alhassan Wasir",
            shop_name: "Alhassan Grain Store & Wholesale",
            category: "Grains & Cereals",
            description: "Leading grain supplier in Tamale Central Market. Bulk white maize, millet, sorghum, and local rice.",
            latitude: 9.4075,
            longitude: -0.8357,
            address: "Shed B-12, Main Grain Section, Central Market",
            digital_address: "NT-092-0621",
            whatsapp_number: "233244123456",
            phone: "0244123456",
            opening_hours: "Mon-Sat: 6:30 AM - 6:00 PM",
            market_area: "Central Market",
            is_verified: true,
            verification_tier: "trusted",
            rating_avg: 4.8,
            rating_count: 28,
            ad_tier: "premium_top",
            cover_image_url: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80",
            listing_type: "product"
        },
        {
            id: "shop-2",
            created_by: "user-trader-2",
            owner_name: "Mariama Fuseini",
            shop_name: "Mariama Pure Sheabutter & Spices",
            category: "Fresh Produce",
            description: "100% organic unrefined Northern Ghana Shea Butter, natural dawadawa, dry pepper, and spices.",
            latitude: 9.4120,
            longitude: -0.8310,
            address: "Aboabo Market Gate 3, Near Mosque",
            digital_address: "NT-104-4820",
            whatsapp_number: "233208112233",
            phone: "0208112233",
            opening_hours: "Mon-Sun: 7:00 AM - 6:30 PM",
            market_area: "Aboabo Market",
            is_verified: true,
            verification_tier: "verified",
            rating_avg: 4.6,
            rating_count: 19,
            ad_tier: "basic_spotlight",
            cover_image_url: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=600&q=80",
            listing_type: "product"
        },
        {
            id: "shop-3",
            created_by: "user-trader-3",
            owner_name: "Ibrahim Yakubu",
            shop_name: "Yakubu Smock Weaving & Royal Batakari",
            category: "Textiles & Smocks",
            description: "Authentic handwoven Northern Ghanaian Batakari, heavy cotton smocks, and custom tailored royal caps.",
            latitude: 9.4030,
            longitude: -0.8390,
            address: "Lamashegu Market Rd, Opposite Shell Station",
            digital_address: "NT-088-1290",
            whatsapp_number: "233245998877",
            phone: "0245998877",
            opening_hours: "Mon-Sat: 8:00 AM - 7:00 PM",
            market_area: "Lamashegu",
            is_verified: true,
            verification_tier: "trusted",
            rating_avg: 4.9,
            rating_count: 42,
            ad_tier: "category_featured",
            cover_image_url: "https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=600&q=80",
            listing_type: "product"
        },
        {
            id: "shop-4",
            created_by: "user-trader-4",
            owner_name: "Kwaku Mensah",
            shop_name: "Northern Solar & Electronics Hub",
            category: "Electronics & Phones",
            description: "Solar power inverters, deep cycle batteries, smartphones, chargers, and off-grid power solutions.",
            latitude: 9.4090,
            longitude: -0.8320,
            address: "Tamale Central Commercial Street",
            digital_address: "NT-095-7721",
            whatsapp_number: "233277334455",
            phone: "0277334455",
            opening_hours: "Mon-Sat: 8:00 AM - 6:00 PM",
            market_area: "Central Market",
            is_verified: false,
            verification_tier: "unverified",
            rating_avg: 4.2,
            rating_count: 8,
            ad_tier: "free",
            cover_image_url: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=600&q=80",
            listing_type: "product"
        }
    ],

    products: [
        {
            id: "prod-1",
            shop_id: "shop-1",
            name: "Local White Maize (100kg Bag)",
            category: "Grains & Cereals",
            price: 350.00,
            discount_price: 320.00,
            badge_tag: "deal",
            description: "Clean dry Northern white maize sourced directly from local farmers in Savelugu.",
            image_url: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=500&q=80",
            in_stock: true,
            stock_quantity: 15,
            low_stock_threshold: 3,
            rating_avg: 4.8,
            rating_count: 14,
            listing_type: "product"
        },
        {
            id: "prod-2",
            shop_id: "shop-1",
            name: "Organic Millet Grain (50kg)",
            category: "Grains & Cereals",
            price: 220.00,
            discount_price: null,
            badge_tag: "hot",
            description: "High quality millet suitable for Hausa Koko, Koko, and porridge.",
            image_url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=500&q=80",
            in_stock: true,
            stock_quantity: 2,
            low_stock_threshold: 3,
            rating_avg: 4.7,
            rating_count: 9,
            listing_type: "product"
        },
        {
            id: "prod-3",
            shop_id: "shop-2",
            name: "Pure Unrefined Shea Butter (5kg Bucket)",
            category: "Fresh Produce",
            price: 85.00,
            discount_price: 75.00,
            badge_tag: "deal",
            description: "100% naturalGrade A yellow/ivory shea butter extracted traditionally in Yendi.",
            image_url: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=500&q=80",
            in_stock: true,
            stock_quantity: 25,
            low_stock_threshold: 5,
            rating_avg: 4.9,
            rating_count: 22,
            listing_type: "product"
        },
        {
            id: "prod-4",
            shop_id: "shop-3",
            name: "Handwoven Heavy Cotton Batakari Smock",
            category: "Textiles & Smocks",
            price: 450.00,
            discount_price: 390.00,
            badge_tag: "new",
            description: "Authentic Northern royal smock with intricate embroidery and heavy durable weave.",
            image_url: "https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=500&q=80",
            in_stock: true,
            stock_quantity: 8,
            low_stock_threshold: 2,
            rating_avg: 5.0,
            rating_count: 31,
            listing_type: "product"
        },
        {
            id: "prod-5",
            shop_id: "shop-4",
            name: "Solar Inverter 1000W 12V Pure Sine Wave",
            category: "Electronics & Phones",
            price: 850.00,
            discount_price: null,
            badge_tag: null,
            description: "Reliable power inverter for lights, TV, and fans during power outages.",
            image_url: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=500&q=80",
            in_stock: false,
            stock_quantity: 0,
            low_stock_threshold: 2,
            rating_avg: 4.0,
            rating_count: 5,
            listing_type: "product"
        }
    ],

    service_listings: [
        {
            id: "srv-1",
            shop_id: "shop-4",
            provider_id: "user-trader-4",
            title: "Master Alhassan Auto Repair & Electrical Specialist",
            category: "Auto & Mechanics",
            price_type: "starting_at",
            price_min: 50.00,
            price_max: 500.00,
            description: "Expert mechanical repair, computer diagnostic scanning, and engine overhaul in Lamashegu.",
            service_area: "Tamale Metropolitan Area",
            availability_hours: "Mon-Sat: 7:30 AM - 6:30 PM",
            image_url: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=500&q=80",
            is_available: true
        },
        {
            id: "srv-2",
            shop_id: "shop-3",
            provider_id: "user-trader-3",
            title: "Custom Smock Embroidery & Tailoring Services",
            category: "Fashion & Tailoring",
            price_type: "quote",
            price_min: 100.00,
            price_max: 800.00,
            description: "Bespoke tailoring for weddings, traditional damba festivals, and corporate events.",
            service_area: "Tamale & Shipping across Ghana",
            availability_hours: "Mon-Sat: 8:00 AM - 6:00 PM",
            image_url: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=500&q=80",
            is_available: true
        }
    ],

    business_listings: [
        {
            id: "biz-1",
            owner_id: "user-biz-1",
            business_name: "Modern City Hotel Tamale",
            business_type: "hotel",
            sub_category: "Luxury Hotel & Conference Centre",
            description: "Premier luxury hotel featuring swimming pool, high-speed WiFi, conference halls, and international restaurant.",
            address: "Main Education Ridge Road, Tamale",
            digital_address: "NT-012-3344",
            latitude: 9.4180,
            longitude: -0.8420,
            phone: "0372022334",
            whatsapp_number: "233372022334",
            amenities: ["📶 Free WiFi", "🏊 Swimming Pool", "❄️ Air Conditioning", "🅿️ Free Parking", "🍳 Breakfast Included"],
            price_range: "$$$",
            cover_image_url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
            rating_avg: 4.8,
            rating_count: 54,
            opening_hours: "24/7 Front Desk",
            is_verified: true
        },
        {
            id: "biz-2",
            owner_id: "user-biz-2",
            business_name: "Swoba Tuo Zaafi & Northern Dishes",
            business_type: "restaurant",
            sub_category: "Local Cuisine & Buka",
            description: "Authentic Tamale Tuo Zaafi with Ayoyo, Bitters soup, fresh beef, guinea fowl, and fried fish.",
            address: "Hospital Road, Near Central Mosque",
            digital_address: "NT-091-8833",
            latitude: 9.4060,
            longitude: -0.8340,
            phone: "0242990011",
            whatsapp_number: "233242990011",
            amenities: ["🍲 Dine-In", "📦 Takeaway", "🚚 Local Delivery"],
            price_range: "$",
            cover_image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80",
            rating_avg: 4.9,
            rating_count: 88,
            opening_hours: "Mon-Sun: 9:00 AM - 10:00 PM",
            is_verified: true
        },
        {
            id: "biz-3",
            owner_id: "user-biz-3",
            business_name: "Savanna Agricultural Development Hub",
            business_type: "company",
            sub_category: "Agribusiness & Export",
            description: "Empowering farmers across Northern Region with seeds, tractor hiring, and agricultural exports.",
            address: "Industrial Area, Nyankpala Road",
            digital_address: "NT-150-0012",
            latitude: 9.3950,
            longitude: -0.8510,
            phone: "0372099881",
            whatsapp_number: "233372099881",
            amenities: ["🚜 Tractor Hiring", "🌾 Grains Export", "💼 B2B Contracts"],
            price_range: "$$",
            cover_image_url: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80",
            rating_avg: 4.7,
            rating_count: 16,
            opening_hours: "Mon-Fri: 8:00 AM - 5:00 PM",
            is_verified: true
        }
    ],

    orders: [
        {
            id: "ord-1",
            order_number: "TMF-2026-4821",
            buyer_id: "user-shopper-1",
            shop_id: "shop-1",
            product_id: "prod-1",
            product_name: "Local White Maize (100kg Bag)",
            unit_price: 320.00,
            quantity: 2,
            total_amount: 640.00,
            delivery_type: "pickup",
            buyer_name: "Wasir Habib",
            buyer_phone: "0244123456",
            buyer_notes: "Will pick up at Shed B-12 around 2:00 PM",
            status: "accepted", // placed | accepted | ready | completed | cancelled | rejected
            placed_at: "2026-08-25T10:00:00Z",
            accepted_at: "2026-08-25T10:15:00Z"
        },
        {
            id: "ord-2",
            order_number: "TMF-2026-1092",
            buyer_id: "user-shopper-1",
            shop_id: "shop-3",
            product_id: "prod-4",
            product_name: "Handwoven Heavy Cotton Batakari Smock",
            unit_price: 390.00,
            quantity: 1,
            total_amount: 390.00,
            delivery_type: "local_delivery",
            delivery_address: "Near Central Hospital, Tamale",
            buyer_name: "Wasir Habib",
            buyer_phone: "0244123456",
            buyer_notes: "Please pack in royal gift wrapper",
            status: "completed",
            placed_at: "2026-08-24T14:30:00Z",
            accepted_at: "2026-08-24T14:45:00Z",
            completed_at: "2026-08-24T16:00:00Z"
        }
    ],

    reviews: [
        {
            id: "rev-1",
            order_id: "ord-2",
            buyer_id: "user-shopper-1",
            buyer_name: "Wasir Habib",
            shop_id: "shop-3",
            product_id: "prod-4",
            rating: 5,
            comment: "Exceptional quality smock! The weaving is heavy and authentic. Fast pickup response from Ibrahim.",
            trader_reply: "Nagode (Thank you)! We appreciate your business and hope to see you again soon.",
            created_date: "2026-08-24T17:00:00Z"
        }
    ],

    ad_placements: [
        {
            id: "ad-1",
            trader_id: "user-trader-1",
            shop_id: "shop-1",
            ad_tier: "premium_top",
            target_category: "Grains & Cereals",
            fee_paid_ghs: 70.00,
            status: "active",
            start_date: "2026-08-20T00:00:00Z",
            end_date: "2026-09-20T00:00:00Z"
        }
    ],

    reports: [
        {
            id: "rep-1",
            reporter_id: "user-shopper-1",
            reported_type: "product",
            target_id: "prod-5",
            reason_category: "scam_attempt",
            description: "Suspicious listing price for inverter.",
            status: "pending",
            created_date: "2026-08-25T11:00:00Z"
        }
    ]
};

// ====================================================================
// 3. MATHEMATICAL RANKING ALGORITHM
// ====================================================================

/**
 * Calculates the combined ranking score for search sorting.
 * Score = (W_dist * S_dist + W_rate * S_bayes + W_pop * S_pop + W_ver * S_ver + W_ad * S_ad) * M_stock
 */
function calculateSearchRankScore(item, userLat, userLng) {
    // 1. Distance Calculation (Haversine formula in KM)
    let distKm = 10.0; // Default fallback
    if (userLat && userLng && item.latitude && item.longitude) {
        distKm = calculateHaversineDistance(userLat, userLng, item.latitude, item.longitude);
    }
    const distScore = Math.max(0, 1 - (distKm / 25.0)); // 0 to 1 normalized within 25km

    // 2. Bayesian Average Rating Calculation
    const v = item.rating_count || 0;
    const R = item.rating_avg || 0.0;
    const m = 5;    // Prior weight constant
    const C = 4.0;  // System baseline score
    const bayesRating = (v * R + m * C) / (v + m);
    const ratingScore = bayesRating / 5.0; // Normalized 0-1

    // 3. Review Volume Popularity Score
    const popScore = Math.min(1.0, v / 50.0);

    // 4. Verification Tier Boost
    let verScore = 0.0;
    if (item.verification_tier === "trusted" || item.is_verified) verScore = 1.0;
    else if (item.verification_tier === "verified") verScore = 0.5;

    // 5. Ad Placement Tier Boost
    let adScore = 0.0;
    if (item.ad_tier === "premium_top") adScore = 3.0;
    else if (item.ad_tier === "category_featured") adScore = 2.0;
    else if (item.ad_tier === "basic_spotlight") adScore = 1.5;

    // 6. Stock Availability Multiplier
    const stockMultiplier = (item.in_stock !== false && (item.stock_quantity === undefined || item.stock_quantity > 0)) ? 1.0 : 0.2;

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

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ====================================================================
// 4. APP INITIALIZATION & EVENT LISTENERS
// ====================================================================
document.addEventListener("DOMContentLoaded", () => {
    var dbg = document.getElementById("resultsList");
    function showErr(label, e) {
        console.error(label + " error:", e);
        if (dbg) dbg.innerHTML = '<div style="color:red;padding:10px;">' + escapeHtml(label + ' ERROR: ' + (e.message || e)) + '</div>';
    }
    try { initSupabase(); } catch(e) { showErr("initSupabase", e); }
    try { initNavigation(); } catch(e) { showErr("initNavigation", e); }
    try { initDomainTabs(); } catch(e) { showErr("initDomainTabs", e); }
    try { initMap(); } catch(e) { showErr("initMap", e); }
    try { renderSpotlightCarousel(); } catch(e) { showErr("renderSpotlightCarousel", e); }
    try { renderShowcaseSections(); } catch(e) { showErr("renderShowcaseSections", e); }
    try { searchListings(); } catch(e) { showErr("searchListings", e); }
    try { updateUIForAuthUser(); } catch(e) { showErr("updateUIForAuthUser", e); }
});

function initSupabase() {
    if (!DEMO_MODE) {
        try {
            if (typeof window.supabase === 'undefined') {
                console.error("Supabase JS library not loaded! CDN may have failed.");
                var dbg = document.getElementById("resultsList");
                if (dbg) dbg.innerHTML = '<div style="color:red;padding:10px;">Supabase JS library not loaded!</div>';
                return;
            }
            sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log("Supabase client initialized successfully");
            setupAuthListener();
        } catch (err) {
            console.warn("Supabase init failed, falling back to Demo Mode:", err);
            var dbg = document.getElementById("resultsList");
            if (dbg) dbg.innerHTML = '<div style="color:red;padding:10px;">Supabase init failed: ' + escapeHtml(err.message||err) + '</div>';
        }
    } else {
        console.log("Running in Full Demo Mode with pre-populated Tamale marketplace data.");
    }
}

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error("Unhandled promise rejection:", event.reason);
});

function setupAuthListener() {
    if (!sbClient) return;
    sbClient.auth.onAuthStateChange((event, session) => {
        if (session && session.user) {
            currentUser = session.user;
            loadUserProfile(session.user.id);
        } else {
            currentUser = null;
            userProfile = { full_name: "Guest User", account_type: "shopper", verification_tier: "unverified" };
            userFavorites = new Set();
            userShop = null;
            updateUIForGuestUser();
        }
    });
}

async function loadUserProfile(userId) {
    if (!sbClient || !userId) return;
    try {
        const { data, error } = await sbClient
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
            userProfile = {
                full_name: data.full_name || currentUser.email || "User",
                phone: data.phone || "",
                account_type: data.account_type || "shopper",
                verification_tier: data.verification_tier || "unverified",
                preferred_market: data.preferred_market || ""
            };
        } else {
            // Create profile if it doesn't exist
            userProfile = {
                full_name: currentUser.user_metadata?.full_name || currentUser.email || "User",
                phone: currentUser.user_metadata?.phone || "",
                account_type: currentUser.user_metadata?.role || "shopper",
                verification_tier: "unverified"
            };
            await sbClient.from('user_profiles').insert({
                id: userId,
                full_name: userProfile.full_name,
                phone: userProfile.phone,
                account_type: userProfile.account_type
            });
        }
        await loadUserShop(userId);
        await loadUserFavorites(userId);
        updateUIForAuthUser();
    } catch (err) {
        console.error("Error loading profile:", err);
        showToast("Could not load profile data", "error");
    }
}

async function loadUserShop(userId) {
    if (!sbClient || !userId) return;
    try {
        const { data, error } = await sbClient
            .from('shops')
            .select('*')
            .eq('created_by', userId)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        userShop = data || null;
    } catch (err) {
        console.error("Error loading shop:", err);
    }
}

async function loadUserFavorites(userId) {
    if (!sbClient || !userId) return;
    try {
        const { data, error } = await sbClient
            .from('favorites')
            .select('shop_id')
            .eq('user_id', userId);
        if (error) throw error;
        userFavorites = new Set(data.map(f => f.shop_id));
        updateFavoritesBadge();
    } catch (err) {
        console.error("Error loading favorites:", err);
    }
}

function initNavigation() {
    // Menu Drawer Toggle
    const mToggle = document.getElementById("menuToggle");
    if (mToggle) mToggle.addEventListener("click", toggleDrawer);
    const logoGrp = document.getElementById("logoGroup");
    if (logoGrp) logoGrp.addEventListener("click", () => navigateToPage("home"));
    const cDrawer = document.getElementById("closeDrawer");
    if (cDrawer) cDrawer.addEventListener("click", closeDrawer);
    const dBackdrop = document.getElementById("drawerBackdrop");
    if (dBackdrop) dBackdrop.addEventListener("click", closeDrawer);

    // Drawer auth/sign-out button
    const drawerAuthBtn = document.getElementById("drawerAuthActionBtn");
    if (drawerAuthBtn) drawerAuthBtn.addEventListener("click", () => {
        if (currentUser) {
            handleSignOut();
            closeDrawer();
        } else {
            closeDrawer();
            openModal("authModal");
        }
    });

    // Auth Modal Tabs
    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            const tab = btn.dataset.authtab;
            if (tab === 'login') document.getElementById('loginForm').classList.add('active');
            else if (tab === 'register') document.getElementById('registerForm').classList.add('active');
            else if (tab === 'forgot') document.getElementById('forgotForm').classList.add('active');
        });
    });

    // Close auth modal
    const closeAuth = document.getElementById('closeAuthModal');
    if (closeAuth) closeAuth.addEventListener('click', () => closeModal('authModal'));
    const authBackdrop = document.getElementById('authModalBackdrop');
    if (authBackdrop) authBackdrop.addEventListener('click', () => closeModal('authModal'));

    // Auth form submissions
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm) forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!sbClient) { showToast("Demo mode", "error"); return; }
        const email = document.getElementById('forgotEmail').value.trim();
        try {
            const { error } = await sbClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
            if (error) throw error;
            showToast("Reset link sent! Check your email.", "success");
            closeModal('authModal');
        } catch (err) { showToast(err.message || "Could not send reset link", "error"); }
    });

    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) profileForm.addEventListener('submit', handleProfileSave);

    // Shop form
    const shopForm = document.getElementById('shopForm');
    if (shopForm) shopForm.addEventListener('submit', handleSaveShop);

    // Product form
    const productForm = document.getElementById('productForm');
    if (productForm) productForm.addEventListener('submit', handleSaveProduct);

    // Close product modal
    const closeProduct = document.getElementById('closeProductModal');
    if (closeProduct) closeProduct.addEventListener('click', () => closeModal('productModal'));
    const productBackdrop = document.getElementById('productModalBackdrop');
    if (productBackdrop) productBackdrop.addEventListener('click', () => closeModal('productModal'));
    const cancelProduct = document.getElementById('cancelProductBtn');
    if (cancelProduct) cancelProduct.addEventListener('click', () => closeModal('productModal'));

    // Password change
    const changePwdForm = document.getElementById('changePasswordForm');
    if (changePwdForm) changePwdForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!sbClient || !currentUser) { showToast("Sign in first", "error"); return; }
        const newPwd = document.getElementById('newPasswordInput').value;
        const confirmPwd = document.getElementById('confirmPasswordInput').value;
        if (newPwd !== confirmPwd) { showToast("Passwords do not match", "error"); return; }
        try {
            const { error } = await sbClient.auth.updateUser({ password: newPwd });
            if (error) throw error;
            showToast("Password updated successfully!", "success");
            changePwdForm.reset();
        } catch (err) { showToast(err.message || "Could not update password", "error"); }
    });

    // Sign out button
    const signOutBtn = document.getElementById('accountSignOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', handleSignOut);

    // Enable trader role button
    const enableTraderBtn = document.getElementById('enableTraderRoleBtn');
    if (enableTraderBtn) enableTraderBtn.addEventListener('click', enableTraderRole);

    // Close shop modal
    const closeShop = document.getElementById('closeShopModal');
    if (closeShop) closeShop.addEventListener('click', () => closeModal('shopModal'));
    const shopBackdrop = document.getElementById('shopModalBackdrop');
    if (shopBackdrop) shopBackdrop.addEventListener('click', () => closeModal('shopModal'));

    // GPS buttons
    const lookupBtn = document.getElementById('lookupDigitalAddressBtn');
    if (lookupBtn) lookupBtn.addEventListener('click', lookupDigitalAddress);
    const gpsBtn = document.getElementById('getLocationBtn');
    if (gpsBtn) gpsBtn.addEventListener('click', handleGetDeviceLocation);

    // Nav Links
    document.querySelectorAll("[data-nav]").forEach(el => {
        el.addEventListener("click", (e) => {
            e.preventDefault();
            const navTarget = el.getAttribute("data-nav");
            navigateToPage(navTarget);
            closeDrawer();
        });
    });

    // Mobile View Switcher Pill
    const mvToggle = document.getElementById("mobileViewToggle");
    if (mvToggle) mvToggle.addEventListener("click", toggleMobileViewMode);

    // Account Sub-Tabs
    document.querySelectorAll(".acc-tab-btn").forEach(btn => {
        elBtnTab(btn, ".acc-tab-btn", ".acc-tab-content", "data-acctab");
    });

    // Trader Sub-Tabs
    document.querySelectorAll(".trader-subtab-btn").forEach(btn => {
        elBtnTab(btn, ".trader-subtab-btn", ".trader-subtab-content", "data-tradersub");
    });

    // Admin Sub-Tabs
    document.querySelectorAll(".admin-subtab-btn").forEach(btn => {
        elBtnTab(btn, ".admin-subtab-btn", ".admin-tab-content", "data-adminsub");
    });

    // Search Controls
    const searchInput = document.getElementById("searchInput");
    const clearBtn = document.getElementById("clearSearchBtn");

    if (!searchInput) return;
    searchInput.addEventListener("input", () => {
        clearBtn.style.display = searchInput.value.length > 0 ? "block" : "none";
        debounceSearch();
    });

    if (!clearBtn) return;
    clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        clearBtn.style.display = "none";
        searchListings();
    });

    const searchBtn = document.getElementById("searchBtn");
    if (searchBtn) searchBtn.addEventListener("click", searchListings);

    const marketFilter = document.getElementById("marketFilter");
    if (marketFilter) marketFilter.addEventListener("change", searchListings);
    const statusFilter = document.getElementById("statusFilter");
    if (statusFilter) statusFilter.addEventListener("change", searchListings);

    // AI Security Scan button (was in duplicate section)
    const aiScanBtn = document.getElementById("runAiScanBtn");
    if (aiScanBtn) aiScanBtn.addEventListener("click", runAISecurityScan);

}

function elBtnTab(btn, btnSelector, contentSelector, dataAttr) {
    btn.addEventListener("click", () => {
        const target = btn.getAttribute(dataAttr);
        document.querySelectorAll(btnSelector).forEach(b => b.classList.remove("active"));
        document.querySelectorAll(contentSelector).forEach(c => c.classList.remove("active"));
        btn.classList.add("active");
        const targetEl = document.getElementById(contentSelector.replace(".", "") + "-" + target) ||
                         document.getElementById("acctab-" + target) ||
                         document.getElementById("trader-sub-" + target) ||
                         document.getElementById("admin-sub-" + target);
        if (targetEl) targetEl.classList.add("active");

        // Specific tab load triggers
        if (target === "orders") renderTraderOrders();
        if (target === "reviews") renderTraderReviews();
        if (target === "ads") renderTraderAds();
        if (target === "admin") renderAdminPanel();
    });
}

function initDomainTabs() {
    const domainTabs = document.querySelectorAll(".domain-tab");
    domainTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            domainTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            currentDomain = tab.getAttribute("data-domain");
            currentCategory = "";
            renderCategoryPillsForDomain(currentDomain);
            searchListings();
        });
    });
    renderCategoryPillsForDomain("product");
}

function renderCategoryPillsForDomain(domain) {
    const pillsContainer = document.getElementById("categoryPills");
    let categories = [];

    if (domain === "product") {
        categories = ["All Products", "Grains & Cereals", "Meat & Livestock", "Textiles & Smocks", "Electronics & Phones", "Hardware & Building", "Fresh Produce", "Pharmacy & Health", "Cooked Food", "Crafts & Artifacts", "General Goods"];
    } else if (domain === "service") {
        categories = ["All Services", "Auto & Mechanics", "Fashion & Tailoring", "Electrical & Solar", "Barber & Beauty", "Construction & Plumbing", "Logistics & Delivery"];
    } else if (domain === "hotel") {
        categories = ["All Lodging", "Luxury Hotels", "Guest Houses", "Lodges & Resorts", "Hostels"];
    } else if (domain === "eatery") {
        categories = ["All Food Spots", "Tuo Zaafi & Local Buka", "Restaurants & Dining", "Waakye & Rice Spots", "Fast Food & Snacks"];
    } else if (domain === "company") {
        categories = ["All Companies", "Agribusiness & Export", "IT & Tech Hubs", "Financial & Rural Banks", "NGOs & Agencies"];
    }

    pillsContainer.innerHTML = categories.map((cat, idx) => {
        const catVal = idx === 0 ? "" : cat;
        return `<button class="pill ${idx === 0 ? 'active' : ''}" data-category="${catVal}" onclick="selectCategoryPill(this, '${escapeJs(catVal)}')">${cat}</button>`;
    }).join("");
}

function selectCategoryPill(pillBtn, categoryVal) {
    document.querySelectorAll("#categoryPills .pill").forEach(p => p.classList.remove("active"));
    pillBtn.classList.add("active");
    currentCategory = categoryVal;
    searchListings();
}

let debounceTimer = null;
function debounceSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(searchListings, 300);
}

// ====================================================================
// 5. RENDERING HOME SHOWCASE & SPOTLIGHT
// ====================================================================
function renderSpotlightCarousel() {
    const carousel = document.getElementById("spotlightCarousel");
    const spotlightShops = demoStore.shops.filter(s => s.ad_tier === "basic_spotlight" || s.ad_tier === "premium_top");

    if (spotlightShops.length === 0) {
        carousel.innerHTML = `<div class="spotlight-card"><p style="font-size:12px;">🌟 Local merchants: Book a spotlight campaign in your dashboard to feature here!</p></div>`;
        return;
    }

    carousel.innerHTML = spotlightShops.map(s => `
        <div class="spotlight-card" onclick="showShopDetailModal('${escapeJs(s.id)}')">
            <div class="spotlight-card-top">
                <img src="${s.cover_image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e'}" class="spotlight-img" alt="${escapeHtml(s.shop_name)}" />
                <div>
                    <h4 class="spotlight-title">${escapeHtml(s.shop_name)}</h4>
                    <span class="spotlight-area">📍 ${escapeHtml(s.market_area)} • 🇬🇭 ${escapeHtml(s.digital_address || 'Tamale')}</span>
                </div>
            </div>
            <p class="spotlight-desc">${escapeHtml(s.description)}</p>
            <div class="spotlight-action">
                <span>⭐ ${s.rating_avg} (${s.rating_count})</span>
                <button class="spotlight-btn">Visit Stall ➔</button>
            </div>
        </div>
    `).join("");
}

function renderShowcaseSections() {
    // 1. Popular Near You Carousel
    const popularContainer = document.getElementById("popularNearCarousel");
    const popularProducts = [...demoStore.products].sort((a, b) => b.rating_avg - a.rating_avg).slice(0, 5);

    popularContainer.innerHTML = popularProducts.map(p => {
        const shop = demoStore.shops.find(s => s.id === p.shop_id) || {};
        return renderMiniProductCard(p, shop);
    }).join("");

    // 2. New Arrivals Carousel
    const newContainer = document.getElementById("newArrivalsCarousel");
    const newProducts = [...demoStore.products].reverse().slice(0, 5);

    newContainer.innerHTML = newProducts.map(p => {
        const shop = demoStore.shops.find(s => s.id === p.shop_id) || {};
        return renderMiniProductCard(p, shop);
    }).join("");
}

function renderMiniProductCard(p, shop) {
    const isOut = !p.in_stock || p.stock_quantity <= 0;
    return `
        <div class="card ${isOut ? 'card-out-of-stock' : ''}" style="min-width: 200px; max-width: 220px; flex-shrink: 0;">
            <div class="card-img-container" style="height: 110px;">
                <img src="${p.image_url}" class="card-img" alt="${escapeHtml(p.name)}" />
                ${p.badge_tag ? `<span class="badge-tag ${p.badge_tag}" style="position:absolute; top:6px; left:6px;">${p.badge_tag.toUpperCase()}</span>` : ''}
            </div>
            <h4 class="card-title" style="font-size: 13px; line-height: 1.2;">${escapeHtml(p.name)}</h4>
            <div class="price-row">
                <span class="price-amount ${p.discount_price ? 'discount-price' : ''}">GHS ${(p.discount_price || p.price).toFixed(2)}</span>
                ${p.discount_price ? `<span class="original-price">GHS ${p.price.toFixed(2)}</span>` : ''}
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">🏪 ${escapeHtml(shop.shop_name || 'Tamale Trader')}</div>
            <button class="btn-primary btn-sm btn-order" ${isOut ? 'disabled' : ''} onclick="openOrderModal('${escapeJs(p.id)}', '${escapeJs(p.shop_id)}')">
                ${isOut ? 'Out of Stock' : '🛒 Order Now'}
            </button>
        </div>
    `;
}

// ====================================================================
// 6. MAIN SEARCH & FILTERING LOGIC
// ====================================================================
async function searchListings() {
    console.log("searchListings called, DEMO_MODE:", DEMO_MODE, "sbClient:", !!sbClient);
    const resultsList = document.getElementById("resultsList");
    if (resultsList) resultsList.innerHTML = '<div style="padding:10px;">Searching... (DEMO_MODE=' + DEMO_MODE + ', sbClient=' + (!!sbClient) + ')</div>';
    const query = document.getElementById("searchInput").value.toLowerCase().trim();
    const market = document.getElementById("marketFilter").value;
    const status = document.getElementById("statusFilter").value;

    let items = [];

    if (DEMO_MODE || !sbClient) {
        // Demo mode fallback
        if (currentDomain === "product") {
            items = demoStore.products.map(p => {
                const shop = demoStore.shops.find(s => s.id === p.shop_id) || {};
                return {
                    ...p, item_type: "product",
                    shop_name: shop.shop_name, market_area: shop.market_area,
                    digital_address: shop.digital_address, whatsapp_number: shop.whatsapp_number,
                    phone: shop.phone, latitude: shop.latitude, longitude: shop.longitude,
                    verification_tier: shop.verification_tier, is_verified: shop.is_verified, ad_tier: shop.ad_tier
                };
            });
        } else if (currentDomain === "service") {
            items = demoStore.service_listings.map(s => ({ ...s, item_type: "service", shop_name: s.title, market_area: "Tamale Metro" }));
        } else if (currentDomain === "hotel" || currentDomain === "eatery" || currentDomain === "company") {
            const typeMap = { hotel: "hotel", eatery: "restaurant", company: "company" };
            items = demoStore.business_listings.filter(b => b.business_type === typeMap[currentDomain]).map(b => ({ ...b, item_type: currentDomain, shop_name: b.business_name, market_area: b.address }));
        }
    } else {
        // Fetch from Supabase
        try {
            if (currentDomain === "product") {
                const { data: shops, error: shopErr } = await sbClient.from('shops').select('*').eq('is_active', true);
                if (shopErr) throw shopErr;
                const { data: products, error: prodErr } = await sbClient.from('products').select('*');
                if (prodErr) throw prodErr;
                items = products.map(p => {
                    const shop = shops.find(s => s.id === p.shop_id) || {};
                    return {
                        ...p, item_type: "product",
                        shop_name: shop.shop_name, market_area: shop.market_area,
                        digital_address: shop.digital_address, whatsapp_number: shop.whatsapp_number,
                        phone: shop.phone, latitude: shop.latitude, longitude: shop.longitude,
                        verification_tier: shop.verification_tier, is_verified: shop.is_verified,
                        ad_tier: shop.ad_tier, shop_id: p.shop_id
                    };
                });
            } else if (currentDomain === "service") {
                const { data: services, error: srvErr } = await sbClient.from('service_listings').select('*,shops(*)').eq('is_available', true);
                if (srvErr) throw srvErr;
                items = (services || []).map(s => ({ ...s, item_type: "service", shop_name: s.title, market_area: s.service_area || "Tamale Metro" }));
            } else if (currentDomain === "hotel" || currentDomain === "eatery" || currentDomain === "company") {
                const typeMap = { hotel: "hotel", eatery: "restaurant", company: "company" };
                const { data: businesses, error: bizErr } = await sbClient.from('business_listings').select('*').eq('business_type', typeMap[currentDomain]);
                if (bizErr) throw bizErr;
                items = (businesses || []).map(b => ({ ...b, item_type: currentDomain, shop_name: b.business_name, market_area: b.address }));
            }
        } catch (err) {
            console.error("Error fetching listings:", err);
            resultsList.innerHTML = '<div class="empty-state" style="text-align:center;padding:40px;"><p>⚠️ Could not load listings: ' + escapeHtml(err.message||err) + '</p></div>';
            clearMapMarkers();
            return;
        }
    }

    // Apply Filters
    items = items.filter(item => {
        const matchQuery = !query || 
            (item.name && item.name.toLowerCase().includes(query)) ||
            (item.shop_name && item.shop_name.toLowerCase().includes(query)) ||
            (item.description && item.description.toLowerCase().includes(query)) ||
            (item.digital_address && item.digital_address.toLowerCase().includes(query));
        const matchCategory = !currentCategory || item.category === currentCategory || item.sub_category === currentCategory;
        const matchMarket = !market || item.market_area === market;
        let matchStatus = true;
        if (status === "in_stock") matchStatus = item.in_stock && item.stock_quantity > 0;
        if (status === "verified") matchStatus = item.verification_tier === "trusted" || item.verification_tier === "verified" || item.is_verified;
        return matchQuery && matchCategory && matchMarket && matchStatus;
    });

    // Apply Ranking Score & Sort
    items.forEach(item => {
        item._rankScore = calculateSearchRankScore(item, userLocation.latitude, userLocation.longitude);
    });
    items.sort((a, b) => b._rankScore - a._rankScore);

    document.getElementById("resultsCount").textContent = `${items.length} ${currentDomain}s found`;

    if (items.length === 0) {
        resultsList.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px 20px;">
                <p style="font-size: 28px;">🔍</p>
                <h3>No ${currentDomain} listings found</h3>
                <p style="color: var(--text-muted); font-size: 13px;">Try adjusting your search keywords, category pills, or market filters.</p>
            </div>
        `;
        clearMapMarkers();
        return;
    }

    resultsList.innerHTML = items.map(item => {
        if (item.item_type === "product") return renderProductCard(item);
        if (item.item_type === "service") return renderServiceCard(item);
        if (item.item_type === "hotel") return renderHotelCard(item);
        if (item.item_type === "eatery") return renderEateryCard(item);
        if (item.item_type === "company") return renderCompanyCard(item);
        return "";
    }).join("");

    updateMapMarkers(items);
}

// ====================================================================
// 7. DOMAIN CARD RENDERING FUNCTIONS
// ====================================================================
function renderProductCard(p) {
    const isOut = !p.in_stock || p.stock_quantity <= 0;
    const isLow = p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 3);

    let stockPill = `<span class="stock-badge in-stock">🟢 In Stock</span>`;
    if (isOut) stockPill = `<span class="stock-badge out-of-stock">⚫ Out of Stock</span>`;
    else if (isLow) stockPill = `<span class="stock-badge low-stock">🔥 Only ${p.stock_quantity} left!</span>`;

    let verBadge = `<span class="verification-badge unverified">⚪ Unverified</span>`;
    if (p.verification_tier === "trusted") verBadge = `<span class="verification-badge trusted">⭐ Trusted</span>`;
    else if (p.verification_tier === "verified" || p.is_verified) verBadge = `<span class="verification-badge verified">🔵 Verified</span>`;

    let adBadge = "";
    if (p.ad_tier === "premium_top") adBadge = `<span class="badge-tag deal" style="background:#FEF3C7; color:#B45309;">⭐ TOP</span>`;
    else if (p.ad_tier === "basic_spotlight") adBadge = `<span class="badge-tag hot">🔥 SPOTLIGHT</span>`;

    const isFav = userFavorites.has(p.shop_id);

    return `
        <div class="card ${isOut ? 'card-out-of-stock' : ''}">
            <div class="card-badge-row">
                <div style="display:flex; gap:4px; align-items:center;">
                    ${stockPill}
                    ${adBadge}
                </div>
                ${verBadge}
            </div>

            <div class="card-img-container">
                <img src="${p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e'}" class="card-img" alt="${escapeHtml(p.name)}" />
                <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavoriteShop('${escapeJs(p.shop_id)}', event)" title="Bookmark Shop">
                    ${isFav ? '❤️' : '🤍'}
                </button>
                ${p.badge_tag ? `<span class="badge-tag ${p.badge_tag}" style="position:absolute; bottom:8px; left:8px;">${p.badge_tag.toUpperCase()}</span>` : ''}
            </div>

            <h3 class="card-title">${escapeHtml(p.name)}</h3>
            <div class="card-subtitle-shop" onclick="showShopDetailModal('${escapeJs(p.shop_id)}')" style="cursor:pointer;">
                <span>🏪 <strong>${escapeHtml(p.shop_name)}</strong></span>
                <span>• 📍 ${escapeHtml(p.market_area)}</span>
            </div>

            ${p.digital_address ? `<div style="font-size:11px; color:#0369A1; font-weight:600; margin-bottom:6px;">🇬🇭 ${escapeHtml(p.digital_address)}</div>` : ''}

            <div class="price-row">
                <span class="price-amount ${p.discount_price ? 'discount-price' : ''}">GHS ${(p.discount_price || p.price).toFixed(2)}</span>
                ${p.discount_price ? `<span class="original-price">GHS ${p.price.toFixed(2)}</span>` : ''}
            </div>

            <div class="star-rating" style="margin-bottom: 10px;">
                <span>★★★★☆</span> <span>${p.rating_avg || 4.5} (${p.rating_count || 12})</span>
            </div>

            <div class="card-actions-row">
                <button class="btn-whatsapp btn-sm" onclick="openWhatsApp('${escapeJs(p.whatsapp_number)}', '${escapeJs(p.name)}', '${escapeJs(p.shop_name)}')">💬 WhatsApp</button>
                <button class="btn-primary btn-sm btn-order" ${isOut ? 'disabled' : ''} onclick="openOrderModal('${escapeJs(p.id)}', '${escapeJs(p.shop_id)}')">
                    ${isOut ? 'Out of Stock' : '🛒 Order Now'}
                </button>
                <button class="btn-report" onclick="openReportModal('product', '${escapeJs(p.id)}', '${escapeJs(p.name)}')" title="Report listing">🚩</button>
            </div>
        </div>
    `;
}

function renderServiceCard(s) {
    return `
        <div class="card">
            <div class="card-badge-row">
                <span class="stock-badge in-stock">🛠️ Service</span>
                <span class="verification-badge verified">🔵 Verified Provider</span>
            </div>
            <h3 class="card-title" style="margin-top:8px;">${escapeHtml(s.title)}</h3>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">${escapeHtml(s.description)}</p>
            
            <div style="font-size:12px; font-weight:600; color:var(--primary-dark); margin-bottom:4px;">
                💰 Rates: GHS ${s.price_min} - GHS ${s.price_max} (${s.price_type.replace('_', ' ')})
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">
                📍 Coverage: ${s.service_area} • 🕐 ${s.availability_hours}
            </div>

            <div class="card-actions-row">
                <button class="btn-whatsapp btn-sm btn-block" onclick="openWhatsApp('233244123456', '${escapeJs(s.title)}', 'Service Inquiry')">💬 Book / Inquire Service</button>
                <button class="btn-report" onclick="openReportModal('service', '${escapeJs(s.id)}', '${escapeJs(s.title)}')">🚩</button>
            </div>
        </div>
    `;
}

function renderHotelCard(h) {
    return `
        <div class="card">
            <div class="card-badge-row">
                <span class="stock-badge in-stock">🏨 Hotel & Lodging</span>
                <span class="verification-badge trusted">⭐ Top Choice</span>
            </div>
            <div class="card-img-container" style="height: 140px; margin-top: 6px;">
                <img src="${h.cover_image_url}" class="card-img" alt="${escapeHtml(h.business_name)}" />
            </div>
            <h3 class="card-title">${escapeHtml(h.business_name)}</h3>
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">📍 ${escapeHtml(h.address)} • 🇬🇭 ${escapeHtml(h.digital_address)}</div>
            
            <div class="amenities-row">
                ${(h.amenities || []).map(a => `<span class="amenity-badge">${a}</span>`).join("")}
            </div>

            <div class="price-row" style="margin-top:6px;">
                <span class="price-amount" style="font-size:15px; color:var(--accent);">${h.price_range} Category</span>
                <span class="star-rating" style="margin-left:auto;">⭐ ${h.rating_avg} (${h.rating_count})</span>
            </div>

            <div class="card-actions-row" style="margin-top:10px;">
                <button class="btn-primary btn-sm btn-block" onclick="openWhatsApp('${escapeJs(h.whatsapp_number)}', 'Room Booking', '${escapeJs(h.business_name)}')">📞 Call / Reserve Room</button>
            </div>
        </div>
    `;
}

function renderEateryCard(e) {
    return `
        <div class="card">
            <div class="card-badge-row">
                <span class="stock-badge in-stock">🍲 Eatery & Food</span>
                <span class="verification-badge verified">🔵 Verified Spot</span>
            </div>
            <div class="card-img-container" style="height: 130px; margin-top: 6px;">
                <img src="${e.cover_image_url}" class="card-img" alt="${escapeHtml(e.business_name)}" />
            </div>
            <h3 class="card-title">${escapeHtml(e.business_name)}</h3>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">${escapeHtml(e.description)}</p>
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">📍 ${escapeHtml(e.address)} • 🕐 ${escapeHtml(e.opening_hours)}</div>
            
            <div class="card-actions-row">
                <button class="btn-whatsapp btn-sm btn-block" onclick="openWhatsApp('${escapeJs(e.whatsapp_number)}', 'Food Order', '${escapeJs(e.business_name)}')">💬 Order Food / Reserve Table</button>
            </div>
        </div>
    `;
}

function renderCompanyCard(c) {
    return `
        <div class="card">
            <div class="card-badge-row">
                <span class="stock-badge in-stock">🏢 Company / Hub</span>
                <span class="verification-badge trusted">⭐ Registered Agency</span>
            </div>
            <h3 class="card-title" style="margin-top:8px;">${escapeHtml(c.business_name)}</h3>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">${escapeHtml(c.description)}</p>
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">📍 ${escapeHtml(c.address)} • 🇬🇭 ${escapeHtml(c.digital_address)}</div>
            
            <div class="card-actions-row">
                <button class="btn-secondary btn-sm btn-block" onclick="openWhatsApp('${escapeJs(c.whatsapp_number)}', 'B2B Inquiry', '${escapeJs(c.business_name)}')">✉️ Contact Business Office</button>
            </div>
        </div>
    `;
}

// ====================================================================
// 8. LEAFLET MAP ENGINE INTEGRATION
// ====================================================================
function initMap() {
    const mapEl = document.getElementById("map");
    if (!mapEl) return;

    leafletMap = L.map("map").setView([9.4075, -0.8357], 13); // Tamale Central

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(leafletMap);
}

function updateMapMarkers(items) {
    if (!leafletMap) return;
    clearMapMarkers();

    items.forEach(item => {
        if (!item.latitude || !item.longitude) return;

        // Custom Leaflet Marker Styling
        let markerColor = "#0A5C36"; // Standard Green
        if (item.ad_tier === "premium_top") markerColor = "#D97706"; // Gold
        else if (item.verification_tier === "trusted" || item.is_verified) markerColor = "#0284C7"; // Blue

        const markerHtml = `<div style="background-color: ${markerColor}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;">🛒</div>`;
        
        const customIcon = L.divIcon({
            html: markerHtml,
            className: "custom-map-pin",
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const marker = L.marker([item.latitude, item.longitude], { icon: customIcon }).addTo(leafletMap);

        const popupContent = `
            <div style="font-family: sans-serif; padding: 4px; max-width: 200px;">
                <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight:700;">${escapeHtml(item.shop_name || item.name)}</h4>
                <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b;">📍 ${escapeHtml(item.market_area || 'Tamale')}</p>
                ${item.digital_address ? `<p style="margin:0 0 6px 0; font-size:11px; color:#0369A1; font-weight:bold;">🇬🇭 ${escapeHtml(item.digital_address)}</p>` : ''}
                <button onclick="showShopDetailModal('${escapeJs(item.shop_id || item.id)}')" style="width:100%; background:#0A5C36; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">View Stall ➔</button>
            </div>
        `;

        marker.bindPopup(popupContent);
        mapMarkers.push(marker);
    });
}

function clearMapMarkers() {
    mapMarkers.forEach(m => leafletMap.removeLayer(m));
    mapMarkers = [];
}

// ====================================================================
// 9. IN-APP EXPRESS RESERVATION ORDERING SYSTEM
// ====================================================================
let activeOrderProduct = null;

async function openOrderModal(productId, shopId) {
    let product = null;
    let shop = {};

    if (!DEMO_MODE && sbClient) {
        try {
            const { data: prod } = await sbClient.from('products').select('*').eq('id', productId).single();
            product = prod;
            const { data: shopData } = await sbClient.from('shops').select('*').eq('id', shopId).single();
            shop = shopData || {};
        } catch (err) { console.error("Error loading order data:", err); }
    } else {
        product = demoStore.products.find(p => p.id === productId);
        shop = demoStore.shops.find(s => s.id === shopId) || {};
    }

    if (!product) return;
    activeOrderProduct = { product, shop, qty: 1 };

    const modalBody = document.getElementById("orderModalBody");
    const unitPrice = product.discount_price || product.price;

    modalBody.innerHTML = `
        <div style="display:flex; gap:12px; margin-bottom:16px; align-items:center; background:#f8fafc; padding:10px; border-radius:8px;">
            <img src="${product.image_url}" style="width:60px; height:60px; object-fit:cover; border-radius:6px;" />
            <div>
                <h4 style="font-size:15px; font-weight:700; line-height:1.2;">${escapeHtml(product.name)}</h4>
                <div style="font-size:12px; color:var(--text-muted);">🏪 ${escapeHtml(shop.shop_name)} • 📍 ${escapeHtml(shop.market_area)}</div>
                <div style="font-size:14px; font-weight:800; color:var(--primary-dark); margin-top:2px;">GHS ${unitPrice.toFixed(2)} / unit</div>
            </div>
        </div>

        <form id="expressOrderForm" onsubmit="handleOrderSubmit(event)">
            <div class="form-group">
                <label>Select Reservation Quantity (Available Stock: ${product.stock_quantity}):</label>
                <div class="inline-stock-control" style="width:140px; margin-top:4px;">
                    <button type="button" class="stock-btn" onclick="updateOrderModalQty(-1)">-</button>
                    <span class="stock-count-num" id="orderModalQtyDisplay">1</span>
                    <button type="button" class="stock-btn" onclick="updateOrderModalQty(1)">+</button>
                </div>
            </div>

            <div class="form-group">
                <label>Fulfillment Preference:</label>
                <div class="radio-cards">
                    <label class="radio-card">
                        <input type="radio" name="deliveryType" value="pickup" checked onchange="toggleDeliveryAddressField(false)" />
                        <div class="radio-content">
                            <strong>🛍️ Pickup at Stall / Digital Address</strong>
                            <span>Visit shop at 🇬🇭 ${shop.digital_address || 'Tamale Stall'}</span>
                        </div>
                    </label>
                    <label class="radio-card">
                        <input type="radio" name="deliveryType" value="local_delivery" onchange="toggleDeliveryAddressField(true)" />
                        <div class="radio-content">
                            <strong>🚚 Local Delivery in Tamale</strong>
                            <span>Delivery rider brings item to your address (Delivery fee paid to rider)</span>
                        </div>
                    </label>
                </div>
            </div>

            <div class="form-group" id="deliveryAddressGroup" style="display:none;">
                <label for="orderDeliveryAddress">Delivery Address / Landmark *</label>
                <input type="text" id="orderDeliveryAddress" placeholder="e.g. Near Central Hospital Gate, Tamale" />
            </div>

            <div class="form-row-2">
                <div class="form-group">
                    <label for="orderBuyerName">Your Full Name *</label>
                    <input type="text" id="orderBuyerName" value="${userProfile.full_name || ''}" required />
                </div>
                <div class="form-group">
                    <label for="orderBuyerPhone">Phone Number *</label>
                    <input type="tel" id="orderBuyerPhone" value="${userProfile.phone || ''}" required />
                </div>
            </div>

            <div class="form-group">
                <label for="orderBuyerNotes">Notes for Trader (Optional)</label>
                <input type="text" id="orderBuyerNotes" placeholder="e.g. Expected arrival time or color preference..." />
            </div>

            <div class="card" style="background:#fef3c7; border-color:#fcd34d; padding:10px; margin-bottom:14px; font-size:11px; color:#b45309;">
                ℹ️ <strong>Payment Disclaimer:</strong> No online payment charged here. Payment is handled directly between buyer and trader upon stall pickup or delivery (Cash / MoMo).
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <span style="font-weight:600; font-size:14px;">Total Reservation Amount:</span>
                <span style="font-size:18px; font-weight:800; color:var(--primary-dark);" id="orderModalTotalDisplay">GHS ${unitPrice.toFixed(2)}</span>
            </div>

            <button type="submit" class="btn-primary btn-block btn-large">Confirm Express Reservation</button>
        </form>
    `;

    openModal("orderModal");
}

function updateOrderModalQty(delta) {
    if (!activeOrderProduct) return;
    const max = activeOrderProduct.product.stock_quantity;
    let newQty = activeOrderProduct.qty + delta;
    if (newQty < 1) newQty = 1;
    if (newQty > max) newQty = max;

    activeOrderProduct.qty = newQty;
    document.getElementById("orderModalQtyDisplay").textContent = newQty;

    const unitPrice = activeOrderProduct.product.discount_price || activeOrderProduct.product.price;
    document.getElementById("orderModalTotalDisplay").textContent = `GHS ${(unitPrice * newQty).toFixed(2)}`;
}

function toggleDeliveryAddressField(show) {
    document.getElementById("deliveryAddressGroup").style.display = show ? "block" : "none";
}

async function handleOrderSubmit(e) {
    e.preventDefault();
    if (!activeOrderProduct) return;

    const deliveryType = document.querySelector('input[name="deliveryType"]:checked').value;
    const deliveryAddress = document.getElementById("orderDeliveryAddress") ? document.getElementById("orderDeliveryAddress").value : "";
    const buyerName = document.getElementById("orderBuyerName").value;
    const buyerPhone = document.getElementById("orderBuyerPhone").value;
    const buyerNotes = document.getElementById("orderBuyerNotes").value;

    const unitPrice = activeOrderProduct.product.discount_price || activeOrderProduct.product.price;
    const totalAmount = unitPrice * activeOrderProduct.qty;

    const orderNumber = "TMF-" + new Date().getFullYear() + "-" + Math.floor(1000 + Math.random() * 9000);

    const newOrder = {
        id: "ord-" + Date.now(),
        order_number: orderNumber,
        buyer_id: currentUser ? currentUser.id : "guest-user",
        shop_id: activeOrderProduct.shop.id,
        product_id: activeOrderProduct.product.id,
        product_name: activeOrderProduct.product.name,
        unit_price: unitPrice,
        quantity: activeOrderProduct.qty,
        total_amount: totalAmount,
        delivery_type: deliveryType,
        delivery_address: deliveryAddress,
        buyer_name: buyerName,
        buyer_phone: buyerPhone,
        buyer_notes: buyerNotes,
        status: "placed",
        placed_at: new Date().toISOString()
    };

    demoStore.orders.unshift(newOrder);

    // Save to Supabase if available
    if (!DEMO_MODE && sbClient) {
        try {
            await sbClient.from('orders').insert({
                order_number: orderNumber,
                buyer_id: newOrder.buyer_id,
                shop_id: newOrder.shop_id,
                product_id: newOrder.product_id,
                product_name: newOrder.product_name,
                unit_price: newOrder.unit_price,
                quantity: newOrder.quantity,
                total_amount: newOrder.total_amount,
                delivery_type: newOrder.delivery_type,
                delivery_address: newOrder.delivery_address,
                buyer_name: newOrder.buyer_name,
                buyer_phone: newOrder.buyer_phone,
                buyer_notes: newOrder.buyer_notes,
                status: "placed"
            });
        } catch (err) { console.error("Error saving order to Supabase:", err); }
    }

    closeModal("orderModal");
    showToast(`Order ${orderNumber} placed successfully! Trader notified.`, "success");
    navigateToPage("my-orders");
    renderBuyerOrders();
}

// ====================================================================
// 10. TRADER DASHBOARD & INLINE STOCK CONTROL
// ====================================================================
async function updateProductStockInline(productId, delta) {
    const product = demoStore.products.find(p => p.id === productId);
    if (!product) return;

    let newCount = (product.stock_quantity || 0) + delta;
    if (newCount < 0) newCount = 0;

    product.stock_quantity = newCount;
    product.in_stock = newCount > 0;

    // Sync to Supabase if available
    if (!DEMO_MODE && sbClient) {
        try {
            await sbClient.from('products').update({
                stock_quantity: newCount,
                in_stock: newCount > 0
            }).eq('id', productId);
        } catch (err) { console.error("Error updating stock in Supabase:", err); }
    }

    renderTraderProductsList();
    searchListings(); // Refresh main grid
    showToast(`Stock for ${product.name} updated to ${newCount}`, "success");
}

async function renderTraderProductsList() {
    const listEl = document.getElementById("productsList");
    if (!listEl) return;

    let myProducts = [];
    if (!DEMO_MODE && sbClient && userShop) {
        try {
            const { data, error } = await sbClient.from('products').select('*').eq('shop_id', userShop.id);
            if (error) throw error;
            myProducts = data || [];
        } catch (err) { console.error("Error loading products:", err); }
    } else if (DEMO_MODE || !sbClient) {
        myProducts = demoStore.products.filter(p => p.shop_id === "shop-1" || (userShop && p.shop_id === userShop.id));
    }

    if (myProducts.length === 0) {
        listEl.innerHTML = `<p class="form-hint">No items added to your stall inventory yet. Click '+ Add New Product' above!</p>`;
        return;
    }

    listEl.innerHTML = myProducts.map(p => `
        <div class="inventory-item-row">
            <div class="inventory-item-info">
                <div class="inventory-item-title">${escapeHtml(p.name)}</div>
                <div class="inventory-item-meta">GHS ${(p.discount_price || p.price).toFixed(2)} • ${p.category}</div>
            </div>
            <div class="inline-stock-control">
                <button class="stock-btn" onclick="updateProductStockInline('${escapeJs(p.id)}', -1)">-</button>
                <span class="stock-count-num">${p.stock_quantity}</span>
                <button class="stock-btn" onclick="updateProductStockInline('${escapeJs(p.id)}', 1)">+</button>
            </div>
        </div>
    `).join("");
}

async function renderTraderOrders() {
    const container = document.getElementById("traderOrdersList");
    if (!container) return;

    let shopOrders = [];
    if (!DEMO_MODE && sbClient && userShop) {
        try {
            const { data, error } = await sbClient.from('orders').select('*').eq('shop_id', userShop.id).order('created_date', { ascending: false });
            if (error) throw error;
            shopOrders = data || [];
        } catch (err) { console.error("Error loading orders:", err); }
    } else {
        shopOrders = demoStore.orders;
    }

    if (shopOrders.length === 0) {
        container.innerHTML = `<p class="form-hint">No buyer orders received yet.</p>`;
        return;
    }

    container.innerHTML = shopOrders.map(o => `
        <div class="order-card">
            <div class="order-card-header">
                <span class="order-num">${escapeHtml(o.order_number)}</span>
                <span class="order-status-badge status-${o.status}">${o.status.toUpperCase()}</span>
            </div>
            <div class="order-card-body">
                <div><strong>Item:</strong> ${escapeHtml(o.product_name)} (x${o.quantity})</div>
                <div><strong>Buyer:</strong> ${escapeHtml(o.buyer_name)} (${escapeHtml(o.buyer_phone)})</div>
                <div><strong>Total:</strong> GHS ${o.total_amount.toFixed(2)} • <strong>Type:</strong> ${o.delivery_type}</div>
                ${o.buyer_notes ? `<div><em>Note: "${escapeHtml(o.buyer_notes)}"</em></div>` : ''}
            </div>
            <div class="order-card-actions">
                ${o.status === 'placed' ? `
                    <button class="btn-primary btn-sm" onclick="changeOrderStatus('${escapeJs(o.id)}', 'accepted')">Accept Order 👍</button>
                    <button class="btn-danger btn-sm" onclick="changeOrderStatus('${escapeJs(o.id)}', 'rejected')">Reject</button>
                ` : ''}
                ${o.status === 'accepted' ? `<button class="btn-primary btn-sm" onclick="changeOrderStatus('${escapeJs(o.id)}', 'ready')">Mark Ready 📦</button>` : ''}
                ${o.status === 'ready' ? `<button class="btn-primary btn-sm" onclick="changeOrderStatus('${escapeJs(o.id)}', 'completed')">Complete Order ✅</button>` : ''}
            </div>
        </div>
    `).join("");
}

async function changeOrderStatus(orderId, newStatus) {
    const order = demoStore.orders.find(o => o.id === orderId);
    if (!order) return;

    const oldStatus = order.status;
    order.status = newStatus;

    // Sync to Supabase if available
    if (!DEMO_MODE && sbClient) {
        try {
            await sbClient.from('orders').update({ status: newStatus }).eq('id', orderId);
        } catch (err) { console.error("Error updating order status in Supabase:", err); }
    }

    // Stock Management Trigger Logic
    if (newStatus === "accepted" && oldStatus === "placed") {
        const product = demoStore.products.find(p => p.id === order.product_id);
        if (product) {
            product.stock_quantity = Math.max(0, product.stock_quantity - order.quantity);
            product.in_stock = product.stock_quantity > 0;
        }
    } else if ((newStatus === "cancelled" || newStatus === "rejected") && (oldStatus === "accepted" || oldStatus === "ready")) {
        const product = demoStore.products.find(p => p.id === order.product_id);
        if (product) {
            product.stock_quantity += order.quantity;
            product.in_stock = true;
        }
    }

    renderTraderOrders();
    renderBuyerOrders();
    searchListings();
    showToast(`Order ${order.order_number} status updated to ${newStatus}`, "success");
}

async function renderBuyerOrders() {
    const container1 = document.getElementById("buyerOrdersList");
    const container2 = document.getElementById("accountOrdersList");

    const render = (el) => {
        if (!el) return;
        if (demoStore.orders.length === 0) {
            el.innerHTML = `<div class="empty-state"><p>📦 No express order reservations placed yet.</p></div>`;
            return;
        }

        el.innerHTML = demoStore.orders.map(o => `
            <div class="order-card">
                <div class="order-card-header">
                    <span class="order-num">${escapeHtml(o.order_number)}</span>
                    <span class="order-status-badge status-${o.status}">${o.status.toUpperCase()}</span>
                </div>
                <div class="order-card-body">
                    <div><strong>Item:</strong> ${escapeHtml(o.product_name)} (x${o.quantity})</div>
                    <div><strong>Total:</strong> GHS ${o.total_amount.toFixed(2)}</div>
                    <div><strong>Fulfillment:</strong> ${o.delivery_type === 'pickup' ? 'Stall Pickup' : 'Local Delivery'}</div>
                </div>
                <div class="order-card-actions">
                    ${o.status === 'completed' ? `
                        <button class="btn-primary btn-sm" onclick="openReviewModal('${escapeJs(o.id)}', '${escapeJs(o.shop_id)}', '${escapeJs(o.product_id)}')">⭐ Leave Verified Review</button>
                    ` : ''}
                </div>
            </div>
        `).join("");
    };

    render(container1);
    render(container2);
}

// ====================================================================
// 11. REVIEWS & RATINGS ENGINE
// ====================================================================
let activeReviewData = null;

function openReviewModal(orderId, shopId, productId) {
    activeReviewData = { orderId, shopId, productId };
    document.getElementById("reviewOrderId").value = orderId;
    document.getElementById("reviewShopId").value = shopId;
    openModal("reviewModal");
}

function selectStarRating(val) {
    document.getElementById("selectedStarValue").value = val;
    const stars = document.querySelectorAll("#starRatingInput span");
    stars.forEach((s, idx) => {
        if (idx < val) s.classList.add("active");
        else s.classList.remove("active");
    });
}

async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!activeReviewData) return;

    const rating = parseInt(document.getElementById("selectedStarValue").value);
    const comment = document.getElementById("reviewComment").value;

    const newReview = {
        id: "rev-" + Date.now(),
        order_id: activeReviewData.orderId,
        buyer_id: currentUser ? currentUser.id : "user-shopper-1",
        buyer_name: userProfile.full_name || "Verified Buyer",
        shop_id: activeReviewData.shopId,
        product_id: activeReviewData.productId,
        rating,
        comment,
        created_date: new Date().toISOString()
    };

    demoStore.reviews.push(newReview);

    // Save to Supabase if available
    if (!DEMO_MODE && sbClient) {
        try {
            await sbClient.from('reviews').insert({
                order_id: newReview.order_id,
                buyer_id: newReview.buyer_id,
                buyer_name: newReview.buyer_name,
                shop_id: newReview.shop_id,
                product_id: newReview.product_id,
                rating: newReview.rating,
                comment: newReview.comment
            });
        } catch (err) { console.error("Error saving review to Supabase:", err); }
    }

    // Auto recalculate shop rating
    const shopReviews = demoStore.reviews.filter(r => r.shop_id === activeReviewData.shopId);
    const avg = shopReviews.reduce((sum, r) => sum + r.rating, 0) / shopReviews.length;
    const shop = demoStore.shops.find(s => s.id === activeReviewData.shopId);
    if (shop) {
        shop.rating_avg = parseFloat(avg.toFixed(1));
        shop.rating_count = shopReviews.length;
    }

    closeModal("reviewModal");
    showToast("Thank you! Your verified review has been published.", "success");
    searchListings();
}

async function renderTraderReviews() {
    const listEl = document.getElementById("traderReviewsList");
    if (!listEl) return;

    if (demoStore.reviews.length === 0) {
        listEl.innerHTML = `<p class="form-hint">No customer reviews yet.</p>`;
        return;
    }

    listEl.innerHTML = demoStore.reviews.map(r => `
        <div class="card" style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>${r.buyer_name} <span class="verification-badge verified">✓ Verified Buyer</span></strong>
                <span class="star-rating">⭐ ${r.rating}.0</span>
            </div>
            <p style="font-size:13px; margin:6px 0;">"${r.comment}"</p>
            ${r.trader_reply ? `
                <div style="background:#f1f5f9; padding:8px; border-radius:6px; font-size:12px; margin-top:6px;">
                    <strong>Your Reply:</strong> ${r.trader_reply}
                </div>
            ` : `
                <button class="btn-secondary btn-sm" style="margin-top:6px;" onclick="openReplyModal('${r.id}')">💬 Reply to Review</button>
            `}
        </div>
    `).join("");
}

function openReplyModal(reviewId) {
    document.getElementById("replyReviewId").value = reviewId;
    openModal("replyReviewModal");
}

function handleReviewReplySubmit(e) {
    e.preventDefault();
    const revId = document.getElementById("replyReviewId").value;
    const replyText = document.getElementById("traderReplyText").value;

    const review = demoStore.reviews.find(r => r.id === revId);
    if (review) {
        review.trader_reply = replyText;
    }

    closeModal("replyReviewModal");
    renderTraderReviews();
    showToast("Reply posted successfully!", "success");
}

// ====================================================================
// 12. ANTI-FRAUD & MODERATION SYSTEM
// ====================================================================
let reportRateLimit = [];

function openReportModal(targetType, targetId, targetTitle) {
    document.getElementById("reportTargetType").value = targetType;
    document.getElementById("reportTargetId").value = targetId;
    openModal("reportModal");
}

async function handleReportSubmit(e) {
    e.preventDefault();

    // Client-side rate limit: max 3 reports per hour
    const now = Date.now();
    reportRateLimit = reportRateLimit.filter(t => now - t < 3600000);
    if (reportRateLimit.length >= 3) {
        showToast("Rate limit reached. You can submit up to 3 reports per hour.", "warning");
        return;
    }

    const type = document.getElementById("reportTargetType").value;
    const targetId = document.getElementById("reportTargetId").value;
    const category = document.getElementById("reportReasonCategory").value;
    const description = document.getElementById("reportDescription").value;

    const newReport = {
        id: "rep-" + Date.now(),
        reporter_id: currentUser ? currentUser.id : "user-1",
        reported_type: type,
        target_id: targetId,
        reason_category: category,
        description,
        status: "pending",
        created_date: new Date().toISOString()
    };

    demoStore.reports.push(newReport);
    reportRateLimit.push(now);

    // Save to Supabase if available
    if (!DEMO_MODE && sbClient) {
        try {
            await sbClient.from('reports').insert({
                reporter_id: newReport.reporter_id,
                reported_type: newReport.reported_type,
                target_id: newReport.target_id,
                reason_category: newReport.reason_category,
                description: newReport.description,
                status: "pending"
            });
        } catch (err) { console.error("Error saving report to Supabase:", err); }
    }

    closeModal("reportModal");
    showToast("Report submitted to moderation. Thank you for keeping TMF safe!", "success");
}

async function renderAdminPanel() {
    const reportsList = document.getElementById("adminReportsList");
    if (!reportsList) return;

    if (demoStore.reports.length === 0) {
        reportsList.innerHTML = `<p class="form-hint">No pending reports in queue.</p>`;
        return;
    }

    reportsList.innerHTML = demoStore.reports.map(r => `
        <div class="report-queue-card">
            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700;">
                <span>🚩 TYPE: ${r.reported_type.toUpperCase()} • CATEGORY: ${r.reason_category}</span>
                <span>STATUS: ${r.status.toUpperCase()}</span>
            </div>
            <p style="font-size:13px; margin:8px 0;">${escapeHtml(r.description)}</p>
            <div style="display:flex; gap:6px;">
                <button class="btn-secondary btn-sm" onclick="dismissReport('${escapeJs(r.id)}')">Approve & Dismiss</button>
                <button class="btn-danger btn-sm" onclick="takeModerationAction('${escapeJs(r.id)}')">Hide Item / Suspend</button>
            </div>
        </div>
    `).join("");
}

function dismissReport(repId) {
    demoStore.reports = demoStore.reports.filter(r => r.id !== repId);
    renderAdminPanel();
    showToast("Report dismissed.", "success");
}

function takeModerationAction(repId) {
    const report = demoStore.reports.find(r => r.id === repId);
    if (report && report.reported_type === "product") {
        const prod = demoStore.products.find(p => p.id === report.target_id);
        if (prod) prod.in_stock = false;
    }
    dismissReport(repId);
    searchListings();
    showToast("Action taken. Item hidden from public search.", "success");
}

function runAISecurityScan() {
    const SUSPICIOUS = ["wire transfer", "western union", "send money first", "bitcoin", "voodoo", "hacked"];
    let flaggedCount = 0;

    demoStore.products.forEach(p => {
        const text = (p.name + " " + p.description).toLowerCase();
        if (SUSPICIOUS.some(kw => text.includes(kw))) {
            flaggedCount++;
            demoStore.reports.push({
                id: "rep-ai-" + Date.now(),
                reported_type: "product",
                target_id: p.id,
                reason_category: "scam_attempt",
                description: `[AI SCANNER DETECTED]: Suspicious keyword match in "${p.name}"`,
                status: "pending"
            });
        }
    });

    renderAdminPanel();
    showToast(`AI Security Scan completed. ${flaggedCount} suspicious items flagged.`, flaggedCount > 0 ? "warning" : "success");
}

// ====================================================================
// 13. ADVERTISING & SPOTLIGHT SYSTEM
// ====================================================================
let selectedAdTier = "basic_spotlight";

function openAdBookingModal(tier) {
    selectedAdTier = tier;
    document.getElementById("adTierSelect").value = tier;
    updateAdFeeDisplay();
    openModal("adModal");
}

function updateAdFeeDisplay() {
    const tier = document.getElementById("adTierSelect").value;
    const duration = parseInt(document.getElementById("adDuration").value);
    
    let baseRate = 25.00;
    if (tier === "category_featured") baseRate = 40.00;
    if (tier === "premium_top") baseRate = 70.00;

    const weeks = duration / 7;
    const total = baseRate * weeks;
    document.getElementById("adCalculatedFee").textContent = `GHS ${total.toFixed(2)}`;
}

async function handleAdBookingSubmit(e) {
    e.preventDefault();
    const tier = document.getElementById("adTierSelect").value;
    const momoRef = document.getElementById("adMomoRef").value;

    const newAd = {
        id: "ad-" + Date.now(),
        trader_id: currentUser ? currentUser.id : "trader-1",
        shop_id: "shop-1",
        ad_tier: tier,
        fee_paid_ghs: 25.00,
        payment_reference: momoRef,
        status: "pending"
    };

    demoStore.ad_placements.push(newAd);

    // Save to Supabase if available
    if (!DEMO_MODE && sbClient) {
        try {
            await sbClient.from('ad_placements').insert({
                trader_id: newAd.trader_id,
                shop_id: newAd.shop_id,
                ad_tier: newAd.ad_tier,
                fee_paid_ghs: newAd.fee_paid_ghs,
                payment_reference: newAd.payment_reference,
                status: "pending"
            });
        } catch (err) { console.error("Error saving ad to Supabase:", err); }
    }

    closeModal("adModal");
    renderTraderAds();
    showToast("Ad campaign application submitted! Admin approval pending.", "success");
}

function renderTraderAds() {
    const container = document.getElementById("traderAdPlacementsList");
    if (!container) return;

    if (demoStore.ad_placements.length === 0) {
        container.innerHTML = `<p class="form-hint">No active spotlight campaigns.</p>`;
        return;
    }

    container.innerHTML = demoStore.ad_placements.map(a => `
        <div class="card" style="margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>📢 ${a.ad_tier.toUpperCase()}</strong>
                <span class="order-status-badge status-${a.status}">${a.status}</span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                Ref: ${escapeHtml(a.payment_reference || 'N/A')} • Fee: GHS ${a.fee_paid_ghs}
            </div>
        </div>
    `).join("");
}

// ====================================================================
// 14. SHOP DETAIL MODAL & FAVORITES
// ====================================================================
function showShopDetailModal(shopId) {
    const shop = demoStore.shops.find(s => s.id === shopId) || {};
    const shopProducts = demoStore.products.filter(p => p.shop_id === shopId);
    const shopReviews = demoStore.reviews.filter(r => r.shop_id === shopId);

    const modalBody = document.getElementById("modalBody");
    modalBody.innerHTML = `
        <div class="shop-modal-header" style="margin-bottom:16px;">
            <img src="${shop.cover_image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e'}" style="width:100%; height:180px; object-fit:cover; border-radius:10px; margin-bottom:12px;" />
            <h2 style="font-size:22px; font-weight:800;">${escapeHtml(shop.shop_name)}</h2>
            <div style="font-size:13px; color:var(--text-muted);">📍 ${escapeHtml(shop.address || shop.market_area)} • 🇬🇭 ${escapeHtml(shop.digital_address || 'NT-092-0621')}</div>
            <div class="star-rating" style="margin-top:6px;">⭐ ${shop.rating_avg || 4.8} (${shop.rating_count || 12} customer reviews)</div>
        </div>

        <h3>In-Stock Items at this Stall</h3>
        <div class="results-grid" style="margin:12px 0 20px 0;">
            ${shopProducts.map(p => renderProductCard(p)).join("")}
        </div>

        <h3>Verified Customer Reviews</h3>
        <div style="margin-top:8px;">
            ${shopReviews.length === 0 ? `<p class="form-hint">No customer reviews yet for this stall.</p>` : shopReviews.map(r => `
                <div style="background:#f8fafc; padding:10px; border-radius:8px; margin-bottom:8px; font-size:13px;">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>${escapeHtml(r.buyer_name)}</strong>
                        <span class="star-rating">⭐ ${r.rating}.0</span>
                    </div>
                    <p style="margin:4px 0;">"${escapeHtml(r.comment)}"</p>
                </div>
            `).join("")}
        </div>
    `;

    openModal("shopModal");
}

async function toggleFavoriteShop(shopId, e) {
    if (e) e.stopPropagation();
    if (userFavorites.has(shopId)) userFavorites.delete(shopId);
    else userFavorites.add(shopId);

    updateFavoritesBadge();
    searchListings();
    showToast(userFavorites.has(shopId) ? "Shop saved to bookmarks!" : "Shop removed from bookmarks", "success");
}

function updateFavoritesBadge() {
    const badge = document.getElementById("favCountBadge");
    const dot = document.getElementById("favDotBadge");
    if (badge) badge.textContent = userFavorites.size;
    if (dot) dot.style.display = userFavorites.size > 0 ? "block" : "none";
}

// ====================================================================
// 15. GHANA POST GPS ADDRESS GELEOMATION API
// ====================================================================
function lookupDigitalAddress() {
    const code = document.getElementById("shopDigitalAddress").value.toUpperCase().trim();
    if (!code) {
        showToast("Please enter a digital address code (e.g. NT-092-0621)", "warning");
        return;
    }

    showToast("Querying Ghana Post GPS API...", "success");
    // Mock Ghana Post GPS geocoding offset
    const lat = 9.4075 + (Math.random() - 0.5) * 0.02;
    const lng = -0.8357 + (Math.random() - 0.5) * 0.02;

    document.getElementById("shopLat").value = lat.toFixed(6);
    document.getElementById("shopLng").value = lng.toFixed(6);
    document.getElementById("locationStatus").textContent = `GPS Pin: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    showToast(`Ghana Post GPS location found for ${code}`, "success");
}

function handleGetDeviceLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            document.getElementById("shopLat").value = lat.toFixed(6);
            document.getElementById("shopLng").value = lng.toFixed(6);
            document.getElementById("shopDigitalAddress").value = "NT-092-" + Math.floor(1000 + Math.random() * 9000);
            document.getElementById("locationStatus").textContent = `GPS Pin: Auto-Detected`;
            showToast("Device location acquired and Ghana Post code generated!", "success");
        }, err => {
            showToast("Could not acquire device location. Using default Tamale Central pin.", "warning");
        });
    }
}

// ====================================================================
// 16. USER PROFILE & UI HELPER ACTIONS
// ====================================================================
function navigateToPage(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".drawer-item").forEach(d => d.classList.remove("active"));
    document.querySelectorAll(".bottom-nav-item").forEach(b => b.classList.remove("active"));

    const targetPage = document.getElementById("page-" + pageId);
    if (targetPage) targetPage.classList.add("active");

    const drawerItem = document.querySelector(`.drawer-item[data-nav="${pageId}"]`);
    if (drawerItem) drawerItem.classList.add("active");

    const bottomItem = document.querySelector(`.bottom-nav-item[data-nav="${pageId}"]`);
    if (bottomItem) bottomItem.classList.add("active");

    if (pageId === "my-orders") renderBuyerOrders();
    if (pageId === "favorites") renderFavoritesPage();
}

function toggleMobileViewMode() {
    const container = document.getElementById("resultsContainer");
    const icon = document.getElementById("viewToggleIcon");
    const text = document.getElementById("viewToggleText");

    if (mobileViewMode === "list") {
        mobileViewMode = "map";
        container.classList.add("map-active");
        icon.textContent = "📋";
        text.textContent = "View List";
        if (leafletMap) leafletMap.invalidateSize();
    } else {
        mobileViewMode = "list";
        container.classList.remove("map-active");
        icon.textContent = "🗺️";
        text.textContent = "View Map";
    }
}

function toggleDrawer() {
    document.getElementById("menuDrawer").classList.toggle("active");
    document.getElementById("drawerBackdrop").classList.toggle("active");
}

function closeDrawer() {
    document.getElementById("menuDrawer").classList.remove("active");
    document.getElementById("drawerBackdrop").classList.remove("active");
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active");
}

function openWhatsApp(number, itemName, shopName) {
    const num = number ? number.replace(/[^0-9]/g, "") : "233244123456";
    const msg = encodeURIComponent(`Hello! I saw ${itemName} at ${shopName} on Tamale Market Finder and would like to make an inquiry.`);
    window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
}

async function enableTraderRole() {
    userProfile.account_type = "trader";
    const traderRadio = document.getElementById("roleTrader");
    if (traderRadio) traderRadio.checked = true;
    if (!DEMO_MODE && sbClient && currentUser) {
        try {
            await sbClient.from('user_profiles').update({ account_type: "trader" }).eq('id', currentUser.id);
        } catch (err) { console.error("Error updating role:", err); }
    }
    updateUIForAuthUser();
    showToast("Trader role enabled! Fill in your stall details below.", "success");
}

function updateUIForAuthUser() {
    document.getElementById("drawerName").textContent = userProfile.full_name || "User";
    document.getElementById("navUserName").textContent = (userProfile.full_name || "Account").split(" ")[0];
    document.getElementById("drawerEmail").textContent = currentUser?.email || "Sign in to save shops, order & manage listings";

    // Update role badge
    const roleBadge = document.getElementById("drawerRoleBadge");
    if (roleBadge) {
        roleBadge.textContent = userProfile.account_type || "Shopper";
        roleBadge.className = "role-badge " + (userProfile.account_type || "shopper");
    }

    // Update auth button text
    const authBtn = document.getElementById("drawerAuthActionBtn");
    if (authBtn) {
        authBtn.innerHTML = currentUser
            ? '<span class="drawer-icon">🚪</span> Sign Out'
            : '<span class="drawer-icon">🔑</span> Sign In / Register';
    }

    // Show/hide trader dashboard
    const upgradePrompt = document.getElementById("trader-upgrade-prompt");
    const dashContent = document.getElementById("trader-dashboard-content");
    if (userProfile.account_type === "trader") {
        if (upgradePrompt) upgradePrompt.style.display = "none";
        if (dashContent) dashContent.style.display = "block";
    } else {
        if (upgradePrompt) upgradePrompt.style.display = "block";
        if (dashContent) dashContent.style.display = "none";
    }

    // Fill profile form if elements exist
    const profName = document.getElementById("profName");
    if (profName) profName.value = userProfile.full_name || "";
    const profEmail = document.getElementById("profEmail");
    if (profEmail && currentUser) profEmail.value = currentUser.email || "";
    const profPhone = document.getElementById("profPhone");
    if (profPhone) profPhone.value = userProfile.phone || "";
    const profMarket = document.getElementById("profPreferredMarket");
    if (profMarket) profMarket.value = userProfile.preferred_market || "";
    const roleRadio = document.getElementById("role" + (userProfile.account_type || "shopper").charAt(0).toUpperCase() + (userProfile.account_type || "shopper").slice(1));
    if (roleRadio) roleRadio.checked = true;

    // Fill shop form if shop exists
    if (userShop) {
        const sn = document.getElementById("shopName"); if (sn) sn.value = userShop.shop_name || "";
        const sc = document.getElementById("shopCategory"); if (sc) sc.value = userShop.category || "";
        const sma = document.getElementById("shopMarketArea"); if (sma) sma.value = userShop.market_area || "";
        const sda = document.getElementById("shopDigitalAddress"); if (sda) sda.value = userShop.digital_address || "";
        const sa = document.getElementById("shopAddress"); if (sa) sa.value = userShop.address || "";
        const sp = document.getElementById("shopPhone"); if (sp) sp.value = userShop.phone || "";
        const sw = document.getElementById("shopWhatsapp"); if (sw) sw.value = userShop.whatsapp_number || "";
        const slat = document.getElementById("shopLat"); if (slat) slat.value = userShop.latitude || "";
        const slng = document.getElementById("shopLng"); if (slng) slng.value = userShop.longitude || "";
    }

    renderTraderProductsList();
    renderTraderOrders();
    renderTraderReviews();
    updateFavoritesBadge();
}

function updateUIForGuestUser() {
    document.getElementById("drawerName").textContent = "Guest User";
    document.getElementById("navUserName").textContent = "Account";
    document.getElementById("drawerEmail").textContent = "Sign in to save shops, order & manage listings";
    const roleBadge = document.getElementById("drawerRoleBadge");
    if (roleBadge) { roleBadge.textContent = "Shopper"; roleBadge.className = "role-badge shopper"; }
    const authBtn = document.getElementById("drawerAuthActionBtn");
    if (authBtn) authBtn.innerHTML = '<span class="drawer-icon">🔑</span> Sign In / Register';
}

function showToast(msg, type = "success") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3500);
}

async function handleLogin(e) {
    e.preventDefault();
    if (!sbClient) { showToast("Demo mode - auth not available", "error"); return; }
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const btn = document.getElementById("loginBtn");
    btn.textContent = "Signing in..."; btn.disabled = true;
    try {
        const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        closeModal("authModal");
        showToast("Signed in successfully!", "success");
    } catch (err) {
        showToast(err.message || "Login failed", "error");
    } finally {
        btn.textContent = "Sign In"; btn.disabled = false;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    if (!sbClient) { showToast("Demo mode - auth not available", "error"); return; }
    const fullName = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const password = document.getElementById("regPassword").value;
    const role = document.getElementById("regRole").value;
    const btn = document.getElementById("registerBtn");
    btn.textContent = "Creating account..."; btn.disabled = true;
    try {
        const { data, error } = await sbClient.auth.signUp({
            email, password,
            options: { data: { full_name: fullName, phone: phone, role: role } }
        });
        if (error) throw error;
        // Create user_profile
        if (data.user) {
            await sbClient.from('user_profiles').insert({
                id: data.user.id, full_name: fullName, phone: phone, account_type: role
            });
        }
        closeModal("authModal");
        showToast("Account created! Check your email to confirm.", "success");
    } catch (err) {
        showToast(err.message || "Registration failed", "error");
    } finally {
        btn.textContent = "Create Free Account"; btn.disabled = false;
    }
}

async function handleProfileSave(e) {
    e.preventDefault();
    if (!sbClient || !currentUser) { showToast("Sign in first", "error"); return; }
    const fullName = document.getElementById("profName").value.trim();
    const phone = document.getElementById("profPhone").value.trim();
    const preferredMarket = document.getElementById("profPreferredMarket").value;
    const role = document.querySelector('input[name="accountRole"]:checked')?.value || "shopper";
    try {
        const { error } = await sbClient.from('user_profiles').upsert({
            id: currentUser.id, full_name: fullName, phone: phone,
            preferred_market: preferredMarket, account_type: role,
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
        userProfile.full_name = fullName;
        userProfile.phone = phone;
        userProfile.account_type = role;
        userProfile.preferred_market = preferredMarket;
        updateUIForAuthUser();
        showToast("Profile details saved successfully!", "success");
    } catch (err) {
        showToast(err.message || "Could not save profile", "error");
    }
}

async function handleSaveShop(e) {
    e.preventDefault();
    if (!sbClient || !currentUser) { showToast("Sign in first", "error"); return; }
    const shopData = {
        created_by: currentUser.id,
        owner_name: userProfile.full_name,
        shop_name: document.getElementById("shopName").value.trim(),
        category: document.getElementById("shopCategory").value,
        market_area: document.getElementById("shopMarketArea").value,
        digital_address: document.getElementById("shopDigitalAddress").value.trim(),
        address: document.getElementById("shopAddress").value.trim(),
        phone: document.getElementById("shopPhone").value.trim(),
        whatsapp_number: document.getElementById("shopWhatsapp").value.trim(),
        opening_hours: document.getElementById("shopHours")?.value?.trim() || "",
        description: document.getElementById("shopDescription")?.value?.trim() || "",
        latitude: parseFloat(document.getElementById("shopLat").value) || null,
        longitude: parseFloat(document.getElementById("shopLng").value) || null,
        is_active: true,
        updated_date: new Date().toISOString()
    };
    try {
        if (userShop) {
            const { error } = await sbClient.from('shops').update(shopData).eq('id', userShop.id);
            if (error) throw error;
        } else {
            const { data, error } = await sbClient.from('shops').insert(shopData).select().single();
            if (error) throw error;
            userShop = data;
        }
        showToast("Market stall details saved!", "success");
    } catch (err) {
        showToast(err.message || "Could not save shop details", "error");
    }
}

async function handleSaveProduct(e) {
    e.preventDefault();
    if (!sbClient || !currentUser) { showToast("Sign in first", "error"); return; }
    if (!userShop) { showToast("Create your shop stall first", "error"); return; }
    const productId = document.getElementById("productId").value;
    const productData = {
        shop_id: userShop.id,
        name: document.getElementById("productName").value.trim(),
        category: document.getElementById("productCategory").value.trim(),
        price: parseFloat(document.getElementById("productPrice").value) || 0,
        discount_price: parseFloat(document.getElementById("productDiscountPrice").value) || null,
        badge_tag: document.getElementById("productBadgeTag").value || null,
        stock_quantity: parseInt(document.getElementById("productStockQuantity").value) || 0,
        low_stock_threshold: parseInt(document.getElementById("productLowStockThreshold").value) || 3,
        description: document.getElementById("productDescription").value.trim(),
        image_url: document.getElementById("productImage").value.trim(),
        in_stock: document.getElementById("productInStock").checked,
        listing_type: "product"
    };
    try {
        if (productId) {
            const { error } = await sbClient.from('products').update(productData).eq('id', productId);
            if (error) throw error;
        } else {
            const { error } = await sbClient.from('products').insert(productData);
            if (error) throw error;
        }
        closeModal("productModal");
        showToast("Product item saved!", "success");
        renderTraderProductsList();
    } catch (err) {
        showToast(err.message || "Could not save product", "error");
    }
}

async function handleSignOut() {
    if (sbClient) {
        await sbClient.auth.signOut();
    }
    currentUser = null;
    userProfile = { full_name: "Guest User", account_type: "shopper", verification_tier: "unverified" };
    userFavorites = new Set();
    userShop = null;
    updateUIForGuestUser();
    showToast("Signed out of account", "success");
}

async function renderFavoritesPage() {
    const list = document.getElementById("favoritesList");
    if (!list) return;

    if (userFavorites.size === 0) {
        list.innerHTML = `<div class="empty-state"><p>❤️ No bookmarked shops yet.</p></div>`;
        return;
    }

    let favShops = [];
    if (!DEMO_MODE && sbClient) {
        try {
            const favIds = Array.from(userFavorites);
            const { data, error } = await sbClient.from('shops').select('*').in('id', favIds);
            if (error) throw error;
            favShops = data || [];
        } catch (err) {
            favShops = demoStore.shops.filter(s => userFavorites.has(s.id));
        }
    } else {
        favShops = demoStore.shops.filter(s => userFavorites.has(s.id));
    }

    list.innerHTML = favShops.map(s => `
        <div class="card" onclick="showShopDetailModal('${escapeJs(s.id)}')">
            <h3 class="card-title">${escapeHtml(s.shop_name)}</h3>
            <p style="font-size:12px; color:var(--text-muted);">📍 ${escapeHtml(s.market_area)} • 🇬🇭 ${escapeHtml(s.digital_address || '')}</p>
        </div>
    `).join("");
}
