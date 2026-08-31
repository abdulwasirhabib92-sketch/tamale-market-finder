const SUPABASE_URL = "https://djcajmglxkmhbipmweps.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqY2FqbWdseGttaGJpcG13ZXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTE3NDcsImV4cCI6MjA5NjQyNzc0N30.ccaT6pQW8Dbqy1LC97p2hH0Q7CuYtWJwnoDgrOdwAX4";
async function runDebug() {
    var sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    var out = document.getElementById("debugOutput");
    out.textContent = "sbClient: " + (sbClient ? "OK" : "NULL") + "\n";
    
    try {
        const { data: shops, error: shopErr } = await sbClient.from('public_shops').select('*').eq('is_active', true);
        if (shopErr) throw shopErr;
        out.textContent += "shops (is_active=true): " + (shops||[]).length + "\n";
        
        const { data: products, error: prodErr } = await sbClient.from('products').select('*').eq('in_stock', true);
        if (prodErr) throw prodErr;
        out.textContent += "products (in_stock=true): " + (products||[]).length + "\n";
        
        const { data: allProducts, error: allErr } = await sbClient.from('products').select('*');
        if (allErr) throw allErr;
        out.textContent += "all products: " + (allProducts||[]).length + "\n";
        
        let matched = 0;
        (products||[]).forEach(p => {
            const shop = (shops||[]).find(s => s.id === p.shop_id);
            if (shop) matched++;
        });
        out.textContent += "matched to shops: " + matched + "/" + (products||[]).length + "\n";
        out.textContent += "SUCCESS - no errors\n";
        
    } catch (err) {
        out.textContent += "ERROR: " + (err.message || err) + "\n";
    }
}
window.addEventListener('load', runDebug);
