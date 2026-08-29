# Tamale Market Finder (TMF) — Comprehensive Codebase Research & Modernization Plan

**Prepared for:** Abdul Wasir Habib & The Development Team  
**Date:** August 25, 2026  
**Status:** Approved Architectural Blueprint & Plan for Implementation  
**Target Directory:** `tamale-market-finder/`

---

## Executive Summary

**Tamale Market Finder (TMF)** is a specialized two-sided marketplace application connecting local buyers and traders across key commercial areas in Tamale, Northern Ghana (such as Tamale Central Market, Aboabo Market, Lamashegu, and Kukuo). The app enables shoppers to search for local products and locate physical market stalls via an interactive Leaflet/OpenStreetMap interface, while giving traders a digital presence with zero hosting cost.

While the current MVP successfully proves the core concept (combining search, Leaflet map markers, and basic Supabase integration), its user experience and security model suffer from architectural gaps:
- **Authentication & Security:** Auth state relies on basic manual login calls without continuous session persistence, password recovery, or profile management.
- **Navigation & IA:** "Trader Portal" is hardcoded into the main top bar, creating clutter for normal shoppers and failing to offer a unified user settings area.
- **UI/UX Aesthetics & Mobile Usability:** The dual-column layout (list left, map right) breaks down on mobile screens into a 1000px+ vertical scroll stack. It lacks modern marketplace patterns such as mobile bottom navigation, category pill carousels, full-screen map/list toggle controls, WhatsApp contact integration, and shop favoriting.

This document presents a comprehensive, production-ready research report and actionable implementation roadmap to transform TMF into a modern, mobile-first marketplace app inspired by **Jiji, Jumia, Airbnb, and Google Maps**.

---

## 1. Current State Analysis

### 1.1 What Works Well
- **Core Search & Mapping:** `app.js` performs client-side search filtering by text query, category, and market area. `initMap()` correctly initializes Leaflet centered on Tamale (`9.4035° N, 0.8421° W`) with OpenStreetMap tiles and renders map pins.
- **Fallback Demo Mode:** When Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) are unconfigured, `showDemoResults()` provides instant mock data featuring iconic Tamale merchants (e.g., Aboabo Yam Market, Dagbon Smocks & Textiles).
- **Basic RLS SQL Baseline:** `supabase_schema.sql` establishes tables for `shops` and `products` with basic Row Level Security policies checking `auth.uid() = created_by`.
- **Zero-Cost Tech Stack:** Standard HTML5, CSS3, vanilla JavaScript (ES6+), Leaflet, and Supabase JS SDK CDN—allowing deployment to GitHub Pages at zero recurring cost.

### 1.2 What Is Broken or Flawed
- **Session Lifecycle & Persistence:** `checkAuthState()` only calls `supabase.auth.getSession()` once on DOM load. It lacks an active `supabase.auth.onAuthStateChange` listener. Refreshing the browser, token expiration, or tab reopening leads to broken auth states or lost session references.
- **Password Reset Flow:** There is no mechanism for traders or users to reset forgotten passwords.
- **Mobile Stacked Layout Defect:** In `styles.css`, `.results-container` uses flexbox with `flex-wrap`. On screen widths under 768px, the map container (`#map`) stacks beneath `.results-list`. If search results return 10 shops, the user must scroll through hundreds of pixels of cards before reaching the map.
- **Image Handling Issues:** When adding or editing products, file uploads to the Supabase Storage bucket (`product-images`) lack image compression, file size validation, or client-side upload previews.
- **Modal Accessibility & Usability:** `showShopDetail()` generates a fixed modal overlay without backdrop click dismissal, full accessibility markup, or deep linking options.

### 1.3 What Is Missing Completely
- **User Settings & Profile Management:** No page or modal exists for users to manage personal details (full name, phone number, email, avatar, or password change).
- **Profile & Menu System:** No hamburger drawer menu or profile dropdown exists. All navigation is restricted to two buttons ("Find Products" and "Trader Portal").
- **Extended User Schema (`user_profiles`):** No database table tracks user roles (Shopper vs Trader), user details, or preferences.
- **Favorites / Saved Shops:** Shoppers cannot bookmark favorite shops or products for offline access or future visits.
- **Modern Marketplace UI Patterns:**
  - Category carousel pills for 1-tap filtering.
  - Floating mobile view switcher ("Map" vs "List").
  - Direct WhatsApp button for trader contact (`https://wa.me/233...`).
  - Search debouncing and auto-suggest.
  - Trader verification badges and status indicators (Open/Closed).

