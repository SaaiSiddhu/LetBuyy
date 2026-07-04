-- 178_v1_pricing_plans_seed.sql
-- V1 Commercial Launch — pricing catalog + entitlements + program seed (idempotent).
--
-- Seeds the four V1 plans into the existing `plans` catalog (site_type='store') and
-- their runtime `plan_entitlements`, plus the singleton founding_merchant_program row
-- and the baseline pricing_snapshots audit. `free` is preserved as the internal
-- fallback tier (not featured in V1 public pricing).
--
-- Idempotency contract:
--   * plans / plan_entitlements      → ON CONFLICT DO UPDATE (establish canonical V1 values)
--   * founding_merchant_program      → ON CONFLICT DO NOTHING (NEVER reset live counters)
--   * pricing_snapshots              → guarded INSERT (baseline appended once)

-- ============================================================================
-- 1) Plans catalog
-- ============================================================================
INSERT INTO public.plans (
    site_type, slug, name, tagline, is_popular,
    price_monthly_inr, price_yearly_inr, founding_price_inr,
    products_limit, orders_limit, pages_limit, staff_limit,
    custom_domain, branding_removable, support_level,
    features, is_active, display_order, requires_contact, trial_days,
    status, purchasable
) VALUES
-- NOTE: price columns are INR MINOR (paise) — planBillingAmountMinor returns them
-- directly as amountMinor for Razorpay. ₹299 = 29900, ₹199 = 19900, etc.
('store', 'launch', 'Launch', 'Everything you need to start selling', false,
    29900, 29900, 19900,
    NULL, NULL, NULL, 1,
    false, false, 'email',
    '["Unlimited Products","Unlimited Orders","Unlimited Customers","Storefront","Themes","COD","UPI","QR Payments","Basic Analytics","Blogs","Pages","Free Hosting","LetBuyy Subdomain"]'::jsonb,
    true, 1, false, 7,
    'available', true),
('store', 'growth', 'Growth', 'Scale your store with advanced tools', true,
    99900, 99900, 69900,
    NULL, NULL, NULL, 3,
    true, true, 'priority',
    '["Everything in Launch","Custom Domain","Inventory Management","3 Staff Accounts","Advanced Analytics","Bulk Import","Discount Engine","Customer Segments","WhatsApp Notifications","Marketing Tools","Basic Automations"]'::jsonb,
    true, 2, false, 7,
    'available', true),
('store', 'scale', 'Scale', 'Coming soon', false,
    0, 0, 0,
    NULL, NULL, NULL, 10,
    true, true, 'priority',
    '["Multi Warehouse","Loyalty Engine","Gift Cards","API Access","App Marketplace","Advanced Reports"]'::jsonb,
    true, 3, false, 0,
    'coming_soon', false),
('store', 'commerce_os', 'Commerce OS', 'Coming soon', false,
    0, 0, 0,
    NULL, NULL, NULL, 25,
    true, true, 'dedicated',
    '["POS","Multi Store","B2B Commerce","AI Copilot","LCIS Access","Operations Center","Executive Center"]'::jsonb,
    true, 4, false, 0,
    'coming_soon', false)
ON CONFLICT (site_type, slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    is_popular = EXCLUDED.is_popular,
    price_monthly_inr = EXCLUDED.price_monthly_inr,
    price_yearly_inr = EXCLUDED.price_yearly_inr,
    founding_price_inr = EXCLUDED.founding_price_inr,
    staff_limit = EXCLUDED.staff_limit,
    custom_domain = EXCLUDED.custom_domain,
    branding_removable = EXCLUDED.branding_removable,
    support_level = EXCLUDED.support_level,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order,
    requires_contact = EXCLUDED.requires_contact,
    trial_days = EXCLUDED.trial_days,
    status = EXCLUDED.status,
    purchasable = EXCLUDED.purchasable,
    updated_at = now();

-- ============================================================================
-- 2) Runtime entitlements (purchasable plans only; resolve_site_entitlements reads these)
-- ============================================================================
INSERT INTO public.plan_entitlements (site_type, plan_slug, features, limits, entitlements, is_active)
VALUES
('store', 'launch',
    ARRAY['storefront','themes','cod','upi','qr_payments','basic_analytics','blogs','pages','free_hosting','subdomain'],
    '{"products": null, "orders": null, "customers": null, "staff": 1, "custom_domain": false}'::jsonb,
    '{"unlimited_products": true, "unlimited_orders": true, "unlimited_customers": true, "marketing_tools": false, "inventory_management": false}'::jsonb,
    true),
('store', 'growth',
    ARRAY['storefront','themes','cod','upi','qr_payments','advanced_analytics','blogs','pages','free_hosting','custom_domain','inventory_management','bulk_import','discount_engine','customer_segments','whatsapp_notifications','marketing_tools','basic_automations'],
    '{"products": null, "orders": null, "customers": null, "staff": 3, "custom_domain": true}'::jsonb,
    '{"unlimited_products": true, "unlimited_orders": true, "unlimited_customers": true, "marketing_tools": true, "inventory_management": true}'::jsonb,
    true)
ON CONFLICT (site_type, plan_slug) DO UPDATE SET
    features = EXCLUDED.features,
    limits = EXCLUDED.limits,
    entitlements = EXCLUDED.entitlements,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- ============================================================================
-- 3) Founding Merchant Program singleton — DO NOTHING so live counters never reset
-- ============================================================================
INSERT INTO public.founding_merchant_program (
    program_key, total_slots, public_slots, invited_slots, partner_slots,
    used_slots, public_used, invited_used, partner_used,
    launch_price, growth_price, active, paused
) VALUES (
    'v1', 100, 70, 20, 10,
    0, 0, 0, 0,
    19900, 69900, true, false
)
ON CONFLICT (program_key) DO NOTHING;

-- ============================================================================
-- 4) Baseline pricing snapshots (append-once; proves founding prices at launch)
-- ============================================================================
INSERT INTO public.pricing_snapshots (plan_slug, site_type, price_monthly_inr, founding_price_inr, reason)
SELECT v.slug, 'store', v.price, v.founding, 'baseline_v1'
FROM (VALUES ('launch', 29900, 19900), ('growth', 99900, 69900)) AS v(slug, price, founding)
WHERE NOT EXISTS (
    SELECT 1 FROM public.pricing_snapshots ps
    WHERE ps.plan_slug = v.slug AND ps.reason = 'baseline_v1'
);
