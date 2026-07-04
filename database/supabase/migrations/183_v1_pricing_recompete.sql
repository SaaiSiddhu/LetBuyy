-- 183_v1_pricing_recompete.sql
-- V1 pricing experience — catalog DATA only (Shopify-class re-merchandising).
--
-- Scope: pricing PRESENTATION/catalog only. This migration changes NO billing,
-- subscription, founding, entitlement-resolution, checkout, or activation logic.
-- It re-seeds the 4 `store` plans (Launch/Growth/Scale/Commerce OS), promotes
-- Scale + Commerce OS to purchasable, writes the single-source compare matrix into
-- `plans.compare_features`, and upserts `plan_entitlements` for Scale + Commerce OS.
--
-- Founding Merchant Program is intentionally untouched (the 178 singleton row and
-- its live counters remain; founding_price_inr stays a per-tier display override).
--
-- Idempotency: plans/entitlements use ON CONFLICT DO UPDATE; pricing_snapshots is
-- append-once. Money columns are INR MINOR (paise): ₹299 = 29900.
--
-- Single source of truth: the compare matrix is authored ONCE here and written to
-- every plan via one CTE-driven UPDATE. The pricing pages (MCP + marketing) read it
-- from /api/plans → plan-ui.ts; it is never hardcoded in React.

-- ============================================================================
-- 1) Plans catalog — 4 priced, available tiers
-- ============================================================================
INSERT INTO public.plans (
    site_type, slug, name, tagline, is_popular,
    price_monthly_inr, price_yearly_inr, founding_price_inr, gmv_percentage,
    ai_credits_monthly, storage_mb, staff_limit,
    products_limit, orders_limit, pages_limit,
    custom_domain, branding_removable, support_level,
    features, is_active, display_order, requires_contact, trial_days,
    status, purchasable
) VALUES
('store', 'launch', 'Launch', 'Everything you need to start selling', false,
    29900, 24900, 19900, 0,
    50, 1024, 1,
    NULL, NULL, NULL,
    false, false, 'email',
    '["0% commission forever","Unlimited products, orders & customers","Online storefront + themes","UPI, QR & COD","GST tax invoices","Free .letbuyy.com domain & hosting","Basic analytics","Blogs & pages","50 AI credits / month","1 staff account"]'::jsonb,
    true, 1, false, 14,
    'available', true),
('store', 'growth', 'Growth', 'Scale your store with advanced tools', true,
    99900, 79900, 69900, 0,
    250, 10240, 3,
    NULL, NULL, NULL,
    true, true, 'priority',
    '["Everything in Launch","Custom domain + remove branding","Inventory management","Bulk product import","Discount engine","Customer segments","WhatsApp commerce","Email campaigns + automations","Advanced analytics","250 AI credits / month","3 staff accounts"]'::jsonb,
    true, 2, false, 14,
    'available', true),
('store', 'scale', 'Scale', 'For scaling, multi-channel businesses', false,
    249900, 199900, 0, 0,
    1000, 51200, 10,
    NULL, NULL, NULL,
    true, true, 'priority',
    '["Everything in Growth","Multi-warehouse inventory","Purchase orders","Loyalty & gift cards","Reviews & UGC","Abandoned-checkout recovery","API access","Markets & local currency","1,000 AI credits / month","10 staff accounts"]'::jsonb,
    true, 3, false, 14,
    'available', true),
('store', 'commerce_os', 'Commerce OS', 'Your commerce operating system', false,
    599900, 479900, 0, 0,
    5000, 204800, 25,
    NULL, NULL, NULL,
    true, true, 'dedicated',
    '["Everything in Scale","POS / in-person sales","Multi-store management","B2B catalogs (B2B + DTC)","AI Copilot + LCIS intelligence","Operations & Executive Center","Custom roles & permissions","Dedicated success manager","5,000 AI credits / month","25 staff accounts"]'::jsonb,
    true, 4, false, 14,
    'available', true)
