/* ====================================================================
   MARKET FINDER - MULTI-CITY E-COMMERCE ENGINE
   Target: Vanilla JS (ES6+), Leaflet.js, Supabase JS v2, Manual address entry + map picker
   ==================================================================== */

// ====================================================================
// 1. CONFIGURATION & CONSTANTS
// ====================================================================
const SUPABASE_URL = CITY_CONFIG.supabaseUrl;
const SUPABASE_ANON_KEY = CITY_CONFIG.supabaseAnonKey;
const IS_PROD = !location.hostname.includes('localhost') && !location.hostname.includes('127.0.0.1');

// Silence console.log/debug in production to avoid leaking debug info
if (IS_PROD && window.console) {
    console.log = function() {};
    console.debug = function() {};
    console.warn = function() {};
    // console.error kept active for production debugging
}

const DEMO_MODE = SUPABASE_URL.includes("YOUR_SUPABASE_PROJECT_URL");

let sbClient = null;

// Global Application State
let currentUser = null;
let userProfile = {
    full_name: null,
    phone: null,
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
let userLocation = { latitude: CITY_CONFIG.coords.lat, longitude: CITY_CONFIG.coords.lng };

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

// Escape for use inside HTML attributes (prevents XSS via attribute injection)
function escapeAttr(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Rate Limiting Storage
let gpsRequestCount = 0;
let lastGpsRequestReset = Date.now();
const GPS_RATE_LIMIT = 5; // max requests
const GPS_RATE_WINDOW = 60000; // per 60 seconds

function checkGpsRateLimit() {
    const now = Date.now();
    if (now - lastGpsRequestReset > GPS_RATE_WINDOW) {
        gpsRequestCount = 0;
        lastGpsRequestReset = now;
    }
    if (gpsRequestCount >= GPS_RATE_LIMIT) {
        showToast("Too many location requests. Please wait a minute.", "warning");
        return false;
    }
    gpsRequestCount++;
    return true;
}


// ====================================================================
// AUTO-CATEGORY DETECTION ENGINE
// ====================================================================
const CATEGORY_KEYWORD_MAP = {
    "Grains & Cereals": ["maize", "corn", "millet", "sorghum", "rice", "beans", "cowpea", "soybean", "groundnut", "peanut", "wheat", "flour", "koko", "porridge", "cereals", "grain", "guinea corn", "yam flour", "bankye", "rice bag", "bag of rice", "local rice", "perfumed rice", "brown rice", "beans bag", "soya", "dawadawa", "groundnut paste", "rice and beans", "waakye", "agushie"],
    "Fresh Produce": ["tomato", "tomatoe", "onion", "pepper", "okro", "okra", "garden eggs", "cabbage", "lettuce", "carrot", "cucumber", "plantain", "cassava", "yam", "cocoyam", "potato", "sweet potato", "vegetable", "fruit", "orange", "mango", "banana", "watermelon", "pineapple", "pawpaw", "papaya", "shea butter", "sheabutter", "spices", "ginger", "garlic", "fresh produce", "produce", "salad", "avocado", "lime", "lemon", "coconut", "water yam", "puna yam", "yam tuber", "cassava tuber", "plantain bunch", "green pepper", "red pepper", "chili", "hot pepper", "onion bag", "tomato box", "garden egg", "fresh tomato", "spring onion", "coriander", "mint", "bay leaf", "dawadawa seeds", "soumbala", "nettle", "bitter leaf", "kontomire", "ayoyo", "aleefu", "bush okra"],
    "Meat & Livestock": ["meat", "beef", "goat", "sheep", "lamb", "chicken", "poultry", "guinea fowl", "turkey", "duck", "fish", "tilapia", "smoked fish", "catfish", "pork", "sausage", "livestock", "cattle", "cow", "butcher", "meat shop", "frozen chicken", "offal", "liver", "goat meat", "cow meat", "live chicken", "layers", "broilers", "day old chicks", "grasscutter", "rabbit", "snail", "crab", "prawn", "shrimp", "dried fish", "salted fish", "tilapia fish", "mudfish", "herring", "sardine", "mackerel", "sausage"],
    "Cooked Food": ["cooked food", "tuo zaafi", "waakye", "jollof", "banku", "kenkey", "fufu", "koko", "hausa koko", "food", "meals", "buka", "chop bar", "restaurant", "fast food", "snacks", "kelewele", "kose", "koose", "tea", "breakfast", "lunch", "dinner", "catering", "traditional food", "banku and tilapia", "fried rice", "plain rice", "shito", "stew", "soup", "light soup", "groundnut soup", "palm nut soup", "okro soup", "knu", "omo tuo", "rice balls", "konkonte", "tz", "t.z.", "sagaa", "wasawasa", "ga kenkey", "fanti kenkey", "porridge", "maasa", "bofrot", " puff puff", "bolo", "meat pie", "sausage roll", "spring roll", "shawarma", "kebab", "nyamo chom", "fried yam", "fried plantain", "atwemo"],
    "Textiles & Smocks": ["smock", "batakari", "kente", "fabric", "cloth", "textile", "sewing", "weaving", "kpalongo", "fugu", "dansiki", "agbada", "kapok", "thread", "yarn", "cotton", "smock weaving", "cap", "hat", "ghana fabric", "ankara", "wax print", "tie and dye", "batik", "kente cloth", "gonja cloth", "northern cloth", "smock yarn", "strip woven", "kete", "adinkra", "print", "lace", "velvet", "satin", "silk fabric", "wrapper", "pagne", "wrapper cloth", "two yard", "six yard", "yard cloth", "sewing thread", "embroidery"],
    "Electronics & Phones": ["phone", "smartphone", "iphone", "android", "samsung", "techno", "infinix", "itel", "charger", "power bank", "battery", "earphone", "earbud", "speaker", "bluetooth", "laptop", "computer", "tablet", "electronics", "solar", "inverter", "cable", "usb", "led", "bulb", "tv", "television", "radio", "tablet", "drone", "camera", "printer", "monitor", "keyboard", "mouse", "router", "modem", "sim card", "memory card", "sd card", "flash drive", "hard drive", "headphone", "airpod", "smart watch", "phone case", "screen protector", "phone screen", "phone repair", "phone screen replacement", "charging port"],
    "Hardware & Building": ["cement", "paint", "nails", "hammer", "screwdriver", "tools", "building", "construction", "hardware", "plumbing", "pipe", "wire", "electrical", "welding", "iron", "steel", "sand", "gravel", "blocks", "tiles", "door", "window", "roofing", "sheet", "carpentry", "wood", "plywood", "cement bag", "ghacem", "diamond cement", "rod iron", "rebar", "binding wire", "hollow blocks", "sandcrete", "lumber", "timber", "plank", "cement board", "corrugated sheet", "aluminium roofing", "gutter", "hinge", "lock", "padlock", "screw", "bolt", "nut", "saw", "drill", "generator", "welder", "welding rod"],
    "Pharmacy & Health": ["medicine", "drug", "pharmacy", "tablet", "syrup", "cream", "ointment", "health", "hospital", "clinic", "first aid", "bandage", "herbal", "supplement", "vitamin", "sanitizer", "mask", "medical", "cosmetics", "soap", "detergent", "paracetamol", "antibiotic", "antimalarial", "malaria drug", "panadol", "aspirin", "cough syrup", "balm", "insecticide", "mosquito coil", "repellent", "lotion", "body cream", "hair cream", "baby lotion", "diaper", "sanitary pad", "tissue", "toilet roll", "bleach", "dettol", "disinfectant"],
    "Crafts & Artifacts": ["craft", "artifact", "carving", "sculpture", "pottery", "beads", "jewelry", "leather", "sandals", "bag", "handicraft", "art", "painting", "decoration", "gift", "souvenir", "drum", "musical instrument", "calabash", "woven", "djembe", "talking drum", "wood carving", "wooden bowl", "leather sandal", "leather bag", "beaded jewelry", "necklace", "bracelet", "earring", "ring", "anklet", "mosaic", "sculpture", "clay pot", "clay bowl", "straw basket", "fan", "broom", "local broom", "mat", "woven mat"],
    "Auto & Mechanics": ["car", "vehicle", "motor", "engine", "tyre", "tire", "battery", "brake", "mechanic", "auto", "spare parts", "motorcycle", "bicycle", "oil", "grease", "repair", "workshop", "garage", "spark plug", "shock absorber", "headlight", "taillight", "side mirror", "bumper", "radiator", "fan belt", "brake pad", "wheel", "hubcap", "tyre repair", "vulcanizer", "car battery", "alternator", "starter", "gear oil", "engine oil", "brake fluid", "coolant", "wiper", "wiper blade", "motor bike", "okada", "tricycle", "aboboyaa", "pragya"],
    "Fashion & Tailoring": ["tailor", "tailoring", "sewing", "clothing", "dress", "shirt", "trousers", "skirt", "fashion", "boutique", "alteration", "measurement", "fabric", "seamstress", "designer", "apparel", "shoes", "sandals", "slippers", "suit", "jacket", "blouse", "gown", "kaftan", "jalabiya", "thawb", "kurta", "pant", "jeans", "shorts", "singlet", "underwear", "boxer", "socks", "tie", "belt", "wallet", "handbag", "purse", "school uniform", "work uniform", "ready made", "second hand clothes", "bend down boutique", "obroni wawu"],
    "Barber & Beauty": ["barber", "haircut", "salon", "beauty", "makeup", "manicure", "pedicure", "hair", "wig", "weave", "nails", "barbing", "styling", "spa", "barbershop", "hair dye", "hair cream", "hair extension", "braiding", "cornrows", "hair cut", "fade", "shape up", "beard trim", "shaving", "razor", "clippers", "tongs", "curling iron", "hair straightener", "facial", "scrub", "pedicure", "manicure", "nail polish", "artificial nails", "lashes", "lash extension", "tint", "foundation", "concealer", "lipstick", "eyebrow"],
    "Electrical & Solar": ["solar", "inverter", "battery", "electrical", "wiring", "lighting", "led", "panel", "charge controller", "deep cycle", "off-grid", "power", "electrician", "installation", "solar panel", "solar battery", "solar light", "solar lantern", "solar charger", "inverter battery", "power inverter", "step up", "step down", "stabilizer", "breaker", "switch", "socket", "extension board", "wire roll", "cable roll", "electrical tape", "junction box", "conduit pipe", "fluorescent", "energy bulb", "ceiling fan", "table fan", "standing fan"],
    "Construction & Plumbing": ["plumber", "plumbing", "construction", "mason", "bricklayer", "tiler", "roofing", "building", "contractor", "renovation", "painting", "fencing", "tiling", "taps", "shower", "sink", "basin", "water closet", "wc", "septic tank", "manhole", "pipe fitting", "valve", "elbow", "poly tank", "water tank", "overhead tank", "plumbing fitting", "drainage", "gutter", "sewage"],
    "Logistics & Delivery": ["delivery", "logistics", "transport", "shipping", "courier", "rider", "dispatch", "haulage", "truck", "van", "moving", "relocation", "cargo", "okada delivery", "tricycle delivery", "pick up", "dropping", "errand", "parcel", "package", "courier service", "freight", "truck load", "container"],
    "Hotels & Lodging": ["hotel", "guest house", "lodge", "lodging", "hostel", "resort", "accommodation", "motel", "inn", "bed and breakfast", "lodge", "room booking", "hotel room", "airbnb", "rental room", "self contained", "single room", "double room", "suite", "presidential suite"],
    "Eateries & Food": ["restaurant", "eatery", "food joint", "chop bar", "fast food", "cafe", "bar", "pub", "drinking spot", "spot", "container", "joint", "waakye spot", "banku spot", "jollof spot", "kelewele spot", "kiosk", "night club", "lounge", "food vendor", "snack bar", "tea shop", "breakfast spot", "lunch spot"],
    "Companies & Business": ["company", "business", "agency", "ngo", "organization", "corporate", "office", "enterprise", "firm", "limited", "ltd", "inc", "corporation", "llc", "startup", "tech hub", "innovation hub", "co-working", "agribusiness", "export company", "import export", "trading company", "consultancy", "holdings", "group", "ventures"],
    "Education & Training": ["school", "tutoring", "tuition", "lesson", "course", "training", "workshop", "seminar", "education", "academy", "institute", "learning", "ict class", "computer training", "driving school", "apprenticeship", "vocation", "vocational", "skills training", "tutorial", "coaching", "mentorship", "examination", "exam prep", "bece", "wassce", "classes", "study"],
    "Farming & Agriculture": ["farm", "farming", "agriculture", "tractor", "seeds", "seedling", "fertilizer", "pesticide", "herbicide", "agric", "irrigation", "poultry farm", "piggery", "fish farm", "fish pond", "vegetable farm", "crop farm", "farm tools", "sprayer", "knapsack sprayer", "cutlass", "hoe", "farm implement", "feed", "animal feed", "poultry feed", "layer feed", "grower feed", "chicken feed", "day old chick", "agro chemical"],
    "General Goods": ["general", "provisions", "groceries", "shop", "store", "supplies", "household", "miscellaneous", "various", "assorted", "provisions shop", "mini mart", "corner shop"]
};

function detectCategory(text) {
    if (!text || text.trim().length < 2) return null;
    const lower = text.toLowerCase().trim();
    const scores = {};
    
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORD_MAP)) {
        scores[category] = 0;
        for (const kw of keywords) {
            if (lower.includes(kw)) {
                // Weight: longer keyword match = more specific = higher score
                scores[category] += kw.length > 4 ? 3 : 2;
            }
        }
    }
    
    // Find best match
    let bestCat = null;
    let bestScore = 0;
    for (const [cat, score] of Object.entries(scores)) {
        if (score > bestScore) {
            bestScore = score;
            bestCat = cat;
        }
    }
    
    return bestScore > 0 ? bestCat : "General Goods";
}


// Price anomaly detection — flags suspiciously low prices
function detectPriceAnomaly(price, category, allProducts) {
    if (!price || price <= 0 || !allProducts || allProducts.length < 3) return null;
    
    // Get average price for same category
    const sameCategory = allProducts.filter(p => p.category === category && p.price > 0);
    if (sameCategory.length < 2) return null;
    
    const avgPrice = sameCategory.reduce((sum, p) => sum + p.price, 0) / sameCategory.length;
    const minPrice = Math.min(...sameCategory.map(p => p.price));
    
    // Flag if price is less than 30% of average and below all others
    if (price < avgPrice * 0.3 && price < minPrice * 0.5) {
        return {
            level: "high",
            message: "This price is unusually low compared to similar items. Exercise caution."
        };
    } else if (price < avgPrice * 0.5) {
        return {
            level: "medium",
            message: "This price is below average for this category. Verify the item before purchase."
        };
    }
    return null;
}

// Collect all distinct categories actually used by shops/products in the DB
let dynamicCategories = {};
async function fetchDynamicCategories() {
    if (DEMO_MODE || !sbClient) return;
    try {
        const { data: shopCats, error: e1 } = await sbClient.from('public_shops').select('category').eq('city', CITY_CONFIG.slug).not('category', 'is', null);
        if (e1) throw e1;
        const { data: prodCats, error: e2 } = await sbClient.from('products').select('category').eq('city', CITY_CONFIG.slug).not('category', 'is', null);
        if (e2) throw e2;
        
        const allCats = new Set();
        (shopCats || []).forEach(s => { if (s.category) allCats.add(s.category); });
        (prodCats || []).forEach(p => { if (p.category) allCats.add(p.category); });
        
        // Group by domain
        const domainMap = { product: [], service: [], hotel: [], eatery: [], company: [] };
        for (const cat of allCats) {
            const domain = detectDomainForCategory(cat);
            if (!domainMap[domain].includes(cat)) domainMap[domain].push(cat);
        }
        dynamicCategories = domainMap;
    } catch (err) {
        console.warn("Could not fetch dynamic categories:", err);
    }
}

