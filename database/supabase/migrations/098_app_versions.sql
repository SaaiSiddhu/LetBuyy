-- Apps marketplace versioning and staged rollout history.
-- App-store lifecycle routes are the single writer; public catalog reads released/in-review history.

CREATE TABLE public.app_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid NOT NULL,
    developer_id uuid NOT NULL,
    version text NOT NULL,
    release_notes text,
    changelog jsonb DEFAULT '[]'::jsonb NOT NULL,
    rollout_percentage integer DEFAULT 100 NOT NULL,
    rollout_cohort text,
    status text DEFAULT 'draft'::text NOT NULL,
    manifest jsonb DEFAULT '{}'::jsonb NOT NULL,
    automated_checks jsonb DEFAULT '{}'::jsonb NOT NULL,
    review_record_id uuid,
    submitted_at timestamp with time zone,
    released_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_versions_changelog_is_array CHECK (jsonb_typeof(changelog) = 'array'::text),
    CONSTRAINT app_versions_rollout_percentage_check CHECK (((rollout_percentage >= 0) AND (rollout_percentage <= 100))),
    CONSTRAINT app_versions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_review'::text, 'approved'::text, 'released'::text, 'rejected'::text, 'rolled_back'::text]))),
    CONSTRAINT app_versions_version_check CHECK ((length(btrim(version)) > 0))
);

ALTER TABLE ONLY public.app_versions
    ADD CONSTRAINT app_versions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_versions
    ADD CONSTRAINT app_versions_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_versions
    ADD CONSTRAINT app_versions_developer_id_fkey FOREIGN KEY (developer_id) REFERENCES public.app_developers(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_versions
    ADD CONSTRAINT app_versions_review_record_id_fkey FOREIGN KEY (review_record_id) REFERENCES public.marketplace_review_records(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.app_versions
    ADD CONSTRAINT app_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.app_versions
    ADD CONSTRAINT app_versions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX app_versions_app_version_active_key
    ON public.app_versions USING btree (app_id, version)
    WHERE (deleted_at IS NULL);

CREATE INDEX idx_app_versions_app_status
    ON public.app_versions USING btree (app_id, status, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE INDEX idx_app_versions_developer
    ON public.app_versions USING btree (developer_id, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE INDEX idx_app_versions_review_record
    ON public.app_versions USING btree (review_record_id)
    WHERE (review_record_id IS NOT NULL);

CREATE TRIGGER update_app_versions_updated_at
    BEFORE UPDATE ON public.app_versions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_versions_service_all ON public.app_versions
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY app_versions_public_read ON public.app_versions FOR SELECT
    USING (((status = ANY (ARRAY['released'::text, 'approved'::text, 'in_review'::text])) AND (deleted_at IS NULL)));

CREATE POLICY app_versions_developer_read ON public.app_versions FOR SELECT
    USING ((EXISTS ( SELECT 1
       FROM public.app_developers
      WHERE ((app_developers.id = app_versions.developer_id) AND (app_developers.user_id = auth.uid())))));

CREATE POLICY app_versions_developer_insert ON public.app_versions FOR INSERT
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.marketplace_apps
       JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
      WHERE ((marketplace_apps.id = app_versions.app_id) AND (marketplace_apps.developer_id = app_versions.developer_id) AND (app_developers.user_id = auth.uid())))));

CREATE POLICY app_versions_developer_update ON public.app_versions FOR UPDATE
    USING ((EXISTS ( SELECT 1
       FROM public.app_developers
      WHERE ((app_developers.id = app_versions.developer_id) AND (app_developers.user_id = auth.uid())))))
    WITH CHECK ((EXISTS ( SELECT 1
       FROM public.marketplace_apps
       JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
      WHERE ((marketplace_apps.id = app_versions.app_id) AND (marketplace_apps.developer_id = app_versions.developer_id) AND (app_developers.user_id = auth.uid())))));

INSERT INTO public.app_versions (
    app_id,
    developer_id,
    version,
    release_notes,
    changelog,
    rollout_percentage,
    status,
    released_at,
    created_at,
    updated_at
)
SELECT
    id,
    developer_id,
    COALESCE(NULLIF(version, ''), '1.0.0'),
    'Initial marketplace listing',
    jsonb_build_array('Initial marketplace listing'),
    100,
    CASE WHEN status = 'published' THEN 'released' ELSE 'draft' END,
    CASE WHEN status = 'published' THEN COALESCE(updated_at, created_at, now()) ELSE NULL END,
    COALESCE(created_at, now()),
    COALESCE(updated_at, created_at, now())
FROM public.marketplace_apps
ON CONFLICT DO NOTHING;
