-- ============================================================================
-- SECURITY FIX V2 — Tamale Market Finder
-- Fixes 5 vulnerabilities from pentest:
--   1. Admin privilege escalation (user_profiles RLS)
--   2. Ghana Card photos moved to private bucket
--   3. Storage RLS cross-user deletion fix
--   4. Enforce 'placed' status on new order inserts
--   5. (Ghana Post address fix is frontend-only — no SQL needed)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FIX 1: ADMIN PRIVILEGE ESCALATION
-- Problem: Users can INSERT or UPDATE their own profile with account_type='admin'
-- Fix: Restrict INSERT/UPDATE to prevent self-assigning admin role
-- ----------------------------------------------------------------------------

-- Drop the vulnerable INSERT policy
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Re-create with check: only allow 'shopper' or 'trader' on self-insert (no admin)
CREATE POLICY "Users can insert own profile" ON user_profiles 
    FOR INSERT WITH CHECK (
        auth.uid() = id 
        AND account_type IN ('shopper', 'trader')
    );

-- Drop the vulnerable UPDATE policy (allowed updating ALL columns)
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Re-create: users can update their own profile but CANNOT change account_type
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id 
        AND account_type IN ('shopper', 'trader')
    );

-- Add a trigger that prevents account_type escalation at the database level
-- This is a belt-and-suspenders approach: even if RLS is somehow bypassed,
-- a non-admin user cannot set account_type to 'admin'
CREATE OR REPLACE FUNCTION prevent_admin_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow admin assignment if the current user is already an admin
    IF NEW.account_type = 'admin' THEN
        IF OLD.account_type IS DISTINCT FROM 'admin' THEN
            -- Check if the current user is an admin
            IF NOT EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE id = auth.uid() AND account_type = 'admin'
            ) THEN
                RAISE EXCEPTION 'Cannot escalate to admin role';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS prevent_admin_escalation_trigger ON user_profiles;
CREATE TRIGGER prevent_admin_escalation_trigger
    BEFORE INSERT OR UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION prevent_admin_escalation();

-- ----------------------------------------------------------------------------
-- FIX 2: GHANA CARD PHOTOS — PRIVATE BUCKET
-- Problem: Ghana Card photos stored in 'shop-images' (PUBLIC bucket)
-- Fix: Create private 'ghana-cards' bucket, restrict access to owner+admin
-- ----------------------------------------------------------------------------

-- Create private bucket for Ghana Card photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ghana-cards', 'ghana-cards', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Policies for ghana-cards bucket
DROP POLICY IF EXISTS "Owners can upload own Ghana Card photos" ON storage.objects;
CREATE POLICY "Owners can upload own Ghana Card photos" 
    ON storage.objects FOR INSERT TO authenticated 
    WITH CHECK (
        bucket_id = 'ghana-cards' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Owners can read own Ghana Card photos" ON storage.objects;
CREATE POLICY "Owners can read own Ghana Card photos" 
    ON storage.objects FOR SELECT TO authenticated 
    USING (
        bucket_id = 'ghana-cards' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Admins can read all Ghana Card photos" ON storage.objects;
CREATE POLICY "Admins can read all Ghana Card photos" 
    ON storage.objects FOR SELECT TO authenticated 
    USING (
        bucket_id = 'ghana-cards' 
        AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND account_type = 'admin')
    );

DROP POLICY IF EXISTS "Owners can delete own Ghana Card photos" ON storage.objects;
CREATE POLICY "Owners can delete own Ghana Card photos" 
    ON storage.objects FOR DELETE TO authenticated 
    USING (
        bucket_id = 'ghana-cards' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- ----------------------------------------------------------------------------
-- FIX 3: STORAGE RLS — CROSS-USER DELETION
-- Problem: Any authenticated user can delete ANY file in product-images or shop-images
-- Fix: Restrict deletion to files owned by the user (folder name = auth.uid())
-- ----------------------------------------------------------------------------

-- Drop the vulnerable blanket deletion policy
DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;

-- Product images: only owner can delete (folder = user id)
CREATE POLICY "Users can delete own product images" 
    ON storage.objects FOR DELETE TO authenticated 
    USING (
        bucket_id = 'product-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Shop images: only owner can delete (folder = user id)
CREATE POLICY "Users can delete own shop images" 
    ON storage.objects FOR DELETE TO authenticated 
    USING (
        bucket_id = 'shop-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Also restrict uploads to use user's own folder
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images" 
    ON storage.objects FOR INSERT TO authenticated 
    WITH CHECK (
        bucket_id = 'product-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Authenticated users can upload shop images" ON storage.objects;
CREATE POLICY "Authenticated users can upload shop images" 
    ON storage.objects FOR INSERT TO authenticated 
    WITH CHECK (
        bucket_id = 'shop-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- ----------------------------------------------------------------------------
-- FIX 4: ENFORCE 'placed' STATUS ON NEW ORDER INSERTS
-- Problem: Order INSERT policy allows any status value, buyers could insert 
--          orders with status='completed' to bypass verification
-- Fix: RLS INSERT CHECK must enforce status = 'placed'
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Buyers can insert orders" ON orders;
CREATE POLICY "Buyers can insert orders" ON orders 
    FOR INSERT WITH CHECK (
        auth.uid() = buyer_id 
        AND status = 'placed'
    );

-- ----------------------------------------------------------------------------
-- DONE — All SQL fixes applied
-- Fix 5 (Ghana Post address) is frontend-only, handled in app.js
-- ----------------------------------------------------------------------------
