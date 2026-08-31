function runDebug() {
    var out = document.getElementById("debugOutput");
    out.textContent = "Starting...\n";
    try {
        if (typeof supabase === 'undefined') {
            out.textContent = "ERROR: supabase library not loaded!\n";
            return;
        }
        out.textContent += "supabase library: OK\n";
        var sbClient = supabase.createClient(
            "https://djcajmglxkmhbipmweps.supabase.co",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqY2FqbWdseGttaGJpcG13ZXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NTE3NDcsImV4cCI6MjA5NjQyNzc0N30.ccaT6pQW8Dbqy1LC97p2hH0Q7CuYtWJwnoDgrOdwAX4"
        );
        out.textContent += "sbClient: " + (sbClient ? "OK" : "NULL") + "\n";

        sbClient.from('public_shops').select('*').eq('is_active', true).then(async (result) => {
            if (result.error) {
                out.textContent += "shops ERROR: " + result.error.message + "\n";
                return;
            }
            out.textContent += "shops (is_active=true): " + (result.data||[]).length + "\n";
            var shops = result.data || [];

            // Query products with in_stock=true (same as renderShowcaseSections)
            var prodResult = await sbClient.from('products').select('*').eq('in_stock', true);
            if (prodResult.error) {
                out.textContent += "products(in_stock) ERROR: " + prodResult.error.message + "\n";
                return;
            }
            out.textContent += "products (in_stock=true): " + (prodResult.data||[]).length + "\n";

            // Query all products (same as searchListings)
            var allResult = await sbClient.from('products').select('*');
            if (allResult.error) {
                out.textContent += "all products ERROR: " + allResult.error.message + "\n";
                return;
            }
            out.textContent += "all products: " + (allResult.data||[]).length + "\n";

            // Check shop_id matching
            var matched = 0;
            (prodResult.data||[]).forEach(function(p) {
                if (shops.find(function(s) { return s.id === p.shop_id; })) matched++;
            });
            out.textContent += "matched to shops: " + matched + "/" + (prodResult.data||[]).length + "\n";
            out.textContent += "DONE - no errors\n";
        }).catch(function(err) {
            out.textContent += "CATCH: " + (err.message || err) + "\n";
        });
    } catch (err) {
        out.textContent += "ERROR: " + (err.message || err) + "\n";
    }
}
