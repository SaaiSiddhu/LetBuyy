-- Theme Marketplace foundation step-up.
-- Expands catalog, review, commerce, developer, and lifecycle persistence without removing existing theme data.

ALTER TABLE public.themes
    ADD COLUMN IF NOT EXISTS html_price_usd numeric(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS react_price_usd numeric(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS download_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS purchase_count integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS published_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS layout text DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS author_handle text,
    ADD COLUMN IF NOT EXISTS compatibility jsonb DEFAULT '{}'::jsonb NOT NULL,
    ADD COLUMN IF NOT EXISTS performance_report jsonb DEFAULT '{}'::jsonb NOT NULL,
    ADD COLUMN IF NOT EXISTS accessibility_report jsonb DEFAULT '{}'::jsonb NOT NULL,
    ADD COLUMN IF NOT EXISTS changelog jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE public.theme_reviews
    ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS purchase_id uuid REFERENCES public.theme_purchases(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS developer_reply text,
    ADD COLUMN IF NOT EXISTS developer_replied_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS moderated_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS moderation_reason text,
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL;

UPDATE public.themes
   SET layout = COALESCE(layout, 'standard'),
       published_at = COALESCE(published_at, created_at, NOW())
 WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.developer_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    handle text NOT NULL UNIQUE,
    display_name text NOT NULL,
    bio text,
    support_email text,
    website_url text,
    avatar_url text,
    verification_status text DEFAULT 'unverified' NOT NULL,
    support_sla text,
    aggregate_rating numeric(3,2) DEFAULT 0 NOT NULL,
    review_count integer DEFAULT 0 NOT NULL,
    portfolio_theme_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT developer_profiles_verification_status_check CHECK (verification_status = ANY (ARRAY['unverified'::text, 'verified'::text, 'suspended'::text]))
);

CREATE TABLE IF NOT EXISTS public.theme_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    description text,
    collection_type text DEFAULT 'auto' NOT NULL,
    rule jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_published boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT theme_collections_collection_type_check CHECK (collection_type = ANY (ARRAY['manual'::text, 'auto'::text]))
);

CREATE TABLE IF NOT EXISTS public.theme_collection_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    collection_id uuid NOT NULL REFERENCES public.theme_collections(id) ON DELETE CASCADE,
    theme_id uuid NOT NULL REFERENCES public.themes(id) ON DELETE CASCADE,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    UNIQUE (collection_id, theme_id)
);

CREATE TABLE IF NOT EXISTS public.theme_saved_searches (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users_custom(id) ON DELETE CASCADE,
    name text NOT NULL,
    query jsonb DEFAULT '{}'::jsonb NOT NULL,
    alerts_enabled boolean DEFAULT false NOT NULL,
    last_notified_at timestamp with time zone,
    created_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.theme_download_artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    theme_id uuid NOT NULL REFERENCES public.themes(id) ON DELETE CASCADE,
    platform text NOT NULL,
    artifact_key text NOT NULL,
    file_name text NOT NULL,
    size_bytes bigint,
    checksum_sha256 text,
    storage_provider text DEFAULT 'local-object-store' NOT NULL,
    delivery_status text DEFAULT 'available' NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    UNIQUE (theme_id, platform),
    CONSTRAINT theme_download_artifacts_platform_check CHECK (platform = ANY (ARRAY['letbuyy'::text, 'wordpress'::text, 'html'::text, 'react'::text])),
    CONSTRAINT theme_download_artifacts_delivery_status_check CHECK (delivery_status = ANY (ARRAY['available'::text, 'disabled'::text]))
);

CREATE TABLE IF NOT EXISTS public.theme_purchase_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    purchase_id uuid NOT NULL UNIQUE REFERENCES public.theme_purchases(id) ON DELETE CASCADE,
    receipt_number text NOT NULL UNIQUE,
    invoice_number text UNIQUE,
    license_key text,
    amount_inr numeric(10,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'INR' NOT NULL,
    gst_rate numeric(5,2) DEFAULT 0 NOT NULL,
    gst_amount_inr numeric(10,2) DEFAULT 0 NOT NULL,
    buyer_gstin text,
    seller_gstin text,
    invoice_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    receipt_status text DEFAULT 'issued' NOT NULL,
    created_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT theme_purchase_receipts_status_check CHECK (receipt_status = ANY (ARRAY['issued'::text, 'void'::text]))
);

CREATE TABLE IF NOT EXISTS public.theme_refund_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    purchase_id uuid NOT NULL REFERENCES public.theme_purchases(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users_custom(id) ON DELETE CASCADE,
    reason text,
    requested_amount_inr numeric(10,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'requested' NOT NULL,
    provider_refund_id text,
    decision_note text,
    created_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT theme_refund_requests_status_check CHECK (status = ANY (ARRAY['requested'::text, 'approved'::text, 'rejected'::text, 'processed'::text, 'failed'::text]))
);

CREATE TABLE IF NOT EXISTS public.theme_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    theme_id uuid NOT NULL REFERENCES public.themes(id) ON DELETE CASCADE,
    reporter_user_id uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    reason text NOT NULL,
    details text,
    status text DEFAULT 'open' NOT NULL,
    created_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT theme_reports_status_check CHECK (status = ANY (ARRAY['open'::text, 'triaged'::text, 'resolved'::text, 'dismissed'::text]))
);