---

## 2. Authentication & Session Management Plan

To turn TMF into a secure, user-centric application, Supabase Auth must be expanded beyond basic email/password submission into a complete session lifecycle.

### 2.1 Complete Supabase Auth Lifecycle Flow

```
+-------------------------------------------------------------------------+
|                         App Initialization                              |
|   1. initSupabase() -> 2. Attach onAuthStateChange listener            |
|   3. getSession() -> Sync user state & update navigation header         |
+-------------------------------------------------------------------------+
                                    |
          +-------------------------+-------------------------+
          |                                                   |
    [Unauthenticated]                                   [Authenticated]
  - Show "Sign In / Register" in                      - Render Avatar / Profile Button
    Profile Menu                                      - Display User Name in Settings
  - Show "Become a Trader" CTA                        - Enable Trader Dashboard Tab
  - Favorites stored locally                          - Enable Saved Shops Sync
                                                      - Pre-fill Shop creation forms
```

### 2.2 Key Auth Capabilities to Implement

1. **Sign Up with Metadata & Profile Creation:**
   - Prompt user for Full Name, Email, Password, and Phone Number.
   - Execute `supabase.auth.signUp()` with metadata payload:
     ```javascript
     const { data, error } = await supabase.auth.signUp({
       email,
       password,
       options: {
         data: { full_name: fullName, phone: phoneNumber, role: accountType }
       }
     });
     ```
   - Automatically seed the `user_profiles` database table via a PostgreSQL trigger.

2. **Login & Error Diagnostics:**
   - Clean, user-friendly error handling (handling invalid credentials, unconfirmed emails, rate limits) with inline notification toasts.

3. **Password Recovery Flow (Reset Password):**
   - Modal tab or view for "Forgot Password?".
   - Trigger `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href })`.
   - On redirect back to the app with recovery tokens, open an "Update Password" modal using `supabase.auth.updateUser({ password: newPassword })`.

4. **Continuous Auth State Subscriptions (`onAuthStateChange`):**
   - Implement global auth event handler:
     ```javascript
     supabase.auth.onAuthStateChange((event, session) => {
       if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
         currentUser = session?.user || null;
         updateUIForAuthenticatedUser(currentUser);
       } else if (event === 'SIGNED_OUT') {
         currentUser = null;
         updateUIForUnauthenticatedUser();
       } else if (event === 'PASSWORD_RECOVERY') {
         showPasswordResetModal();
       }
     });
     ```

5. **Row Level Security (RLS) Alignment:**
   - RLS policies use `auth.uid() = created_by`. When authenticated, Supabase JS automatically attaches the JWT Bearer token to all Postgres requests, enforcing security at the database tier.

---

## 3. UI/UX Redesign Plan & Design System

### 3.1 Design Inspired by Market Leaders (Jiji, Jumia, Airbnb, Google Maps)

| App Reference | Feature / Pattern Adopted | TMF Implementation Plan |
| :--- | :--- | :--- |
| **Airbnb** | Floating mobile view toggle pill ("Map" vs "List") | Sticky bottom floating pill allowing users on mobile to switch instantly between full-screen map and result card list. |
| **Airbnb / Jiji** | Horizontal category carousel pills | Emoji-supported scrollable category badges right below the search bar for quick 1-tap product filtering. |
| **Jiji / Jumia** | Direct contact actions (WhatsApp / Phone) | One-tap green WhatsApp button (`https://wa.me/233...`) and phone call buttons on every shop card and modal. |
| **Google Maps** | Pins with shop preview cards & directions | Custom Leaflet popup markers displaying shop name, market area badge, and 1-tap route guidance. |
| **Jiji / Jumia** | Profile & Settings Drawer / Bottom Nav | Move account, settings, saved items, and trader tools into a slide-over side drawer (desktop/tablet) and bottom navigation bar (mobile). |

### 3.2 Visual Design System (Ghanaian Earthy Modern Palette)

