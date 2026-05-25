-- ============================================
-- FIX: Subscriptions & billing_history RLS + FK
-- Migration: 013_fix_subscription_rls
--
-- Problems:
-- 1. RLS uses `user_id = auth.uid()` but app uses
--    custom auth (users_custom). auth.uid() is null.
-- 2. user_id columns have FK to auth.users(id) but
--    we insert users_custom.id values.
--
-- Solution: 
-- 1. Add permissive RLS policies for server operations
-- 2. Drop auth.users FK and add users_custom FK
-- ============================================

-- 1. Fix subscriptions user_id FK
-- Drop the old FK to auth.users
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
-- Add FK to users_custom instead
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users_custom(id) ON DELETE CASCADE;

-- 2. Fix billing_history user_id FK
ALTER TABLE billing_history DROP CONSTRAINT IF EXISTS billing_history_user_id_fkey;
ALTER TABLE billing_history ADD CONSTRAINT billing_history_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users_custom(id) ON DELETE CASCADE;

-- 3. Subscriptions: add permissive policy for server operations
DROP POLICY IF EXISTS "service_role_subscriptions" ON subscriptions;
CREATE POLICY "service_role_subscriptions" ON subscriptions
    FOR ALL USING (true) WITH CHECK (true);

-- 4. Billing history: add permissive policy
DROP POLICY IF EXISTS "service_role_billing_history" ON billing_history;
CREATE POLICY "service_role_billing_history" ON billing_history
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Sites: ensure server can update trial_status
DROP POLICY IF EXISTS "service_role_sites" ON sites;
CREATE POLICY "service_role_sites" ON sites
    FOR ALL USING (true) WITH CHECK (true);