ON CONFLICT (site_type, slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    is_popular = EXCLUDED.is_popular,
    price_monthly_inr = EXCLUDED.price_monthly_inr,
    price_yearly_inr = EXCLUDED.price_yearly_inr,
    founding_price_inr = EXCLUDED.founding_price_inr,
    gmv_percentage = EXCLUDED.gmv_percentage,
    ai_credits_monthly = EXCLUDED.ai_credits_monthly,
    storage_mb = EXCLUDED.storage_mb,
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
-- 2) Compare matrix — single source of truth, written to every plan
--    Structure: [{ category, items: [{ label, description, launch, growth,
--    scale, commerce_os, display_order }] }]  (rendered by plan-ui.ts)
--    Verified LetBuyy capabilities only — no fabricated features.
-- ============================================================================
WITH matrix AS (
    SELECT '[
      {"category":"Pricing","items":[
        {"label":"Monthly price","description":"Billed every month.","launch":"₹299","growth":"₹999","scale":"₹2,499","commerce_os":"₹5,999","display_order":1},
        {"label":"Yearly price (per month)","description":"Pay yearly and save about 20%.","launch":"₹249","growth":"₹799","scale":"₹1,999","commerce_os":"₹4,799","display_order":2},
        {"label":"Founding price","description":"Lifetime locked price for the first 100 merchants.","launch":"₹199","growth":"₹699","scale":"—","commerce_os":"—","display_order":3},
        {"label":"Platform commission","description":"LetBuyy never takes a cut of your sales.","launch":"0% forever","growth":"0% forever","scale":"0% forever","commerce_os":"0% forever","display_order":4},
        {"label":"Free trial","description":"Try every feature before you pay.","launch":"14 days","growth":"14 days","scale":"14 days","commerce_os":"14 days","display_order":5},
        {"label":"Setup fee","description":"No onboarding or setup charges, ever.","launch":"₹0","growth":"₹0","scale":"₹0","commerce_os":"₹0","display_order":6}
      ]},
      {"category":"Core commerce","items":[
        {"label":"Online storefront","description":"Your own branded online store.","launch":"Full","growth":"Full","scale":"Full","commerce_os":"Full","display_order":7},
        {"label":"Themes & templates","description":"Ready-made designs you can customize.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":8},
        {"label":"Unlimited products","description":"No cap on how many products you list.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":9},
        {"label":"Unlimited orders","description":"No cap on orders you process.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":10},
        {"label":"Unlimited customers","description":"No cap on customer records.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":11},
        {"label":"Staff accounts","description":"Team members who can access your store.","launch":"1","growth":"3","scale":"10","commerce_os":"25","display_order":12},
        {"label":"Storage","description":"Space for product images and media.","launch":"1 GB","growth":"10 GB","scale":"50 GB","commerce_os":"200 GB","display_order":13},
        {"label":"AI credits per month","description":"Monthly allowance for AI content and assistance.","launch":"50","growth":"250","scale":"1,000","commerce_os":"5,000","display_order":14}
      ]},
      {"category":"Products","items":[
        {"label":"Product variants","description":"Sizes, colors and other options per product.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":15},
        {"label":"Collections","description":"Group products into curated collections.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":16},
        {"label":"Categories","description":"Organize products into categories.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":17},
        {"label":"Product media","description":"Images and media on every product.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":18},
        {"label":"Product reviews","description":"Collect and show customer reviews.","launch":false,"growth":false,"scale":true,"commerce_os":true,"display_order":19},
        {"label":"Custom data (metafields)","description":"Add custom fields to products and pages.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":20},
        {"label":"Bulk product import","description":"Import many products at once from a file.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":21},
        {"label":"Purchase orders","description":"Track stock purchases from suppliers.","launch":false,"growth":false,"scale":true,"commerce_os":true,"display_order":22}
      ]},
      {"category":"Inventory","items":[
        {"label":"Inventory tracking","description":"Track stock levels across products.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":23},
        {"label":"Adjustments & history","description":"Adjust quantities and see the change history.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":24},
        {"label":"Inventory locations","description":"Track stock across store locations.","launch":"—","growth":"1","scale":"Multiple","commerce_os":"Multiple","display_order":25},
        {"label":"Multi-warehouse","description":"Manage stock across warehouses.","launch":false,"growth":false,"scale":true,"commerce_os":true,"display_order":26},
        {"label":"Low-stock visibility","description":"See which products are running low.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":27}
      ]},
      {"category":"Orders","items":[
        {"label":"Order management","description":"View, fulfill and manage orders.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":28},
        {"label":"Draft orders","description":"Create orders manually for customers.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":29},
        {"label":"Order notes & tags","description":"Add internal notes and tags to orders.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":30},
        {"label":"Returns & refunds","description":"Process returns and issue refunds.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":31},
        {"label":"COD reconciliation","description":"Reconcile cash-on-delivery collections.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":32},
        {"label":"Custom order ID format","description":"Set your own order number prefix.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":33}
      ]},
      {"category":"Payments","items":[
        {"label":"Razorpay payments","description":"Accept cards, netbanking and more via your Razorpay account.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":34},
        {"label":"UPI payments","description":"Accept UPI natively.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":35},
        {"label":"QR payments","description":"Accept payments by QR code.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":36},
        {"label":"Cash on delivery","description":"Let customers pay on delivery.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":37},
        {"label":"GST tax invoices","description":"Issue GST-compliant invoices automatically.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":38},
        {"label":"Gift cards","description":"Sell and redeem store gift cards.","launch":false,"growth":false,"scale":true,"commerce_os":true,"display_order":39},
        {"label":"Wallet & payouts","description":"Track your balance and settlements.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":40},
        {"label":"0% commission","description":"Keep 100% of every sale, forever.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":41}
      ]},
      {"category":"Checkout","items":[
        {"label":"Hosted checkout","description":"Secure, fast checkout for your store.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":42},
        {"label":"Customer accounts","description":"Let customers create and use accounts.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":43},
        {"label":"Checkout customization","description":"Customize checkout fields and options.","launch":"Limited","growth":"Limited","scale":"Standard","commerce_os":"Full","display_order":44},
        {"label":"Abandoned-checkout recovery","description":"Win back customers who did not finish checkout.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":45}
      ]},
      {"category":"Marketing","items":[
        {"label":"Coupons","description":"Create coupon codes.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":46},
        {"label":"Discount engine","description":"Build advanced discount rules.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":47},
        {"label":"Customer segments","description":"Group customers by behavior and value.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":48},
        {"label":"Email campaigns","description":"Send marketing emails to customers.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":49},
        {"label":"WhatsApp commerce","description":"Sell and engage customers on WhatsApp.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":50},
        {"label":"Marketing automations","description":"Automate marketing workflows.","launch":false,"growth":"Basic","scale":true,"commerce_os":true,"display_order":51},
        {"label":"Reviews & UGC","description":"Collect reviews and user-generated content.","launch":false,"growth":false,"scale":true,"commerce_os":true,"display_order":52},
        {"label":"Blog","description":"Publish blog content on your store.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":53}
      ]},
      {"category":"Customers","items":[
        {"label":"Customer profiles","description":"Unified records for every customer.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":54},
        {"label":"Notes & tags","description":"Annotate and tag customers.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":55},
        {"label":"Saved addresses","description":"Store customer shipping addresses.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":56},
        {"label":"Customer segmentation","description":"Target groups of customers.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":57},
        {"label":"Loyalty program","description":"Reward repeat customers.","launch":false,"growth":false,"scale":true,"commerce_os":true,"display_order":58}
      ]},
      {"category":"Shipping","items":[
        {"label":"Shipping zones","description":"Define where you ship.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":59},
        {"label":"Shipping rates","description":"Set rates by zone and weight.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":60},
        {"label":"GST on shipping","description":"Apply GST to shipping charges.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":61},
        {"label":"Shipping labels","description":"Generate shipping labels.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":62},
        {"label":"Order tracking","description":"Share tracking with customers.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":63}
      ]},
      {"category":"Tax","items":[
        {"label":"GST invoices","description":"Automatic GST-compliant invoices.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":64},
        {"label":"GSTIN capture","description":"Capture business and customer GSTIN.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":65},
        {"label":"HSN codes","description":"Assign HSN codes to products.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":66},
        {"label":"Tax-inclusive pricing","description":"Show prices inclusive of tax.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":67},
        {"label":"GST state code","description":"Place-of-supply handling for tax.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":68}
      ]},
      {"category":"AI","items":[
        {"label":"AI homepage builder","description":"Generate a store homepage from a prompt.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":69},
        {"label":"AI product content","description":"Generate product titles and descriptions.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":70},
        {"label":"AI SEO","description":"AI help for search optimization.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":71},
        {"label":"AI marketing","description":"AI help for campaigns and copy.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":72},
        {"label":"AI Copilot","description":"Your AI assistant for running the business.","launch":false,"growth":false,"scale":true,"commerce_os":true,"display_order":73},
        {"label":"AI Operations","description":"AI for operational questions and tasks.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":74},
        {"label":"AI credits per month","description":"Monthly AI usage allowance.","launch":"50","growth":"250","scale":"1,000","commerce_os":"5,000","display_order":75}
      ]},
      {"category":"Analytics","items":[
        {"label":"Sales dashboard","description":"Overview of sales and store activity.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":76},
        {"label":"Standard reports","description":"Core sales and order reports.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":77},
        {"label":"Advanced reports","description":"Deeper analytics and breakdowns.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":78},
        {"label":"Executive Center","description":"Executive-level view of the business.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":79},
        {"label":"LCIS intelligence","description":"Access to the LetBuyy intelligence system.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":80}
      ]},
      {"category":"Operations","items":[
        {"label":"Operations Center","description":"Central view of store operations.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":81},
        {"label":"Runbooks & incidents","description":"Operational runbooks and incident view.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":82},
        {"label":"Live operations","description":"Real-time operations board.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":83},
        {"label":"Bulk operations","description":"Act on many records at once.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":84},
        {"label":"Enterprise automations","description":"Advanced cross-store workflow automations.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":85}
      ]},
      {"category":"Domains","items":[
        {"label":"Free .letbuyy.com address","description":"A free store address to start with.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":86},
        {"label":"Custom domain","description":"Use your own branded domain.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":87},
        {"label":"Free SSL certificate","description":"Secure HTTPS for your store.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":88},
        {"label":"Remove LetBuyy branding","description":"Hide platform branding from your store.","launch":false,"growth":true,"scale":true,"commerce_os":true,"display_order":89}
      ]},
      {"category":"Global commerce","items":[
        {"label":"Storefront languages","description":"Indian languages available on your storefront.","launch":"1","growth":"3","scale":"All","commerce_os":"All","display_order":90},
        {"label":"Default language","description":"Choose your store default language.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":91},
        {"label":"Markets","description":"Region-specific selling.","launch":false,"growth":false,"scale":true,"commerce_os":true,"display_order":92},
        {"label":"Local currency display","description":"Show prices in local currency.","launch":false,"growth":false,"scale":true,"commerce_os":true,"display_order":93}
      ]},
      {"category":"B2B","items":[
        {"label":"B2B catalogs","description":"Wholesale catalogs with custom pricing.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":94},
        {"label":"B2B + DTC from one store","description":"Sell wholesale and retail from a single store.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":95},
        {"label":"Wholesale price lists","description":"Custom price lists for B2B buyers.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":96}
      ]},
      {"category":"Multi-store","items":[
        {"label":"Multi-store management","description":"Run multiple stores from one account.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":97},
        {"label":"Centralized catalog","description":"Share catalog across your stores.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":98},
        {"label":"Store switching","description":"Switch quickly between your stores.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":99}
      ]},
      {"category":"Security","items":[
        {"label":"KYC verification","description":"Verify your business to receive payouts.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":100},
        {"label":"Two-factor authentication","description":"Add extra login security.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":101},
        {"label":"Passkeys","description":"Passwordless sign-in.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":102},
        {"label":"Users & permissions","description":"Control who can access what.","launch":"Standard","growth":"Standard","scale":"Standard","commerce_os":"Custom","display_order":103},
        {"label":"Custom roles","description":"Define custom permission sets.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":104},
        {"label":"Step-up verification","description":"Extra checks for sensitive actions.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":105},
        {"label":"Policy pages","description":"Refund, privacy and terms pages.","launch":true,"growth":true,"scale":true,"commerce_os":true,"display_order":106}
      ]},
      {"category":"Support","items":[
        {"label":"Support channel","description":"How you reach the LetBuyy team.","launch":"Email","growth":"Priority","scale":"Priority + WhatsApp","commerce_os":"Dedicated manager","display_order":107},
        {"label":"Onboarding","description":"Help getting your store set up.","launch":"Self-serve","growth":"Guided","scale":"Guided","commerce_os":"White-glove","display_order":108},
        {"label":"Response priority","description":"How quickly we respond to you.","launch":"Standard","growth":"Priority","scale":"Priority","commerce_os":"Highest","display_order":109},
        {"label":"Dedicated success manager","description":"A named contact for your account.","launch":false,"growth":false,"scale":false,"commerce_os":true,"display_order":110}
      ]}
    ]'::jsonb AS cf
)
UPDATE public.plans
SET compare_features = matrix.cf,
    updated_at = now()
