-- App Marketplace UI parity data layer.
-- App-store routes are the single writer for feature taxonomy, feature assignments,
-- marketplace awards, persisted review summaries, and collection editorial sections.
-- Public marketplace surfaces read only published, non-deleted rows.

CREATE TABLE IF NOT EXISTS public.app_feature_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    handle text NOT NULL,
    label text NOT NULL,
    description text,
    display_order integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'published'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_feature_groups_pkey PRIMARY KEY (id),
    CONSTRAINT app_feature_groups_category_handle_key UNIQUE (category_id, handle),
    CONSTRAINT app_feature_groups_category_fkey FOREIGN KEY (category_id) REFERENCES public.app_categories(id) ON DELETE CASCADE,
    CONSTRAINT app_feature_groups_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);

CREATE TABLE IF NOT EXISTS public.app_feature_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    handle text NOT NULL,
    label text NOT NULL,
    description text,
    display_order integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'published'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_feature_tags_pkey PRIMARY KEY (id),
    CONSTRAINT app_feature_tags_handle_key UNIQUE (handle),
    CONSTRAINT app_feature_tags_group_handle_key UNIQUE (group_id, handle),
    CONSTRAINT app_feature_tags_group_fkey FOREIGN KEY (group_id) REFERENCES public.app_feature_groups(id) ON DELETE CASCADE,
    CONSTRAINT app_feature_tags_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);

CREATE TABLE IF NOT EXISTS public.app_feature_tag_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    feature_tag_id uuid NOT NULL,
    source text DEFAULT 'ops_seed'::text NOT NULL,
    confidence numeric(5,2) DEFAULT 1 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_feature_tag_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT app_feature_tag_assignments_unique UNIQUE (app_id, feature_tag_id),
    CONSTRAINT app_feature_tag_assignments_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_feature_tag_assignments_tag_fkey FOREIGN KEY (feature_tag_id) REFERENCES public.app_feature_tags(id) ON DELETE CASCADE,
    CONSTRAINT app_feature_tag_assignments_confidence_check CHECK (((confidence >= 0) AND (confidence <= 1)))
);

CREATE TABLE IF NOT EXISTS public.app_awards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    award_key text NOT NULL,
    label text NOT NULL,
    year integer,
    blurb text,
    status text DEFAULT 'published'::text NOT NULL,
    awarded_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_awards_pkey PRIMARY KEY (id),
    CONSTRAINT app_awards_app_key_year_key UNIQUE (app_id, award_key, year),
    CONSTRAINT app_awards_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_awards_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);

CREATE TABLE IF NOT EXISTS public.app_review_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    summary text NOT NULL,
    source text DEFAULT 'ai'::text NOT NULL,
    model text,
    eligibility_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    generated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_review_summaries_pkey PRIMARY KEY (id),
    CONSTRAINT app_review_summaries_app_key UNIQUE (app_id),
    CONSTRAINT app_review_summaries_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_review_summaries_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT app_review_summaries_source_check CHECK ((source = ANY (ARRAY['ai'::text, 'manual_ops'::text, 'import'::text])))
);

CREATE TABLE IF NOT EXISTS public.app_collection_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    collection_id uuid NOT NULL,
    section_type text NOT NULL,
    heading text,
    body text,
    media_url text,
    app_id uuid,
    cta_label text,
    cta_href text,
    sort_order integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_collection_sections_pkey PRIMARY KEY (id),
    CONSTRAINT app_collection_sections_collection_order_key UNIQUE (collection_id, sort_order),
    CONSTRAINT app_collection_sections_collection_fkey FOREIGN KEY (collection_id) REFERENCES public.app_collections(id) ON DELETE CASCADE,
    CONSTRAINT app_collection_sections_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE SET NULL,
    CONSTRAINT app_collection_sections_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT app_collection_sections_type_check CHECK ((section_type = ANY (ARRAY['rich_text'::text, 'app_callout'::text, 'quote'::text, 'cta'::text, 'media'::text])))
);