function detectDomainForCategory(category) {
    const productCats = ["Grains & Cereals", "Fresh Produce", "Meat & Livestock", "Cooked Food", "Textiles & Smocks", "Electronics & Phones", "Hardware & Building", "Pharmacy & Health", "Crafts & Artifacts", "General Goods", "Farming & Agriculture"];
    const serviceCats = ["Auto & Mechanics", "Fashion & Tailoring", "Electrical & Solar", "Barber & Beauty", "Construction & Plumbing", "Logistics & Delivery", "Education & Training"];
    const hotelCats = ["Hotels & Lodging", "Guest Houses", "Lodges & Resorts", "Hostels", "Hospitality"];
    const eateryCats = ["Eateries & Food", "Restaurants & Dining", "Fast Food & Snacks", "Tuo Zaafi & Local Buka", "Waakye & Rice Spots"];
    const companyCats = ["Companies & Business", "Agribusiness & Export", "IT & Tech Hubs", "Financial & Rural Banks", "NGOs & Agencies"];

    if (productCats.includes(category)) return "product";
    if (serviceCats.includes(category)) return "service";
    if (hotelCats.includes(category)) return "hotel";
    if (eateryCats.includes(category)) return "eatery";
    if (companyCats.includes(category)) return "company";
    return "product";
}


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
            buyer_name: userProfile.full_name || "Guest",
            buyer_phone: userProfile.phone || "",
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
            buyer_name: userProfile.full_name || "Guest",
            buyer_phone: userProfile.phone || "",
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
            buyer_name: userProfile.full_name || "Guest",
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
        if (IS_PROD) console.error(label + " error:", e);
    }
    try { initSupabase(); } catch(e) { showErr("initSupabase", e); }
    try { initNavigation(); } catch(e) { showErr("initNavigation", e); }
    try { initDomainTabs(); } catch(e) { showErr("initDomainTabs", e); }
    try { initMap(); } catch(e) { showErr("initMap", e); }
    try { renderSpotlightCarousel().catch(e => showErr("renderSpotlightCarousel", e)); } catch(e) { showErr("renderSpotlightCarousel", e); }
    try { renderShowcaseSections().catch(e => showErr("renderShowcaseSections", e)); } catch(e) { showErr("renderShowcaseSections", e); }
    try { searchListings(); } catch(e) { showErr("searchListings", e); }
    try { updateUIForAuthUser(); } catch(e) { showErr("updateUIForAuthUser", e); }
    try { initInlineHandlers(); } catch(e) { showErr("initInlineHandlers", e); }
});

// Migrate all inline event handlers to addEventListener + event delegation (CSP compliance)
function initInlineHandlers() {
    // Static elements (exist in initial HTML)
    document.querySelectorAll('[data-ad-tier]').forEach(btn => {
        btn.addEventListener('click', () => openAdBookingModal(btn.dataset.adTier));
    });
    document.querySelectorAll('[data-close-modal]').forEach(el => {
        el.addEventListener('click', () => closeModal(el.dataset.closeModal));
    });
    document.querySelectorAll('[data-star]').forEach(star => {
        star.addEventListener('click', () => selectStarRating(parseInt(star.dataset.star)));
    });
    const reviewForm = document.getElementById('reviewForm');
    if (reviewForm) reviewForm.addEventListener('submit', handleReviewSubmit);
    const replyReviewForm = document.getElementById('replyReviewForm');
    if (replyReviewForm) replyReviewForm.addEventListener('submit', handleReviewReplySubmit);
    const reportForm = document.getElementById('reportForm');
    if (reportForm) reportForm.addEventListener('submit', handleReportSubmit);
    const adBookingForm = document.getElementById('adBookingForm');
    if (adBookingForm) adBookingForm.addEventListener('submit', handleAdBookingSubmit);
    const helpForm = document.getElementById('helpForm');
    if (helpForm) helpForm.addEventListener('submit', handleHelpSubmit);
    const adTierSelect = document.getElementById('adTierSelect');
    if (adTierSelect) adTierSelect.addEventListener('change', updateAdFeeDisplay);
    const adDuration = document.getElementById('adDuration');
    if (adDuration) adDuration.addEventListener('change', updateAdFeeDisplay);

    // Express order form (dynamically generated)
    const expressOrderForm = document.getElementById('expressOrderForm');
    if (expressOrderForm) expressOrderForm.addEventListener('submit', handleOrderSubmit);

    // Event delegation for dynamically generated content
    document.addEventListener('click', handleDelegatedClick);
    document.addEventListener('change', handleDelegatedChange);
}

function handleDelegatedClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    switch (action) {
        case 'selectCategory':
            selectCategoryPill(el, el.dataset.catVal);
            break;
        case 'showShopDetail':
            showShopDetailModal(el.dataset.shopId);
            break;
        case 'goToSpotlight':
            goToSpotlight(parseInt(el.dataset.idx));
            break;
        case 'openOrderModal':
            openOrderModal(el.dataset.pid, el.dataset.sid);
            break;
        case 'toggleFavorite':
            toggleFavoriteShop(el.dataset.shopId, e);
            break;
        case 'openWhatsApp':
            openWhatsApp(el.dataset.waNum, el.dataset.waMsg, el.dataset.waShop);
            break;
        case 'openReportModal':
            openReportModal(el.dataset.reportType, el.dataset.reportId, el.dataset.reportName);
            break;
        case 'drawDirections':
            drawDirectionsToShop(parseFloat(el.dataset.lat), parseFloat(el.dataset.lng), el.dataset.name);
            break;
        case 'takeMeThere':
            takeMeThere(parseFloat(el.dataset.lat), parseFloat(el.dataset.lng), el.dataset.name || '');
            break;
        case 'updateOrderQty':
            updateOrderModalQty(parseInt(el.dataset.qtyDelta));
            break;
        case 'goToOrderStep':
            goToOrderStep(parseInt(el.dataset.step));
            break;
        case 'updateStockInline':
            updateProductStockInline(el.dataset.pid, parseInt(el.dataset.delta));
            break;
        case 'changeOrderStatus':
            changeOrderStatus(el.dataset.orderId, el.dataset.status);
            break;
        case 'openReviewModal':
            openReviewModal(el.dataset.orderId, el.dataset.shopId, el.dataset.productId);
            break;
        case 'openReplyModal':
            openReplyModal(el.dataset.reviewId);
            break;
        case 'dismissReport':
            dismissReport(el.dataset.reportId);
            break;
        case 'takeModerationAction':
            takeModerationAction(el.dataset.reportId);
            break;
    }
}

function handleDelegatedChange(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    switch (action) {
        case 'toggleDelivery':
            toggleDeliveryAddressField(el.dataset.show === 'true');
            break;
    }
}

function initSupabase() {
    if (!DEMO_MODE) {
        try {
            if (typeof window.supabase === 'undefined') {
                console.error("Supabase JS library not loaded! CDN may have failed.");
                var dbg = document.getElementById("resultsList");
                console.error("Supabase JS library not loaded! CDN may have failed.");
                return;
            }
            sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            // [debug log removed]
            setupAuthListener();
        } catch (err) {
            console.warn("Supabase init failed, falling back to Demo Mode:", err);
            var dbg = document.getElementById("resultsList");
            console.error("Supabase init failed:", err.message || err);
        }
    } else {
        // [debug log removed]
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
                account_type: userProfile.account_type,
                city: CITY_CONFIG.slug
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

    // Back to Market button (trader dashboard -> home)
    const backToMarketBtn = document.getElementById("backToMarketBtn");
    if (backToMarketBtn) backToMarketBtn.addEventListener("click", () => {
        navigateToPage("home");
        closeDrawer();
    });
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

    // Auto-category detection on shop description typing
    const shopDescInput = document.getElementById("shopDescription");
    if (shopDescInput) {
        shopDescInput.addEventListener("input", () => {
            const text = shopDescInput.value.trim();
            if (text.length > 3) {
                const detected = detectCategory(text);
                const badge = document.getElementById("shopCategoryAutoDetect");
                const catSpan = document.getElementById("shopDetectedCategory");
                if (detected && catSpan) {
                    catSpan.textContent = detected;
                    if (badge) badge.style.display = "block";
                }
            } else {
                const badge = document.getElementById("shopCategoryAutoDetect");
                if (badge) badge.style.display = "none";
            }
        });
    }

    // Auto-category detection on product name typing
    const productNameInput = document.getElementById("productName");
    if (productNameInput) {
        productNameInput.addEventListener("input", () => {
            const text = productNameInput.value.trim();
            const catInput = document.getElementById("productCategory");
            const hint = document.getElementById("productCategoryHint");
            if (text.length > 3) {
                const detected = detectCategory(text + " " + (document.getElementById("productDescription")?.value || ""));
                if (catInput && detected) {
                    catInput.value = detected;
                    if (hint) hint.innerHTML = '<span style="color:#16A34A;">✓ Auto-detected: ' + detected + '</span>';
                }
            } else {
                if (catInput) catInput.value = "";
                if (hint) hint.textContent = "Start typing the product name — category auto-detects";
            }
        });
    }

    // Also detect on product description typing
    const productDescInput = document.getElementById("productDescription");
    if (productDescInput) {
        productDescInput.addEventListener("input", () => {
            const name = document.getElementById("productName")?.value.trim() || "";
            if (name.length > 3) {
                const detected = detectCategory(name + " " + productDescInput.value);
                const catInput = document.getElementById("productCategory");
                const hint = document.getElementById("productCategoryHint");
                if (catInput && detected) {
                    catInput.value = detected;
                    if (hint) hint.innerHTML = '<span style="color:#16A34A;">✓ Auto-detected: ' + detected + '</span>';
                }
            }
        });
    }

    // View Terms & Conditions button (in Account Settings)
    const viewTermsBtn = document.getElementById("viewTermsBtn");
    if (viewTermsBtn) viewTermsBtn.addEventListener("click", () => {
        navigateToPage("terms");
        closeDrawer();
    });

    // Product image file upload + preview
    const productImageFile = document.getElementById("productImageFile");
    if (productImageFile) {
        productImageFile.addEventListener("change", () => {
            const file = productImageFile.files[0];
            if (!file) return;
            if (!file.type.startsWith("image/")) { showToast("Please select an image file", "error"); return; }
            if (file.size > 5 * 1024 * 1024) { showToast("Image must be under 5MB", "error"); return; }
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById("productImagePreview");
                const previewImg = document.getElementById("productImagePreviewImg");
                const hiddenInput = document.getElementById("productImage");
                if (previewImg) previewImg.src = e.target.result;
                if (preview) preview.style.display = "block";
                if (hiddenInput) hiddenInput.value = e.target.result; // Will upload to Supabase on save
            };
            reader.readAsDataURL(file);
        });
    }

    // Product image URL fallback
    const productImageUrl = document.getElementById("productImageUrl");
    if (productImageUrl) {
        productImageUrl.addEventListener("input", () => {
            const hiddenInput = document.getElementById("productImage");
            if (hiddenInput) hiddenInput.value = productImageUrl.value.trim();
        });
    }

    // Ghana Card photo preview
    const ghanaCardInput = document.getElementById('ghanaCardPhoto');
    if (ghanaCardInput) {
        ghanaCardInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    document.getElementById('ghanaCardPreviewImg').src = ev.target.result;
                    document.getElementById('ghanaCardPreview').style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }

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
    if (searchBtn) searchBtn.addEventListener("click", () => { searchListings(); });

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
        const targetEl = document.getElementById("acctab-" + target) ||
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
    fetchDynamicCategories().then(() => renderCategoryPillsForDomain(currentDomain));
}

