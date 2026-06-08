-- App Marketplace trust, reviews, and content foundation.
-- App-store routes are the single writer for app trust disclosures, review replies,
-- abuse reports, activity events, policy reads, and Built for LetBuyy checks.

ALTER TABLE public.marketplace_apps
    ADD COLUMN IF NOT EXISTS built_for_letbuyy boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS built_for_letbuyy_awarded_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS built_for_letbuyy_checked_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS data_handling jsonb DEFAULT '{}'::jsonb NOT NULL,
    ADD COLUMN IF NOT EXISTS support_sla text,
    ADD COLUMN IF NOT EXISTS support_sla_response_minutes integer,
    ADD COLUMN IF NOT EXISTS status_url text,
    ADD COLUMN IF NOT EXISTS works_with text[] DEFAULT '{}'::text[] NOT NULL,
    ADD COLUMN IF NOT EXISTS conflict_app_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    ADD COLUMN IF NOT EXISTS health_status text DEFAULT 'unknown'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS health_checked_at timestamp with time zone;

ALTER TABLE public.app_reviews
    ADD COLUMN IF NOT EXISTS verified_installation_id uuid,
    ADD COLUMN IF NOT EXISTS developer_reply text,
    ADD COLUMN IF NOT EXISTS developer_replied_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS developer_reply_by uuid,
    ADD COLUMN IF NOT EXISTS reported_count integer DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS fraud_score numeric(5,2) DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS fraud_flags text[] DEFAULT '{}'::text[] NOT NULL,
    ADD COLUMN IF NOT EXISTS moderation_reason text,
    ADD COLUMN IF NOT EXISTS moderated_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS moderated_by uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'marketplace_apps_support_sla_minutes_check'
          AND conrelid = 'public.marketplace_apps'::regclass
    ) THEN
        ALTER TABLE public.marketplace_apps
            ADD CONSTRAINT marketplace_apps_support_sla_minutes_check
            CHECK (((support_sla_response_minutes IS NULL) OR (support_sla_response_minutes >= 0))) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'marketplace_apps_health_status_check'
          AND conrelid = 'public.marketplace_apps'::regclass
    ) THEN
        ALTER TABLE public.marketplace_apps
            ADD CONSTRAINT marketplace_apps_health_status_check
            CHECK ((health_status = ANY (ARRAY['unknown'::text, 'operational'::text, 'degraded'::text, 'incident'::text, 'maintenance'::text]))) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'app_reviews_verified_installation_fkey'
          AND conrelid = 'public.app_reviews'::regclass
    ) THEN
        ALTER TABLE ONLY public.app_reviews
            ADD CONSTRAINT app_reviews_verified_installation_fkey
            FOREIGN KEY (verified_installation_id) REFERENCES public.app_installations(id) ON DELETE SET NULL NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'app_reviews_developer_reply_by_fkey'
          AND conrelid = 'public.app_reviews'::regclass
    ) THEN
        ALTER TABLE ONLY public.app_reviews
            ADD CONSTRAINT app_reviews_developer_reply_by_fkey
            FOREIGN KEY (developer_reply_by) REFERENCES public.users_custom(id) ON DELETE SET NULL NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'app_reviews_moderated_by_fkey'
          AND conrelid = 'public.app_reviews'::regclass
    ) THEN
        ALTER TABLE ONLY public.app_reviews
            ADD CONSTRAINT app_reviews_moderated_by_fkey
            FOREIGN KEY (moderated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'app_reviews_reported_count_check'
          AND conrelid = 'public.app_reviews'::regclass
    ) THEN
        ALTER TABLE public.app_reviews
            ADD CONSTRAINT app_reviews_reported_count_check CHECK ((reported_count >= 0)) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'app_reviews_fraud_score_check'
          AND conrelid = 'public.app_reviews'::regclass
    ) THEN
        ALTER TABLE public.app_reviews
            ADD CONSTRAINT app_reviews_fraud_score_check CHECK (((fraud_score >= 0) AND (fraud_score <= 100))) NOT VALID;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.app_built_for_letbuyy_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    status text DEFAULT 'needs_review'::text NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    criteria jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    checked_by uuid,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_built_for_letbuyy_checks_pkey PRIMARY KEY (id),
    CONSTRAINT app_built_for_letbuyy_checks_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_built_for_letbuyy_checks_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_built_for_letbuyy_checks_score_check CHECK (((score >= 0) AND (score <= 100))),
    CONSTRAINT app_built_for_letbuyy_checks_status_check CHECK ((status = ANY (ARRAY['eligible'::text, 'ineligible'::text, 'needs_review'::text])))
);

CREATE TABLE IF NOT EXISTS public.app_review_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    review_id uuid NOT NULL,
    site_id uuid,
    reported_by uuid,
    reason_code text NOT NULL,
    reason_text text,
    status text DEFAULT 'open'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_review_reports_pkey PRIMARY KEY (id),
    CONSTRAINT app_review_reports_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_review_reports_review_fkey FOREIGN KEY (review_id) REFERENCES public.app_reviews(id) ON DELETE CASCADE,
    CONSTRAINT app_review_reports_site_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL,
    CONSTRAINT app_review_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_review_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_review_reports_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_review_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'triaged'::text, 'dismissed'::text, 'actioned'::text])))
);