CREATE INDEX IF NOT EXISTS idx_app_feature_groups_category_order
    ON public.app_feature_groups USING btree (category_id, display_order, label)
    WHERE ((status = 'published'::text) AND (deleted_at IS NULL));

CREATE INDEX IF NOT EXISTS idx_app_feature_tags_group_order
    ON public.app_feature_tags USING btree (group_id, display_order, label)
    WHERE ((status = 'published'::text) AND (deleted_at IS NULL));

CREATE INDEX IF NOT EXISTS idx_app_feature_tags_handle
    ON public.app_feature_tags USING btree (handle)
    WHERE ((status = 'published'::text) AND (deleted_at IS NULL));

CREATE INDEX IF NOT EXISTS idx_app_feature_tag_assignments_app
    ON public.app_feature_tag_assignments USING btree (app_id)
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_app_feature_tag_assignments_tag
    ON public.app_feature_tag_assignments USING btree (feature_tag_id, app_id)
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_app_awards_app
    ON public.app_awards USING btree (app_id, awarded_at DESC)
    WHERE ((status = 'published'::text) AND (deleted_at IS NULL));

CREATE INDEX IF NOT EXISTS idx_app_awards_key
    ON public.app_awards USING btree (award_key, year DESC)
    WHERE ((status = 'published'::text) AND (deleted_at IS NULL));

CREATE INDEX IF NOT EXISTS idx_app_review_summaries_app
    ON public.app_review_summaries USING btree (app_id, generated_at DESC)
    WHERE ((status = 'published'::text) AND (deleted_at IS NULL));

CREATE INDEX IF NOT EXISTS idx_app_collection_sections_collection
    ON public.app_collection_sections USING btree (collection_id, sort_order)
    WHERE ((status = 'published'::text) AND (deleted_at IS NULL));

DROP TRIGGER IF EXISTS update_app_feature_groups_updated_at ON public.app_feature_groups;
CREATE TRIGGER update_app_feature_groups_updated_at BEFORE UPDATE ON public.app_feature_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_feature_tags_updated_at ON public.app_feature_tags;
CREATE TRIGGER update_app_feature_tags_updated_at BEFORE UPDATE ON public.app_feature_tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_feature_tag_assignments_updated_at ON public.app_feature_tag_assignments;
CREATE TRIGGER update_app_feature_tag_assignments_updated_at BEFORE UPDATE ON public.app_feature_tag_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_awards_updated_at ON public.app_awards;
CREATE TRIGGER update_app_awards_updated_at BEFORE UPDATE ON public.app_awards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_review_summaries_updated_at ON public.app_review_summaries;
CREATE TRIGGER update_app_review_summaries_updated_at BEFORE UPDATE ON public.app_review_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_collection_sections_updated_at ON public.app_collection_sections;
CREATE TRIGGER update_app_collection_sections_updated_at BEFORE UPDATE ON public.app_collection_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.app_feature_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_feature_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_feature_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_review_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_collection_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_feature_groups_public_read ON public.app_feature_groups;
CREATE POLICY app_feature_groups_public_read ON public.app_feature_groups FOR SELECT
    USING (((status = 'published'::text) AND (deleted_at IS NULL) AND (EXISTS (
        SELECT 1 FROM public.app_categories
        WHERE app_categories.id = app_feature_groups.category_id
          AND app_categories.is_active = true
    ))));

DROP POLICY IF EXISTS app_feature_groups_service_all ON public.app_feature_groups;
CREATE POLICY app_feature_groups_service_all ON public.app_feature_groups
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS app_feature_tags_public_read ON public.app_feature_tags;
CREATE POLICY app_feature_tags_public_read ON public.app_feature_tags FOR SELECT
    USING (((status = 'published'::text) AND (deleted_at IS NULL) AND (EXISTS (
        SELECT 1 FROM public.app_feature_groups
        WHERE app_feature_groups.id = app_feature_tags.group_id
          AND app_feature_groups.status = 'published'::text
          AND app_feature_groups.deleted_at IS NULL
    ))));

