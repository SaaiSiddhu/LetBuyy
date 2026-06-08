-- App Marketplace growth and polish foundation.
-- App-store routes are the single writer for request capture, saved apps, bundles,
-- editorial rails, and cross-store review proof records.

ALTER TABLE public.app_categories
    ADD COLUMN IF NOT EXISTS seo_content text,
    ADD COLUMN IF NOT EXISTS seo_faq jsonb DEFAULT '[]'::jsonb NOT NULL,
    ADD COLUMN IF NOT EXISTS buyer_guidance text;

CREATE TABLE IF NOT EXISTS public.app_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid,
    requested_by uuid,
    query text,
    category_slug text,
    requested_app_name text,
    use_case text NOT NULL,
    contact_email text,
    status text DEFAULT 'open'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_requests_pkey PRIMARY KEY (id),
    CONSTRAINT app_requests_site_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL,
    CONSTRAINT app_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_requests_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_requests_status_check CHECK ((status = ANY (ARRAY['open'::text, 'reviewing'::text, 'planned'::text, 'fulfilled'::text, 'closed'::text])))
);

CREATE TABLE IF NOT EXISTS public.app_saved_apps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    app_id uuid NOT NULL,
    saved_by uuid,
    source text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_saved_apps_pkey PRIMARY KEY (id),
    CONSTRAINT app_saved_apps_site_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
    CONSTRAINT app_saved_apps_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_saved_apps_saved_by_fkey FOREIGN KEY (saved_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_saved_apps_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_saved_apps_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_saved_apps_unique_user_app UNIQUE (site_id, app_id, saved_by)
);

CREATE TABLE IF NOT EXISTS public.app_bundles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    discount_percent numeric(5,2),
    discount_amount_minor integer DEFAULT 0 NOT NULL,
    disclosure text,
    sort_order integer DEFAULT 0 NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_bundles_pkey PRIMARY KEY (id),
    CONSTRAINT app_bundles_slug_key UNIQUE (slug),
    CONSTRAINT app_bundles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_bundles_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_bundles_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text]))),
    CONSTRAINT app_bundles_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT app_bundles_discount_percent_check CHECK (((discount_percent IS NULL) OR ((discount_percent >= 0) AND (discount_percent <= 100)))),
    CONSTRAINT app_bundles_discount_amount_check CHECK ((discount_amount_minor >= 0))
);

CREATE TABLE IF NOT EXISTS public.app_bundle_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bundle_id uuid NOT NULL,
    app_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_bundle_items_pkey PRIMARY KEY (id),
    CONSTRAINT app_bundle_items_bundle_fkey FOREIGN KEY (bundle_id) REFERENCES public.app_bundles(id) ON DELETE CASCADE,
    CONSTRAINT app_bundle_items_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_bundle_items_unique_app UNIQUE (bundle_id, app_id)
);

CREATE TABLE IF NOT EXISTS public.app_review_proofs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    review_id uuid NOT NULL,
    app_id uuid NOT NULL,
    site_id uuid,
    installation_id uuid,
    proof_type text DEFAULT 'verified_install'::text NOT NULL,
    proof_status text DEFAULT 'verified'::text NOT NULL,
    source text DEFAULT 'letbuyy_installation'::text NOT NULL,
    external_reference text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_review_proofs_pkey PRIMARY KEY (id),
    CONSTRAINT app_review_proofs_review_fkey FOREIGN KEY (review_id) REFERENCES public.app_reviews(id) ON DELETE CASCADE,
    CONSTRAINT app_review_proofs_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_review_proofs_site_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL,
    CONSTRAINT app_review_proofs_installation_fkey FOREIGN KEY (installation_id) REFERENCES public.app_installations(id) ON DELETE SET NULL,
    CONSTRAINT app_review_proofs_type_check CHECK ((proof_type = ANY (ARRAY['verified_install'::text, 'cross_store_install'::text, 'imported_partner_proof'::text]))),
    CONSTRAINT app_review_proofs_status_check CHECK ((proof_status = ANY (ARRAY['verified'::text, 'pending'::text, 'rejected'::text])))
);