- **Color Tokens:**
  - `Primary Green` (`#0A5C36`): Represents Northern Ghanaian agricultural richness; main brand color for header, primary buttons, active tabs.
  - `Primary Hover` (`#074428`): Deep emerald for dark states.
  - `Accent Gold / Amber` (`#E68A00`): Inspired by Ghanaian craftsmanship; highlights, rating badges, special tags.
  - `Background Canvas` (`#F8FAFC`): Off-white, soft background for minimal eye strain under bright sunlight.
  - `Card Surface` (`#FFFFFF`): Pure white with subtle borders and shadows.
  - `Dark Neutral Text` (`#0F172A`): High-contrast slate charcoal for readability.
  - `Muted Text` (`#64748B`): Secondary labels and captions.
  - `Border / Divider` (`#E2E8F0`): Clean 1px gray borders.
  - `Danger Red` (`#DC2626`): Out-of-stock and delete badges.
  - `Success Green` (`#16A34A`): In-stock badges and WhatsApp buttons.

- **Typography & Scale:**
  - System Font Stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.
  - H1: 22px / 700 bold (Page titles, logo).
  - H2: 18px / 600 semi-bold (Section titles, shop names).
  - H3: 15px / 600 semi-bold (Card headings).
  - Body: 14px / 400 regular (Standard text, descriptions).
  - Caption / Badge: 12px / 500 medium (Market tags, opening hours).

- **Elevation & Corners:**
  - Radius: `8px` (inputs, badges), `12px` (cards, buttons), `16px` (modals, bottom sheets).
  - Box Shadows:
    - Subtle: `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`
    - Card Hover: `0 4px 12px rgba(0,0,0,0.08)`
    - Floating Controls: `0 10px 25px -5px rgba(0,0,0,0.15)`

---

## 4. Information Architecture & Navigation Structure

### 4.1 Proposed Navigation Pattern

The current hardcoded top nav (`Find Products` | `Trader Portal`) will be replaced with a modern 3-tiered navigation system:

1. **Header Bar (Top):**
   - Left: Logo `🛒 Tamale Market Finder`
   - Center: Quick search shortcut or tagline
   - Right: User Profile Avatar / Menu Button (e.g. `👤 Menu` or User Photo)

2. **Slide-over Menu Drawer / Profile Dropdown:**
   - Activated by clicking the header profile button or hamburger icon.
   - **Header Section:** User greeting ("Hello, Wasir" or "Welcome Guest"), account badge ("Trader" or "Shopper").
   - **Menu Items:**
     - 🔍 **Explore Markets** (Home search & map)
     - ❤️ **Saved Shops & Products** (Favorites)
     - 🏪 **Trader Portal / My Shop** (If trader: opens dashboard; if shopper: "Register as a Trader")
     - ⚙️ **Settings & Profile** (Personal details, security, preferences)
     - 📞 **Help & Contact** (Local support info)
     - 🚪 **Sign In / Sign Out**

3. **Mobile Bottom Navigation Bar (Screens < 768px):**
   - Fixed at the bottom of the viewport with 4 key touch targets:
     - 🔍 **Explore** (Search & Card list)
     - 🗺️ **Map** (Full-screen map view)
     - ❤️ **Favorites** (Saved shops)
     - 👤 **Account** (Opens Settings & Profile menu)

### 4.2 Detailed Page / View Structure

```
+-------------------------------------------------------------------------------+
|                             APP NAVIGATION HUB                                |
+-------------------------------------------------------------------------------+
       |                   |                     |                    |
       v                   v                     v                    v
+--------------+    +--------------+     +--------------+     +----------------+
| EXPLORE VIEW |    |   MAP VIEW   |     | FAVORITES    |     | USER ACCOUNT & |
| (Home)       |    | (Full Screen)|     | VIEW         |     | SETTINGS VIEW  |
+--------------+    +--------------+     +--------------+     +----------------+
| - Search Bar |    | - Full Map   |     | - List of    |     | [Sub-Tabs]:    |
| - Category   |    | - Custom     |     |   Bookmarked |     | 1. My Profile  |
|   Pills      |    |   Pins       |     |   Shops      |     | 2. Security    |
| - Market     |    | - Pin Cards  |     | - Quick      |     | 3. Trader Portal|
|   Filter     |    | - Floating   |     |   Contact    |     |    - Shop Info |
| - Results    |    |   List       |     +--------------+     |    - Products  |
|   Cards      |    |   Toggle     |                          | 4. Preferences |
+--------------+    +--------------+                          +----------------+
       |                   |
       +---------+---------+
                 |
                 v
       +-------------------+
       | SHOP DETAIL MODAL |
       | - Header & Status |
       | - WhatsApp & Call |
       | - Product Grid    |
       | - Map Location    |
       +-------------------+
```