DROP POLICY IF EXISTS app_feature_tags_service_all ON public.app_feature_tags;
CREATE POLICY app_feature_tags_service_all ON public.app_feature_tags
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS app_feature_tag_assignments_public_read ON public.app_feature_tag_assignments;
CREATE POLICY app_feature_tag_assignments_public_read ON public.app_feature_tag_assignments FOR SELECT
    USING (((deleted_at IS NULL) AND (EXISTS (
        SELECT 1 FROM public.marketplace_apps
        WHERE marketplace_apps.id = app_feature_tag_assignments.app_id
          AND marketplace_apps.status = 'published'::text
    )) AND (EXISTS (
        SELECT 1 FROM public.app_feature_tags
        JOIN public.app_feature_groups ON app_feature_groups.id = app_feature_tags.group_id
        WHERE app_feature_tags.id = app_feature_tag_assignments.feature_tag_id
          AND app_feature_tags.status = 'published'::text
          AND app_feature_tags.deleted_at IS NULL
          AND app_feature_groups.status = 'published'::text
          AND app_feature_groups.deleted_at IS NULL
    ))));

DROP POLICY IF EXISTS app_feature_tag_assignments_service_all ON public.app_feature_tag_assignments;
CREATE POLICY app_feature_tag_assignments_service_all ON public.app_feature_tag_assignments
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS app_awards_public_read ON public.app_awards;
CREATE POLICY app_awards_public_read ON public.app_awards FOR SELECT
    USING (((status = 'published'::text) AND (deleted_at IS NULL) AND (EXISTS (
        SELECT 1 FROM public.marketplace_apps
        WHERE marketplace_apps.id = app_awards.app_id
          AND marketplace_apps.status = 'published'::text
    ))));

DROP POLICY IF EXISTS app_awards_service_all ON public.app_awards;
CREATE POLICY app_awards_service_all ON public.app_awards
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS app_review_summaries_public_read ON public.app_review_summaries;
CREATE POLICY app_review_summaries_public_read ON public.app_review_summaries FOR SELECT
    USING (((status = 'published'::text) AND (deleted_at IS NULL) AND (EXISTS (
        SELECT 1 FROM public.marketplace_apps
        WHERE marketplace_apps.id = app_review_summaries.app_id
          AND marketplace_apps.status = 'published'::text
    ))));

DROP POLICY IF EXISTS app_review_summaries_service_all ON public.app_review_summaries;
CREATE POLICY app_review_summaries_service_all ON public.app_review_summaries
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS app_collection_sections_public_read ON public.app_collection_sections;
CREATE POLICY app_collection_sections_public_read ON public.app_collection_sections FOR SELECT
    USING (((status = 'published'::text) AND (deleted_at IS NULL) AND (EXISTS (
        SELECT 1 FROM public.app_collections
        WHERE app_collections.id = app_collection_sections.collection_id
          AND app_collections.status = 'published'::text
          AND app_collections.deleted_at IS NULL
    ))));

DROP POLICY IF EXISTS app_collection_sections_service_all ON public.app_collection_sections;
CREATE POLICY app_collection_sections_service_all ON public.app_collection_sections
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

WITH group_seed(category_slug, group_handle, label, description, display_order) AS (
    VALUES
        ('reviews', 'display-options', 'Display options', 'How reviews and trust signals appear in the storefront.', 10),
        ('reviews', 'ways-to-collect', 'Ways to collect', 'Channels and workflows for collecting review content.', 20),
        ('shipping', 'delivery-automation', 'Delivery automation', 'Carrier and fulfillment automation features.', 10),
        ('shipping', 'merchant-operations', 'Merchant operations', 'Back-office shipping and exception handling features.', 20),
        ('analytics', 'reporting', 'Reporting', 'Merchant dashboards and reporting workflows.', 10),
        ('analytics', 'attribution-data', 'Attribution and data', 'Tracking, segmentation, and export capabilities.', 20),
        ('email-marketing', 'campaigns', 'Campaigns', 'Email campaign and lifecycle message features.', 10),
        ('email-marketing', 'audience-data', 'Audience data', 'Capture, segment, and compliance features.', 20),
        ('seo', 'search-visibility', 'Search visibility', 'Technical SEO and discovery features.', 10),
        ('seo', 'content-optimization', 'Content optimization', 'Content, schema, and audit workflows.', 20)
)
INSERT INTO public.app_feature_groups (category_id, handle, label, description, display_order, status, metadata)
SELECT
    categories.id,
    group_seed.group_handle,
    group_seed.label,
    group_seed.description,
    group_seed.display_order,
    'published',
    '{"seed":"wave9_taxonomy"}'::jsonb
