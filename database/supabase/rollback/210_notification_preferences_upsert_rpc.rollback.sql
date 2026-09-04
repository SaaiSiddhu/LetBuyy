-- Rollback for 210_notification_preferences_upsert_rpc.sql. Drops the RPC.
-- Only use this if services/api-gateway/src/routes/notifications.ts's PUT
-- /preferences handler is reverted to plain PostgREST .upsert() first --
-- otherwise every preference toggle goes back to 500ing with "there is no
-- unique or exclusion constraint matching the ON CONFLICT specification".

BEGIN;

DROP FUNCTION IF EXISTS public.upsert_notification_preference(uuid, uuid, text, text, boolean);

COMMIT;
