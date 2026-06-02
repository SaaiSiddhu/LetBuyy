-- ============================================================================
-- Store employee runtime alignment
-- Migration: 041_store_employee_runtime_alignment.sql
-- Purpose:
--   Make staff/users settings store-scoped and compatible with merchant roles.
-- ============================================================================

ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'invited'
        CHECK (status IN ('invited', 'active', 'disabled', 'removed')),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE employees
    ALTER COLUMN full_name DROP NOT NULL;

ALTER TABLE employees
    DROP CONSTRAINT IF EXISTS employees_role_check;

ALTER TABLE employees
    ADD CONSTRAINT employees_role_check
    CHECK (role IN (
        'support',
        'sales',
        'marketing',
        'operations',
        'manager',
        'admin',
        'editor',
        'viewer',
        'fulfillment',
        'staff'
    ));

UPDATE employees
SET status = CASE
        WHEN deleted_at IS NOT NULL THEN 'removed'
        WHEN is_active = TRUE THEN COALESCE(status, 'active')
        ELSE COALESCE(status, 'disabled')
    END,
    full_name = COALESCE(full_name, email)
WHERE status IS NULL
   OR full_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_employees_store_status_active
    ON employees(store_id, status, created_at DESC)
    WHERE deleted_at IS NULL;