FROM group_seed
JOIN public.app_categories categories ON categories.slug = group_seed.category_slug
ON CONFLICT (category_id, handle) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    status = 'published',
    deleted_at = NULL,
    metadata = public.app_feature_groups.metadata || EXCLUDED.metadata,
    updated_at = now();

WITH tag_seed(category_slug, group_handle, tag_handle, label, description, display_order) AS (
    VALUES
        ('reviews', 'display-options', 'reviews-testimonials', 'Testimonials', 'Reusable testimonials and pull quotes.', 10),
        ('reviews', 'display-options', 'reviews-photo-reviews', 'Photo reviews', 'Customer photos attached to product reviews.', 20),
        ('reviews', 'display-options', 'reviews-video-reviews', 'Video reviews', 'Video review capture and display.', 30),
        ('reviews', 'display-options', 'reviews-star-ratings', 'Star ratings', 'Rating stars and aggregate score display.', 40),
        ('reviews', 'display-options', 'reviews-badges', 'Badges', 'Trust badges and review-count badges.', 50),
        ('reviews', 'display-options', 'reviews-carousels', 'Carousels', 'Carousel or slider review layouts.', 60),
        ('reviews', 'display-options', 'reviews-rich-snippets', 'Rich snippets', 'Structured review data for search snippets.', 70),
        ('reviews', 'ways-to-collect', 'reviews-email-sms-requests', 'Email and SMS requests', 'Post-purchase review request flows.', 10),
        ('reviews', 'ways-to-collect', 'reviews-social-ugc', 'Social UGC', 'Social content import and moderation.', 20),
        ('reviews', 'ways-to-collect', 'reviews-forms-surveys', 'Forms and surveys', 'Forms, survey prompts, and custom questions.', 30),
        ('reviews', 'ways-to-collect', 'reviews-qr-codes', 'QR codes', 'QR-code review capture flows.', 40),
        ('reviews', 'ways-to-collect', 'reviews-import-export', 'Import and export', 'Review migration, export, and syndication tools.', 50),
        ('reviews', 'ways-to-collect', 'reviews-automations', 'Automations', 'Review request and moderation automation.', 60),
        ('shipping', 'delivery-automation', 'shipping-carrier-labels', 'Carrier labels', 'Buy, print, and manage carrier labels.', 10),
        ('shipping', 'delivery-automation', 'shipping-rate-rules', 'Rate rules', 'Custom shipping rates and delivery rule logic.', 20),
        ('shipping', 'delivery-automation', 'shipping-tracking-pages', 'Tracking pages', 'Branded tracking pages and updates.', 30),
        ('shipping', 'delivery-automation', 'shipping-delivery-estimates', 'Delivery estimates', 'Estimated delivery dates and service levels.', 40),
        ('shipping', 'merchant-operations', 'shipping-fulfillment-handoffs', 'Fulfillment handoffs', 'Warehouse and fulfillment partner handoffs.', 10),
        ('shipping', 'merchant-operations', 'shipping-pickup-delivery', 'Pickup and local delivery', 'Pickup slots and local delivery scheduling.', 20),
        ('shipping', 'merchant-operations', 'shipping-returns-labels', 'Returns labels', 'Return labels and reverse logistics.', 30),
        ('shipping', 'merchant-operations', 'shipping-cod-support', 'COD support', 'Cash-on-delivery operational support.', 40),
        ('analytics', 'reporting', 'analytics-sales-dashboards', 'Sales dashboards', 'Sales and order performance dashboards.', 10),
        ('analytics', 'reporting', 'analytics-cohort-reports', 'Cohort reports', 'Customer and purchase cohort reporting.', 20),
        ('analytics', 'reporting', 'analytics-funnel-tracking', 'Funnel tracking', 'Conversion funnel tracking and analysis.', 30),
        ('analytics', 'reporting', 'analytics-product-performance', 'Product performance', 'Product, variant, and collection performance.', 40),
        ('analytics', 'attribution-data', 'analytics-utm-attribution', 'UTM attribution', 'UTM, campaign, and channel attribution.', 10),
        ('analytics', 'attribution-data', 'analytics-customer-segments', 'Customer segments', 'Segment-based analytics and audiences.', 20),
        ('analytics', 'attribution-data', 'analytics-export-csv', 'CSV export', 'Export reports and datasets for offline analysis.', 30),
        ('analytics', 'attribution-data', 'analytics-alerts', 'Alerts', 'Metric alerts and anomaly notifications.', 40),
        ('email-marketing', 'campaigns', 'email-automations', 'Automations', 'Lifecycle and triggered email automations.', 10),
        ('email-marketing', 'campaigns', 'email-newsletters', 'Newsletters', 'Broadcast campaigns and newsletters.', 20),
        ('email-marketing', 'campaigns', 'email-abandoned-cart', 'Abandoned cart', 'Cart recovery and checkout follow-up.', 30),
        ('email-marketing', 'campaigns', 'email-templates', 'Templates', 'Campaign templates and design controls.', 40),
        ('email-marketing', 'audience-data', 'email-capture', 'Email capture', 'Forms and popups that collect subscribers.', 10),
        ('email-marketing', 'audience-data', 'email-segmentation', 'Segmentation', 'Segmented lists and targeting.', 20),
        ('email-marketing', 'audience-data', 'email-product-recommendations', 'Product recommendations', 'Product-aware campaign blocks.', 30),
        ('email-marketing', 'audience-data', 'email-compliance', 'Consent and compliance', 'Consent, unsubscribe, and deliverability controls.', 40),
        ('seo', 'search-visibility', 'seo-metadata', 'Metadata', 'Title and meta description management.', 10),
        ('seo', 'search-visibility', 'seo-rich-snippets', 'Rich snippets', 'Structured data and rich result support.', 20),
        ('seo', 'search-visibility', 'seo-sitemaps', 'Sitemaps', 'Sitemap and indexing helpers.', 30),
        ('seo', 'search-visibility', 'seo-redirects', 'Redirects', 'Redirect management and canonical URL helpers.', 40),
        ('seo', 'content-optimization', 'seo-image-alt-text', 'Image alt text', 'Image alt text and media optimization.', 10),
        ('seo', 'content-optimization', 'seo-blog-optimization', 'Blog optimization', 'Blog and content optimization workflows.', 20),
        ('seo', 'content-optimization', 'seo-keyword-research', 'Keyword research', 'Keyword discovery and content planning.', 30),
        ('seo', 'content-optimization', 'seo-broken-links', 'Broken links', 'Broken link detection and repair workflows.', 40)
)
INSERT INTO public.app_feature_tags (group_id, handle, label, description, display_order, status, metadata)
SELECT
    groups.id,
    tag_seed.tag_handle,
    tag_seed.label,
    tag_seed.description,
    tag_seed.display_order,
    'published',
    '{"seed":"wave9_taxonomy"}'::jsonb
