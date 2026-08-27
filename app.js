// ============================================
// Tamale Market Finder — Main Application
// ============================================

// --- XSS Sanitization ---
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- Secure Supabase Configuration ---
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';

async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        if (!res.ok) return false;
        const data = await res.json();
        SUPABASE_URL = data.SUPABASE_URL || data.VITE_SUPABASE_URL || '';
        SUPABASE_ANON_KEY = data.SUPABASE_ANON_KEY || data.VITE_SUPABASE_ANON_KEY || '';
        return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
    } catch (e) {
        console.error('Config fetch failed:', e);
        return false;
    }
}

let supabase = null;
let map = null;
let markers = [];
let currentUser = null;
let currentShop = null;
let editingProductId = null;

// --- Initialize Supabase ---
async function initSupabase() {
    const configured = await loadConfig();
    if (!configured) {
        console.warn('Supabase not configured. Running in demo mode.');
        return null;
    }
    if (!window.supabase) {
        console.error('Supabase JS library not loaded');
        return null;
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
}

// --- Initialize Map (Tamale centered) ---
function initMap() {
    // Tamale, Ghana coordinates: 9.4035° N, 0.8421° W
    map = L.map('map').setView([9.4035, -0.8421], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
}

// --- Page Navigation ---
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('page-' + btn.dataset.page).classList.add('active');
        
        if (btn.dataset.page === 'home' && !map) {
            setTimeout(initMap, 100);
        }
        if (btn.dataset.page === 'home' && map) {
            setTimeout(() => map.invalidateSize(), 100);
        }
    });
});

// --- Search Functionality ---
document.getElementById('searchBtn').addEventListener('click', searchProducts);
document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchProducts();
});

async function searchProducts() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    const marketArea = document.getElementById('marketFilter').value;
    
    const resultsList = document.getElementById('resultsList');
    resultsList.innerHTML = '<div class="empty-state"><p>⏳ Searching...</p></div>';
    
    if (!supabase) {
        showDemoResults(query, category, marketArea);
        return;
    }
    
    try {
        // First find products matching the search
        let productQuery = supabase.from('products').select('*, shops(*)');
        if (query) {
            productQuery = productQuery.ilike('name', `%${query}%`);
        }
        if (category) {
            productQuery = productQuery.eq('category', category);
        }
        const { data: products, error } = await productQuery.eq('in_stock', true);
        
        if (error) throw error;
        
        // Filter by market area if selected
        let filteredShops = products;
        if (marketArea) {
            filteredShops = products.filter(p => p.shops && p.shops.market_area === marketArea);
        }
        
        // Group by shop
        const shopsMap = {};
        filteredShops.forEach(p => {
            if (p.shops && !shopsMap[p.shops.id]) {
                shopsMap[p.shops.id] = { ...p.shops, products: [] };
            }
            if (p.shops) {
                shopsMap[p.shops.id].products.push(p);
            }
        });
        
        const shops = Object.values(shopsMap);
        displayResults(shops);
    } catch (err) {
        console.error('Search error:', err);
        resultsList.innerHTML = '<div class="empty-state"><p>⚠️ Error searching. Please try again.</p></div>';
    }
}

// --- Display Results ---
function displayResults(shops) {
    const resultsList = document.getElementById('resultsList');
    clearMarkers();
    
    if (shops.length === 0) {
        resultsList.innerHTML = '<div class="empty-state"><p>😕 No shops found. Try a different search.</p></div>';
        return;
    }
    
    resultsList.innerHTML = '';
    shops.forEach(shop => {
        const card = document.createElement('div');
        card.className = 'shop-card';
        card.onclick = () => showShopDetail(shop);
        
        const productTags = shop.products.slice(0, 5).map(p => 
            `<span>${escapeHtml(p.name)}${p.price ? ' — GH¢' + escapeHtml(String(p.price)) : ''}</span>`
        ).join('');
        
        card.innerHTML = `
            <h4>${escapeHtml(shop.shop_name)}</h4>
            <div class="shop-meta">
                <span>📍 ${escapeHtml(shop.market_area || 'Tamale')}</span>
                ${shop.opening_hours ? `<span>🕐 ${escapeHtml(shop.opening_hours)}</span>` : ''}
            </div>
            <div class="shop-products">${productTags}</div>
        `;
        resultsList.appendChild(card);
        
        // Add marker to map
        if (shop.latitude && shop.longitude) {
            const marker = L.marker([shop.latitude, shop.longitude])
                .addTo(map)
                .bindPopup(`<strong>${escapeHtml(shop.shop_name)}</strong><br>${escapeHtml(shop.market_area || 'Tamale')}`);
            marker.on('click', () => showShopDetail(shop));
            markers.push(marker);
        }
    });
    
    // Fit map to show all markers
    if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

function clearMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
}

