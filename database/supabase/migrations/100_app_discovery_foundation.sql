-- App Marketplace discovery foundation.
-- App-store routes are the single writer for curation, featured placement, and discovery analytics.

ALTER TABLE public.app_categories
    ADD COLUMN IF NOT EXISTS group_name text,
    ADD COLUMN IF NOT EXISTS seo_title text,
    ADD COLUMN IF NOT EXISTS seo_description text,
    ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
    ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.marketplace_apps
    ADD COLUMN IF NOT EXISTS is_first_party_demo boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS featured_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS published_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS compatibility_tags text[] DEFAULT '{}'::text[] NOT NULL,
    ADD COLUMN IF NOT EXISTS discovery_metadata jsonb DEFAULT '{}'::jsonb NOT NULL;

CREATE TABLE IF NOT EXISTS public.app_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    curation_type text DEFAULT 'manual'::text NOT NULL,
    disclosure text,
    status text DEFAULT 'draft'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_collections_pkey PRIMARY KEY (id),
    CONSTRAINT app_collections_slug_key UNIQUE (slug),
    CONSTRAINT app_collections_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT app_collections_curation_type_check CHECK ((curation_type = ANY (ARRAY['manual'::text, 'rule'::text, 'editorial'::text])))
);

CREATE TABLE IF NOT EXISTS public.app_collection_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    app_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    note text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_collection_items_pkey PRIMARY KEY (id),
    CONSTRAINT app_collection_items_unique UNIQUE (collection_id, app_id),
    CONSTRAINT app_collection_items_collection_fkey FOREIGN KEY (collection_id) REFERENCES public.app_collections(id) ON DELETE CASCADE,
    CONSTRAINT app_collection_items_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.app_featured_placements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    placement_key text NOT NULL,
    disclosure text DEFAULT 'First-party marketplace placement'::text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_featured_placements_pkey PRIMARY KEY (id),
    CONSTRAINT app_featured_placements_unique UNIQUE (app_id, placement_key),
    CONSTRAINT app_featured_placements_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_featured_placements_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'expired'::text])))
);