CREATE TABLE IF NOT EXISTS public.theme_marketplace_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE REFERENCES public.users_custom(id) ON DELETE CASCADE,
    display_name text,
    support_email text,
    notification_preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    saved_filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    plan_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.theme_developer_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    developer_user_id uuid NOT NULL REFERENCES public.users_custom(id) ON DELETE CASCADE,
    developer_profile_id uuid REFERENCES public.developer_profiles(id) ON DELETE SET NULL,
    theme_package_id uuid REFERENCES public.theme_packages(id) ON DELETE SET NULL,
    slug text NOT NULL,
    name text NOT NULL,
    short_description text NOT NULL,
    long_description text,
    category text NOT NULL,
    industries text[] DEFAULT '{}'::text[] NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    supported_platforms text[] DEFAULT '{letbuyy}'::text[] NOT NULL,
    screenshots text[] DEFAULT '{}'::text[] NOT NULL,
    pricing jsonb DEFAULT '{}'::jsonb NOT NULL,
    license_tiers jsonb DEFAULT '[]'::jsonb NOT NULL,
    bundle_manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    asset_scan_status text DEFAULT 'passed' NOT NULL,
    agreement_accepted_at timestamp with time zone,
    submission_status text DEFAULT 'draft' NOT NULL,
    review_feedback text,
    reviewed_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    reviewed_at timestamp with time zone,
    created_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    UNIQUE (developer_user_id, slug),
    CONSTRAINT theme_developer_listings_asset_scan_status_check CHECK (asset_scan_status = ANY (ARRAY['passed'::text, 'failed'::text])),
    CONSTRAINT theme_developer_listings_submission_status_check CHECK (submission_status = ANY (ARRAY['draft'::text, 'submitted'::text, 'in_review'::text, 'changes_requested'::text, 'approved'::text, 'rejected'::text]))
);

CREATE TABLE IF NOT EXISTS public.theme_developer_payout_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    developer_user_id uuid NOT NULL UNIQUE REFERENCES public.users_custom(id) ON DELETE CASCADE,
    revenue_share_rate numeric(5,2) DEFAULT 15 NOT NULL,
    payout_schedule text DEFAULT 'monthly' NOT NULL,
    payout_provider text DEFAULT 'manual' NOT NULL,
    provider_account_id text,
    onboarding_status text DEFAULT 'active' NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.users_custom(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT theme_developer_payout_accounts_onboarding_status_check CHECK (onboarding_status = ANY (ARRAY['active'::text, 'suspended'::text]))
);

CREATE INDEX IF NOT EXISTS idx_themes_layout_active ON public.themes (layout, is_active);
CREATE INDEX IF NOT EXISTS idx_themes_author_handle ON public.themes (author_handle) WHERE author_handle IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_theme_reviews_status_created ON public.theme_reviews (theme_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_developer_profiles_handle_active ON public.developer_profiles (handle) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_theme_collections_published ON public.theme_collections (is_published, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_theme_collection_items_theme ON public.theme_collection_items (theme_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_theme_saved_searches_user ON public.theme_saved_searches (user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_theme_download_artifacts_theme ON public.theme_download_artifacts (theme_id, platform) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_theme_purchase_receipts_purchase ON public.theme_purchase_receipts (purchase_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_theme_refund_requests_purchase ON public.theme_refund_requests (purchase_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_theme_reports_theme_status ON public.theme_reports (theme_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_theme_developer_listings_developer ON public.theme_developer_listings (developer_user_id, submission_status) WHERE deleted_at IS NULL;

DO $$
DECLARE
    table_name text;
    trigger_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'developer_profiles',
        'theme_collections',
        'theme_collection_items',
        'theme_saved_searches',
        'theme_download_artifacts',
        'theme_purchase_receipts',
        'theme_refund_requests',
        'theme_reports',
        'theme_marketplace_settings',
        'theme_developer_listings',
        'theme_developer_payout_accounts'
    ]
    LOOP
        trigger_name := 'update_' || table_name || '_updated_at';
        IF NOT EXISTS (
            SELECT 1
              FROM pg_trigger
             WHERE tgname = trigger_name
               AND tgrelid = ('public.' || table_name)::regclass
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
                trigger_name,
                table_name
            );
        END IF;
    END LOOP;
END $$;

ALTER TABLE public.developer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_download_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_marketplace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_developer_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_developer_payout_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'developer_profiles' AND policyname = 'developer_profiles_public_read') THEN
        CREATE POLICY developer_profiles_public_read ON public.developer_profiles FOR SELECT USING (deleted_at IS NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'theme_collections' AND policyname = 'theme_collections_public_read') THEN
        CREATE POLICY theme_collections_public_read ON public.theme_collections FOR SELECT USING (is_published = true AND deleted_at IS NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'theme_collection_items' AND policyname = 'theme_collection_items_public_read') THEN
        CREATE POLICY theme_collection_items_public_read ON public.theme_collection_items FOR SELECT USING (deleted_at IS NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'theme_download_artifacts' AND policyname = 'theme_download_artifacts_public_metadata_read') THEN
        CREATE POLICY theme_download_artifacts_public_metadata_read ON public.theme_download_artifacts FOR SELECT USING (deleted_at IS NULL);
    END IF;
END $$;

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'developer_profiles',
        'theme_collections',
        'theme_collection_items',
        'theme_saved_searches',
        'theme_download_artifacts',
        'theme_purchase_receipts',
        'theme_refund_requests',
        'theme_reports',
        'theme_marketplace_settings',
        'theme_developer_listings',
        'theme_developer_payout_accounts'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
              FROM pg_policies
             WHERE schemaname = 'public'
               AND tablename = table_name
               AND policyname = table_name || '_service_all'
        ) THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
                table_name || '_service_all',
                table_name
            );
        END IF;
    END LOOP;
END $$;