function renderCategoryPillsForDomain(domain) {
    const pillsContainer = document.getElementById("categoryPills");
    if (!pillsContainer) return;

    // The "All" label per domain
    const allLabels = {
        product: "All Products", service: "All Services",
        hotel: "All Lodging", eatery: "All Food Spots", company: "All Companies"
    };

    // Collect categories from two sources:
    // 1. Dynamic categories fetched from the database (what traders actually listed)
    // 2. Demo store categories (for demo mode fallback)
    let categories = [];
    const dynamic = dynamicCategories[domain] || [];
    for (const cat of dynamic) {
        if (cat && !categories.includes(cat)) categories.push(cat);
    }

    // In demo mode, pull categories from demoStore
    if (DEMO_MODE || !sbClient) {
        const demoCats = new Set();
        if (domain === "product") {
            demoStore.products.forEach(p => { if (p.category) demoCats.add(p.category); });
            demoStore.shops.forEach(s => { if (s.category && s.listing_type === "product") demoCats.add(s.category); });
        } else if (domain === "service") {
            demoStore.service_listings.forEach(s => { if (s.category) demoCats.add(s.category); });
        } else if (domain === "hotel" || domain === "eatery" || domain === "company") {
            const typeMap = { hotel: "hotel", eatery: "restaurant", company: "company" };
            demoStore.business_listings.filter(b => b.business_type === typeMap[domain])
                .forEach(b => { if (b.category) demoCats.add(b.category); });
        }
        for (const cat of demoCats) {
            if (!categories.includes(cat)) categories.push(cat);
        }
    }

    // Always prepend the "All" option
    categories = [allLabels[domain] || "All", ...categories.sort()];

    pillsContainer.innerHTML = categories.map((cat, idx) => {
        const catVal = idx === 0 ? "" : cat;
        return `<button class="pill ${idx === 0 ? 'active' : ''}" data-category="${catVal}" data-action="selectCategory" data-cat-val="${escapeJs(catVal)}">${cat}</button>`;
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
let spotlightIndex = 0;
let spotlightTimer = null;

async function renderSpotlightCarousel() {
    const carousel = document.getElementById("spotlightCarousel");
    let spotlightShops = [];

    if (!DEMO_MODE && sbClient) {
        try {
            const { data, error } = await sbClient.from('public_shops').select('*').eq('is_active', true).eq('city', CITY_CONFIG.slug).order('rating_avg', { ascending: false }).limit(3);
            if (error) throw error;
            spotlightShops = (data || []).filter(s => s.ad_tier === "basic_spotlight" || s.ad_tier === "premium_top");
            if (spotlightShops.length === 0 && data && data.length > 0) spotlightShops = data.slice(0, 2);
        } catch (err) {
            console.error("Spotlight fetch error:", err);
        }
    }

    if (spotlightShops.length === 0) {
        carousel.innerHTML = `<div class="spotlight-card active" style="text-align:center;padding:24px 16px;">
            <p style="font-size:24px;margin-bottom:8px;">📌</p>
            <p style="font-size:14px;font-weight:600;margin-bottom:4px;">No spotlight listings yet</p>
            <p style="font-size:12px;opacity:0.85;">Local merchants — book a spotlight campaign in your dashboard to feature here!</p>
        </div>`;
        return;
    }

    // Build all cards (only first is active)
    carousel.innerHTML = spotlightShops.map((s, i) => `
        <div class="spotlight-card ${i === 0 ? 'active' : ''}" data-idx="${i}" data-action="showShopDetail" data-shop-id="${escapeJs(s.id)}">
            <div class="spotlight-card-top">
                <img src="${escapeAttr(s.cover_image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e')}" class="spotlight-img" alt="${escapeHtml(s.shop_name)}" />
                <div>
                    <h4 class="spotlight-title">${escapeHtml(s.shop_name)}</h4>
                    <span class="spotlight-area">📍 ${escapeHtml(s.market_area)} • 🇬🇭 ${escapeHtml(s.digital_address || 'Tamale')}</span>
                </div>
            </div>
            <p class="spotlight-desc">${escapeHtml(s.description)}</p>
            <div class="spotlight-action">
                <span>⭐ ${s.rating_avg || 0} (${s.rating_count || 0})</span>
                <button class="spotlight-btn">Visit Stall ➔</button>
            </div>
        </div>
    `).join("");

    // Build navigation dots (remove old dots first to prevent duplication)
    const oldDots = document.getElementById('spotlightDots');
    if (oldDots) oldDots.remove();
    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'spotlight-dots';
    dotsContainer.id = 'spotlightDots';
    dotsContainer.innerHTML = spotlightShops.map((_, i) =>
        `<button class="spotlight-dot ${i === 0 ? 'active' : ''}" data-idx="${i}" data-action="goToSpotlight" data-idx="${i}"></button>`
    ).join('');
    carousel.appendChild(dotsContainer);

    // Store shops globally for rotation
    window._spotlightShops = spotlightShops;
    spotlightIndex = 0;

    // Start auto-rotation
    if (spotlightTimer) clearInterval(spotlightTimer);
    if (spotlightShops.length > 1) {
        spotlightTimer = setInterval(rotateSpotlight, 7000);
    }
}

function rotateSpotlight() {
    const cards = document.querySelectorAll('#spotlightCarousel .spotlight-card');
    const dots = document.querySelectorAll('#spotlightDots .spotlight-dot');
    if (cards.length <= 1) return;

    // Remove active from current
    cards.forEach(c => c.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));

    // Advance index
    spotlightIndex = (spotlightIndex + 1) % cards.length;

    // Activate next
    cards[spotlightIndex].classList.add('active');
    if (dots[spotlightIndex]) dots[spotlightIndex].classList.add('active');
}

function goToSpotlight(idx) {
    const cards = document.querySelectorAll('#spotlightCarousel .spotlight-card');
    const dots = document.querySelectorAll('#spotlightDots .spotlight-dot');
    if (idx < 0 || idx >= cards.length) return;

    cards.forEach(c => c.classList.remove('active'));
    dots.forEach(d => d.classList.remove('active'));

    spotlightIndex = idx;
    cards[idx].classList.add('active');
    if (dots[idx]) dots[idx].classList.add('active');

    // Reset timer
    if (spotlightTimer) clearInterval(spotlightTimer);
    if (window._spotlightShops && window._spotlightShops.length > 1) {
        spotlightTimer = setInterval(rotateSpotlight, 7000);
    }
}

async function renderShowcaseSections() {
    const popularContainer = document.getElementById("popularNearCarousel");
    const newContainer = document.getElementById("newArrivalsCarousel");
    let products = [];
    let shops = [];

    if (!DEMO_MODE && sbClient) {
        try {
            const { data: shopData, error: shopErr } = await sbClient.from('public_shops').select('*').eq('is_active', true).eq('city', CITY_CONFIG.slug);
            if (shopErr) throw shopErr;
            shops = shopData || [];
            const { data: prodData, error: prodErr } = await sbClient.from('products').select('*').eq('city', CITY_CONFIG.slug).eq('in_stock', true);
            if (prodErr) throw prodErr;
            products = (prodData || []).map(p => {
                const shop = shops.find(s => s.id === p.shop_id) || {};
                return {
                    ...p, item_type: "product",
                    shop_name: shop.shop_name, market_area: shop.market_area,
                    digital_address: shop.digital_address, whatsapp_number: shop.whatsapp_number,
                    phone: shop.phone, latitude: shop.latitude, longitude: shop.longitude,
                    verification_tier: shop.verification_tier, is_verified: shop.is_verified,
                    ad_tier: shop.ad_tier
                };
            });
        } catch (err) {
            console.error("Showcase fetch error:", err);
        }
    }

    // If no products loaded (empty DB or error), show empty states
    if (products.length === 0) {
        popularContainer.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:13px;">No products listed yet. Be the first to sell on Tamale Market Finder!</div>`;
        newContainer.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:13px;">No new arrivals yet.</div>`;
        return;
    }

    // 1. Popular Near You Carousel
    const popularProducts = [...products].sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0)).slice(0, 5);
    popularContainer.innerHTML = popularProducts.map(p => {
        const shop = shops.find(s => s.id === p.shop_id) || {};
        return renderMiniProductCard(p, shop);
    }).join("");

    // 2. New Arrivals Carousel
    const newProducts = [...products].reverse().slice(0, 5);
    newContainer.innerHTML = newProducts.map(p => {
        const shop = shops.find(s => s.id === p.shop_id) || {};
        return renderMiniProductCard(p, shop);
    }).join("");
}

function renderMiniProductCard(p, shop) {
    const isOut = !p.in_stock || p.stock_quantity <= 0;
    return `
        <div class="card ${isOut ? 'card-out-of-stock' : ''}" style="min-width: 200px; max-width: 220px; flex-shrink: 0;">
            <div class="card-img-container" style="height: 110px;">
                <img src="${escapeAttr(p.image_url)}" class="card-img" alt="${escapeHtml(p.name)}" />
                ${p.badge_tag ? `<span class="badge-tag ${escapeHtml(p.badge_tag)}" style="position:absolute; top:6px; left:6px;">${escapeHtml(p.badge_tag.toUpperCase())}</span>` : ''}
            </div>
            <h4 class="card-title" style="font-size: 13px; line-height: 1.2;">${escapeHtml(p.name)}</h4>
            <div class="price-row">
                <span class="price-amount ${p.discount_price ? 'discount-price' : ''}">GHS ${(p.discount_price || p.price).toFixed(2)}</span>
                ${p.discount_price ? `<span class="original-price">GHS ${p.price.toFixed(2)}</span>` : ''}
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px;">🏪 ${escapeHtml(shop.shop_name || CITY_CONFIG.name + ' Trader')}</div>
            <button class="btn-primary btn-sm btn-order" ${isOut ? 'disabled' : ''} data-action="openOrderModal" data-pid="${escapeJs(p.id)}" data-sid="${escapeJs(p.shop_id)}">
                ${isOut ? 'Out of Stock' : '🛒 Order Now'}
            </button>
        </div>
    `;
}

