-- ============================================
-- FIX: Infinite RLS recursion on super_admin_allowlist
-- Migration: 012_fix_rls_recursion
-- 
-- Problem: The "super_admin_manage_plans" policy 
-- on plans table queries super_admin_allowlist, 
-- which has its own RLS policies that also query 
-- super_admin_allowlist → infinite recursion (42P17).
--
-- Solution: Create a SECURITY DEFINER function 
-- that bypasses RLS to check super admin status.
-- ============================================

-- 1. Create a helper function that bypasses RLS
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.super_admin_allowlist
        WHERE user_id = auth.uid() AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Fix plans table policy
DROP POLICY IF EXISTS "super_admin_manage_plans" ON plans;
CREATE POLICY "super_admin_manage_plans" ON plans FOR ALL USING (
    public.is_super_admin()
);

-- 3. Fix super_admin_allowlist self-referencing policies
-- These policies reference themselves, causing the recursion
-- Replace with the SECURITY DEFINER function approach

-- First check if these policies exist and recreate them
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Get all policies on super_admin_allowlist that use the recursive pattern
    FOR pol IN
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'super_admin_allowlist' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.super_admin_allowlist', pol.policyname);
    END LOOP;
END $$;

-- Recreate with non-recursive policies
-- Super admins can read the allowlist (using SECURITY DEFINER function)
CREATE POLICY "super_admin_read_allowlist" ON super_admin_allowlist
    FOR SELECT USING (public.is_super_admin());

-- Super admins can manage the allowlist
CREATE POLICY "super_admin_manage_allowlist" ON super_admin_allowlist
    FOR ALL USING (public.is_super_admin());

-- Service role bypass (for server-side operations)
CREATE POLICY "service_role_manage_allowlist" ON super_admin_allowlist
    FOR ALL USING (true) WITH CHECK (true);
