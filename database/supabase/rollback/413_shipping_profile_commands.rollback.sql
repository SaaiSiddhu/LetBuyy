BEGIN;
-- Profiles predate this release and are preserved; this removes only the command surface.
DROP FUNCTION public.save_shipping_profile_v1(uuid,uuid,uuid,timestamptz,jsonb);
COMMIT;