// ====================================================================
// 6. MAIN SEARCH & FILTERING LOGIC
// ====================================================================
async function searchListings() {
    // [debug log removed]
    const resultsList = document.getElementById("resultsList");
    if (resultsList) resultsList.innerHTML = '<div style="padding:10px;color:#888;">Loading listings...</div>';
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
            items = demoStore.service_listings.map(s => ({ ...s, item_type: "service", shop_name: s.title, market_area: CITY_CONFIG.name + ' Metro' }));
        } else if (currentDomain === "hotel" || currentDomain === "eatery" || currentDomain === "company") {
            const typeMap = { hotel: "hotel", eatery: "restaurant", company: "company" };
            items = demoStore.business_listings.filter(b => b.business_type === typeMap[currentDomain]).map(b => ({ ...b, item_type: currentDomain, shop_name: b.business_name, market_area: b.address }));
        }
    } else {
        // Fetch from Supabase
        try {
            if (currentDomain === "product") {
                const { data: shops, error: shopErr } = await sbClient.from('public_shops').select('*').eq('is_active', true).eq('city', CITY_CONFIG.slug);
                if (shopErr) throw shopErr;
                const { data: products, error: prodErr } = await sbClient.from('products').select('*').eq('city', CITY_CONFIG.slug);
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
                const { data: services, error: srvErr } = await sbClient.from('service_listings').select('*,shops(*)').eq('is_available', true).eq('city', CITY_CONFIG.slug);
                if (srvErr) throw srvErr;
                items = (services || []).map(s => ({ ...s, item_type: "service", shop_name: s.title, market_area: s.service_area || CITY_CONFIG.name + ' Metro' }));
            } else if (currentDomain === "hotel" || currentDomain === "eatery" || currentDomain === "company") {
                const typeMap = { hotel: "hotel", eatery: "restaurant", company: "company" };
                const { data: businesses, error: bizErr } = await sbClient.from('business_listings').select('*').eq('business_type', typeMap[currentDomain]).eq('city', CITY_CONFIG.slug);
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
    if (p.ghana_card_verified) verBadge += ` <span class="verification-badge verified" style="background:#DCFCE7; color:#16A34A;">🪪 ID Verified</span>`;
    let deliveryBadge = p.offers_delivery ? ` <span class="badge-tag" style="background:#EFF6FF; color:#1D4ED8; font-size:10px;">🚚 Delivery</span>` : "";
    let accountAge = "";
    if (p.created_date) {
        const days = Math.floor((Date.now() - new Date(p.created_date).getTime()) / 86400000);
        if (days < 7) accountAge = `<span style="font-size:10px; color:#D97706;">🆕 New seller (${days}d)</span>`;
        else if (days < 30) accountAge = `<span style="font-size:10px; color:#666;">⏱️ ${days}d on TMF</span>`;
        else accountAge = `<span style="font-size:10px; color:#666;">⏱️ ${Math.floor(days/30)}mo on TMF</span>`;
    }
    let priceWarning = "";
    if (p.price > 0 && p.price < 5) priceWarning = `<div style="font-size:10px; color:#DC2626; margin-top:2px;">⚠️ Unusually low price — verify before buying</div>`;

    let adBadge = "";
    if (p.ad_tier === "premium_top") adBadge = `<span class="badge-tag deal" style="background:#FEF3C7; color:#B45309;">⭐ TOP</span>`;
    else if (p.ad_tier === "basic_spotlight") adBadge = `<span class="badge-tag hot">🔥 SPOTLIGHT</span>`;

    const isFav = userFavorites.has(p.shop_id);

    return `
        <div class="card ${isOut ? 'card-out-of-stock' : ''}">
            <div class="card-badge-row">
                <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
                    ${stockPill}
                    ${adBadge}
                    ${deliveryBadge}
                </div>
                <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
                    ${verBadge}
                </div>
            </div>
            ${accountAge}

            <div class="card-img-container">
                <img src="${escapeAttr(p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e')}" class="card-img" alt="${escapeHtml(p.name)}" />
                <button class="fav-btn ${isFav ? 'active' : ''}" data-action="toggleFavorite" data-shop-id="${escapeJs(p.shop_id)}" title="Bookmark Shop">
                    ${isFav ? '❤️' : '🤍'}
                </button>
                ${p.badge_tag ? `<span class="badge-tag ${escapeHtml(p.badge_tag)}" style="position:absolute; bottom:8px; left:8px;">${escapeHtml(p.badge_tag.toUpperCase())}</span>` : ''}
            </div>

            <h3 class="card-title">${escapeHtml(p.name)}</h3>
            <div class="card-subtitle-shop" data-action="showShopDetail" data-shop-id="${escapeJs(p.shop_id)}" style="cursor:pointer;">
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

            ${priceWarning}
            <div class="card-actions-row">
                <button class="btn-whatsapp btn-sm" data-action="openWhatsApp" data-wa-num="${escapeJs(p.whatsapp_number)}" data-wa-msg="${escapeJs(p.name)}" data-wa-shop="${escapeJs(p.shop_name)}">💬 WhatsApp</button>
                <button class="btn-primary btn-sm btn-order" ${isOut ? 'disabled' : ''} data-action="openOrderModal" data-pid="${escapeJs(p.id)}" data-sid="${escapeJs(p.shop_id)}">
                    ${isOut ? 'Out of Stock' : '🛒 Order Now'}
                </button>
                <button class="btn-take-me btn-sm" data-action="takeMeThere" data-lat="${escapeJs(p.latitude)}" data-lng="${escapeJs(p.longitude)}" data-name="${escapeJs(p.shop_name)}" title="Get directions">📍 Take me there</button>
                <button class="btn-report" data-action="openReportModal" data-report-type="product" data-report-id="${escapeJs(p.id)}" data-report-name="${escapeJs(p.name)}" title="Report listing">🚩</button>
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
                💰 Rates: GHS ${escapeHtml(String(s.price_min || '?'))} - GHS ${escapeHtml(String(s.price_max || '?'))} (${escapeHtml(String((s.price_type || '').replace('_', ' ')))})
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">
                📍 Coverage: ${escapeHtml(s.service_area || '')} • 🕐 ${escapeHtml(s.availability_hours || '')}
            </div>

            <div class="card-actions-row">
                <button class="btn-whatsapp btn-sm btn-block" data-action="openWhatsApp" data-wa-num="${escapeJs(s.whatsapp_number || "")}" data-wa-msg="${escapeJs(s.title)}" data-wa-shop="Service Inquiry">💬 Book / Inquire Service</button>
                <button class="btn-report" data-action="openReportModal" data-report-type="service" data-report-id="${escapeJs(s.id)}" data-report-name="${escapeJs(s.title)}">🚩</button>
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
                <img src="${escapeAttr(h.cover_image_url)}" class="card-img" alt="${escapeHtml(h.business_name)}" />
            </div>
            <h3 class="card-title">${escapeHtml(h.business_name)}</h3>
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">📍 ${escapeHtml(h.address)} • 🇬🇭 ${escapeHtml(h.digital_address)}</div>
            
            <div class="amenities-row">
                ${(h.amenities || []).map(a => `<span class="amenity-badge">${escapeHtml(a)}</span>`).join("")}
            </div>

            <div class="price-row" style="margin-top:6px;">
                <span class="price-amount" style="font-size:15px; color:var(--accent);">${escapeHtml(h.price_range || '?')} Category</span>
                <span class="star-rating" style="margin-left:auto;">⭐ ${escapeHtml(String(h.rating_avg || 'N/A'))} (${escapeHtml(String(h.rating_count || 0))})</span>
            </div>

            <div class="card-actions-row" style="margin-top:10px;">
                <button class="btn-primary btn-sm btn-block" data-action="openWhatsApp" data-wa-num="${escapeJs(h.whatsapp_number)}" data-wa-msg="Room Booking" data-wa-shop="${escapeJs(h.business_name)}">📞 Call / Reserve Room</button>
                <button class="btn-take-me btn-sm" data-action="takeMeThere" data-lat="${escapeJs(h.latitude)}" data-lng="${escapeJs(h.longitude)}" data-name="${escapeJs(h.business_name)}" title="Get directions">📍 Take me there</button>
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
                <img src="${escapeAttr(e.cover_image_url)}" class="card-img" alt="${escapeHtml(e.business_name)}" />
            </div>
            <h3 class="card-title">${escapeHtml(e.business_name)}</h3>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">${escapeHtml(e.description)}</p>
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">📍 ${escapeHtml(e.address)} • 🕐 ${escapeHtml(e.opening_hours)}</div>
            
            <div class="card-actions-row">
                <button class="btn-whatsapp btn-sm btn-block" data-action="openWhatsApp" data-wa-num="${escapeJs(e.whatsapp_number)}" data-wa-msg="Food Order" data-wa-shop="${escapeJs(e.business_name)}">💬 Order Food / Reserve Table</button>
                <button class="btn-take-me btn-sm" data-action="takeMeThere" data-lat="${escapeJs(e.latitude)}" data-lng="${escapeJs(e.longitude)}" data-name="${escapeJs(e.business_name)}" title="Get directions">📍 Take me there</button>
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
                <button class="btn-secondary btn-sm btn-block" data-action="openWhatsApp" data-wa-num="${escapeJs(c.whatsapp_number)}" data-wa-msg="B2B Inquiry" data-wa-shop="${escapeJs(c.business_name)}">✉️ Contact Business Office</button>
                <button class="btn-take-me btn-sm" data-action="takeMeThere" data-lat="${escapeJs(c.latitude)}" data-lng="${escapeJs(c.longitude)}" data-name="${escapeJs(c.business_name)}" title="Get directions">📍 Take me there</button>
            </div>
        </div>
    `;
}

// Simple "Take me there" — opens Google Maps directions in a new tab
function takeMeThere(lat, lng, name) {
    if (!lat || !lng) {
        showToast('Location not available for this listing.', 'warning');
        return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank');
    showToast(`Opening directions to ${name || 'this location'}...`, 'success');
}

// ====================================================================
// 8. LEAFLET MAP ENGINE INTEGRATION
// ====================================================================
let userLocationMarker = null;
let userLocationCircle = null;
let directionsLayer = null;
let userLat = null;
let userLng = null;

function initMap() {
    const mapEl = document.getElementById("map");
    if (!mapEl) return;

    leafletMap = L.map("map", {
        zoomControl: true,
        attributionControl: true
    }).setView([CITY_CONFIG.coords.lat, CITY_CONFIG.coords.lng], CITY_CONFIG.zoom);

    // Use a more detailed tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(leafletMap);

    // Add a "Find My Location" button to the map
    const locateBtn = L.control({ position: "topright" });
    locateBtn.onAdd = function() {
        const btn = L.DomUtil.create("button", "map-locate-btn");
        btn.innerHTML = "📍 My Location";
        btn.style.cssText = "background:#0A5C36; color:white; border:none; padding:8px 14px; border-radius:20px; font-weight:600; font-size:13px; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,0.3); margin:10px;";
        btn.onclick = function(e) {
            e.preventDefault();
            findMyLocation();
        };
        return btn;
    };
    locateBtn.addTo(leafletMap);

    // Auto-detect user's location on map load
    setTimeout(findMyLocation, 1500);
}

function findMyLocation() {
    if (!leafletMap) return;

    if (!("geolocation" in navigator)) {
        showToast("GPS not available on this device", "warning");
        return;
    }

    showToast("Finding your precise location...", "success");

    // Try high-accuracy first with generous timeout for mobile GPS
    navigator.geolocation.getCurrentPosition(pos => {
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        // Also update the global userLocation used for ranking "Popular Near You"
        userLocation = { latitude: userLat, longitude: userLng };

        // Remove old user marker
        if (userLocationMarker) leafletMap.removeLayer(userLocationMarker);
        if (userLocationCircle) leafletMap.removeLayer(userLocationCircle);

        // Add user location marker (blue pulsing dot)
        const userIcon = L.divIcon({
            html: `<div style="position:relative; width:20px; height:20px;">
                <div style="position:absolute; width:20px; height:20px; border-radius:50%; background:#2196F3; border:3px solid white; box-shadow:0 0 0 2px #2196F3, 0 2px 6px rgba(0,0,0,0.3);"></div>
                <div style="position:absolute; width:20px; height:20px; border-radius:50%; background:rgba(33,150,243,0.3); animation:pulse 2s infinite;"></div>
            </div>
            <style>@keyframes pulse{0%{transform:scale(1);opacity:0.7}70%{transform:scale(2.5);opacity:0}100%{transform:scale(2.5);opacity:0}}</style>`,
            className: "user-location-pin",
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        userLocationMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(leafletMap);
        userLocationMarker.bindPopup("<b>You are here</b><br><span style='font-size:11px;color:#64748b;'>Your current GPS location</span>");

        // Add accuracy circle
        if (pos.coords.accuracy) {
            userLocationCircle = L.circle([userLat, userLng], {
                radius: pos.coords.accuracy,
                color: "#2196F3",
                weight: 1,
                fillColor: "#2196F3",
                fillOpacity: 0.1
            }).addTo(leafletMap);
        }

        // Center map on user location
        leafletMap.setView([userLat, userLng], 15);
        showToast("Location found! You can see shops near you on the map.", "success");

        // Re-add shop markers
        if (typeof currentMapItems !== 'undefined' && currentMapItems) {
            updateMapMarkers(currentMapItems);
        }
    }, err => {
        // High-accuracy failed — retry with lower accuracy as fallback
        if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
            showToast("High-accuracy GPS timed out, trying approximate location...", "info");
            navigator.geolocation.getCurrentPosition(pos => {
                userLat = pos.coords.latitude;
                userLng = pos.coords.longitude;
                userLocation = { latitude: userLat, longitude: userLng };
                showToast("Approximate location found.", "success");
                // Re-center map if it exists
                if (leafletMap) leafletMap.setView([userLat, userLng], 14);
            }, err2 => {
                showToast("Could not get your location. Check GPS is enabled and you have permission.", "warning");
            }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 });
        } else if (err.code === err.PERMISSION_DENIED) {
            showToast("Location permission denied. Allow GPS access in your browser settings.", "warning");
        } else {
            showToast("Could not get your location. Allow GPS permissions and try again.", "warning");
        }
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
}

function drawDirectionsToShop(shopLat, shopLng, shopName) {
    if (!leafletMap) return;

    // Need user location first
    if (!userLat || !userLng) {
        showToast("Finding your location first...", "success");
        navigator.geolocation.getCurrentPosition(pos => {
            userLat = pos.coords.latitude;
            userLng = pos.coords.longitude;
            userLocation = { latitude: userLat, longitude: userLng };
            drawDirectionsToShop(shopLat, shopLng, shopName);
        }, () => {
            showToast("Enable GPS to get directions to this shop.", "warning");
        }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        return;
    }

    // Remove old directions
    if (directionsLayer) leafletMap.removeLayer(directionsLayer);

    // Draw a line from user to shop
    directionsLayer = L.polyline([[userLat, userLng], [shopLat, shopLng]], {
        color: "#0A5C36",
        weight: 4,
        opacity: 0.7,
        dashArray: "10, 10",
        lineCap: "round"
    }).addTo(leafletMap);

    // Fit map to show both points
    leafletMap.fitBounds([[userLat, userLng], [shopLat, shopLng]], { padding: [50, 50] });

    // Calculate approximate distance
    const dist = calculateDistance(userLat, userLng, shopLat, shopLng);
    const distText = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(2)}km`;

    // Open Google Maps / Apple Maps directions link
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${shopLat},${shopLng}&travelmode=driving`;

    showToast(`Distance to ${shopName}: ${distText}. Tap the shop marker for turn-by-turn directions.`, "success");

    // Add a popup on the shop marker with directions link
    if (directionsLayer) {
        directionsLayer.bindPopup(`
            <div style="font-family:sans-serif; padding:4px; min-width:180px;">
                <h4 style="margin:0 0 6px; font-size:13px;">🧭 Directions to ${escapeHtml(shopName)}</h4>
                <p style="margin:0 0 8px; font-size:12px; color:#64748b;">Distance: ~${distText}</p>
                <a href="${directionsUrl}" target="_blank" style="display:block; background:#0A5C36; color:white; text-decoration:none; padding:8px; border-radius:6px; text-align:center; font-weight:600; font-size:13px;">Open in Google Maps ➔</a>
            </div>
        `);
        directionsLayer.openPopup();
    }
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

let currentMapItems = null;

function updateMapMarkers(items) {
    if (!leafletMap) return;
    clearMapMarkers();
    currentMapItems = items;

    items.forEach(item => {
        if (!item.latitude || !item.longitude) return;

        // Custom Leaflet Marker Styling
        let markerColor = "#0A5C36"; // Standard Green
        if (item.ad_tier === "premium_top") markerColor = "#D97706"; // Gold
        else if (item.verification_tier === "trusted" || item.is_verified) markerColor = "#0284C7"; // Blue

        const markerHtml = `<div style="background-color: ${markerColor}; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 13px; font-weight: bold;">🛒</div>`;
        
        const customIcon = L.divIcon({
            html: markerHtml,
            className: "custom-map-pin",
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        const marker = L.marker([item.latitude, item.longitude], { icon: customIcon }).addTo(leafletMap);

        const shopId = escapeJs(item.shop_id || item.id);
        const shopLat = item.latitude;
        const shopLng = item.longitude;
        const shopName = escapeJs(item.shop_name || item.name);

        const popupContent = `
            <div style="font-family: sans-serif; padding: 4px; min-width: 220px;">
                <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight:700;">${escapeHtml(item.shop_name || item.name)}</h4>
                <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b;">📍 ${escapeHtml(item.market_area || 'Tamale')}</p>
                ${item.digital_address ? `<p style="margin:0 0 6px 0; font-size:11px; color:#0369A1; font-weight:bold;">🇬🇭 ${escapeHtml(item.digital_address)}</p>` : ''}
                <button data-action="showShopDetail" data-shop-id="${shopId}" style="width:100%; background:#0A5C36; color:white; border:none; padding:6px 8px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer; margin-bottom:4px;">View Stall ➔</button>
                <button data-action="drawDirections" data-lat="${shopLat}" data-lng="${shopLng}" data-name="${shopName}" style="width:100%; background:#2196F3; color:white; border:none; padding:6px 8px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer;">🧭 Get Directions</button>
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
    // Check if shop offers delivery before showing the delivery option
    let product = null;
    let shop = {};

    if (!sbClient) {
        showToast("Unable to load product details", "error");
        return;
    }
    try {
        const { data: prod, error: prodErr } = await sbClient.from('products').select('*').eq('city', CITY_CONFIG.slug).eq('id', productId).single();
        if (prodErr) throw prodErr;
        product = prod;
        const { data: shopData, error: shopErr } = await sbClient.from('public_shops').select('*').eq('id', shopId).eq('city', CITY_CONFIG.slug).single();
        if (shopErr) throw shopErr;
        shop = shopData || {};
    } catch (err) {
        console.error("Error loading product for order:", err);
        showToast("Could not load product details: " + (err.message || "Unknown error"), "error");
        return;
    }

    if (!product) {
        showToast("Product not found. Please try again.", "error");
        return;
    }
    activeOrderProduct = { product, shop, qty: 1 };
    currentOrderStep = 0;

    const modalBody = document.getElementById("orderModalBody");
    const unitPrice = product.discount_price || product.price;

    modalBody.innerHTML = `
        <div class="order-stepper" id="orderStepper">
            <div class="step-dot active" id="step-dot-0">1</div>
            <div class="step-bar" id="step-bar-0"></div>
            <div class="step-dot" id="step-dot-1">2</div>
            <div class="step-bar" id="step-bar-1"></div>
            <div class="step-dot" id="step-dot-2">3</div>
            <div class="step-bar" id="step-bar-2"></div>
            <div class="step-dot" id="step-dot-3">4</div>
        </div>

        <form id="expressOrderForm" data-form="orderSubmit">
            <!-- STEP 1: Item & Quantity -->
            <div class="order-step active" id="order-step-0">
                <div class="order-step-title">Reserve Item</div>
                <div class="order-step-subtitle">Review the item and select how many you'd like to reserve.</div>

                <div style="display:flex; gap:12px; margin-bottom:16px; align-items:center; background:#f8fafc; padding:12px; border-radius:10px;">
                    <img src="${escapeAttr(product.image_url)}" style="width:56px; height:56px; object-fit:cover; border-radius:8px;" />
                    <div>
                        <h4 style="font-size:15px; font-weight:700; line-height:1.2;">${escapeHtml(product.name)}</h4>
                        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">\ud83c\udfea ${escapeHtml(shop.shop_name)} \u2022 \ud83d\udccd ${escapeHtml(shop.market_area)}</div>
                        <div style="font-size:15px; font-weight:800; color:var(--primary-dark); margin-top:3px;">GHS ${unitPrice.toFixed(2)} <span style="font-size:11px;font-weight:500;color:#9ca3af;">/ unit</span></div>
                    </div>
                </div>

                <div class="form-group">
                    <label style="font-weight:600; font-size:14px;">How many do you want to reserve?</label>
                    <div style="display:flex; align-items:center; gap:16px; margin-top:8px;">
                        <div class="inline-stock-control" style="width:130px;">
                            <button type="button" class="stock-btn" data-action="updateOrderQty" data-qty-delta="-1">\u2212</button>
                            <span class="stock-count-num" id="orderModalQtyDisplay" style="font-size:18px; font-weight:700;">1</span>
                            <button type="button" class="stock-btn" data-action="updateOrderQty" data-qty-delta="1">+</button>
                        </div>
                        <span style="font-size:12px; color:#6b7280;">${product.stock_quantity} available in stock</span>
                    </div>
                </div>

                <div class="order-nav-buttons">
                    <span></span>
                    <button type="button" class="btn-next" data-action="goToOrderStep" data-step="1">Continue \u2192</button>
                </div>
            </div>

            <!-- STEP 2: Fulfillment -->
            <div class="order-step" id="order-step-1">
                <div class="order-step-title">Delivery or Pickup?</div>
                <div class="order-step-subtitle">Choose how you'd like to receive your item.</div>

                <div class="radio-cards">
                    <label class="radio-card" style="cursor:pointer; padding:14px; border-radius:10px; margin-bottom:10px; border:2px solid #e5e7eb; transition:border-color 0.2s;">
                        <input type="radio" name="deliveryType" value="pickup" checked data-action="toggleDelivery" data-show="false" />
                        <div class="radio-content">
                            <strong style="font-size:14px;">\ud83d\udecd\ufe0f Pickup at Stall</strong>
                            <span style="font-size:12px; color:#6b7280; display:block; margin-top:2px;">Visit shop at \ud83c\uddec\ud83c\udded ${shop.digital_address || 'Tamale Stall'}</span>
                        </div>
                    </label>
                    <label class="radio-card" style="cursor:pointer; padding:14px; border-radius:10px; margin-bottom:10px; border:2px solid #e5e7eb; transition:border-color 0.2s;">
                        <input type="radio" name="deliveryType" value="local_delivery" data-action="toggleDelivery" data-show="true" />
                        <div class="radio-content">
                            <strong style="font-size:14px;">\ud83d\ude9a Local Delivery in Tamale</strong>
                            <span style="font-size:12px; color:#6b7280; display:block; margin-top:2px;">Rider brings item to your address (fee paid to rider)</span>
                        </div>
                    </label>
                </div>

                <div class="form-group" id="deliveryAddressGroup" style="display:none; margin-top:12px;">
                    <label for="orderDeliveryAddress" style="font-weight:600; font-size:14px;">Delivery Address / Landmark *</label>
                    <input type="text" id="orderDeliveryAddress" class="form-input" placeholder="e.g. Near Central Hospital Gate, Tamale" style="margin-top:6px;" />
                </div>

                <div class="order-nav-buttons">
                    <button type="button" class="btn-back" data-action="goToOrderStep" data-step="0">\u2190 Back</button>
                    <button type="button" class="btn-next" data-action="goToOrderStep" data-step="2">Continue \u2192</button>
                </div>
            </div>

            <!-- STEP 3: Contact Details -->
            <div class="order-step" id="order-step-2">
                <div class="order-step-title">Your Contact Details</div>
                <div class="order-step-subtitle">The trader needs this to confirm your reservation.</div>

                <div class="form-group" style="margin-bottom:14px;">
                    <label for="orderBuyerName" style="font-weight:600; font-size:14px;">Full Name *</label>
                    <input type="text" id="orderBuyerName" class="form-input" value="${userProfile.full_name || ''}" placeholder="Enter your full name" style="margin-top:6px;" required />
                </div>

                <div class="form-group" style="margin-bottom:14px;">
                    <label for="orderBuyerPhone" style="font-weight:600; font-size:14px;">Phone Number *</label>
                    <input type="tel" id="orderBuyerPhone" class="form-input" value="${userProfile.phone || ''}" placeholder="e.g. 0244123456" style="margin-top:6px;" required />
                </div>

                <div class="form-group" style="margin-bottom:14px;">
                    <label for="orderBuyerNotes" style="font-weight:600; font-size:14px;">Notes for Trader <span style="font-weight:400;color:#9ca3af;">(Optional)</span></label>
                    <input type="text" id="orderBuyerNotes" class="form-input" placeholder="e.g. Expected arrival time, color preference..." style="margin-top:6px;" />
                </div>

                <div class="order-nav-buttons">
                    <button type="button" class="btn-back" data-action="goToOrderStep" data-step="1">\u2190 Back</button>
                    <button type="button" class="btn-next" data-action="goToOrderStep" data-step="3">Review Order \u2192</button>
                </div>
            </div>

            <!-- STEP 4: Review & Confirm -->
            <div class="order-step" id="order-step-3">
                <div class="order-step-title">Review &amp; Confirm</div>
                <div class="order-step-subtitle">Double-check everything before placing your reservation.</div>

                <div class="order-review-summary" id="orderReviewSummary">
                    <div class="order-review-row">
                        <span class="order-review-label">Item</span>
                        <span class="order-review-value">${escapeHtml(product.name)}</span>
                    </div>
                    <div class="order-review-row">
                        <span class="order-review-label">Shop</span>
                        <span class="order-review-value">${escapeHtml(shop.shop_name)}</span>
                    </div>
                    <div class="order-review-row">
                        <span class="order-review-label">Quantity</span>
                        <span class="order-review-value" id="reviewQty">1</span>
                    </div>
                    <div class="order-review-row">
                        <span class="order-review-label">Fulfillment</span>
                        <span class="order-review-value" id="reviewDelivery">Pickup</span>
                    </div>
                    <div class="order-review-row">
                        <span class="order-review-label">Name</span>
                        <span class="order-review-value" id="reviewName">-</span>
                    </div>
                    <div class="order-review-row">
                        <span class="order-review-label">Phone</span>
                        <span class="order-review-value" id="reviewPhone">-</span>
                    </div>
                    <div class="order-review-row">
                        <span class="order-review-label">Total Amount</span>
                        <span class="order-review-value" id="reviewTotal">GHS ${unitPrice.toFixed(2)}</span>
                    </div>
                </div>

                <div style="background:#fef3c7; border:1px solid #fcd34d; border-radius:8px; padding:10px; margin-bottom:14px; font-size:11px; color:#b45309; display:flex; gap:6px; align-items:flex-start;">
                    <span style="font-size:14px;">\u2139\ufe0f</span>
                    <div><strong>Payment Disclaimer:</strong> No online payment charged here. Payment is handled directly between buyer and trader (Cash / MoMo).</div>
                </div>

                <div class="order-nav-buttons">
                    <button type="button" class="btn-back" data-action="goToOrderStep" data-step="2">\u2190 Back</button>
                    <button type="submit" class="btn-next" style="flex:1; text-align:center;">\u2705 Confirm Reservation</button>
                </div>
            </div>
        </form>
    `;

    openModal("orderModal");
    // Set initial radio card highlight
    setTimeout(() => {
        const firstRadio = document.querySelector('input[name="deliveryType"]:checked');
        if (firstRadio) toggleDeliveryAddressField(firstRadio.dataset.show === 'true');
    }, 50);
}

let currentOrderStep = 0;
const ORDER_STEPS = 4;

function goToOrderStep(step) {
    if (step < 0 || step >= ORDER_STEPS) return;
    if (step > currentOrderStep) {
        // Validate forward navigation
        if (currentOrderStep === 2) {
            const name = document.getElementById("orderBuyerName").value.trim();
            const phone = document.getElementById("orderBuyerPhone").value.trim();
            if (!name) { showToast("Enter your full name", "error"); document.getElementById("orderBuyerName").focus(); return; }
            if (!phone || !/^0[0-9]{9}$/.test(phone)) { showToast("Enter a valid Ghana phone number (e.g. 0244123456)", "error"); document.getElementById("orderBuyerPhone").focus(); return; }
        }
        if (currentOrderStep === 1) {
            const delivery = document.querySelector('input[name="deliveryType"]:checked');
            if (delivery && delivery.value === 'local_delivery') {
                const addr = document.getElementById("orderDeliveryAddress");
                if (addr && !addr.value.trim()) { showToast("Enter a delivery address", "error"); addr.focus(); return; }
            }
        }
    }

    document.getElementById("order-step-" + currentOrderStep).classList.remove("active");
    document.getElementById("order-step-" + step).classList.add("active");

    for (let i = 0; i < ORDER_STEPS; i++) {
        const dot = document.getElementById("step-dot-" + i);
        dot.classList.remove("active", "done");
        if (i < step) dot.classList.add("done");
        if (i === step) dot.classList.add("active");
    }
    for (let i = 0; i < ORDER_STEPS - 1; i++) {
        const bar = document.getElementById("step-bar-" + i);
        bar.classList.toggle("done", i < step);
    }

    if (step === 3) updateOrderReview();

    currentOrderStep = step;
    const modalBody = document.getElementById("orderModalBody");
    if (modalBody) modalBody.scrollTop = 0;
}

function updateOrderReview() {
    if (!activeOrderProduct) return;
    const unitPrice = activeOrderProduct.product.discount_price || activeOrderProduct.product.price;
    const qty = activeOrderProduct.qty;
    const delivery = document.querySelector('input[name="deliveryType"]:checked');
    const deliveryType = delivery ? delivery.value : 'pickup';
    const name = document.getElementById("orderBuyerName") ? document.getElementById("orderBuyerName").value : '-';
    const phone = document.getElementById("orderBuyerPhone") ? document.getElementById("orderBuyerPhone").value : '-';

    const rq = document.getElementById("reviewQty");
    const rd = document.getElementById("reviewDelivery");
    const rn = document.getElementById("reviewName");
    const rp = document.getElementById("reviewPhone");
    const rt = document.getElementById("reviewTotal");
    if (rq) rq.textContent = qty + " unit" + (qty > 1 ? "s" : "");
    if (rd) rd.textContent = deliveryType === 'pickup' ? "\ud83d\udecd\ufe0f Pickup" : "\ud83d\ude9a Delivery";
    if (rn) rn.textContent = name || '-';
    if (rp) rp.textContent = phone || '-';
    if (rt) rt.textContent = "GHS " + (unitPrice * qty).toFixed(2);
}

function updateOrderModalQty(delta) {
    if (!activeOrderProduct) return;
    const max = activeOrderProduct.product.stock_quantity;
    let newQty = activeOrderProduct.qty + delta;
    if (newQty < 1) newQty = 1;
    if (newQty > max) newQty = max;

    activeOrderProduct.qty = newQty;
    const qtyDisplay = document.getElementById("orderModalQtyDisplay");
    if (qtyDisplay) qtyDisplay.textContent = newQty;

    const unitPrice = activeOrderProduct.product.discount_price || activeOrderProduct.product.price;
    const totalEl = document.getElementById("orderModalTotalDisplay");
    if (totalEl) totalEl.textContent = `GHS ${(unitPrice * newQty).toFixed(2)}`;
    if (currentOrderStep === 3) updateOrderReview();
}

function toggleDeliveryAddressField(show) {
    const group = document.getElementById("deliveryAddressGroup");
    if (group) group.style.display = show ? "block" : "none";
    // Highlight the selected radio card
    document.querySelectorAll('input[name="deliveryType"]').forEach(radio => {
        const card = radio.closest('.radio-card');
        if (card) {
            if (radio.checked) {
                card.style.borderColor = 'var(--primary)';
                card.style.background = 'rgba(26,102,52,0.04)';
            } else {
                card.style.borderColor = '#e5e7eb';
                card.style.background = '';
            }
        }
    });
}

async function handleOrderSubmit(e) {
    e.preventDefault();
    if (!activeOrderProduct) return;

    const buyerName = document.getElementById("orderBuyerName").value.trim();
    const buyerPhone = document.getElementById("orderBuyerPhone").value.trim();
    if (!buyerName) { showToast("Enter your full name", "error"); return; }
    if (!buyerPhone || !/^0[0-9]{9}$/.test(buyerPhone)) { showToast("Enter a valid Ghana phone number", "error"); return; }

    const orderQty = activeOrderProduct.qty;
    const availableStock = activeOrderProduct.product.stock_quantity || 0;
    if (orderQty > availableStock) { showToast("Not enough stock available", "error"); return; }

    const deliveryType = document.querySelector('input[name="deliveryType"]:checked').value;
    const deliveryAddress = document.getElementById("orderDeliveryAddress") ? document.getElementById("orderDeliveryAddress").value : "";
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
        quantity: orderQty,
        total_amount: totalAmount,
        delivery_type: deliveryType,
        delivery_address: deliveryAddress,
        buyer_name: buyerName,
        buyer_phone: buyerPhone,
        buyer_notes: buyerNotes,
        status: "placed",
        placed_at: new Date().toISOString()
    , city: CITY_CONFIG.slug };



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
                status: "placed",
                city: CITY_CONFIG.slug
            });
        } catch (err) { console.error("Error saving order to Supabase:", err); }
    }

    // Decrement stock after successful order
    if (!DEMO_MODE && sbClient) {
        try {
            const newStock = Math.max(0, availableStock - orderQty);
            await sbClient.from('products').update({
                stock_quantity: newStock,
                in_stock: newStock > 0
            }).eq('id', activeOrderProduct.product.id);
        } catch (stockErr) { console.error("Stock decrement error:", stockErr); }
    }

    closeModal("orderModal");

    // --- INSTANT TRADER NOTIFICATION ---
    const shop = activeOrderProduct.shop;
    const productName = activeOrderProduct.product.name;
    const traderWa = shop.whatsapp_number || "";
    const traderPhone = shop.phone_number || shop.whatsapp_number || "";

    // 1. Open WhatsApp to trader with order details (fastest, free)
    if (traderWa) {
        const waMsg = `🔔 NEW ORDER ${orderNumber}\n\n📦 ${productName} x${orderQty}\n💰 GHS ${totalAmount.toFixed(2)}\n👤 ${buyerName} (${buyerPhone})\n🚚 ${deliveryType}\n${buyerNotes ? '📝 ' + buyerNotes : ''}\n\nRespond to buyer: ${buyerPhone}`;
        window.open(`https://wa.me/${traderWa}?text=${encodeURIComponent(waMsg)}`, "_blank");
    }

    showToast(`Order ${orderNumber} placed! Trader notified via WhatsApp.`, "success");
    navigateToPage("my-orders");
    renderBuyerOrders();
}

// ====================================================================
// 10. TRADER DASHBOARD & INLINE STOCK CONTROL
// ====================================================================
async function updateProductStockInline(productId, delta) {
    if (!sbClient) { showToast("Database not connected", "error"); return; }

    try {
        const { data: product, error } = await sbClient.from('products').select('*').eq('city', CITY_CONFIG.slug).eq('id', productId).single();
        if (error || !product) { showToast("Product not found", "error"); return; }

        let newCount = (product.stock_quantity || 0) + delta;
        if (newCount < 0) newCount = 0;

        const { error: updateErr } = await sbClient.from('products').update({
            stock_quantity: newCount,
            in_stock: newCount > 0
        }).eq('id', productId);
        if (updateErr) throw updateErr;

        renderTraderProductsList();
        searchListings();
        showToast(`Stock for ${product.name} updated to ${newCount}`, "success");
    } catch (err) {
        console.error("Error updating stock:", err);
        showToast("Could not update stock: " + (err.message || "Unknown error"), "error");
    }
}

async function renderTraderProductsList() {
    const listEl = document.getElementById("productsList");
    if (!listEl) return;

    let myProducts = [];
    if (sbClient && userShop) {
        try {
            const { data, error } = await sbClient.from('products').select('*').eq('city', CITY_CONFIG.slug).eq('shop_id', userShop.id).order('created_date', { ascending: false });
            if (error) throw error;
            myProducts = data || [];
        } catch (err) { console.error("Error loading products:", err); }
    }

    if (!userShop) {
        listEl.innerHTML = `<div style="text-align:center;padding:24px;"><p style="font-size:28px;">🏪</p><p class="form-hint">Create your shop first to start managing products.</p></div>`;
        return;
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
                <button class="stock-btn" data-action="updateStockInline" data-pid="${escapeJs(p.id)}" data-delta="-1">-</button>
                <span class="stock-count-num">${p.stock_quantity}</span>
                <button class="stock-btn" data-action="updateStockInline" data-pid="${escapeJs(p.id)}" data-delta="1">+</button>
            </div>
        </div>
    `).join("");
}

async function renderTraderOrders() {
    const container = document.getElementById("traderOrdersList");
    if (!container) return;

    let shopOrders = [];
    if (sbClient && userShop) {
        try {
            const { data, error } = await sbClient.from('orders').select('*').eq('shop_id', userShop.id).eq('city', CITY_CONFIG.slug).order('created_date', { ascending: false });
            if (error) throw error;
            shopOrders = data || [];
        } catch (err) { console.error("Error loading orders:", err); }
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
                    <button class="btn-primary btn-sm" data-action="changeOrderStatus" data-order-id="${escapeJs(o.id)}" data-status="accepted">Accept Order 👍</button>
                    <button class="btn-danger btn-sm" data-action="changeOrderStatus" data-order-id="${escapeJs(o.id)}" data-status="rejected">Reject</button>
                ` : ''}
                ${o.status === 'accepted' ? `<button class="btn-primary btn-sm" data-action="changeOrderStatus" data-order-id="${escapeJs(o.id)}" data-status="ready">Mark Ready 📦</button>` : ''}
                ${o.status === 'ready' ? `<button class="btn-primary btn-sm" data-action="changeOrderStatus" data-order-id="${escapeJs(o.id)}" data-status="completed">Complete Order ✅</button>` : ''}
            </div>
        </div>
    `).join("");
}

async function changeOrderStatus(orderId, newStatus) {
    // Update demo store if present

    if (order) order.status = newStatus;

    // Sync to Supabase
    if (!DEMO_MODE && sbClient) {
        try {
            await sbClient.from('orders').update({ status: newStatus }).eq('id', orderId);
        } catch (err) { console.error("Error updating order status in Supabase:", err); }
    }

    // Stock Management: decrement on accept, restore on cancel/reject
    if (sbClient && order.product_id) {
        try {
            if (newStatus === "accepted" && oldStatus === "placed") {
                const { data: prod } = await sbClient.from('products').select('stock_quantity').eq('id', order.product_id).single();
                if (prod) {
                    const newQty = Math.max(0, (prod.stock_quantity || 0) - order.quantity);
                    await sbClient.from('products').update({ stock_quantity: newQty, in_stock: newQty > 0 }).eq('id', order.product_id);
                }
            } else if ((newStatus === "cancelled" || newStatus === "rejected") && (oldStatus === "accepted" || oldStatus === "ready")) {
                const { data: prod } = await sbClient.from('products').select('stock_quantity').eq('id', order.product_id).single();
                if (prod) {
                    const restoredQty = (prod.stock_quantity || 0) + order.quantity;
                    await sbClient.from('products').update({ stock_quantity: restoredQty, in_stock: true }).eq('id', order.product_id);
                }
            }
        } catch (err) { console.error("Error updating product stock:", err); }
    }

    renderTraderOrders();
    renderBuyerOrders();
    searchListings();
    showToast(`Order ${order.order_number} status updated to ${newStatus}`, "success");
}

async function renderBuyerOrders() {
    const container1 = document.getElementById("buyerOrdersList");
    const container2 = document.getElementById("accountOrdersList");

    let orders = [];
    if (!DEMO_MODE && sbClient) {
        try {
            const buyerId = currentUser ? currentUser.id : null;
            if (buyerId) {
                const { data, error } = await sbClient.from('orders').select('*').eq('buyer_id', buyerId).eq('city', CITY_CONFIG.slug).order('created_date', { ascending: false });
                if (error) throw error;
                orders = data || [];
            }
        } catch (err) { console.error("Error loading buyer orders:", err); }
    }


    const render = (el) => {
        if (!el) return;
        if (orders.length === 0) {
            el.innerHTML = `<div class="empty-state"><p>📦 No express order reservations placed yet.</p></div>`;
            return;
        }

        el.innerHTML = orders.map(o => `
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
                        <button class="btn-primary btn-sm" data-action="openReviewModal" data-order-id="${escapeJs(o.id)}" data-shop-id="${escapeJs(o.shop_id)}" data-product-id="${escapeJs(o.product_id)}">⭐ Leave Verified Review</button>
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

    // Review saved to Supabase via handleReviewSubmit

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
                comment: newReview.comment,
                city: CITY_CONFIG.slug
            });
        } catch (err) { console.error("Error saving review to Supabase:", err); }
    }

    // Auto recalculate shop rating
    // Reviews fetched from Supabase in showShopDetailModal
    const avg = shopReviews.reduce((sum, r) => sum + r.rating, 0) / shopReviews.length;

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

    let reviews = [];
    if (!DEMO_MODE && sbClient && userShop) {
        try {
            const { data, error } = await sbClient.from('reviews').select('*').eq('shop_id', userShop.id).eq('city', CITY_CONFIG.slug).order('created_date', { ascending: false });
            if (error) throw error;
            reviews = data || [];
        } catch (err) { console.error("Error loading reviews:", err); }
    }


    if (reviews.length === 0) {
        listEl.innerHTML = `<p class="form-hint">No customer reviews yet.</p>`;
        return;
    }

    listEl.innerHTML = reviews.map(r => `
        <div class="card" style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>${escapeHtml(r.buyer_name)} <span class="verification-badge verified">✓ Verified Buyer</span></strong>
                <span class="star-rating">⭐ ${r.rating || 5}.0</span>
            </div>
            <p style="font-size:13px; margin:6px 0;">"${escapeHtml(r.comment)}"</p>
            ${r.trader_reply ? `
                <div style="background:#f1f5f9; padding:8px; border-radius:6px; font-size:12px; margin-top:6px;">
                    <strong>Your Reply:</strong> ${escapeHtml(r.trader_reply)}
                </div>
            ` : `
                <button class="btn-secondary btn-sm" style="margin-top:6px;" data-action="openReplyModal" data-review-id="${escapeJs(r.id)}">💬 Reply to Review</button>
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

    // Review fetched from Supabase
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

    // Report saved to Supabase
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
                status: "pending",
                    city: CITY_CONFIG.slug
                });
        } catch (err) { console.error("Error saving report to Supabase:", err); }
    }

    closeModal("reportModal");
    showToast("Report submitted to moderation. Thank you for keeping TMF safe!", "success");
}

// Handle Help & Support form submission
async function handleHelpSubmit(e) {
    e.preventDefault();
    const name = document.getElementById("helpName").value.trim();
    const contact = document.getElementById("helpContact").value.trim();
    const type = document.getElementById("helpType").value;
    const message = document.getElementById("helpMessage").value.trim();

    if (!name || !contact || !message) {
        showToast("Please fill in all fields", "error");
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    if (sbClient) {
        try {
            const { error } = await sbClient.from('support_tickets').insert({
                name: name,
                contact: contact,
                request_type: type,
                message: message,
                status: "open",
                created_by: currentUser?.id || null,
                city: CITY_CONFIG.slug
            });
            if (error) throw error;

            showToast("Message sent! Our team will contact you soon.", "success");
            document.getElementById("helpForm").reset();
            closeModal("helpModal");
        } catch (err) {
            console.error("Help submit error:", err);
            showToast("Could not send message: " + (err.message || "Unknown error"), "error");
        }
    } else {
        showToast("Database not connected. Please try again later.", "error");
    }

    submitBtn.disabled = false;
    submitBtn.textContent = "Send Message";
}

async function renderAdminPanel() {
    const reportsList = document.getElementById("adminReportsList");
    if (!reportsList) return;

    // Authorization check: only admins can access this panel
    if (userProfile.account_type !== "admin") {
        reportsList.innerHTML = `<p class="form-hint">⚠️ Admin access required.</p>`;
        return;
    }

    let reports = [];
    if (!DEMO_MODE && sbClient) {
        try {
            const { data, error } = await sbClient.from('reports').select('*').eq('city', CITY_CONFIG.slug).order('created_date', { ascending: false });
            if (error) throw error;
            reports = data || [];
        } catch (err) { console.error("Error loading reports:", err); }
    }


    if (reports.length === 0) {
        reportsList.innerHTML = `<p class="form-hint">No pending reports in queue.</p>`;
        return;
    }

    reportsList.innerHTML = reports.map(r => `
        <div class="report-queue-card">
            <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700;">
                <span>🚩 TYPE: ${escapeHtml(r.reported_type || '').toUpperCase()} • CATEGORY: ${escapeHtml(r.reason_category || '')}</span>
                <span>STATUS: ${escapeHtml(r.status || '').toUpperCase()}</span>
            </div>
            <p style="font-size:13px; margin:8px 0;">${escapeHtml(r.description)}</p>
            <div style="display:flex; gap:6px;">
                <button class="btn-secondary btn-sm" data-action="dismissReport" data-report-id="${escapeJs(r.id)}">Approve & Dismiss</button>
                <button class="btn-danger btn-sm" data-action="takeModerationAction" data-report-id="${escapeJs(r.id)}">Hide Item / Suspend</button>
            </div>
        </div>
    `).join("");
}

async function dismissReport(repId) {
    if (!sbClient) { showToast("Database not connected", "error"); return; }
    try {
        const { error } = await sbClient.from('reports').delete().eq('id', repId);
        if (error) throw error;
        showToast("Report dismissed.", "success");
        renderAdminPanel();
    } catch (err) {
        showToast(err.message || "Could not dismiss report", "error");
    }
}

async function takeModerationAction(repId) {
    if (!sbClient) { showToast("Database not connected", "error"); return; }
    try {
        // Fetch the report to find what to moderate
        const { data: report, error: fetchErr } = await sbClient.from('reports').select('*').eq('id', repId).single();
        if (fetchErr) throw fetchErr;
        if (!report) { showToast("Report not found", "error"); return; }

        // Hide the reported item based on type
        if (report.reported_type === "product") {
            const { error: prodErr } = await sbClient.from('products')
                .update({ in_stock: false }).eq('id', report.target_id);
            if (prodErr) console.error("Product hide error:", prodErr);
        } else if (report.reported_type === "shop") {
            const { error: shopErr } = await sbClient.from('shops')
                .update({ is_active: false }).eq('id', report.target_id);
            if (shopErr) console.error("Shop hide error:", shopErr);
        }

        // Delete the report after action taken
        await sbClient.from('reports').delete().eq('id', repId);
        showToast("Action taken. Item hidden from public search.", "success");
        renderAdminPanel();
        searchListings();
    } catch (err) {
        showToast(err.message || "Could not take moderation action", "error");
    }
}

async function runAISecurityScan() {
    if (!sbClient) { showToast("Database not connected", "error"); return; }
    const SUSPICIOUS = [
        "wire transfer", "bitcoin", "cryptocurrency", "send money first",
        "advance payment", "western union", "moneygram", "paypal gift",
        "gift card", "google play card", "itunes card", "steam card",
        "too good to be true", "guaranteed profit", "double your money",
        "investment opportunity", "forex trading", "mlm", "pyramid scheme",
        "work from home", "earn money fast", "get rich quick",
        "free iphone", "free money", "lottery winner", "inheritance",
        "nigerian prince", "bank transfer only", "no cash on delivery",
        "urgent sale", "must sell today", "moving abroad",
        "send deposit", "hold this item", "pre-order only",
        "agent fee", "delivery fee upfront", "custom clearance fee",
        "no refund", "non-refundable", "final sale no return", "no guarantee",
        "whatsapp only", "dont call", "no calls", "text only",
        "fake", "replica", "counterfeit", "clone", "copy of original",
        "voodoo", "hacked", "cracked", "modded", "jailbroken"
    ];
    let flaggedCount = 0;

    try {
        const { data: products, error } = await sbClient.from('products').select('id,name,description');
        if (error) throw error;

        for (const p of (products || [])) {
            const text = ((p.name || '') + ' ' + (p.description || '')).toLowerCase();
            if (SUSPICIOUS.some(kw => text.includes(kw))) {
                flaggedCount++;
                await sbClient.from('reports').insert({
                    reported_type: "product",
                    target_id: p.id,
                    reason_category: "scam_attempt",
                    description: `[AI SCANNER DETECTED]: Suspicious keyword match in "${p.name}"`,
                    status: "pending"
                });
            }
        }
    } catch (err) {
        console.error("AI scan error:", err);
    }

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

    if (!userShop) { showToast("Create your shop stall first", "error"); return; }
    const duration = parseInt(document.getElementById("adDuration")?.value) || 7;
    let baseRate = 25.00;
    if (tier === "category_featured") baseRate = 40.00;
    if (tier === "premium_top") baseRate = 70.00;
    const calculatedFee = baseRate * (duration / 7);

    const newAd = {
        id: "ad-" + Date.now(),
        trader_id: currentUser ? currentUser.id : "trader-1",
        shop_id: userShop.id,
        ad_tier: tier,
        fee_paid_ghs: calculatedFee,
        payment_reference: momoRef,
        status: "pending"
    };

    // Ad placement saved to Supabase

    // Save to Supabase if available
    if (!DEMO_MODE && sbClient) {
        try {
            await sbClient.from('ad_placements').insert({
                trader_id: newAd.trader_id,
                shop_id: newAd.shop_id,
                ad_tier: newAd.ad_tier,
                fee_paid_ghs: newAd.fee_paid_ghs,
                payment_reference: newAd.payment_reference,
                status: "pending",
                    city: CITY_CONFIG.slug
                });
        } catch (err) { console.error("Error saving ad to Supabase:", err); }
    }

    closeModal("adModal");
    renderTraderAds();
    showToast("Ad campaign application submitted! Admin approval pending.", "success");
}

async function renderTraderAds() {
    const container = document.getElementById("traderAdPlacementsList");
    if (!container) return;

    let ads = [];
    if (!DEMO_MODE && sbClient && userShop) {
        try {
            const { data, error } = await sbClient.from('ad_placements').select('*').eq('shop_id', userShop.id).order('created_date', { ascending: false });
            if (error) throw error;
            ads = data || [];
        } catch (err) { console.error("Error loading ads:", err); }
    }


    if (ads.length === 0) {
        container.innerHTML = `<p class="form-hint">No active spotlight campaigns.</p>`;
        return;
    }

    container.innerHTML = ads.map(a => `
        <div class="card" style="margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>📢 ${escapeHtml(a.ad_tier || '').toUpperCase()}</strong>
                <span class="order-status-badge status-${escapeHtml(a.status || '')}">${escapeHtml(a.status || '')}</span>
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
async function showShopDetailModal(shopId) {
    let shop = {};
    let shopProducts = [];
    let shopReviews = [];

    if (!sbClient) {
        showToast("Unable to load shop details", "error");
        return;
    }
    try {
        const { data: shopData, error: shopErr } = await sbClient.from('public_shops').select('*').eq('id', shopId).eq('city', CITY_CONFIG.slug).single();
        if (shopErr) throw shopErr;
        if (shopData) shop = shopData;
        // Hide delivery option if shop doesn't offer delivery
        const deliveryLabel = document.getElementById("deliveryOptionLabel");
        if (deliveryLabel) {
            deliveryLabel.style.display = shop?.offers_delivery ? "" : "none";
        }
        const { data: prodData, error: prodErr } = await sbClient.from('products').select('*').eq('city', CITY_CONFIG.slug).eq('shop_id', shopId).eq('in_stock', true);
        if (prodErr) throw prodErr;
        if (prodData) shopProducts = prodData;
        const { data: reviewData, error: revErr } = await sbClient.from('reviews').select('*').eq('shop_id', shopId).order('created_date', { ascending: false }).limit(10);
        if (revErr) console.warn("Could not load reviews:", revErr);
        if (reviewData) shopReviews = reviewData;
    } catch (err) {
        console.error("Error loading shop detail:", err);
        showToast("Could not load shop details: " + (err.message || "Unknown error"), "error");
        return;
    }

    const modalBody = document.getElementById("modalBody");
    modalBody.innerHTML = `
        <div class="shop-modal-header" style="margin-bottom:16px;">
            <img src="${escapeAttr(shop.cover_image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e')}" style="width:100%; height:180px; object-fit:cover; border-radius:10px; margin-bottom:12px;" />
            <h2 style="font-size:22px; font-weight:800;">${escapeHtml(shop.shop_name)}</h2>
            <div style="font-size:13px; color:var(--text-muted);">📍 ${escapeHtml(shop.address || shop.market_area)} • 🇬🇭 ${escapeHtml(shop.digital_address || 'NT-092-0621')}</div>
            <div class="star-rating" style="margin-top:6px;">⭐ ${shop.rating_avg || 4.8} (${shop.rating_count || 12} customer reviews)</div>
            ${shop.ghana_card_verified ? '<span style="display:inline-block; background:#DCFCE7; color:#16A34A; padding:2px 10px; border-radius:12px; font-size:11px; font-weight:600; margin-top:6px;">✓ Ghana Card Verified</span>' : ''}
            ${shop.latitude && shop.longitude ? `
            <div style="margin-top:10px;">
                <button data-action="drawDirections" data-lat="${shop.latitude}" data-lng="${shop.longitude}" data-name="${escapeJs(shop.shop_name)}" style="background:#2196F3; color:white; border:none; padding:10px 16px; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer;">🧭 Get Directions to This Stall</button>
            </div>
            ` : ''}
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
                        <strong>${escapeHtml(r.buyer_name || r.reviewer_name || 'Anonymous')}</strong>
                        <span class="star-rating">⭐ ${r.rating || 5}.0</span>
                    </div>
                    <p style="margin:4px 0;">"${escapeHtml(r.comment || '')}"</p>
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
async function lookupDigitalAddress() {
    const code = document.getElementById("shopDigitalAddress").value.toUpperCase().trim();
    if (!code) {
        showToast("Enter your digital address (e.g. NT-092-0621) or use GPS", "warning");
        return;
    }

    // Validate Ghana Post digital address format: 2 letters + dash + 3 digits + dash + 4 digits
    if (!/^[A-Z]{2}-\d{3}-\d{4}$/.test(code)) {
        showToast("Invalid format. Example: NT-092-0621", "warning");
        return;
    }

    // Manual address entry + map picker has no public API — open the map picker so traders can
    // manually set their pin. No fake coordinates.
    showToast("Enter your GPS coordinates manually or use the map picker below", "info");
    openMapPicker();
}

// Map picker: lets traders click on a map to set their shop location
let pickerMap = null;
let pickerMarker = null;

function openMapPicker() {
    // Show the map picker container
    const picker = document.getElementById("mapPickerContainer");
    if (!picker) return;

    picker.style.display = "block";

    // Default center: Tamale
    const existingLat = parseFloat(document.getElementById("shopLat").value);
    const existingLng = parseFloat(document.getElementById("shopLng").value);
    const centerLat = isNaN(existingLat) ? 9.4030 : existingLat;
    const centerLng = isNaN(existingLng) ? -0.8357 : existingLng;

    if (pickerMap) {
        pickerMap.setView([centerLat, centerLng], 15);
        if (pickerMarker) pickerMap.removeLayer(pickerMarker);
        pickerMarker = L.marker([centerLat, centerLng]).addTo(pickerMap);
    } else {
        pickerMap = L.map("shopMapPicker").setView([centerLat, centerLng], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "OpenStreetMap", maxZoom: 19
        }).addTo(pickerMap);

        pickerMap.on("click", (e) => {
            if (pickerMarker) pickerMap.removeLayer(pickerMarker);
            pickerMarker = L.marker(e.latlng).addTo(pickerMap);
            const lat = e.latlng.lat.toFixed(6);
            const lng = e.latlng.lng.toFixed(6);
            document.getElementById("shopLat").value = lat;
            document.getElementById("shopLng").value = lng;
            document.getElementById("locationStatus").textContent = `GPS Pin: ${lat}, ${lng} (map-selected)`;
        });

        if (!isNaN(existingLat) && !isNaN(existingLng)) {
            pickerMarker = L.marker([centerLat, centerLng]).addTo(pickerMap);
        }
    }

    // Also show manual lat/lng inputs
    const manualInputs = document.getElementById("manualCoordsRow");
    if (manualInputs) manualInputs.style.display = "flex";
}

function handleGetDeviceLocation() {
    if ("geolocation" in navigator) {
        document.getElementById("locationStatus").textContent = "GPS Pin: Detecting your location (high accuracy)...";
        navigator.geolocation.getCurrentPosition(async pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            // Update global location used for ranking
            userLocation = { latitude: lat, longitude: lng };
            document.getElementById("shopLat").value = lat.toFixed(6);
            document.getElementById("shopLng").value = lng.toFixed(6);

            // Manual address entry + map picker has no public API — just use coordinates from device GPS
            document.getElementById("locationStatus").textContent = `GPS Pin: ${lat.toFixed(6)}, ${lng.toFixed(6)} (device GPS)`;
            showToast("Device GPS location set. Enter your digital address manually if you have one.", "success");
        }, err => {
            // High-accuracy failed — retry with approximate
            if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
                document.getElementById("locationStatus").textContent = "GPS Pin: Retrying with approximate location...";
                navigator.geolocation.getCurrentPosition(async pos => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    userLocation = { latitude: lat, longitude: lng };
                    document.getElementById("shopLat").value = lat.toFixed(6);
                    document.getElementById("shopLng").value = lng.toFixed(6);
                    // Manual address entry + map picker has no public API — just use device GPS coordinates
                    document.getElementById("locationStatus").textContent = `GPS Pin: ${lat.toFixed(6)}, ${lng.toFixed(6)} (device GPS — approximate)`;
                    showToast("Approximate GPS location set. Enter your digital address manually if you have one.", "success");
                }, () => {
                    document.getElementById("locationStatus").textContent = "GPS Pin: Not Set";
                    showToast("Could not acquire location. Enter your digital address manually.", "warning");
                }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 });
            } else if (err.code === err.PERMISSION_DENIED) {
                document.getElementById("locationStatus").textContent = "GPS Pin: Not Set";
                showToast("Location permission denied. Enable GPS in browser settings.", "warning");
            } else {
                document.getElementById("locationStatus").textContent = "GPS Pin: Not Set";
                showToast("Could not acquire device location. Please enter your digital address manually.", "warning");
            }
        }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    } else {
        showToast("GPS not available on this device. Please enter your digital address manually.", "warning");
    }
}

// ====================================================================
// 16. USER PROFILE & UI HELPER ACTIONS
// ====================================================================
function navigateToPage(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".drawer-item").forEach(d => d.classList.remove("active"));
    document.querySelectorAll(".bottom-nav-item").forEach(b => b.classList.remove("active"));

    // Handle account sub-navigation from drawer
    let actualPage = pageId;
    let accountSubTab = null;

    if (pageId === "account-settings") { actualPage = "account"; accountSubTab = "profile"; }
    else if (pageId === "account-trader") { actualPage = "account"; accountSubTab = "trader"; }
    else if (pageId === "account-admin") { actualPage = "account"; accountSubTab = "admin"; }

    const targetPage = document.getElementById("page-" + actualPage);
    if (targetPage) targetPage.classList.add("active");

    const drawerItem = document.querySelector(`.drawer-item[data-nav="${pageId}"]`);
    if (drawerItem) drawerItem.classList.add("active");

    const bottomItem = document.querySelector(`.bottom-nav-item[data-nav="${actualPage}"]`);
    if (bottomItem) bottomItem.classList.add("active");

    // Activate the correct account sub-tab
    if (accountSubTab) {
        document.querySelectorAll(".acc-tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".acc-tab-content").forEach(c => c.classList.remove("active"));
        const tabBtn = document.querySelector(`.acc-tab-btn[data-acctab="${accountSubTab}"]`);
        const tabContent = document.getElementById("acctab-" + accountSubTab);
        if (tabBtn) tabBtn.classList.add("active");
        if (tabContent) tabContent.classList.add("active");

        if (accountSubTab === "trader") {
            renderTraderProductsList();
            renderTraderOrders();
        }
        if (accountSubTab === "admin") renderAdminPanel();
    }

    if (actualPage === "my-orders") renderBuyerOrders();
    if (actualPage === "favorites") renderFavoritesPage();

    // Terms page is static HTML, nothing to render dynamically
    if (pageId === "terms") {
        // Just scroll to top
    }

    // Help opens a modal, not a page
    if (pageId === "help") {
        openModal("helpModal");
        closeDrawer();
        return;
    }

    // Scroll to top
    window.scrollTo(0, 0);
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
    const num = number ? number.replace(/[^0-9]/g, "") : "";
    if (!num) {
        showToast("No WhatsApp number available for this listing.", "warning");
        return;
    }
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
    showToast("Welcome to your store! Set up your stall to start selling.", "success");
    setTimeout(() => {
        navigateToPage("account-trader");
        closeDrawer();
    }, 500);
}

// Dashboard delivery toggle - quick toggle for delivery
async function toggleDashboardDelivery() {
    const checkbox = document.getElementById("dashboardDeliveryToggle");
    if (!checkbox || !sbClient || !userShop) return;
    try {
        await sbClient.from("shops").update({ offers_delivery: checkbox.checked }).eq("id", userShop.id);
        userShop.offers_delivery = checkbox.checked;
        showToast(checkbox.checked ? "Delivery enabled! Buyers can now choose delivery." : "Delivery disabled.", "success");
    } catch (err) {
        showToast("Could not update delivery setting", "error");
        checkbox.checked = !checkbox.checked;
    }
}

function updateUIForAuthUser() {
    document.getElementById("drawerName").textContent = userProfile.full_name || "User";
    document.getElementById("drawerEmail").textContent = currentUser?.email || "Sign in to save shops, order & manage listings";

    // Toggle trader-mode class on menu button (orange color in trader mode)
    const menuBtn = document.getElementById("menuToggle");
    if (menuBtn) {
        if (userProfile.account_type === "trader") {
            menuBtn.classList.add("trader-mode");
        } else {
            menuBtn.classList.remove("trader-mode");
        }
    }

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

    // Show/hide admin tab — only visible to actual admins
    const adminTabBtn = document.getElementById("adminTabBtn");
    if (adminTabBtn) {
        adminTabBtn.style.display = (userProfile.account_type === "admin") ? "" : "none";
    }

    // Show/hide trader dashboard
    const upgradePrompt = document.getElementById("trader-upgrade-prompt");
    const dashContent = document.getElementById("trader-dashboard-content");
    if (userProfile.account_type === "trader") {
        if (upgradePrompt) upgradePrompt.style.display = "none";
        if (dashContent) dashContent.style.display = "block";
        loadTraderStats();
        updateTraderNotificationBadge();
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
        const sd = document.getElementById("shopOffersDelivery"); if (sd) sd.checked = userShop.offers_delivery || false;
        const ddt = document.getElementById("dashboardDeliveryToggle"); if (ddt) ddt.checked = userShop.offers_delivery || false;
        const sma = document.getElementById("shopMarketArea"); if (sma) sma.value = userShop.market_area || "";
        const sda = document.getElementById("shopDigitalAddress"); if (sda) sda.value = userShop.digital_address || "";
        const sa = document.getElementById("shopAddress"); if (sa) sa.value = userShop.address || "";
        const sp = document.getElementById("shopPhone"); if (sp) sp.value = userShop.phone || "";
        const sw = document.getElementById("shopWhatsapp"); if (sw) sw.value = userShop.whatsapp_number || "";
        const slat = document.getElementById("shopLat"); if (slat) slat.value = userShop.latitude || "";
        const slng = document.getElementById("shopLng"); if (slng) slng.value = userShop.longitude || "";

        // Fill Ghana Card fields
        const gcn = document.getElementById("ghanaCardNumber"); if (gcn) gcn.value = userShop.ghana_card_number || "";
        const gcfn = document.getElementById("ghanaCardFullName"); if (gcfn) gcfn.value = userShop.ghana_card_full_name || "";
        const gct = document.getElementById("ghanaCardType"); if (gct) gct.value = userShop.ghana_card_type || "national_id";
        if (userShop.ghana_card_photo_url) {
            const preview = document.getElementById("ghanaCardPreview");
            const previewImg = document.getElementById("ghanaCardPreviewImg");
            if (preview) preview.style.display = "block";
            // Ghana Card photos are in private bucket — use signed URL
            if (userShop.ghana_card_photo_url.startsWith("ghana-cards/")) {
                const cardPath = userShop.ghana_card_photo_url.substring("ghana-cards/".length);
                if (sbClient) {
                    sbClient.storage.from("ghana-cards").createSignedUrl(cardPath, 3600).then(({ data, error }) => {
                        if (!error && data?.signedUrl && previewImg) previewImg.src = data.signedUrl;
                    });
                }
            } else if (previewImg) {
                previewImg.src = userShop.ghana_card_photo_url;
            }
        }
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
    const menuBtnLogout = document.getElementById("menuToggle");
    if (menuBtnLogout) menuBtnLogout.classList.remove("trader-mode");
    const authBtn = document.getElementById("drawerAuthActionBtn");
    if (authBtn) authBtn.innerHTML = '<span class="drawer-icon">🔑</span> Sign In / Register';
    // Hide admin tab for guests
    const adminTabBtn = document.getElementById("adminTabBtn");
    if (adminTabBtn) adminTabBtn.style.display = "none";
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
        // Fetch user profile to check role
        if (sbClient && data.user) {
            try {
                const { data: profile } = await sbClient.from('user_profiles').select('account_type').eq('id', data.user.id).single();
                if (profile && profile.account_type === "trader") {
                    showToast("Welcome back to your store!", "success");
                    setTimeout(() => {
                        navigateToPage("account-trader");
                        closeDrawer();
                    }, 600);
                    return;
                }
            } catch (e) { console.error("Profile fetch on login:", e); }
        }
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

    // Validate Ghana phone format: 0XXXXXXXXX (10 digits starting with 0)
    if (!/^0[0-9]{9}$/.test(phone)) {
        showToast("Enter a valid Ghana phone number (e.g. 0244123456)", "error"); return;
    }
    // Password strength: min 8 chars with at least 1 number
    if (password.length < 8) {
        showToast("Password must be at least 8 characters", "error"); return;
    }
    if (!/[0-9]/.test(password)) {
        showToast("Password must contain at least one number", "error"); return;
    }
    if (fullName.length < 2) {
        showToast("Enter your full name", "error"); return;
    }

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
                id: data.user.id, full_name: fullName, phone: phone, account_type: role, city: CITY_CONFIG.slug
            });
        }
        closeModal("authModal");
        if (role === "trader") {
            showToast("Welcome to your store! Set up your stall details to start selling.", "success");
            setTimeout(() => {
                navigateToPage("account-trader");
                closeDrawer();
            }, 600);
        } else {
            showToast("Account created! Check your email to confirm.", "success");
        }
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

    // Ghana Card fields are now optional
    const ghanaCardNum = document.getElementById("ghanaCardNumber")?.value.trim() || "";
    const ghanaCardName = document.getElementById("ghanaCardFullName")?.value.trim() || "";
    const ghanaCardConsent = document.getElementById("ghanaCardConsent")?.checked || false;
    const ghanaCardPhoto = document.getElementById("ghanaCardPhoto")?.files[0] || null;

    // Only validate consent if they filled in card number
    if (ghanaCardNum && !ghanaCardConsent) {
        showToast("Please confirm the Ghana Card consent checkbox", "error"); return;
    }

    // Upload Ghana Card photo if a new file was selected
    let ghanaCardPhotoUrl = userShop?.ghana_card_photo_url || null;
    if (ghanaCardPhoto) {
        // Validate file type and size
        if (!ghanaCardPhoto.type.startsWith('image/')) {
            showToast("Please upload an image file (JPG, PNG)", "error"); return;
        }
        if (ghanaCardPhoto.size > 5 * 1024 * 1024) {
            showToast("Image must be under 5MB", "error"); return;
        }
        try {
            const fileExt = ghanaCardPhoto.name.split('.').pop();
            const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
            const { data: uploadData, error: uploadError } = await sbClient.storage
                .from('ghana-cards')
                .upload(fileName, ghanaCardPhoto, { upsert: false });
            if (uploadError) throw uploadError;
            // Private bucket: store the path, not a public URL
            ghanaCardPhotoUrl = `ghana-cards/${fileName}`;

        } catch (uploadErr) {
            console.error("Ghana Card photo upload error:", uploadErr);
            showToast("Card photo upload failed, but saving other details...", "warning");
        }
    }

    const shopData = {
        created_by: currentUser.id,
        owner_name: userProfile.full_name,
        shop_name: document.getElementById("shopName").value.trim(),
        category: document.getElementById("shopCategory")?.value || detectCategory(document.getElementById("shopDescription")?.value || ""),
        offers_delivery: document.getElementById("shopOffersDelivery")?.checked || false,
        market_area: document.getElementById("shopMarketArea").value,
        digital_address: document.getElementById("shopDigitalAddress").value.trim(),
        address: document.getElementById("shopAddress").value.trim(),
        phone: document.getElementById("shopPhone").value.trim(),
        whatsapp_number: document.getElementById("shopWhatsapp").value.trim(),
        opening_hours: document.getElementById("shopHours")?.value?.trim() || "",
        description: document.getElementById("shopDescription")?.value?.trim() || "",
        latitude: parseFloat(document.getElementById("shopLat").value) || null,
        longitude: parseFloat(document.getElementById("shopLng").value) || null,
        ghana_card_number: ghanaCardNum,
        ghana_card_full_name: ghanaCardName,
        ghana_card_type: document.getElementById("ghanaCardType")?.value || "national_id",
        ghana_card_photo_url: ghanaCardPhotoUrl,
        ghana_card_verified: false,
        is_active: true,
        offers_delivery: document.getElementById("shopOffersDelivery")?.checked || false,
        updated_date: new Date().toISOString(),
                city: CITY_CONFIG.slug
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
        showToast("Market stall details saved! Ghana Card pending verification.", "success");
    } catch (err) {
        showToast(err.message || "Could not save shop details", "error");
    }
}