CREATE INDEX IF NOT EXISTS idx_app_categories_seo_content
    ON public.app_categories USING btree (slug)
    WHERE (seo_content IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_app_requests_status
    ON public.app_requests USING btree (status, created_at DESC)
    WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_app_requests_category
    ON public.app_requests USING btree (category_slug, created_at DESC)
    WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_app_saved_apps_site_created
    ON public.app_saved_apps USING btree (site_id, created_at DESC)
    WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_app_saved_apps_app
    ON public.app_saved_apps USING btree (app_id)
    WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_app_bundles_active
    ON public.app_bundles USING btree (sort_order, created_at DESC)
    WHERE ((status = 'active'::text) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS idx_app_bundle_items_bundle
    ON public.app_bundle_items USING btree (bundle_id, sort_order)
    WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS app_review_proofs_unique_review_install
    ON public.app_review_proofs USING btree (review_id, installation_id)
    WHERE ((installation_id IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS idx_app_review_proofs_app
    ON public.app_review_proofs USING btree (app_id, proof_status, created_at DESC)
    WHERE (deleted_at IS NULL);

DROP TRIGGER IF EXISTS update_app_requests_updated_at ON public.app_requests;
CREATE TRIGGER update_app_requests_updated_at BEFORE UPDATE ON public.app_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_saved_apps_updated_at ON public.app_saved_apps;
CREATE TRIGGER update_app_saved_apps_updated_at BEFORE UPDATE ON public.app_saved_apps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_bundles_updated_at ON public.app_bundles;
CREATE TRIGGER update_app_bundles_updated_at BEFORE UPDATE ON public.app_bundles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_bundle_items_updated_at ON public.app_bundle_items;
CREATE TRIGGER update_app_bundle_items_updated_at BEFORE UPDATE ON public.app_bundle_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_review_proofs_updated_at ON public.app_review_proofs;
CREATE TRIGGER update_app_review_proofs_updated_at BEFORE UPDATE ON public.app_review_proofs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.app_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_saved_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_review_proofs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_requests_service_all ON public.app_requests;
CREATE POLICY app_requests_service_all ON public.app_requests
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS app_requests_site_owner_read ON public.app_requests;
CREATE POLICY app_requests_site_owner_read ON public.app_requests FOR SELECT
    USING ((site_id IS NOT NULL) AND (EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_requests.site_id) AND (sites.user_id = auth.uid())))));

DROP POLICY IF EXISTS app_saved_apps_service_all ON public.app_saved_apps;
CREATE POLICY app_saved_apps_service_all ON public.app_saved_apps
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS app_saved_apps_site_owner_read ON public.app_saved_apps;
CREATE POLICY app_saved_apps_site_owner_read ON public.app_saved_apps FOR SELECT
    USING ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_saved_apps.site_id) AND (sites.user_id = auth.uid())))));

DROP POLICY IF EXISTS app_bundles_public_read ON public.app_bundles;
CREATE POLICY app_bundles_public_read ON public.app_bundles FOR SELECT
    USING (((status = 'active'::text) AND (deleted_at IS NULL) AND ((starts_at IS NULL) OR (starts_at <= now())) AND ((ends_at IS NULL) OR (ends_at >= now()))));

DROP POLICY IF EXISTS app_bundles_service_all ON public.app_bundles;
CREATE POLICY app_bundles_service_all ON public.app_bundles
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS app_bundle_items_public_read ON public.app_bundle_items;
CREATE POLICY app_bundle_items_public_read ON public.app_bundle_items FOR SELECT
    USING ((deleted_at IS NULL) AND (EXISTS ( SELECT 1
       FROM public.app_bundles
      WHERE ((app_bundles.id = app_bundle_items.bundle_id) AND (app_bundles.status = 'active'::text) AND (app_bundles.deleted_at IS NULL)))));

DROP POLICY IF EXISTS app_bundle_items_service_all ON public.app_bundle_items;
CREATE POLICY app_bundle_items_service_all ON public.app_bundle_items
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS app_review_proofs_public_read ON public.app_review_proofs;
CREATE POLICY app_review_proofs_public_read ON public.app_review_proofs FOR SELECT
    USING (((proof_status = 'verified'::text) AND (deleted_at IS NULL)));

DROP POLICY IF EXISTS app_review_proofs_site_owner_read ON public.app_review_proofs;
CREATE POLICY app_review_proofs_site_owner_read ON public.app_review_proofs FOR SELECT
    USING ((site_id IS NOT NULL) AND (EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_review_proofs.site_id) AND (sites.user_id = auth.uid())))));

DROP POLICY IF EXISTS app_review_proofs_service_all ON public.app_review_proofs;
CREATE POLICY app_review_proofs_service_all ON public.app_review_proofs
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

