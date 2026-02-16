-- ============================================
-- FIX: Stale "super_admins" references
-- Migration: 014_fix_stale_super_admins_refs
--
-- Problem: Migration 004 renamed super_admins → 
-- super_admin_allowlist, but policies and functions
-- still reference "super_admins" by name causing
-- 42P01 "relation does not exist" errors.
-- ============================================

-- 1. Fix log_audit_event() function
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        actor_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values
    ) VALUES (
        auth.uid(),
        CASE 
            WHEN public.is_super_admin() THEN 'super_admin'
            WHEN EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid()) THEN 'employee'
            ELSE 'user'
        END,
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix employees policy  
DROP POLICY IF EXISTS "super_admin_employees" ON employees;
CREATE POLICY "super_admin_employees" ON employees
    FOR ALL USING (public.is_super_admin());

-- 3. Fix audit_logs policy
DROP POLICY IF EXISTS "audit_read_super_admin" ON audit_logs;
CREATE POLICY "audit_read_super_admin" ON audit_logs
    FOR SELECT USING (public.is_super_admin());

-- 4. Fix employee_invites policy (from migration 003)
DROP POLICY IF EXISTS "super_admin_invites" ON employee_invites;
CREATE POLICY "super_admin_invites" ON employee_invites
    FOR ALL USING (public.is_super_admin());
