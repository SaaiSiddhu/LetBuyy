-- 107_security_rls_hardening_and_payment_uniqueness.sql
-- Security hardening (2026-06-07). Closes critical issues from the deep audit.
--
-- (1) Auth/credential/session/token RLS policies were named "Service role ..." but
--     OMITTED `TO service_role`, so they evaluated USING(true) for the anon and
--     authenticated PostgREST roles → customer password hashes, session tokens, and
--     password-reset tokens were readable with the public anon key. Re-scope to
--     service_role only.
-- (2) Several "own-row" policies used USING(true), letting any authenticated user
--     read/modify EVERY user's rows. Re-scope to `user_id = auth.uid()`.
-- (3) Tenant tables with NO RLS (contacts, projects) and a global RBAC catalog with
--     no RLS (employee_permissions) — enable RLS and scope appropriately.
-- (4) Add a GLOBAL unique on captured payment ids so one provider payment id can
--     confirm at most one order (defense-in-depth behind the route-level binding fix
--     in routes/payments.ts + routes/storefront/checkout-payment-routes.ts).
--
-- SAFETY: the api-gateway connects with the Supabase service_role key, which BYPASSES
-- RLS. These policy changes therefore only affect direct anon/authenticated PostgREST
-- access (the exact attack surface being closed) and cannot break gateway code paths.
-- Idempotent / re-runnable.

-- ============================================================================
-- (1) Credential / session / token tables → restrict to service_role
-- ============================================================================
DROP POLICY IF EXISTS "Service role full access" ON public.devices;
CREATE POLICY "Service role full access" ON public.devices
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.sessions;
CREATE POLICY "Service role full access" ON public.sessions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.users_custom;
CREATE POLICY "Service role full access" ON public.users_custom
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.verification_tokens;
CREATE POLICY "Service role full access" ON public.verification_tokens
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages customer credentials" ON public.customer_credentials;
CREATE POLICY "Service role manages customer credentials" ON public.customer_credentials
    FOR ALL TO service_role USING (true) WITH CHECK (true);
-- NOTE: the store-owner policy "Store owners manage customer credentials" is intentionally
-- left in place so merchants can still manage their own store's customer credentials.

-- ============================================================================
-- (2) "Own-row" policies that matched every row → scope to the owning user
-- ============================================================================
-- notifications: system insert restricted to service_role; reads/writes own-row only.
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Service role inserts notifications" ON public.notifications
    FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
CREATE POLICY "Users view own notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications" ON public.notifications
    FOR DELETE USING (user_id = auth.uid());

-- theme_reviews: keep the existing "Public can read published theme reviews" policy;
-- only the manage-all policy was over-broad.
DROP POLICY IF EXISTS "Users manage own theme reviews" ON public.theme_reviews;
CREATE POLICY "Users manage own theme reviews" ON public.theme_reviews
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- notification_preferences: drop the permissive duplicate; keep a single own-row policy.
DROP POLICY IF EXISTS "Users manage their notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS users_own_notifications ON public.notification_preferences;
CREATE POLICY users_own_notification_preferences ON public.notification_preferences
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- (3) Tables that had NO row level security
-- ============================================================================
-- contacts / projects are tenant-scoped (site_id and store_id both reference sites.id).
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contacts_service_all ON public.contacts;
CREATE POLICY contacts_service_all ON public.contacts
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS contacts_owner_all ON public.contacts;
CREATE POLICY contacts_owner_all ON public.contacts
    FOR ALL
    USING (
        site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid() AND deleted_at IS NULL)
        OR store_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid() AND deleted_at IS NULL)
    )
    WITH CHECK (
        site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid() AND deleted_at IS NULL)
        OR store_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid() AND deleted_at IS NULL)
    );

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projects_service_all ON public.projects;
CREATE POLICY projects_service_all ON public.projects
    FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS projects_owner_all ON public.projects;
CREATE POLICY projects_owner_all ON public.projects
    FOR ALL
    USING (
        site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid() AND deleted_at IS NULL)
        OR store_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid() AND deleted_at IS NULL)
    )
    WITH CHECK (
        site_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid() AND deleted_at IS NULL)
        OR store_id IN (SELECT id FROM public.sites WHERE user_id = auth.uid() AND deleted_at IS NULL)
    );

-- employee_permissions is a GLOBAL role→permission catalog (no tenant column). The real
-- risk was unauthenticated WRITES (privilege escalation), not a tenant data leak. Keep
-- reads open (harmless metadata, may be referenced by other policies' subqueries) and
-- lock all writes to service_role.
ALTER TABLE public.employee_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_permissions_read ON public.employee_permissions;
CREATE POLICY employee_permissions_read ON public.employee_permissions
    FOR SELECT USING (true);
DROP POLICY IF EXISTS employee_permissions_service_write ON public.employee_permissions;
CREATE POLICY employee_permissions_service_write ON public.employee_permissions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- (4) Global uniqueness on captured payment ids (anti-replay defense-in-depth)
-- A given (gateway, provider_payment_id) may confirm at most one order globally.
-- The confirm RPC keeps exactly one captured row per (order_id, gateway), so this
-- never conflicts with a legitimate single confirmation.
-- NOTE: if legacy/exploit data already contains duplicate provider_payment_id values,
-- this index build will fail — dedupe those rows first, then re-run.
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_provider_payment_global
    ON public.payment_transactions (gateway, provider_payment_id)
    WHERE provider_payment_id IS NOT NULL AND deleted_at IS NULL;
