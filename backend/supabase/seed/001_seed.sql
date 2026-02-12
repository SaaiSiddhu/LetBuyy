-- ============================================
-- LETBUYY SEED DATA
-- Run after migrations to populate test data
-- ============================================

-- Default employee roles permissions mapping
INSERT INTO employee_permissions (role, permission, description) 
VALUES
    ('support', 'tickets.view', 'View support tickets'),
    ('support', 'tickets.respond', 'Respond to tickets'),
    ('support', 'users.read', 'Look up user profiles'),
    ('support', 'stores.read', 'Look up store details'),
    ('marketing', 'analytics.read', 'View marketing analytics'),
    ('marketing', 'campaigns.manage', 'Manage campaigns'),
    ('marketing', 'content.manage', 'Manage blog/content'),
    ('marketing', 'banners.manage', 'Manage promotional banners'),
    ('operations', 'disputes.manage', 'Handle order disputes'),
    ('operations', 'health.view', 'View platform health'),
    ('operations', 'sellers.verify', 'Verify seller accounts')
ON CONFLICT (role, permission) DO NOTHING;

-- Subscription plan limits reference (informational, enforced in API)
-- Free:       1 site,  10 products, 2% transaction fee
-- Starter:    3 sites, 100 products, 1% transaction fee, custom domain
-- Business:  10 sites, 1000 products, 0% transaction fee, custom domain
-- Enterprise: unlimited
