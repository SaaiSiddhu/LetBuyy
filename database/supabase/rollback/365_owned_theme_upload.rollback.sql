-- Retire command only. Retain uploaded owned data; no global-upsert fallback.
BEGIN;
DO $guard$ BEGIN
 IF EXISTS(SELECT 1 FROM public.theme_packages WHERE marketplace_metadata ? 'uploaded_for_site_id') THEN
  RAISE EXCEPTION 'rollback365 refuses retained owned uploads; preserve the secure reader/writer contract';
 END IF;
END $guard$;
DROP FUNCTION public.upload_owned_theme_package_v1(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb);
ALTER POLICY theme_packages_public_read ON public.theme_packages USING(status='active' AND deleted_at IS NULL);
ALTER POLICY theme_package_versions_public_read ON public.theme_package_versions USING(release_status='published' AND deleted_at IS NULL);
NOTIFY pgrst,'reload schema';
COMMIT;