CREATE TABLE IF NOT EXISTS public.app_listing_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    site_id uuid,
    reported_by uuid,
    reason_code text NOT NULL,
    reason_text text,
    status text DEFAULT 'open'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_listing_reports_pkey PRIMARY KEY (id),
    CONSTRAINT app_listing_reports_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_listing_reports_site_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE SET NULL,
    CONSTRAINT app_listing_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_listing_reports_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_listing_reports_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_listing_reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'triaged'::text, 'dismissed'::text, 'actioned'::text])))
);

CREATE TABLE IF NOT EXISTS public.app_activity_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    app_id uuid NOT NULL,
    installation_id uuid,
    actor_id uuid,
    event_type text NOT NULL,
    summary text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_activity_events_pkey PRIMARY KEY (id),
    CONSTRAINT app_activity_events_site_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE,
    CONSTRAINT app_activity_events_app_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE,
    CONSTRAINT app_activity_events_installation_fkey FOREIGN KEY (installation_id) REFERENCES public.app_installations(id) ON DELETE SET NULL,
    CONSTRAINT app_activity_events_actor_fkey FOREIGN KEY (actor_id) REFERENCES public.users_custom(id) ON DELETE SET NULL,
    CONSTRAINT app_activity_events_type_check CHECK ((event_type = ANY (ARRAY['installed'::text, 'uninstalled'::text, 'billing_charge'::text, 'scope_changed'::text, 'version_updated'::text, 'review_submitted'::text, 'report_submitted'::text])))
);

CREATE TABLE IF NOT EXISTS public.app_review_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    version text NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    effective_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_review_policies_pkey PRIMARY KEY (id),
    CONSTRAINT app_review_policies_slug_version_key UNIQUE (slug, version),
    CONSTRAINT app_review_policies_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);