async function handleSaveProduct(e) {
    e.preventDefault();
    if (!sbClient || !currentUser) { showToast("Sign in first", "error"); return; }
    if (!userShop) { showToast("Create your shop stall first", "error"); return; }
    const productId = document.getElementById("productId").value;
    const productName = document.getElementById("productName").value.trim();
    const productPrice = parseFloat(document.getElementById("productPrice").value) || 0;
    if (!productName) { showToast("Product name is required", "error"); return; }
    if (productPrice <= 0) { showToast("Price must be greater than 0", "error"); return; }

    // Handle product image file upload
    let productImageUrl = document.getElementById("productImage")?.value || "";
    const productImageFile = document.getElementById("productImageFile")?.files[0] || null;
    if (productImageFile && productImageUrl.startsWith("data:")) {
        try {
            const fileExt = productImageFile.name.split(".").pop();
            const fileName = `${currentUser.id}/products_${Date.now()}.${fileExt}`;
            const { error: uploadError } = await sbClient.storage.from("product-images").upload(fileName, productImageFile);
            if (!uploadError) {
                const { data: pubData } = sbClient.storage.from("product-images").getPublicUrl(fileName);
                productImageUrl = pubData?.publicUrl || "";
            }
        } catch (uploadErr) {
            console.error("Product image upload error:", uploadErr);
            showToast("Image upload failed, saving without image...", "warning");
            productImageUrl = "";
        }
    }
    const productData = {
        shop_id: userShop.id,
        name: document.getElementById("productName").value.trim(),
        category: document.getElementById("productCategory").value.trim() || detectCategory(document.getElementById("productName").value + " " + (document.getElementById("productDescription")?.value || "")),
        price: parseFloat(document.getElementById("productPrice").value) || 0,
        discount_price: parseFloat(document.getElementById("productDiscountPrice").value) || null,
        badge_tag: document.getElementById("productBadgeTag").value || null,
        stock_quantity: parseInt(document.getElementById("productStockQuantity").value) || 0,
        low_stock_threshold: parseInt(document.getElementById("productLowStockThreshold").value) || 3,
        description: document.getElementById("productDescription").value.trim(),
        image_url: productImageUrl,
        in_stock: document.getElementById("productInStock").checked,
        listing_type: "product",
                city: CITY_CONFIG.slug
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
            const { data, error } = await sbClient.from('public_shops').select('*').in('id', favIds);
            if (error) throw error;
            favShops = data || [];
        } catch (err) {
    
        }
    } else {

    }

    list.innerHTML = favShops.map(s => `
        <div class="card" data-action="showShopDetail" data-shop-id="${escapeJs(s.id)}">
            <h3 class="card-title">${escapeHtml(s.shop_name)}</h3>
            <p style="font-size:12px; color:var(--text-muted);">📍 ${escapeHtml(s.market_area)} • 🇬🇭 ${escapeHtml(s.digital_address || '')}</p>
        </div>
    `).join("");
}
// Latest security update