FROM matrix
WHERE site_type = 'store'
  AND slug IN ('launch', 'growth', 'scale', 'commerce_os');

-- ============================================================================
-- 3) Runtime entitlements for the newly-purchasable tiers (Launch/Growth from 178)
-- ============================================================================
INSERT INTO public.plan_entitlements (site_type, plan_slug, features, limits, entitlements, is_active)
VALUES
('store', 'scale',
    ARRAY['storefront','themes','cod','upi','qr_payments','advanced_analytics','blogs','pages','free_hosting','custom_domain','inventory_management','multi_warehouse','purchase_orders','bulk_import','discount_engine','customer_segments','whatsapp_notifications','marketing_tools','automations','reviews','loyalty','gift_cards','api_access','markets'],
    '{"products": null, "orders": null, "customers": null, "staff": 10, "custom_domain": true, "storage_mb": 51200, "ai_credits_monthly": 1000}'::jsonb,
    '{"unlimited_products": true, "unlimited_orders": true, "unlimited_customers": true, "marketing_tools": true, "inventory_management": true, "multi_warehouse": true, "api_access": true, "loyalty": true, "gift_cards": true}'::jsonb,
    true),
('store', 'commerce_os',
    ARRAY['storefront','themes','cod','upi','qr_payments','advanced_analytics','blogs','pages','free_hosting','custom_domain','inventory_management','multi_warehouse','purchase_orders','bulk_import','discount_engine','customer_segments','whatsapp_notifications','marketing_tools','automations','reviews','loyalty','gift_cards','api_access','markets','pos','multi_store','b2b','ai_copilot','lcis_access','operations_center','executive_center','custom_roles'],
    '{"products": null, "orders": null, "customers": null, "staff": 25, "custom_domain": true, "storage_mb": 204800, "ai_credits_monthly": 5000}'::jsonb,
    '{"unlimited_products": true, "unlimited_orders": true, "unlimited_customers": true, "marketing_tools": true, "inventory_management": true, "multi_warehouse": true, "api_access": true, "loyalty": true, "gift_cards": true, "pos": true, "multi_store": true, "b2b": true, "ai_copilot": true, "lcis_access": true}'::jsonb,
    true)
ON CONFLICT (site_type, plan_slug) DO UPDATE SET
    features = EXCLUDED.features,
    limits = EXCLUDED.limits,
    entitlements = EXCLUDED.entitlements,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- ============================================================================
-- 4) Pricing snapshot baseline (append-once; proves V1 re-compete prices)
-- ============================================================================
INSERT INTO public.pricing_snapshots (plan_slug, site_type, price_monthly_inr, founding_price_inr, reason)
SELECT v.slug, 'store', v.price, v.founding, 'recompete_v1'
FROM (VALUES
    ('launch', 29900, 19900),
    ('growth', 99900, 69900),
    ('scale', 249900, 0),
    ('commerce_os', 599900, 0)
) AS v(slug, price, founding)
WHERE NOT EXISTS (
    SELECT 1 FROM public.pricing_snapshots ps
    WHERE ps.plan_slug = v.slug AND ps.reason = 'recompete_v1'
);
