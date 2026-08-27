# TAMALE MARKET FINDER (TMF) — CODE CRITIC REVIEW V2

**Reviewed Files:**
1. `tamale-market-finder/index.html`
2. `tamale-market-finder/app.js`
3. `tamale-market-finder/styles.css`
4. `tamale-market-finder/supabase_schema.sql`

---

## 1. CRITICAL BUGS

### Bug 1: `TypeError` Risk on Null Radio Selection in `handleOrderSubmit`
* **File & Line:** `app.js`, Line 1159
* **Code:** `document.querySelector('input[name="deliveryType"]:checked').value`
* **Issue:** If no radio is selected, `querySelector` returns null → unhandled TypeError.
* **Fix:** `document.querySelector('input[name="deliveryType"]:checked')?.value || 'pickup'`

### Bug 2: Unhandled Null Exception & Flawed Stock Cap in `updateOrderModalQty`
* **File & Line:** `app.js`, Lines 1139 & 1072
* **Issue:** `stock_quantity` undefined for services/hotels → caps quantity at 0.
* **Fix:** `const max = activeOrderProduct.product.stock_quantity ?? 999;`

### Bug 3: Order Placement Does Not Validate or Decrement Stock at Checkout
* **File & Line:** `app.js`, Lines 1155–1195
* **Issue:** No stock validation or decrement at order time. Allows infinite overbooking.
* **Fix:** Validate `qty <= stock_quantity` and decrement at reservation time.

### Bug 4: Complete Absence of Database Persistence Queries in `app.js`
* **File & Line:** `app.js` throughout
* **Issue:** Zero `supabase.from(...)` CRUD queries. All operations use in-memory `demoStore`. Data lost on refresh.
* **Fix:** Implement `supabase.from('products').select()` / `.insert()` calls when `!DEMO_MODE`.

### Bug 5: Sub-tab ID Selector Mismatch in Trader & Admin Dashboards
* **File & Line:** `app.js`, Lines 596–610 & 1215–1250
* **Issue:** `initTabs()` constructs IDs like `trader-tab-orders` but HTML uses `trader-orders`. Sub-tabs fail to display.
* **Fix:** Standardize sub-tab element IDs between HTML and JS.

### Bug 6: Star Rating Event Listeners Lost on Review Modal Re-open
* **File & Line:** `app.js`, Lines 1345–1365
* **Issue:** Star rating listeners bound once, lost when modal re-renders.
* **Fix:** Use event delegation on `#starRatingInput`.

---

## 2. MISSING FEATURES

1. **Stock Greyed Out Enforcement**: UI styling exists but `openOrderModal()` still allows ordering out-of-stock items.
2. **Order System Persistence**: Status updates are in-memory only. Buyers can't cancel pending orders.
3. **Reviews Verification**: No check verifying completed order before allowing review. Anyone can post unlimited reviews.
4. **Ranking Algorithm Integration**: `calculateCompositeScore` exists but isn't consistently called during search/filter.
5. **Expanded Category Fields**: Domain tabs exist but lack category-specific fields (room types for hotels, menu items for eateries).
6. **Ad Payment Integration**: Spotlight carousel renders but no payment gateway or ad expiration tracking.
7. **Report Persistence**: Reports stored only in `demoStore`. Admin actions don't persist.
8. **Verification Workflow**: Badges display but no application process or document upload.
9. **Admin Access Control**: Any user can access admin panel regardless of role.

---

## 3. SCHEMA ISSUES

1. **No RLS Policies**: 11 tables defined but zero `CREATE POLICY` statements. Major security risk.
2. **Missing Foreign Key Cascade Rules**: `orders.shop_id`, `reviews.shop_id` lack `ON DELETE CASCADE`.
3. **Missing Rating Recalculation Trigger**: No trigger to auto-update `rating_avg`/`rating_count` on review insert.
4. **Missing Database Indexes**: No indexes on `latitude`, `longitude`, `market_area`, search fields.
5. **User Roles Mismatch**: `account_type` lacks `'admin'` role enum.

---

## 4. SECURITY CONCERNS

1. **Critical XSS via innerHTML**: 23+ instances of user input inserted into `innerHTML` without escaping. Buyer notes, review comments, search queries, report reasons all exploitable.
2. **Missing Auth Checks**: `renderAdminPanel()` and `renderTraderDashboard()` don't verify JWT tokens or user roles.
3. **Cleartext PII Exposure**: Buyer phone numbers and addresses accessible via browser console.

---

## 5. TOP 10 PRIORITY FIXES (RANKED)

1. **Fix XSS Vulnerabilities**: Add `escapeHtml()` helper, sanitize all dynamic user inputs before `innerHTML`.
2. **Implement Supabase RLS Policies**: Add `CREATE POLICY` statements for all 11 tables.
3. **Connect app.js to Supabase**: Replace `demoStore` with actual `supabase.from()` CRUD calls when `!DEMO_MODE`.
4. **Enforce Stock Validation**: Block order modal on `stock_quantity <= 0`, decrement stock at order time.
5. **Enforce Verified Order for Reviews**: Check `status === 'completed'` before allowing review submission.
6. **Fix Dashboard Sub-tab Selectors**: Align element IDs between HTML and JS `initTabs()`.
7. **Add Null Guard on Delivery Type Radio**: Use optional chaining to prevent TypeError.
8. **Enforce Admin Role Authorization**: Restrict admin panel to `account_type === 'admin'`.
9. **Add Database Triggers for Rating Recalc**: PostgreSQL trigger on reviews to update shop/product ratings.
10. **Implement Location Fallback in Ranking**: Use market area dropdown when geolocation is denied.