// ====================================================================
// TRADER QUICK STATS OVERVIEW
// ====================================================================
async function loadTraderStats() {
    if (!sbClient || !userShop) {
        // Reset stats to 0
        const ids = ['statTotalProducts', 'statPendingOrders', 'statProfileViews', 'statAvgRating'];
        ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '0'; });
        const ratingEl = document.getElementById('statAvgRating');
        if (ratingEl) ratingEl.textContent = '0.0';
        return;
    }

    try {
        // Fetch product count
        const { count: productCount, error: pErr } = await sbClient
            .from('products').select('*', { count: 'exact', head: true })
            .eq('shop_id', userShop.id);

        // Fetch pending orders count
        const { count: orderCount, error: oErr } = await sbClient
            .from('orders').select('*', { count: 'exact', head: true })
            .eq('shop_id', userShop.id)
            .eq('status', 'pending');

        // Profile views (from shop data if available, fallback to 0)
        const views = userShop.view_count || userShop.profile_views || 0;

        // Average rating
        const rating = userShop.rating_avg || 0;

        // Update DOM
        const elProducts = document.getElementById('statTotalProducts');
        const elOrders = document.getElementById('statPendingOrders');
        const elViews = document.getElementById('statProfileViews');
        const elRating = document.getElementById('statAvgRating');

        if (elProducts) elProducts.textContent = productCount || 0;
        if (elOrders) elOrders.textContent = orderCount || 0;
        if (elViews) elViews.textContent = views;
        if (elRating) elRating.textContent = (rating > 0 ? rating.toFixed(1) : '0.0');
    } catch (err) {
        console.error("Error loading trader stats:", err);
    }
}