UPDATE public.app_categories
SET
    seo_content = CASE slug
        WHEN 'analytics' THEN 'Analytics apps help merchants understand orders, product performance, customer cohorts, conversion paths, and store operations without exporting data into separate spreadsheets.'
        WHEN 'shipping' THEN 'Shipping apps connect fulfillment, delivery-rate previews, shipment tracking, and carrier handoffs for LetBuyy stores.'
        WHEN 'reviews' THEN 'Review apps help merchants collect verified customer feedback, moderate responses, and display trust signals across product and store experiences.'
        ELSE COALESCE(seo_content, description)
    END,
    buyer_guidance = CASE slug
        WHEN 'analytics' THEN 'Compare data freshness, supported reports, API permissions, and whether usage-based plans match your order volume.'
        WHEN 'shipping' THEN 'Review carrier coverage, fulfillment workflow fit, support SLA, and whether the app needs order write permissions.'
        WHEN 'reviews' THEN 'Check verified-review support, moderation tools, data-handling disclosures, and storefront display compatibility.'
        ELSE COALESCE(buyer_guidance, 'Review permissions, pricing, support SLA, and compatibility before installing an app in this category.')
    END,
    seo_faq = CASE slug
        WHEN 'analytics' THEN '[{"question":"What should I compare before installing analytics apps?","answer":"Check reporting depth, data latency, requested scopes, pricing model, and whether the app supports your store type."}]'::jsonb
        WHEN 'shipping' THEN '[{"question":"Which permissions do shipping apps usually need?","answer":"Shipping apps commonly need order and fulfillment access. Install only after reviewing the exact requested scopes."}]'::jsonb
        WHEN 'reviews' THEN '[{"question":"How does LetBuyy mark verified reviews?","answer":"Reviews are tied to active app installations and can include proof records from the marketplace review-proof pipeline."}]'::jsonb
        ELSE COALESCE(seo_faq, '[]'::jsonb)
    END,
    updated_at = now()
WHERE slug IN ('analytics', 'shipping', 'reviews');

INSERT INTO public.app_bundles (slug, name, description, status, currency, discount_percent, disclosure, sort_order, metadata)
VALUES (
    'store-operations-starter',
    'Store operations starter',
    'A first-party demo bundle that groups reviews, shipping, and analytics workflows for marketplace validation.',
    'active',
    'INR',
    10,
    'First-party demo bundle. Real partner bundles require approved partner content and pricing.',
    10,
    '{"first_party_demo":true,"source":"marketplace_foundation_wave_10"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    currency = EXCLUDED.currency,
    discount_percent = EXCLUDED.discount_percent,
    disclosure = EXCLUDED.disclosure,
    sort_order = EXCLUDED.sort_order,
    metadata = EXCLUDED.metadata,
    updated_at = now();

WITH bundle AS (
    SELECT id FROM public.app_bundles WHERE slug = 'store-operations-starter'
),
bundle_apps AS (
    SELECT app.id, row.sort_order
    FROM (VALUES
        ('letbuyy-reviews-demo', 10),
        ('letbuyy-shipping-demo', 20),
        ('letbuyy-analytics-demo', 30)
    ) AS row(app_slug, sort_order)
    JOIN public.marketplace_apps app ON app.slug = row.app_slug
)
INSERT INTO public.app_bundle_items (bundle_id, app_id, sort_order, metadata)
SELECT bundle.id, bundle_apps.id, bundle_apps.sort_order, '{"first_party_demo":true}'::jsonb
FROM bundle
CROSS JOIN bundle_apps
ON CONFLICT (bundle_id, app_id) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    metadata = EXCLUDED.metadata,
    deleted_at = NULL,
    updated_at = now();

INSERT INTO public.app_review_proofs (review_id, app_id, site_id, installation_id, proof_type, proof_status, source, metadata)
SELECT
    reviews.id,
    reviews.app_id,
    reviews.store_id,
    reviews.verified_installation_id,
    'verified_install',
    'verified',
    'letbuyy_installation',
    jsonb_build_object('backfilled', true, 'is_verified', reviews.is_verified)
FROM public.app_reviews reviews
WHERE reviews.verified_installation_id IS NOT NULL
ON CONFLICT (review_id, installation_id) WHERE ((installation_id IS NOT NULL) AND (deleted_at IS NULL)) DO NOTHING;
