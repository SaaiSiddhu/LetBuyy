BEGIN;
DROP FUNCTION IF EXISTS public.install_owned_theme_v1(uuid,uuid,text,jsonb,jsonb,uuid,integer,text);
-- Installed instances, saved drafts and releases are retained.
NOTIFY pgrst,'reload schema';
COMMIT;