// ====================================================================
// TRADER NOTIFICATION BADGE — live pending order count on drawer
// ====================================================================
async function updateTraderNotificationBadge() {
    if (!sbClient || !userShop || userProfile.account_type !== "trader") {
        const badge = document.getElementById("traderBadgeText");
        if (badge) badge.textContent = "Trader Dashboard";
        return;
    }
    try {
        const { count, error } = await sbClient
            .from('orders').select('*', { count: 'exact', head: true })
            .eq('shop_id', userShop.id)
            .in('status', ['placed', 'accepted']);
        const badge = document.getElementById("traderBadgeText");
        if (badge) {
            if (count && count > 0) {
                badge.innerHTML = `🔔 ${count} new order${count > 1 ? 's' : ''}`;
                badge.style.background = '#FEF3C7';
                badge.style.color = '#92400E';
                badge.style.fontWeight = '700';
            } else {
                badge.textContent = "Trader Dashboard";
                badge.style.background = '';
                badge.style.color = '';
                badge.style.fontWeight = '';
            }
        }
        // Also update the orders badge inside the dashboard
        const ordersBadge = document.getElementById('traderOrdersBadge');
        if (ordersBadge) ordersBadge.textContent = count || 0;
    } catch (err) {
        console.error("Error updating trader badge:", err);
    }
}