CREATE UNIQUE INDEX IF NOT EXISTS app_built_for_letbuyy_checks_active_app_key
    ON public.app_built_for_letbuyy_checks USING btree (app_id)
    WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_app_reviews_verified_installation
    ON public.app_reviews USING btree (verified_installation_id)
    WHERE (verified_installation_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_app_reviews_status_fraud
    ON public.app_reviews USING btree (status, fraud_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_review_reports_status
    ON public.app_review_reports USING btree (status, created_at DESC)
    WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS app_review_reports_unique_open_report
    ON public.app_review_reports USING btree (review_id, reported_by)
    WHERE ((status = 'open'::text) AND (reported_by IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS idx_app_listing_reports_status
    ON public.app_listing_reports USING btree (status, created_at DESC)
    WHERE (deleted_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS app_listing_reports_unique_open_report
    ON public.app_listing_reports USING btree (app_id, reported_by)
    WHERE ((status = 'open'::text) AND (reported_by IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS idx_app_activity_events_site_created
    ON public.app_activity_events USING btree (site_id, created_at DESC)
    WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_app_activity_events_app_created
    ON public.app_activity_events USING btree (app_id, created_at DESC)
    WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_app_review_policies_published
    ON public.app_review_policies USING btree (slug, effective_at DESC)
    WHERE ((status = 'published'::text) AND (deleted_at IS NULL));
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_built_for_letbuyy
    ON public.marketplace_apps USING btree (built_for_letbuyy, built_for_letbuyy_awarded_at DESC)
    WHERE (status = 'published'::text);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_works_with
    ON public.marketplace_apps USING gin (works_with);
CREATE INDEX IF NOT EXISTS idx_marketplace_apps_conflicts
    ON public.marketplace_apps USING gin (conflict_app_ids);

DROP TRIGGER IF EXISTS update_app_built_for_letbuyy_checks_updated_at ON public.app_built_for_letbuyy_checks;
CREATE TRIGGER update_app_built_for_letbuyy_checks_updated_at BEFORE UPDATE ON public.app_built_for_letbuyy_checks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_review_reports_updated_at ON public.app_review_reports;
CREATE TRIGGER update_app_review_reports_updated_at BEFORE UPDATE ON public.app_review_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_listing_reports_updated_at ON public.app_listing_reports;
CREATE TRIGGER update_app_listing_reports_updated_at BEFORE UPDATE ON public.app_listing_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_app_review_policies_updated_at ON public.app_review_policies;
CREATE TRIGGER update_app_review_policies_updated_at BEFORE UPDATE ON public.app_review_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.app_built_for_letbuyy_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_listing_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_review_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_built_for_letbuyy_checks_service_all ON public.app_built_for_letbuyy_checks;
CREATE POLICY app_built_for_letbuyy_checks_service_all ON public.app_built_for_letbuyy_checks
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS app_built_for_letbuyy_checks_developer_read ON public.app_built_for_letbuyy_checks;
CREATE POLICY app_built_for_letbuyy_checks_developer_read ON public.app_built_for_letbuyy_checks FOR SELECT
    USING ((EXISTS ( SELECT 1
       FROM public.marketplace_apps
       JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
      WHERE ((marketplace_apps.id = app_built_for_letbuyy_checks.app_id) AND (app_developers.user_id = auth.uid())))));

DROP POLICY IF EXISTS app_review_reports_service_all ON public.app_review_reports;
CREATE POLICY app_review_reports_service_all ON public.app_review_reports
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS app_review_reports_reporter_read ON public.app_review_reports;
CREATE POLICY app_review_reports_reporter_read ON public.app_review_reports FOR SELECT
    USING ((reported_by = auth.uid()));

DROP POLICY IF EXISTS app_listing_reports_service_all ON public.app_listing_reports;
CREATE POLICY app_listing_reports_service_all ON public.app_listing_reports
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS app_listing_reports_reporter_read ON public.app_listing_reports;
CREATE POLICY app_listing_reports_reporter_read ON public.app_listing_reports FOR SELECT
    USING ((reported_by = auth.uid()));

DROP POLICY IF EXISTS app_activity_events_service_all ON public.app_activity_events;
CREATE POLICY app_activity_events_service_all ON public.app_activity_events
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

DROP POLICY IF EXISTS app_activity_events_site_owner_read ON public.app_activity_events;
CREATE POLICY app_activity_events_site_owner_read ON public.app_activity_events FOR SELECT
    USING ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_activity_events.site_id) AND (sites.user_id = auth.uid())))));

DROP POLICY IF EXISTS app_review_policies_public_read ON public.app_review_policies;
CREATE POLICY app_review_policies_public_read ON public.app_review_policies FOR SELECT
    USING (((status = 'published'::text) AND (deleted_at IS NULL)));

DROP POLICY IF EXISTS app_review_policies_service_all ON public.app_review_policies;
CREATE POLICY app_review_policies_service_all ON public.app_review_policies
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

INSERT INTO public.app_review_policies (slug, version, title, summary, sections, status, effective_at)
VALUES (
    'app-review-requirements',
    '2026-06-foundation',
    'App review requirements',
    'Marketplace submissions are checked for installability, required privacy and support disclosures, OAuth redirect integrity, manifest validity, screenshot evidence, and app-token scope fit before publication.',
    '[
        {"heading":"Required submission evidence","items":["Working app URL and OAuth redirect URIs","At least one real screenshot","Privacy policy, terms, and support contact","Structured data-handling disclosure","Support SLA or support response expectation"]},
        {"heading":"Automated checks","items":["Manifest schema validity","Requested scopes match declared app surfaces","Redirect URIs use HTTPS and the declared app domain","Static security checks for disallowed secrets and unsafe callback URLs"]},
        {"heading":"Manual review","items":["Listing copy is accurate","Pricing is disclosed","Conflicting app dependencies are declared","Built for LetBuyy badges are awarded only after program criteria pass"]}
    ]'::jsonb,
    'published',
    now()
)
ON CONFLICT (slug, version) DO UPDATE SET
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    sections = EXCLUDED.sections,
    status = 'published',
    effective_at = COALESCE(public.app_review_policies.effective_at, now()),
    updated_at = now();

WITH demo_checks AS (
    SELECT id AS app_id
    FROM public.marketplace_apps
    WHERE slug = 'letbuyy-reviews-demo'
)
INSERT INTO public.app_built_for_letbuyy_checks (app_id, status, score, criteria, notes, checked_at)
SELECT
    app_id,
    'eligible',
    100,
    '{"performance":true,"design":true,"oauth":true,"mandatory_webhooks":true,"data_disclosure":true,"support_sla":true}'::jsonb,
    'Seeded first-party demo check for marketplace trust flow validation.',
    now()
FROM demo_checks
ON CONFLICT (app_id) WHERE (deleted_at IS NULL) DO UPDATE SET
    status = EXCLUDED.status,
    score = EXCLUDED.score,
    criteria = EXCLUDED.criteria,
    notes = EXCLUDED.notes,
    checked_at = now(),
    updated_at = now();

UPDATE public.marketplace_apps app
SET
    built_for_letbuyy = true,
    built_for_letbuyy_awarded_at = COALESCE(app.built_for_letbuyy_awarded_at, now()),
    built_for_letbuyy_checked_at = now(),
    data_handling = jsonb_build_object(
        'summary', 'Collects product and review metadata only for the demo review workflow.',
        'data_collected', jsonb_build_array('Products', 'Reviews'),
        'retention', 'Demo data is retained until the demo installation is removed.'
    ),
    support_sla = 'Next business day demo support',
    support_sla_response_minutes = 1440,
    status_url = 'https://apps-demo.letbuyy.test/status',
    works_with = ARRAY['products', 'reviews', 'storefront']::text[],
    health_status = 'operational',
    health_checked_at = now(),
    updated_at = now()
FROM public.app_built_for_letbuyy_checks check_row
WHERE app.id = check_row.app_id
  AND check_row.status = 'eligible'
  AND app.slug = 'letbuyy-reviews-demo';
