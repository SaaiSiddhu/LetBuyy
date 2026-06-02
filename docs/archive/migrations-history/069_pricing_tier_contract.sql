-- Migration: 069_pricing_tier_contract
-- Purpose: Wire the India-first store tier contract to billing and entitlement
-- resolution without making final production pricing decisions.
--
-- Final paid price points and live Razorpay plan ids are human-gated policy and
-- provider-account decisions. This migration adds the zero-price Free tier and
-- keeps existing paid plan amounts unless a human-approved pricing migration
-- changes them later.

INSERT INTO plans (
    site_type, slug, name, tagline, is_popular,
    price_monthly_inr, price_yearly_inr,
    gmv_percentage, promo_price_inr, promo_months, promo_label,
    products_limit, orders_limit, storage_mb, staff_limit, ai_credits_monthly,
    custom_domain, branding_removable, support_level,
    display_order, requires_contact, trial_days, features
) VALUES (
    'store', 'free', 'Free', 'Start selling with the essentials', false,
    0, 0,
    2.50, 0, 0, NULL,
    25, 50, 100, 1, 5,
    false, false, 'community',
    0, false, 0,
    '[
        {"label": "25 products", "icon": "inventory_2"},
        {"label": "50 orders/month", "icon": "shopping_bag"},
        {"label": "100 MB storage", "icon": "cloud"},
        {"label": "LetBuyy branding", "icon": "storefront"}
    ]'::jsonb
)
ON CONFLICT (site_type, slug)
DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    is_popular = EXCLUDED.is_popular,
    price_monthly_inr = 0,
    price_yearly_inr = 0,
    gmv_percentage = EXCLUDED.gmv_percentage,
    promo_price_inr = 0,
    promo_months = 0,
    promo_label = NULL,
    products_limit = EXCLUDED.products_limit,
    orders_limit = EXCLUDED.orders_limit,
    storage_mb = EXCLUDED.storage_mb,
    staff_limit = EXCLUDED.staff_limit,
    ai_credits_monthly = EXCLUDED.ai_credits_monthly,
    custom_domain = EXCLUDED.custom_domain,
    branding_removable = EXCLUDED.branding_removable,
    support_level = EXCLUDED.support_level,
    display_order = EXCLUDED.display_order,
    requires_contact = EXCLUDED.requires_contact,
    trial_days = EXCLUDED.trial_days,
    features = EXCLUDED.features,
    is_active = TRUE,
    updated_at = NOW();

UPDATE plans
SET display_order = CASE slug
        WHEN 'free' THEN 0
        WHEN 'starter' THEN 1
        WHEN 'business' THEN 2
        WHEN 'enterprise' THEN 3
        ELSE display_order
    END,
    is_popular = CASE slug
        WHEN 'business' THEN TRUE
        WHEN 'starter' THEN FALSE
        WHEN 'free' THEN FALSE
        ELSE is_popular
    END,
    updated_at = NOW()
WHERE site_type = 'store'
  AND slug IN ('free', 'starter', 'business', 'enterprise');

INSERT INTO plan_entitlements (site_type, plan_slug, features, limits, entitlements)
VALUES
    ('store', 'free',
        ARRAY['storefront', 'products', 'orders'],
        '{"products": 25, "orders_monthly": 50, "storage_mb": 100, "staff": 1, "ai_credits_monthly": 5, "api_requests_monthly": 1000, "webhook_subscriptions": 0}'::JSONB,
        '{"custom_domain": false, "remove_branding": false, "multi_location_inventory": false, "advanced_promotions": false, "api_access": false}'::JSONB
    ),
    ('store', 'starter',
        ARRAY['storefront', 'products', 'orders', 'custom_domain', 'basic_analytics', 'webhooks'],
        '{"products": 100, "orders_monthly": 250, "storage_mb": 2048, "staff": 1, "ai_credits_monthly": 30, "api_requests_monthly": 10000, "webhook_subscriptions": 3}'::JSONB,
        '{"custom_domain": true, "remove_branding": false, "multi_location_inventory": false, "advanced_promotions": false, "api_access": true}'::JSONB
    ),
    ('store', 'business',
        ARRAY['storefront', 'products', 'orders', 'custom_domain', 'advanced_analytics', 'webhooks', 'multi_location_inventory', 'advanced_promotions'],
        '{"products": 1000, "orders_monthly": 2500, "storage_mb": 10240, "staff": 3, "ai_credits_monthly": 100, "api_requests_monthly": 100000, "webhook_subscriptions": 25}'::JSONB,
        '{"custom_domain": true, "remove_branding": true, "multi_location_inventory": true, "advanced_promotions": true, "api_access": true}'::JSONB
    ),
    ('store', 'enterprise',
        ARRAY['storefront', 'products', 'orders', 'custom_domain', 'enterprise_analytics', 'webhooks', 'multi_location_inventory', 'advanced_promotions', 'dedicated_support'],
        '{"products": null, "orders_monthly": null, "storage_mb": 51200, "staff": null, "ai_credits_monthly": 500, "api_requests_monthly": null, "webhook_subscriptions": null}'::JSONB,
        '{"custom_domain": true, "remove_branding": true, "multi_location_inventory": true, "advanced_promotions": true, "api_access": true, "dedicated_support": true}'::JSONB
    )
ON CONFLICT (site_type, plan_slug)
DO UPDATE SET
    features = EXCLUDED.features,
    limits = EXCLUDED.limits,
    entitlements = EXCLUDED.entitlements,
    is_active = TRUE,
    updated_at = NOW(),
    deleted_at = NULL;