---

## 5. Schema Changes (PostgreSQL / Supabase DDL)

To support user profiles, extended trader information, favorites, and settings, the current database schema must be upgraded.

### 5.1 New & Updated SQL DDL Specifications

Below is the complete database schema enhancement script to be executed in Supabase:

```sql
-- ====================================================================
-- TAMALE MARKET FINDER — SCHEMA ENHANCEMENTS
-- Add User Profiles, Favorites, and RLS Triggers
-- ====================================================================

-- 1. Create User Profiles Table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    account_type TEXT DEFAULT 'shopper' CHECK (account_type IN ('shopper', 'trader', 'admin')),
    preferred_market TEXT,
    language_preference TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Favorites Table
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_shop_favorite UNIQUE (user_id, shop_id)
);

-- 3. Enhance Shops Table (Add Verification & WhatsApp Support)
ALTER TABLE public.shops 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- 4. Automatically Create User Profile on Signup (Trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, phone, account_type)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Valued User'),
        NEW.raw_user_meta_data->>'phone',
        COALESCE(NEW.raw_user_meta_data->>'role', 'shopper')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Row Level Security Policies for New Tables

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- User Profiles RLS
CREATE POLICY "Public user profiles are viewable by everyone" 
    ON public.user_profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" 
    ON public.user_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
    ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Favorites RLS
CREATE POLICY "Users can view own favorites" 
    ON public.favorites FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites" 
    ON public.favorites FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites" 
    ON public.favorites FOR DELETE USING (auth.uid() = user_id);
```

---

## 6. Technical Implementation Roadmap & Architecture Recommendations

To ensure clean, maintainable, and high-performance code without adding heavy JavaScript frameworks, the implementation should follow a modular vanilla JS pattern using standard browser capabilities.

### 6.1 Modular Architecture Breakdown (`app.js`)

`app.js` will be organized into logical ES modules or structured objects:

1. **`AppState` Manager:**
   Central state object managing active tab, user session, current shop, cached search results, favorite shop IDs, and view modes (List vs Map).

2. **`AuthModule`:**
   Handles sign up, sign in, sign out, password reset requests, password updates, profile sync, and `onAuthStateChange` listeners.

3. **`NavigationModule`:**
   Controls header profile drawer toggling, bottom nav bar state switching, and smooth transitions between Explore, Map, Favorites, and Account views.

4. **`SearchAndFilterModule`:**
   Manages real-time debounced search input, category pill selection, market area dropdown filters, and result rendering.

5. **`MapModule`:**
   Encapsulates Leaflet map instance, marker cluster/layers, custom emoji/icon map pins, user geolocation, bounds auto-fitting, and popup handlers.

6. **`TraderModule`:**
   Handles shop detail editing, location pin selection on map, product CRUD operations, image compression before upload, and stock status toggling.

7. **`SettingsModule`:**
   Renders user profile editor, password change form, account status toggles, and notification preferences.

8. **`FavoritesModule`:**
   Manages local and database bookmarking of shops with instant UI feedback (heart icon toggle).

### 6.2 Key Code Patterns for the Implementer

#### A. Mobile View Toggle Control (List vs Map Switcher)
```javascript
// Toggle between List and Map view on mobile devices
function setMobileViewMode(mode) { // 'list' or 'map'
    AppState.viewMode = mode;
    const resultsList = document.getElementById('resultsList');
    const mapContainer = document.querySelector('.map-container');
    const toggleBtn = document.getElementById('mobileViewToggle');

    if (mode === 'map') {
        resultsList.classList.add('mobile-hidden');
        mapContainer.classList.remove('mobile-hidden');
        toggleBtn.innerHTML = '📋 View List';
        if (map) setTimeout(() => map.invalidateSize(), 200);
    } else {
        resultsList.classList.remove('mobile-hidden');
        mapContainer.classList.add('mobile-hidden');
        toggleBtn.innerHTML = '🗺️ View Map';
    }
}
```

