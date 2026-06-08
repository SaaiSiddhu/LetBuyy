-- Apps marketplace uninstall feedback.
-- App-store uninstall route is the single writer; feedback is optional and never blocks uninstall.

CREATE TABLE public.app_uninstall_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id uuid NOT NULL,
    app_id uuid NOT NULL,
    installation_id uuid NOT NULL,
    reason_code text,
    reason_text text,
    submitted_by uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT app_uninstall_feedback_reason_code_check CHECK ((reason_code IS NULL) OR (char_length(reason_code) <= 80)),
    CONSTRAINT app_uninstall_feedback_reason_text_check CHECK ((reason_text IS NULL) OR (char_length(reason_text) <= 1000))
);

ALTER TABLE ONLY public.app_uninstall_feedback
    ADD CONSTRAINT app_uninstall_feedback_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_uninstall_feedback
    ADD CONSTRAINT app_uninstall_feedback_site_id_fkey FOREIGN KEY (site_id) REFERENCES public.sites(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_uninstall_feedback
    ADD CONSTRAINT app_uninstall_feedback_app_id_fkey FOREIGN KEY (app_id) REFERENCES public.marketplace_apps(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_uninstall_feedback
    ADD CONSTRAINT app_uninstall_feedback_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.app_installations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.app_uninstall_feedback
    ADD CONSTRAINT app_uninstall_feedback_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.users_custom(id) ON DELETE SET NULL;

CREATE INDEX idx_app_uninstall_feedback_app_created
    ON public.app_uninstall_feedback USING btree (app_id, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE INDEX idx_app_uninstall_feedback_site_created
    ON public.app_uninstall_feedback USING btree (site_id, created_at DESC)
    WHERE (deleted_at IS NULL);

CREATE TRIGGER update_app_uninstall_feedback_updated_at
    BEFORE UPDATE ON public.app_uninstall_feedback
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.app_uninstall_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_uninstall_feedback_service_all ON public.app_uninstall_feedback
    USING ((auth.role() = 'service_role'::text))
    WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY app_uninstall_feedback_store_owner_read ON public.app_uninstall_feedback FOR SELECT
    USING ((EXISTS ( SELECT 1
       FROM public.sites
      WHERE ((sites.id = app_uninstall_feedback.site_id) AND ((sites.user_id = auth.uid()) OR (sites.custom_user_id = auth.uid())) AND (sites.deleted_at IS NULL)))));

CREATE POLICY app_uninstall_feedback_developer_read ON public.app_uninstall_feedback FOR SELECT
    USING ((EXISTS ( SELECT 1
       FROM public.marketplace_apps
       JOIN public.app_developers ON app_developers.id = marketplace_apps.developer_id
      WHERE ((marketplace_apps.id = app_uninstall_feedback.app_id) AND (app_developers.user_id = auth.uid())))));
