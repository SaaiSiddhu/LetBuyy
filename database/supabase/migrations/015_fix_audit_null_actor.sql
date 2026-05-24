-- ============================================
-- FIX: Audit trigger fails with null auth.uid()
-- Migration: 015_fix_audit_null_actor
--
-- Problem: log_audit_event() uses auth.uid() for
-- actor_id, but custom auth means auth.uid() is null.
-- audit_logs.actor_id is NOT NULL → insert fails.
--
-- Solution: Make actor_id nullable and handle null
-- auth.uid() gracefully in the trigger function.
-- ============================================

-- 1. Make actor_id nullable
ALTER TABLE audit_logs ALTER COLUMN actor_id DROP NOT NULL;

-- 2. Update trigger function to handle null gracefully
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
        auth.uid(),  -- may be null for custom auth operations
        CASE 
            WHEN auth.uid() IS NULL THEN 'system'
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