#### B. WhatsApp One-Click Direct Link Generator
```javascript
function formatWhatsAppLink(phone, shopName, productName = null) {
    if (!phone) return null;
    // Clean phone number format for Ghana (+233)
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '233' + cleaned.substring(1);
    }
    const message = productName 
        ? `Hello! I saw ${productName} at ${shopName} on Tamale Market Finder and would like to inquire.`
        : `Hello! I saw your shop ${shopName} on Tamale Market Finder and would like to make an inquiry.`;
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}
```

#### C. Debounced Search Handler
```javascript
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const debouncedSearch = debounce(() => searchProducts(), 300);
```

---

## 7. Actionable Step-by-Step Implementation Guide

For the Implementer agent building the codebase, execute the work in the following sequential order:

### Step 1: Database Schema Update
- Add SQL schema enhancements (`user_profiles`, `favorites`, `handle_new_user` trigger, altered `shops` table columns) to `supabase_schema.sql`.

### Step 2: HTML Structure Modernization (`index.html`)
- **Header:** Modernize header with logo, search icon button, and user profile drawer trigger.
- **Drawer / Menu System:** Add slide-over `#menuDrawer` containing User Profile Header, Quick Links, Settings, and Auth actions.
- **Bottom Nav Bar:** Add fixed bottom navigation bar (`.bottom-nav`) with 4 tab items (Explore, Map, Favorites, Account).
- **Home View Overhaul:** Add horizontal category pills scroll container (`#categoryPills`), sticky search bar, and floating mobile view switcher button (`#mobileViewToggle`).
- **Account & Settings View:** Replace raw `#page-trader` with `#page-account` containing sub-tabs: `My Profile`, `Security`, `Trader Portal` (Shop + Products), `Favorites`.
- **Modals:** Upgrade Shop Detail Modal with WhatsApp integration, share button, and direction launcher. Add Auth/Password Reset Modal.

### Step 3: CSS Styling Overhaul (`styles.css`)
- Define CSS CSS variables (`:root`) for colors, shadows, radius, and z-index layers.
- Implement responsive CSS grid & flex layouts for desktop vs mobile views.
- Style horizontal scrollbar for category pills.
- Style mobile bottom nav bar (fixed, blurred backdrop, active indicator).
- Style menu drawer animation (`transform: translateX(100%)` to `0`).
- Implement modern card components, pill badges, and elevated action buttons.

### Step 4: Core JavaScript & State Refactoring (`app.js`)
- Implement `AppState` object.
- Integrate full Supabase Auth lifecycle: `signUp`, `signInWithPassword`, `signOut`, `resetPasswordForEmail`, `updateUser`, and `onAuthStateChange`.
- Add `user_profiles` sync and settings editor handlers.
- Refactor search function with debouncing and category pill support.
- Add mobile view toggle handler (`setMobileViewMode`).
- Integrate Favorites functionality (add/remove bookmark with database sync or localStorage fallback).
- Add WhatsApp link generator and map routing launcher to Shop Detail view.

### Step 5: Testing & Verification
- Test demo mode behavior when Supabase is disconnected.
- Test authentication flows (Sign Up, Login, Password Reset, Logout).
- Test layout responsiveness across mobile viewport (375px), tablet (768px), and desktop (1200px+).
- Verify Leaflet map resizing on tab/view switching (`map.invalidateSize()`).

---

## Conclusion & Next Steps

This plan addresses every operational, structural, and aesthetic limitation identified in the Tamale Market Finder codebase. By transitioning to a menu-driven navigation model, integrating a full Supabase Auth and User Profile system, and adopting modern mobile UI patterns (bottom nav, category pills, mobile view toggle, WhatsApp integration), Tamale Market Finder will offer a world-class experience tailored to the local commercial dynamics of Tamale.

**Implementer Instructions:** Proceed with editing `tamale-market-finder/supabase_schema.sql`, `index.html`, `styles.css`, `app.js`, and `README.md` following the blueprint outlined in this report.
