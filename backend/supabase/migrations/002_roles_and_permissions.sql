-- ============================================
-- LETBUYY EMPLOYEE & SUPER ADMIN ROLES
-- Migration: 002_roles_and_permissions
-- ============================================

-- ============================================
-- EMPLOYEE ROLES
-- ============================================

CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    
    -- Role
    role TEXT NOT NULL CHECK (role IN ('support', 'sales', 'marketing', 'operations', 'manager', 'admin')),
    
    -- Permissions (granular)
    permissions JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_role ON employees(role);

-- ============================================
-- SUPER ADMINS
-- ============================================

CREATE TABLE IF NOT EXISTS super_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    
    -- 2FA is mandatory
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    
    -- Access control
    allowed_ips TEXT[] DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Actor
    actor_id UUID NOT NULL,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'employee', 'super_admin', 'system')),
    actor_email TEXT,
    
    -- Action
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    
    -- Details
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    
    -- Request info
    ip_address TEXT,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ============================================
-- EMPLOYEE PERMISSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS employee_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    permission TEXT NOT NULL,
    description TEXT,
    
    UNIQUE(role, permission)
);

-- Insert default permissions
INSERT INTO employee_permissions (role, permission, description) VALUES
('support', 'view_users', 'View user profiles'),
('support', 'view_orders', 'View order details'),
('support', 'update_order_status', 'Update order fulfillment status'),
('sales', 'view_users', 'View user profiles'),
('sales', 'view_orders', 'View order details'),
('sales', 'view_analytics', 'View sales analytics'),
('marketing', 'view_analytics', 'View marketing analytics'),
('marketing', 'send_notifications', 'Send push notifications'),
('operations', 'view_users', 'View user profiles'),
('operations', 'view_orders', 'View order details'),
('operations', 'update_order_status', 'Update order fulfillment status'),
('operations', 'manage_inventory', 'Manage product inventory'),
('manager', 'view_users', 'View user profiles'),
('manager', 'view_orders', 'View order details'),
('manager', 'update_order_status', 'Update order fulfillment status'),
('manager', 'view_analytics', 'View all analytics'),
('manager', 'manage_employees', 'Manage team members'),
('admin', 'all', 'Full employee admin access');

-- ============================================
-- RLS FOR NEW TABLES
-- ============================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can manage everything
CREATE POLICY "super_admin_employees" ON employees
    FOR ALL USING (
        EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND is_active = TRUE)
    );

CREATE POLICY "super_admin_only" ON super_admins
    FOR ALL USING (
        EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND is_active = TRUE)
    );

-- Audit logs: insert only, super admins can read
CREATE POLICY "audit_insert" ON audit_logs
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "audit_read_super_admin" ON audit_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND is_active = TRUE)
    );

-- ============================================
-- AUDIT TRIGGER FUNCTION
-- ============================================

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
            WHEN EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()) THEN 'super_admin'
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

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_employees AFTER INSERT OR UPDATE OR DELETE ON employees
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_super_admins AFTER INSERT OR UPDATE OR DELETE ON super_admins
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();