FROM tag_seed
JOIN public.app_categories categories ON categories.slug = tag_seed.category_slug
JOIN public.app_feature_groups groups ON groups.category_id = categories.id AND groups.handle = tag_seed.group_handle
ON CONFLICT (handle) DO UPDATE SET
    group_id = EXCLUDED.group_id,
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    status = 'published',
    deleted_at = NULL,
    metadata = public.app_feature_tags.metadata || EXCLUDED.metadata,
    updated_at = now();

WITH assignment_seed(app_slug, tag_handle) AS (
    VALUES
        ('letbuyy-reviews-demo', 'reviews-testimonials'),
        ('letbuyy-reviews-demo', 'reviews-photo-reviews'),
        ('letbuyy-reviews-demo', 'reviews-star-ratings'),
        ('letbuyy-reviews-demo', 'reviews-badges'),
        ('letbuyy-reviews-demo', 'reviews-rich-snippets'),
        ('letbuyy-reviews-demo', 'reviews-email-sms-requests'),
        ('letbuyy-reviews-demo', 'reviews-forms-surveys'),
        ('letbuyy-reviews-demo', 'reviews-import-export'),
        ('letbuyy-reviews-demo', 'reviews-automations'),
        ('letbuyy-shipping-demo', 'shipping-carrier-labels'),
        ('letbuyy-shipping-demo', 'shipping-rate-rules'),
        ('letbuyy-shipping-demo', 'shipping-tracking-pages'),
        ('letbuyy-shipping-demo', 'shipping-delivery-estimates'),
        ('letbuyy-shipping-demo', 'shipping-fulfillment-handoffs'),
        ('letbuyy-shipping-demo', 'shipping-pickup-delivery'),
        ('letbuyy-shipping-demo', 'shipping-cod-support'),
        ('letbuyy-analytics-demo', 'analytics-sales-dashboards'),
        ('letbuyy-analytics-demo', 'analytics-cohort-reports'),
        ('letbuyy-analytics-demo', 'analytics-funnel-tracking'),
        ('letbuyy-analytics-demo', 'analytics-product-performance'),
        ('letbuyy-analytics-demo', 'analytics-utm-attribution'),
        ('letbuyy-analytics-demo', 'analytics-customer-segments'),
        ('letbuyy-analytics-demo', 'analytics-export-csv'),
        ('letbuyy-analytics-demo', 'analytics-alerts')
)
INSERT INTO public.app_feature_tag_assignments (app_id, feature_tag_id, source, confidence, metadata)
SELECT
    apps.id,
    tags.id,
    'seed',
    1,
    '{"seed":"wave9_taxonomy","basis":"first_party_demo_listing"}'::jsonb