// --- Shop Detail Modal ---
function showShopDetail(shop) {
    const modal = document.getElementById('shopModal');
    const body = document.getElementById('modalBody');
    
    const productsHTML = shop.products.map(p => `
        <div class="modal-product">
            ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}">` : ''}
            <div class="info">
                <h5>${escapeHtml(p.name)}</h5>
                ${p.price ? `<div class="price">GH¢${escapeHtml(String(p.price))}</div>` : ''}
                ${p.description ? `<div style="font-size:13px;color:#666">${escapeHtml(p.description)}</div>` : ''}
            </div>
        </div>
    `).join('');
    
    const directionsLink = shop.latitude && shop.longitude ?
        `<a href="https://www.openstreetmap.org/directions?from=&to=${parseFloat(shop.latitude)}%2C${parseFloat(shop.longitude)}" target="_blank" rel="noopener" class="directions-btn">📍 Get Directions</a>` : '';
    
    body.innerHTML = `
        <div class="modal-shop-header">
            <h2>${escapeHtml(shop.shop_name)}</h2>
            <span class="shop-category">${escapeHtml(shop.category || 'General')}</span>
        </div>
        ${shop.description ? `<p style="margin-bottom:12px;color:#666">${escapeHtml(shop.description)}</p>` : ''}
        <div style="font-size:14px;color:#666;margin-bottom:8px;">
            📍 ${escapeHtml(shop.address || shop.market_area || 'Tamale')}<br>
            🕐 ${escapeHtml(shop.opening_hours || 'Hours not specified')}<br>
            📞 ${escapeHtml(shop.phone || 'No phone provided')}
        </div>
        ${directionsLink}
        <div class="modal-products">
            <h4>Products (${shop.products.length})</h4>
            ${productsHTML || '<p style="color:#999;font-size:14px">No products listed yet.</p>'}
        </div>
    `;
    
    modal.style.display = 'flex';
}

document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('shopModal').style.display = 'none';
});

// --- Demo Results (when Supabase not configured) ---
function showDemoResults(query, category, marketArea) {
    const demoShops = [
        {
            id: '1', shop_name: 'Aboabo Yam Market', category: 'Grains & Cereals',
            market_area: 'Aboabo Market', address: 'Aboabo Market, Tamale',
            latitude: 9.3960, longitude: -0.8370, opening_hours: '6am–6pm daily',
            phone: '024 000 0000', description: 'Fresh yam and cereals from across Northern Ghana',
            products: [{ name: 'Fresh Yam', price: 5 }, { name: 'Yellow Maize (bag)', price: 200 }, { name: 'Local Rice (bag)', price: 350 }]
        },
        {
            id: '2', shop_name: 'Dagbon Smocks & Textiles', category: 'Textiles & Smocks',
            market_area: 'Central Market', address: 'Tamale Central Market',
            latitude: 9.4060, longitude: -0.8450, opening_hours: '8am–7pm daily',
            phone: '020 000 0000', description: 'Traditional Dagomba smocks, Guinea brocade, and local fabrics',
            products: [{ name: 'Dagomba Smock', price: 150 }, { name: 'Guinea Brocade (yard)', price: 25 }]
        },
        {
            id: '3', shop_name: 'Tamale Phone Hub', category: 'Electronics & Phones',
            market_area: 'Central Market', address: 'Central Market, Tamale',
            latitude: 9.4040, longitude: -0.8430, opening_hours: '8am–8pm daily',
            phone: '055 000 0000', description: 'Phones, accessories, and repairs',
            products: [{ name: 'Phone Charger', price: 15 }, { name: 'Phone Case', price: 10 }, { name: 'Earphones', price: 20 }]
        },
        {
            id: '4', shop_name: 'Sahaaba Fresh Produce', category: 'Fresh Produce',
            market_area: 'Lamashegu', address: 'Lamashegu Market, Tamale',
            latitude: 9.4130, longitude: -0.8380, opening_hours: '5am–6pm daily',
            phone: '024 111 1111', description: 'Fresh fruits and vegetables daily',
            products: [{ name: 'Tomatoes (crate)', price: 80 }, { name: 'Onions (bag)', price: 120 }, { name: 'Pepper (bag)', price: 60 }]
        }
    ];
    
    let filtered = demoShops;
    if (query) {
        filtered = filtered.filter(s => 
            s.products.some(p => p.name.toLowerCase().includes(query)) ||
            s.shop_name.toLowerCase().includes(query) ||
            s.category.toLowerCase().includes(query)
        );
    }
    if (category) filtered = filtered.filter(s => s.category === category);
    if (marketArea) filtered = filtered.filter(s => s.market_area === marketArea);
    
    displayResults(filtered);
}

// ============================================
// TRADER PORTAL
// ============================================

// --- Auth Tabs ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
});

// --- Register ---
document.getElementById('registerBtn').addEventListener('click', async () => {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    
    if (!email || !password) return alert('Please fill in all fields');
    
    if (!supabase) {
        alert('Demo mode: Supabase not configured. Add credentials to app.js to enable trader accounts.');
        return;
    }
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email, password,
            options: { data: { full_name: name } }
        });
        if (error) throw error;
        alert('Account created! Check your email to confirm, then sign in.');
        document.querySelector('.tab-btn[data-tab="login"]').click();
    } catch (err) {
        alert('Registration failed: ' + err.message);
    }
});

// --- Login ---
document.getElementById('loginBtn').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) return alert('Please enter email and password');
    
    if (!supabase) {
        alert('Demo mode: Supabase not configured.');
        return;
    }
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
        showDashboard();
    } catch (err) {
        alert('Login failed: ' + err.message);
    }
});

// --- Logout ---
document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (supabase) await supabase.auth.signOut();
    currentUser = null;
    currentShop = null;
    document.getElementById('trader-dashboard').style.display = 'none';
    document.getElementById('trader-auth').style.display = 'block';
});

// --- Show Dashboard After Login ---
async function showDashboard() {
    document.getElementById('trader-auth').style.display = 'none';
    document.getElementById('trader-dashboard').style.display = 'block';
    
    // Check if shop already exists
    try {
        const { data: shop, error } = await supabase
            .from('shops')
            .select('*')
            .eq('created_by', currentUser.id)
            .single();
        
        if (shop) {
            currentShop = shop;
            fillShopForm(shop);
            document.getElementById('products-card').style.display = 'block';
            loadProducts();
        }
    } catch (err) {
        // No shop yet — that's fine, user will create one
    }
}

function fillShopForm(shop) {
    document.getElementById('shopName').value = shop.shop_name || '';
    document.getElementById('shopCategory').value = shop.category || '';
    document.getElementById('shopMarketArea').value = shop.market_area || '';
    document.getElementById('shopAddress').value = shop.address || '';
    document.getElementById('shopPhone').value = shop.phone || '';
    document.getElementById('shopHours').value = shop.opening_hours || '';
    document.getElementById('shopDescription').value = shop.description || '';
    document.getElementById('shopLat').value = shop.latitude || '';
    document.getElementById('shopLng').value = shop.longitude || '';
    if (shop.latitude) {
        document.getElementById('locationStatus').textContent = `📍 Location set (${shop.latitude.toFixed(4)}, ${shop.longitude.toFixed(4)})`;
    }
}

// --- Save Shop ---
document.getElementById('shopForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const shopData = {
        owner_name: currentUser.user_metadata?.full_name || '',
        shop_name: document.getElementById('shopName').value.trim(),
        category: document.getElementById('shopCategory').value,
        market_area: document.getElementById('shopMarketArea').value,
        address: document.getElementById('shopAddress').value.trim(),
        phone: document.getElementById('shopPhone').value.trim(),
        opening_hours: document.getElementById('shopHours').value.trim(),
        description: document.getElementById('shopDescription').value.trim(),
        latitude: parseFloat(document.getElementById('shopLat').value) || null,
        longitude: parseFloat(document.getElementById('shopLng').value) || null,
        created_by: currentUser.id
    };
    
    if (!shopData.shop_name || !shopData.category) {
        return alert('Please fill in shop name and category');
    }
    
    try {
        if (currentShop) {
            // Update existing
            const { error } = await supabase
                .from('shops')
                .update(shopData)
                .eq('id', currentShop.id);
            if (error) throw error;
            alert('Shop updated successfully!');
        } else {
            // Create new
            const { data, error } = await supabase
                .from('shops')
                .insert([shopData])
                .select();
            if (error) throw error;
            currentShop = data[0];
            document.getElementById('products-card').style.display = 'block';
            alert('Shop created! Now add your products.');
        }
    } catch (err) {
        alert('Error saving shop: ' + err.message);
    }
});

// --- Get Location ---
document.getElementById('getLocationBtn').addEventListener('click', () => {
    if (!navigator.geolocation) {
        document.getElementById('locationStatus').textContent = '⚠️ Geolocation not supported';
        return;
    }
    
    document.getElementById('locationStatus').textContent = '📍 Getting location...';
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            document.getElementById('shopLat').value = pos.coords.latitude;
            document.getElementById('shopLng').value = pos.coords.longitude;
            document.getElementById('locationStatus').textContent = 
                `✅ Location set (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
        },
        (err) => {
            document.getElementById('locationStatus').textContent = '⚠️ Could not get location. Try entering coordinates manually.';
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
});

