-- Fixes a second, independent defect on the same PUT /preferences path
-- fixed in 209: notification_preferences' only uniqueness guarantee is
-- notification_preferences_user_store_channel_category_uidx, an
-- EXPRESSION index -- UNIQUE (user_id, COALESCE(store_id,
-- '00000000-0000-0000-0000-000000000000'), channel, category) -- so that a
-- "global" (store_id IS NULL) preference and a store-scoped one both dedupe
-- correctly (plain unique constraints treat two NULLs as distinct, which
-- would silently let a user accumulate duplicate global rows).
--
-- services/api-gateway/src/routes/notifications.ts's PUT /preferences
-- handler calls
-- `.from('notification_preferences').upsert(row, { onConflict:
-- 'user_id,store_id,channel,category' })`. PostgREST's onConflict only
-- supports a literal column list, translated verbatim into
-- `ON CONFLICT (user_id, store_id, channel, category)` -- there is no way
-- for it to match an expression index. Every upsert therefore fails with
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification", reproduced live against the local database for both a
-- NULL and a real store_id. apps/merchant-control-plane's Notifications
-- settings page never sends store_id in its PUT body (see
-- src/app/[store]/settings/notifications/page.tsx's handleToggle), so in
-- practice this is not a rare edge case -- it is the only path the live UI
-- exercises, and every single preference toggle 500s.
--
-- Fixed with a thin upsert RPC that repeats the index's own expression as
-- the ON CONFLICT target -- `ON CONFLICT (user_id, COALESCE(store_id,
-- ...), channel, category)` -- which plain PostgREST upsert syntax cannot
-- express (it only emits bare column names) but raw SQL can. Note
-- `ON CONFLICT ON CONSTRAINT notification_preferences_user_store_channel_category_uidx`
-- was tried first and does NOT work here: that index was created with a
-- bare `CREATE UNIQUE INDEX`, not `ALTER TABLE ... ADD CONSTRAINT`, so it
-- has no backing pg_constraint row for ON CONFLICT to name -- confirmed
-- against pg_constraint on the live database. The expression-target form
-- keeps the existing dedup semantics (correct) and only changes how the
-- conflict target is specified. services/api-gateway/src/routes/notifications.ts
-- is updated alongside this migration to call
-- `.rpc('upsert_notification_preference', ...)` instead of `.upsert(...)`.
-- No SECURITY DEFINER: the route already calls this through
-- getSupabaseAdmin's service_role client, so no privilege elevation is
-- needed or wanted.

BEGIN;

CREATE OR REPLACE FUNCTION public.upsert_notification_preference(
    p_user_id uuid,
    p_store_id uuid,
    p_channel text,
    p_category text,
    p_enabled boolean
) RETURNS public.notification_preferences
LANGUAGE sql
AS $$
    INSERT INTO public.notification_preferences (user_id, store_id, channel, category, enabled)
    VALUES (p_user_id, p_store_id, p_channel, p_category, p_enabled)
    ON CONFLICT (user_id, (COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid)), channel, category)
    DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()
    RETURNING *;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_notification_preference(uuid, uuid, text, text, boolean) TO service_role;

COMMIT;