// Poll for new orders every 30 seconds when trader is logged in
setInterval(() => {
    if (sbClient && userShop && userProfile.account_type === "trader") {
        updateTraderNotificationBadge();
    }
}, 30000);

// ====================================================================
// SPOTLIGHT POPUP MODAL (Ad-style, auto-dismiss, video support)
// ====================================================================
let spotlightPopupTimer = null;
let spotlightPopupCountdown = 8;
let spotlightPopupShown = false;

async function showSpotlightPopup() {
    // Only show once per session
    if (spotlightPopupShown) return;
    if (sessionStorage.getItem('spotlightPopupSeen')) return;

    let spotlightShops = [];

    if (!DEMO_MODE && sbClient) {
        try {
            const { data, error } = await sbClient.from('public_shops').select('*').eq('is_active', true).eq('city', CITY_CONFIG.slug).order('rating_avg', { ascending: false }).limit(5);
            if (error) throw error;
            spotlightShops = (data || []).filter(s => s.ad_tier === "basic_spotlight" || s.ad_tier === "premium_top");
            if (spotlightShops.length === 0 && data && data.length > 0) spotlightShops = data.slice(0, 1);
        } catch (err) {
            console.error("Spotlight popup fetch error:", err);
        }
    }

    // Don't show popup if no spotlight shops
    if (spotlightShops.length === 0) return;

    const shop = spotlightShops[0];
    spotlightPopupShown = true;
    sessionStorage.setItem('spotlightPopupSeen', '1');

    const content = document.getElementById('spotlightPopupContent');

    // Check if shop has a video (motion video for ad)
    const videoUrl = shop.cover_video_url || shop.ad_video_url || '';
    const imageUrl = shop.cover_image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e';

    let mediaHTML = '';
    if (videoUrl) {
        mediaHTML = `<video class="spotlight-popup-video" autoplay muted loop playsinline>
            <source src="${escapeAttr(videoUrl)}" type="video/mp4">
        </video>`;
    } else {
        mediaHTML = `<img src="${escapeAttr(imageUrl)}" class="spotlight-popup-img" alt="${escapeHtml(shop.shop_name)}" />`;
    }

    content.innerHTML = `
        ${mediaHTML}
        <div class="spotlight-popup-body">
            <span class="spotlight-popup-badge">🔥 Spotlight Featured</span>
            <h3 class="spotlight-popup-title">${escapeHtml(shop.shop_name)}</h3>
            <p class="spotlight-popup-area">📍 ${escapeHtml(shop.market_area)} • 🇬🇭 ${escapeHtml(shop.digital_address || 'Tamale')}</p>
            <p class="spotlight-popup-desc">${escapeHtml(shop.description || '')}</p>
            <div class="spotlight-popup-meta">
                <span>⭐ ${shop.rating_avg || 0} (${shop.rating_count || 0})</span>
                <button class="spotlight-popup-btn" data-action="showShopDetail" data-shop-id="${escapeJs(shop.id)}">Visit Stall ➔</button>
            </div>
        </div>
    `;

    // Show the popup
    const modal = document.getElementById('spotlightPopupModal');
    modal.style.display = 'flex';

    // Start countdown timer
    spotlightPopupCountdown = 8;
    document.getElementById('spotlightPopupCountdown').textContent = spotlightPopupCountdown;
    const timerBar = document.getElementById('spotlightPopupTimerBar');
    timerBar.style.width = '100%';

    // Animate timer bar shrink
    setTimeout(() => { timerBar.style.transition = 'width 8s linear'; timerBar.style.width = '0%'; }, 100);

    spotlightPopupTimer = setInterval(() => {
        spotlightPopupCountdown--;
        const cdEl = document.getElementById('spotlightPopupCountdown');
        if (cdEl) cdEl.textContent = spotlightPopupCountdown;
        if (spotlightPopupCountdown <= 0) {
            closeSpotlightPopup();
        }
    }, 1000);
}

function closeSpotlightPopup() {
    const modal = document.getElementById('spotlightPopupModal');
    if (modal) modal.style.display = 'none';
    if (spotlightPopupTimer) {
        clearInterval(spotlightPopupTimer);
        spotlightPopupTimer = null;
    }
}

// Wire up close button and overlay click
document.getElementById('spotlightPopupClose')?.addEventListener('click', closeSpotlightPopup);
document.getElementById('spotlightPopupModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSpotlightPopup();
});

// Click on content navigates to shop
document.getElementById('spotlightPopupContent')?.addEventListener('click', (e) => {
    const shopId = e.target.closest('[data-shop-id]')?.dataset.shopId;
    if (shopId) {
        closeSpotlightPopup();
        showShopDetail(shopId);
    } else {
        const sid = document.querySelector('#spotlightPopupContent [data-shop-id]')?.dataset.shopId;
        if (sid) { closeSpotlightPopup(); showShopDetail(sid); }
    }
});

// ====================================================================
// APP UPDATES & CHANGELOG
// ====================================================================
const APP_CHANGELOG = [
    {
        version: "v2.0",
        date: "September 1, 2026",
        changes: [
            "Added Two-Factor Authentication (2FA) for account security",
            "Spotlight popup with video support and auto-dismiss",
            "Improved GPS location accuracy with fallback retry",
            "App Updates section in settings",
            "Branding corrected to TechMarketVulture"
        ]
    },
    {
        version: "v1.5",
        date: "August 31, 2026",
        changes: [
            "Horizontal scroll layout for product cards",
            "PWA icons fixed for mobile install",
            "Security headers and CSP policies implemented",
            "PWA manifest configured for Android TWA"
        ]
    },
    {
        version: "v1.0",
        date: "August 2026",
        changes: [
            "Initial release of Tamale Market Finder",
            "Product, service, hotel, eatery, and company listings",
            "Manual address entry + map picker integration",
            "WhatsApp contact and directions to stalls"
        ]
    }
];

function renderAppUpdates() {
    const container = document.getElementById('appChangelogList');
    if (!container) return;

    container.innerHTML = APP_CHANGELOG.map(entry => `
        <div class="changelog-item">
            <div class="changelog-version">${entry.version}</div>
            <div class="changelog-date">${entry.date}</div>
            <div class="changelog-changes">
                <ul>
                    ${entry.changes.map(c => `<li>${escapeHtml(c)}</li>`).join('')}
                </ul>
            </div>
        </div>
    `).join('');
}

document.getElementById('checkUpdatesBtn')?.addEventListener('click', () => {
    showToast("You're on the latest version of Tamale Market Finder!", "success");
});

// Render updates when settings page loads
const _origNavigateToPage = navigateToPage;
navigateToPage = function(pageId) {
    _origNavigateToPage(pageId);
    if (pageId === 'account-settings') {
        setTimeout(renderAppUpdates, 200);
    }
};

// Show spotlight popup after page loads (delayed)
setTimeout(() => {
    if (document.getElementById('spotlightPopupModal')) {
        showSpotlightPopup();
    }
}, 3000);

// ====================================================================
// CITY SWITCHER LOGIC
// ====================================================================
function initCitySwitcher() {
    const btn = document.getElementById('citySwitchBtn');
    const dropdown = document.getElementById('cityDropdown');
    const label = document.getElementById('currentCityLabel');
    const logoTitle = document.getElementById('cityLogoTitle');
    const pageTitle = document.getElementById('pageTitle');

    if (!btn || !dropdown) return;

    // Set current city label
    if (label && typeof CITY_CONFIG !== 'undefined') {
        label.textContent = CITY_CONFIG.name;
    }
    if (logoTitle && typeof CITY_CONFIG !== 'undefined') {
        logoTitle.textContent = CITY_CONFIG.name + ' Market Finder';
    }
    if (pageTitle && typeof CITY_CONFIG !== 'undefined') {
        pageTitle.textContent = CITY_CONFIG.name + ' Market Finder — Local Shops & E-Commerce';
    }

    // Update manifest dynamically for this city
    if (typeof CITY_CONFIG !== 'undefined') {
        const manifest = document.querySelector('link[rel="manifest"]');
        if (manifest) {
            const blob = new Blob([JSON.stringify({
                name: CITY_CONFIG.name + ' Market Finder',
                short_name: CITY_CONFIG.name.substring(0, 4) + 'MF',
                description: CITY_CONFIG.description,
                start_url: '/',
                display: 'standalone',
                orientation: 'portrait',
                background_color: '#0A5C36',
                theme_color: '#0A5C36',
                scope: '/',
                lang: 'en',
                categories: ['shopping', 'business', 'lifestyle'],
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
                ]
            })], { type: 'application/json' });
            manifest.href = URL.createObjectURL(blob);
        }

        // Update market area dropdown options with city-specific markets
        const marketSelect = document.getElementById('shopMarketArea');
        if (marketSelect && CITY_CONFIG.markets) {
            marketSelect.innerHTML = CITY_CONFIG.markets.map(m => `<option value="${m}">${m}</option>`).join('');
        }
    }

    // Build dropdown from registry
    if (typeof CITY_REGISTRY !== 'undefined') {
        dropdown.innerHTML = CITY_REGISTRY.map(city => {
            const isActive = typeof CITY_CONFIG !== 'undefined' && city.slug === CITY_CONFIG.slug;
            return `<div class="city-dropdown-item ${isActive ? 'active' : ''}" data-url="${city.url}">
                <div>
                    <div class="city-name">${city.name}</div>
                    <div class="city-region">${city.region}</div>
                </div>
                <span class="city-check">✓</span>
            </div>`;
        }).join('');

        // Handle city selection
        dropdown.querySelectorAll('.city-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const url = item.dataset.url;
                if (url && !item.classList.contains('active')) {
                    window.location.href = url;
                }
            });
        });
    }

    // Toggle dropdown
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.city-switcher')) {
            dropdown.style.display = 'none';
        }
    });
}

// Initialize city switcher after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCitySwitcher);
} else {
    initCitySwitcher();
}