FROM assignment_seed
JOIN public.marketplace_apps apps ON apps.slug = assignment_seed.app_slug
JOIN public.app_feature_tags tags ON tags.handle = assignment_seed.tag_handle
ON CONFLICT (app_id, feature_tag_id) DO UPDATE SET
    source = EXCLUDED.source,
    confidence = EXCLUDED.confidence,
    metadata = public.app_feature_tag_assignments.metadata || EXCLUDED.metadata,
    deleted_at = NULL,
    updated_at = now();

INSERT INTO public.app_awards (app_id, award_key, label, year, blurb, status, awarded_at, metadata)
SELECT
    apps.id,
    'built_for_letbuyy',
    'Built for LetBuyy',
    2026,
    'Awarded from the existing LetBuyy quality check for this published listing.',
    'published',
    COALESCE(apps.built_for_letbuyy_awarded_at, checks.checked_at, now()),
    jsonb_build_object('source', 'app_built_for_letbuyy_checks', 'check_id', checks.id)
FROM public.marketplace_apps apps
JOIN public.app_built_for_letbuyy_checks checks ON checks.app_id = apps.id
WHERE apps.status = 'published'
  AND apps.built_for_letbuyy = true
  AND checks.status = 'eligible'
  AND checks.deleted_at IS NULL
ON CONFLICT (app_id, award_key, year) DO UPDATE SET
    label = EXCLUDED.label,
    blurb = EXCLUDED.blurb,
    status = 'published',
    awarded_at = COALESCE(public.app_awards.awarded_at, EXCLUDED.awarded_at),
    metadata = public.app_awards.metadata || EXCLUDED.metadata,
    deleted_at = NULL,
    updated_at = now();
