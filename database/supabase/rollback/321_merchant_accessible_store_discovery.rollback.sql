-- Read-only addition: no membership, user, store or retained record is removed.
BEGIN;
DROP FUNCTION IF EXISTS public.list_merchant_accessible_sites_v1(uuid,integer,integer,uuid);
NOTIFY pgrst,'reload schema';
COMMIT;