CREATE TABLE IF NOT EXISTS public.app_discovery_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    site_id uuid,
    user_id uuid,
    app_id uuid,
    category_id uuid,
    collection_id uuid,
    search_query text,
    result_count integer,
    request_id text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_discovery_events_pkey PRIMARY KEY (id),
    CONSTRAINT app_discovery_events_type_check CHECK ((event_type = ANY (ARRAY['search'::text, 'zero_results'::text, 'app_click'::text, 'collection_view'::text, 'featured_impression'::text]))),
    CONSTRAINT app_discovery_events_site_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL,
    CONSTRAINT app_discovery_events_user_fkey FOREIGN KEY (user_id) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_discovery_events_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE SET NULL,
    CONSTRAINT app_discovery_events_category_fkey FOREIGN KEY (category_id) REFERENCES public.app_categories(id) ON DELETE SET NULL,
    CONSTRAINT app_discovery_events_collection_fkey FOREIGN KEY (collection_id) REFERENCES public.app_collections(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_categories_group_sort ON public.app_categories USING btree (group_name, sort_order, name) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_demo ON public.marketplace_apps USING btree (is_first_party_demo, published_at DESC) WHERE (status = 'published'::text);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_featured ON public.marketplace_apps USING btree (is_featured, featured_at DESC) WHERE (status = 'published'::text);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_rating ON public.marketplace_apps USING btree (rating_avg DESC, review_count DESC) WHERE (status = 'published'::text);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_compatibility ON public.marketplace_apps USING gin (compatibility_tags);
CREATE INDEX IF NOT EXISTS idx_app_collections_published ON public.app_collections USING btree (sort_order, name) WHERE ((status = 'published'::text) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS idx_app_collection_items_collection ON public.app_collection_items USING btree (collection_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_app_collection_items_app ON public.app_collection_items USING btree (app_id);
CREATE INDEX IF NOT EXISTS idx_app_featured_placements_active ON public.app_featured_placements USING btree (placement_key, priority DESC, starts_at DESC) WHERE ((status = 'active'::text) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS idx_app_discovery_events_type_created ON public.app_discovery_events USING btree (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_discovery_events_app_created ON public.app_discovery_events USING btree (app_id, created_at DESC) WHERE (app_id IS NOT NULL);

DROP TRIGGER IF EXISTS update_app_categories_updated_at ON public.app_categories;
CREATE TRIGGER update_app_categories_updated_at BEFORE UPDATE ON public.app_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_collections_updated_at ON public.app_collections;
CREATE TRIGGER update_app_collections_updated_at BEFORE UPDATE ON public.app_collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_collection_items_updated_at ON public.app_collection_items;
CREATE TRIGGER update_app_collection_items_updated_at BEFORE UPDATE ON public.app_collection_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_featured_placements_updated_at ON public.app_featured_placements;
CREATE TRIGGER update_app_featured_placements_updated_at BEFORE UPDATE ON public.app_featured_placements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.app_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_featured_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_discovery_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_collections_public_read ON public.app_collections;
CREATE POLICY app_collections_public_read ON public.app_collections
    FOR SELECT USING ((status = 'published'::text) AND (deleted_at IS NULL));

DROP POLICY IF EXISTS app_collections_service_all ON public.app_collections;
CREATE POLICY app_collections_service_all ON public.app_collections USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS app_collection_items_public_read ON public.app_collection_items;
CREATE POLICY app_collection_items_public_read ON public.app_collection_items
    FOR SELECT USING ((deleted_at IS NULL) AND EXISTS (
        SELECT 1 FROM public.app_collections c
        WHERE c.id = app_collection_items.collection_id
          AND c.status = 'published'::text
          AND c.deleted_at IS NULL
    ));

DROP POLICY IF EXISTS app_collection_items_service_all ON public.app_collection_items;
CREATE POLICY app_collection_items_service_all ON public.app_collection_items USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS app_featured_placements_public_read ON public.app_featured_placements;
CREATE POLICY app_featured_placements_public_read ON public.app_featured_placements
    FOR SELECT USING ((status = 'active'::text) AND (deleted_at IS NULL));

DROP POLICY IF EXISTS app_featured_placements_service_all ON public.app_featured_placements;
CREATE POLICY app_featured_placements_service_all ON public.app_featured_placements USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS app_discovery_events_service_all ON public.app_discovery_events;
CREATE POLICY app_discovery_events_service_all ON public.app_discovery_events USING (true) WITH CHECK (true);

INSERT INTO public.app_categories (name, slug, description, icon, group_name, sort_order, metadata)
VALUES
    ('Product Sourcing', 'sourcing', 'Find, import, and manage supplier product feeds.', 'inventory_2', 'Products', 10, '{"source":"seed"}'::jsonb),
    ('Dropshipping', 'dropshipping', 'Dropshipping operations, fulfillment, and supplier sync apps.', 'local_shipping', 'Products', 20, '{"source":"seed"}'::jsonb),
    ('Print on Demand', 'print-on-demand', 'Print-on-demand catalog, production, and design apps.', 'palette', 'Products', 30, '{"source":"seed"}'::jsonb),
    ('Checkout', 'checkout', 'Checkout, payment, and post-purchase experience apps.', 'shopping_cart_checkout', 'Selling', 40, '{"source":"seed"}'::jsonb),
    ('Upsell & Cross-sell', 'upsell-cross-sell', 'Merchandising, upsell, and cross-sell apps.', 'trending_up', 'Selling', 50, '{"source":"seed"}'::jsonb),
    ('Subscriptions', 'subscriptions', 'Recurring billing and subscription lifecycle apps.', 'autorenew', 'Selling', 60, '{"source":"seed"}'::jsonb),
    ('Pricing & Discounts', 'pricing', 'Promotions, discounts, and pricing strategy apps.', 'local_offer', 'Selling', 70, '{"source":"seed"}'::jsonb),
    ('Shipping & Delivery', 'shipping', 'Carrier, delivery, and fulfillment workflow apps.', 'local_shipping', 'Orders', 80, '{"source":"seed"}'::jsonb),
    ('Inventory Management', 'inventory', 'Inventory sync, stock alerts, and warehouse operations.', 'inventory', 'Orders', 90, '{"source":"seed"}'::jsonb),
    ('Order Management', 'order-management', 'Order operations, routing, and exception handling apps.', 'orders', 'Orders', 100, '{"source":"seed"}'::jsonb),
    ('Returns & Exchanges', 'returns', 'Returns, exchanges, refunds, and reverse logistics apps.', 'refund_policy', 'Orders', 110, '{"source":"seed"}'::jsonb),
    ('Email Marketing', 'email-marketing', 'Email campaign and lifecycle messaging apps.', 'mail', 'Marketing', 120, '{"source":"seed"}'::jsonb),
    ('SMS Marketing', 'sms-marketing', 'SMS, WhatsApp, and mobile messaging apps.', 'phone_iphone', 'Marketing', 130, '{"source":"seed"}'::jsonb),
    ('SEO', 'seo', 'Search, structured data, and organic growth apps.', 'search', 'Marketing', 140, '{"source":"seed"}'::jsonb),
    ('Social Media', 'social-media', 'Social commerce and social publishing apps.', 'share', 'Marketing', 150, '{"source":"seed"}'::jsonb),
    ('Advertising', 'ads', 'Ads, pixels, attribution, and campaign apps.', 'monitoring', 'Marketing', 160, '{"source":"seed"}'::jsonb),
    ('Reviews & Ratings', 'reviews', 'Product reviews, ratings, UGC, and trust apps.', 'star', 'Conversion', 170, '{"source":"seed"}'::jsonb),
    ('Loyalty & Rewards', 'loyalty', 'Loyalty, referrals, wallet, and rewards apps.', 'card_giftcard', 'Conversion', 180, '{"source":"seed"}'::jsonb),
    ('Pop-ups & Banners', 'popups', 'Lead capture, banners, and announcement apps.', 'chat', 'Conversion', 190, '{"source":"seed"}'::jsonb),
    ('Trust & Security', 'trust-badges', 'Trust, fraud, consent, and security apps.', 'shield_lock', 'Conversion', 200, '{"source":"seed"}'::jsonb),
    ('Page Builders', 'page-builders', 'Landing page, section, and design apps.', 'web_asset', 'Design', 210, '{"source":"seed"}'::jsonb),
    ('Image & Media', 'image-editing', 'Image optimization, media, and creative asset apps.', 'image', 'Design', 220, '{"source":"seed"}'::jsonb),
    ('Live Chat', 'live-chat', 'Live chat and real-time customer support apps.', 'chat', 'Support', 230, '{"source":"seed"}'::jsonb),
    ('Help Desk & FAQ', 'helpdesk', 'Help desk, ticketing, knowledge base, and FAQ apps.', 'support', 'Support', 240, '{"source":"seed"}'::jsonb),
    ('CRM', 'crm', 'Customer relationship and retention apps.', 'group', 'Support', 250, '{"source":"seed"}'::jsonb),
    ('Analytics & Reports', 'analytics', 'Reporting, dashboards, and performance analytics apps.', 'analytics', 'Analytics', 260, '{"source":"seed"}'::jsonb),
    ('A/B Testing', 'ab-testing', 'Experimentation and conversion testing apps.', 'experiment', 'Analytics', 270, '{"source":"seed"}'::jsonb),
    ('Accounting & Tax', 'accounting', 'Accounting, GST, tax, and reconciliation apps.', 'receipt_long', 'Finance', 280, '{"source":"seed"}'::jsonb),
    ('Invoicing', 'invoicing', 'Invoice, quote, and billing document apps.', 'request_quote', 'Finance', 290, '{"source":"seed"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    group_name = EXCLUDED.group_name,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = now();

INSERT INTO public.users_custom (id, email, email_verified, full_name, auth_provider)
VALUES ('11111111-1111-4111-8111-111111111101', 'marketplace-demo@letbuyy.test', true, 'LetBuyy Marketplace Demo', 'system')
ON CONFLICT (email) DO UPDATE SET
    email_verified = true,
    full_name = EXCLUDED.full_name,
    updated_at = now();

INSERT INTO public.app_developers (id, user_id, company_name, slug, website_url, support_email, logo_url, description, verified, status, country)
SELECT
    '11111111-1111-4111-8111-111111111102',
    u.id,
    'LetBuyy First-Party Demos',
    'letbuyy-first-party-demos',
    'https://apps-demo.letbuyy.test',
    'marketplace-demo@letbuyy.test',
    NULL,
    'First-party demo apps used to exercise marketplace discovery and installation flows before launch partners are onboarded.',
    true,
    'approved',
    'IN'
FROM public.users_custom u
WHERE u.email = 'marketplace-demo@letbuyy.test'
ON CONFLICT (slug) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    website_url = EXCLUDED.website_url,
    support_email = EXCLUDED.support_email,
    description = EXCLUDED.description,
    verified = true,
    status = 'approved',
    updated_at = now();

WITH demo_developer AS (
    SELECT id FROM public.app_developers WHERE slug = 'letbuyy-first-party-demos'
),
demo_apps AS (
    SELECT *
    FROM (VALUES
        ('11111111-1111-4111-8111-111111111201'::uuid, 'letbuyy-reviews-demo', 'LetBuyy Reviews Demo', 'Collect product reviews and show verified merchant feedback.', 'reviews', ARRAY['read_products', 'write_products']::text[], ARRAY['products', 'reviews', 'trust']::text[], 'https://apps-demo.letbuyy.test/reviews'),
        ('11111111-1111-4111-8111-111111111202'::uuid, 'letbuyy-shipping-demo', 'LetBuyy Shipping Demo', 'Preview delivery-rate workflows and fulfillment handoffs.', 'shipping', ARRAY['read_orders', 'write_fulfillments']::text[], ARRAY['orders', 'shipping', 'fulfillment']::text[], 'https://apps-demo.letbuyy.test/shipping'),
        ('11111111-1111-4111-8111-111111111203'::uuid, 'letbuyy-analytics-demo', 'LetBuyy Analytics Demo', 'Explore merchant reporting, cohort, and conversion analytics surfaces.', 'analytics', ARRAY['read_orders', 'read_products']::text[], ARRAY['analytics', 'orders', 'conversion']::text[], 'https://apps-demo.letbuyy.test/analytics')
    ) AS row(id, slug, name, tagline, category_slug, api_scopes, compatibility_tags, app_url)
)
INSERT INTO public.marketplace_apps (
    id,
    developer_id,
    slug,
    name,
    tagline,
    description,
    type,
    status,
    pricing_model,
    price_inr,
    category_id,
    tags,
    install_count,
    rating_avg,
    review_count,
    supported_site_types,
    oauth_client_id,
    oauth_redirect_uris,
    api_scopes,
    app_url,
    privacy_policy_url,
    terms_url,
    documentation_url,
    version,
    is_first_party_demo,
    is_featured,
    featured_at,
    published_at,
    compatibility_tags,
    discovery_metadata
)
SELECT
    demo_apps.id,
    demo_developer.id,
    demo_apps.slug,
    demo_apps.name,
    demo_apps.tagline,
    demo_apps.tagline || E'\n\nThis is a clearly labeled first-party demo listing. It is seeded so the marketplace catalog, install consent, extension, and discovery flows can be exercised without pretending launch-partner inventory exists.',
    'public',
    'published',
    'free',
    0,
    c.id,
    demo_apps.compatibility_tags,
    0,
    0,
    0,
    ARRAY['store']::text[],
    demo_apps.slug || '-client',
    ARRAY[demo_apps.app_url || '/oauth/callback']::text[],
    demo_apps.api_scopes,
    demo_apps.app_url,
    'https://apps-demo.letbuyy.test/privacy',
    'https://apps-demo.letbuyy.test/terms',
    'https://apps-demo.letbuyy.test/docs',
    '1.0.0',
    true,
    true,
    now(),
    now(),
    demo_apps.compatibility_tags,
    '{"seed":"first_party_demo","honest_label":"First-party demo app","launch_partner":false}'::jsonb
FROM demo_apps
CROSS JOIN demo_developer
JOIN public.app_categories c ON c.slug = demo_apps.category_slug
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    status = 'published',
    category_id = EXCLUDED.category_id,
    api_scopes = EXCLUDED.api_scopes,
    app_url = EXCLUDED.app_url,
    privacy_policy_url = EXCLUDED.privacy_policy_url,
    terms_url = EXCLUDED.terms_url,
    documentation_url = EXCLUDED.documentation_url,
    is_first_party_demo = true,
    is_featured = true,
    featured_at = COALESCE(public.marketplace_apps.featured_at, now()),
    published_at = COALESCE(public.marketplace_apps.published_at, now()),
    compatibility_tags = EXCLUDED.compatibility_tags,
    discovery_metadata = EXCLUDED.discovery_metadata,
    updated_at = now();

INSERT INTO public.app_pricing_plans (
    app_id,
    developer_id,
    plan_slug,
    name,
    description,
    pricing_model,
    billing_mode,
    currency,
    amount_minor,
    interval,
    is_default,
    status,
    sort_order
)
SELECT
    app.id,
    app.developer_id,
    'free',
    'Free demo',
    'Free first-party demo plan.',
    'free',
    'free',
    'INR',
    0,
    'none',
    true,
    'active',
    0
FROM public.marketplace_apps app
WHERE app.slug IN ('letbuyy-reviews-demo', 'letbuyy-shipping-demo', 'letbuyy-analytics-demo')
ON CONFLICT (app_id, plan_slug) WHERE (deleted_at IS NULL) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    pricing_model = EXCLUDED.pricing_model,
    billing_mode = EXCLUDED.billing_mode,
    amount_minor = 0,
    interval = 'none',
    is_default = true,
    status = 'active',
    updated_at = now();

INSERT INTO public.app_collections (slug, name, description, curation_type, disclosure, status, sort_order, metadata)
VALUES
    ('staff-picks', 'Staff Picks', 'Curated first-party demo apps that exercise core marketplace flows.', 'editorial', 'Curated by LetBuyy marketplace operations.', 'published', 10, '{"seed":"first_party_demo"}'::jsonb),
    ('trending', 'Trending This Week', 'Apps surfaced from current featured inventory until real trend depth grows.', 'rule', 'Uses featured inventory and install/rating ranking; zero-metric demo apps remain labeled.', 'published', 20, '{"seed":"first_party_demo"}'::jsonb),
    ('made-in-india', 'Made in India', 'India-first apps and first-party demos built for local merchant workflows.', 'manual', 'Includes clearly labeled first-party demo listings.', 'published', 30, '{"seed":"first_party_demo","country":"IN"}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    curation_type = EXCLUDED.curation_type,
    disclosure = EXCLUDED.disclosure,
    status = 'published',
    sort_order = EXCLUDED.sort_order,
    metadata = EXCLUDED.metadata,
    updated_at = now();

INSERT INTO public.app_collection_items (collection_id, app_id, sort_order, note)
SELECT c.id, app.id, row.sort_order, 'First-party demo listing'
FROM (VALUES
    ('staff-picks', 'letbuyy-reviews-demo', 10),
    ('staff-picks', 'letbuyy-shipping-demo', 20),
    ('trending', 'letbuyy-analytics-demo', 10),
    ('trending', 'letbuyy-reviews-demo', 20),
    ('made-in-india', 'letbuyy-shipping-demo', 10),
    ('made-in-india', 'letbuyy-analytics-demo', 20)
) AS row(collection_slug, app_slug, sort_order)
JOIN public.app_collections c ON c.slug = row.collection_slug
JOIN public.marketplace_apps app ON app.slug = row.app_slug
ON CONFLICT (collection_id, app_id) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    note = EXCLUDED.note,
    updated_at = now(),
    deleted_at = NULL;

INSERT INTO public.app_featured_placements (app_id, placement_key, disclosure, priority, starts_at, status, metadata)
SELECT
    app.id,
    'home_featured',
    'First-party demo placement',
    row.priority,
    now(),
    'active',
    '{"seed":"first_party_demo"}'::jsonb
FROM (VALUES
    ('letbuyy-reviews-demo', 30),
    ('letbuyy-shipping-demo', 20),
    ('letbuyy-analytics-demo', 10)
) AS row(app_slug, priority)
JOIN public.marketplace_apps app ON app.slug = row.app_slug
ON CONFLICT (app_id, placement_key) DO UPDATE SET
    disclosure = EXCLUDED.disclosure,
    priority = EXCLUDED.priority,
    status = 'active',
    starts_at = COALESCE(public.app_featured_placements.starts_at, now()),
    metadata = EXCLUDED.metadata,
    updated_at = now(),
    deleted_at = NULL;
