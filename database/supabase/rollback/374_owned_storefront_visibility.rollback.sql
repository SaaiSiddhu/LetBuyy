BEGIN;
DROP FUNCTION IF EXISTS public.set_owned_storefront_access_v1(uuid,uuid,uuid,text,text,text);
-- Retain the merchant's last saved access mode and password hash.
NOTIFY pgrst,'reload schema';
COMMIT;
