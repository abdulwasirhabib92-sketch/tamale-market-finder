-- ================================================================
-- TMF CLEANUP SCRIPT — remove E2E test data
-- Paste into: Supabase Dashboard → SQL Editor → Run
-- Run this AFTER the fix script has been applied and re-tested.
--
-- Removes:
--   • test orders placed by E2E test accounts (email like 'tmfe2e%')
--   • the E2E test user accounts and their profiles
--
-- NOTE: product stock is NOT touched — during testing the stock bug
-- meant nothing was decremented, so stock values are still correct.
-- ================================================================

-- 1. Delete orders placed by test accounts
DELETE FROM orders
WHERE buyer_id IN (SELECT id FROM auth.users WHERE email LIKE 'tmfe2e%')
   OR order_number = 'TMF-2026-7355';

-- 2. Delete test user profiles
DELETE FROM user_profiles
WHERE id IN (SELECT id FROM auth.users WHERE email LIKE 'tmfe2e%');

-- 3. Delete test accounts themselves
DELETE FROM auth.users WHERE email LIKE 'tmfe2e%';

-- 4. Safety net: profiles whose user no longer exists
DELETE FROM user_profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- Optional: check Authentication → Users in the Supabase dashboard for
-- any OTHER test accounts from earlier sessions and delete them there.