// ============================================
// PRODUCTS MANAGEMENT
// ============================================

document.getElementById('addProductBtn').addEventListener('click', () => {
    editingProductId = null;
    document.getElementById('productFormTitle').textContent = 'Add Product';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('productInStock').checked = true;
    document.getElementById('product-form-card').style.display = 'block';
});

document.getElementById('cancelProductBtn').addEventListener('click', () => {
    document.getElementById('product-form-card').style.display = 'none';
});

document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const productData = {
        shop_id: currentShop.id,
        name: document.getElementById('productName').value.trim(),
        category: document.getElementById('productCategory').value,
        price: parseFloat(document.getElementById('productPrice').value) || null,
        description: document.getElementById('productDescription').value.trim(),
        in_stock: document.getElementById('productInStock').checked
    };
    
    // Handle image upload
    const imageFile = document.getElementById('productImage').files[0];
    if (imageFile) {
        try {
            const fileName = `products/${currentShop.id}/${Date.now()}_${imageFile.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, imageFile);
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName);
            productData.image_url = urlData.publicUrl;
        } catch (err) {
            console.error('Image upload failed:', err);
            // Continue without image
        }
    }
    
    try {
        if (editingProductId) {
            const { error } = await supabase.from('products').update(productData).eq('id', editingProductId);
            if (error) throw error;
            alert('Product updated!');
        } else {
            const { error } = await supabase.from('products').insert([productData]);
            if (error) throw error;
            alert('Product added!');
        }
        document.getElementById('product-form-card').style.display = 'none';
        loadProducts();
    } catch (err) {
        alert('Error saving product: ' + err.message);
    }
});

async function loadProducts() {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*')
            .eq('shop_id', currentShop.id)
            .order('created_date', { ascending: false });
        
        if (error) throw error;
        
        const list = document.getElementById('productsList');
        list.innerHTML = '';
        
        if (products.length === 0) {
            list.innerHTML = '<p style="color:#999;font-size:14px;text-align:center;padding:20px;">No products yet. Click "Add Product" to get started.</p>';
            return;
        }
        
        products.forEach(p => {
            const item = document.createElement('div');
            item.className = 'product-item';
            item.innerHTML = `
                ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : '<div style="width:50px;height:50px;background:#f5f5f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:20px;">📦</div>'}
                <div class="product-info">
                    <h5>${p.name} ${!p.in_stock ? '<span style="color:#c0392b;font-size:12px">(Out of stock)</span>' : ''}</h5>
                    ${p.price ? `<div class="price">GH¢${p.price}</div>` : ''}
                </div>
                <div class="product-actions">
                    <button onclick="editProduct('${p.id}')">✏️ Edit</button>
                    <button class="delete-btn" onclick="deleteProduct('${p.id}')">🗑️ Delete</button>
                </div>
            `;
            list.appendChild(item);
        });
    } catch (err) {
        console.error('Error loading products:', err);
    }
}

window.editProduct = async function(id) {
    try {
        const { data: product, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        
        editingProductId = id;
        document.getElementById('productFormTitle').textContent = 'Edit Product';
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name || '';
        document.getElementById('productCategory').value = product.category || '';
        document.getElementById('productPrice').value = product.price || '';
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productInStock').checked = product.in_stock !== false;
        document.getElementById('product-form-card').style.display = 'block';
    } catch (err) {
        alert('Error loading product: ' + err.message);
    }
};

window.deleteProduct = async function(id) {
    if (!confirm('Delete this product?')) return;
    try {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw error;
        loadProducts();
    } catch (err) {
        alert('Error deleting: ' + err.message);
    }
};

// --- Check auth state on load ---
async function checkAuthState() {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        showDashboard();
    }
}

// --- Initialize on page load ---
window.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    initMap();
    if (supabase) checkAuthState();
});
