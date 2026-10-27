-- Revoke the dedicated public projection; ordinary tenant-table grants are unchanged.
REVOKE ALL ON FUNCTION public.public_storefront_directory_v1(integer,timestamptz,uuid) FROM service_role;
DROP FUNCTION public.public_storefront_directory_v1(integer,timestamptz,uuid);
-- The recorded production and faithful-baseline default before398 was modern.
-- This changes future defaults only, never saved merchant selections or releases.
ALTER TABLE public.sites ALTER COLUMN theme_id SET DEFAULT 'modern';
NOTIFY pgrst, 'reload schema';
