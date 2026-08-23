-- Migration 198: close the app_tenant GUC coverage gap on the 4 tenant tables
-- added by migrations 176, 184 and 185, all of which post-date the dynamic
-- app_tenant policy loop in 164_d4_tenant_role_guc.sql.
--
-- WHAT
--   Adds an app_tenant FOR-ALL-or-SELECT GUC policy (site_id = current_site_id())
--   to:
--     * founding_merchant_allocations (176) — mutable (release flow UPDATEs it).
--     * site_domains                  (185) — mutable (status/primary UPDATEs it).
--     * site_domain_verifications     (185) — append-only audit trail, written
--       only by the SECURITY DEFINER record_domain_verification() RPC.
--     * subscription_coupon_redemptions (184) — append-only usage ledger,
--       written only by the SECURITY DEFINER redeem_subscription_coupon() RPC.
--
-- WHY (ART-08 / R-1)
--   R-1: "Every tenant table MUST have RLS ENABLE+FORCE and a per-transaction
--   tenant-GUC policy; an unset or wrong GUC MUST yield zero rows." 176/184/185
--   each already set ENABLE+FORCE and documented a deliberate "service_role +
--   SECURITY DEFINER RPC only, no permissive policy" design — which IS fail-closed
--   for app_tenant (FORCE RLS + zero matching policies denies every row), but is
--   NOT the per-transaction GUC policy R-1 requires, and it is inconsistent with
--   the other 261 registered tables, which all received a real app_tenant GUC
--   policy from the 164 loop regardless of how conservative their intended access
--   pattern was. Leaving these four as a silent exception would mean any future
--   gateway path that adopts withTenantTx(siteId, fn) (the ART-08 target state)
--   reads these tables as permanently empty instead of correctly scoped — a latent
--   functional defect, not just a documentation gap.
--
--   This migration closes that gap the same way 164 did, with one adjustment:
--   the two append-only tables get a SELECT-only policy and a SELECT-only grant
--   (no INSERT/UPDATE/DELETE to app_tenant), because their only legitimate writer
--   is a SECURITY DEFINER RPC that runs as the table owner and is unaffected by
--   FORCE RLS or role grants. Granting app_tenant write access to an append-only
--   audit/ledger table would weaken, not strengthen, R-1 (PAY-adjacent MIG-R6
--   spirit: append-only surfaces stay append-only at the grant layer too).
--
--   164's `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT,
--   UPDATE, DELETE ON TABLES TO app_tenant` applies to every table created
--   afterward by the same migration-running role — including these four — so
--   app_tenant already holds table-level INSERT/UPDATE/DELETE on the two
--   append-only tables independent of anything this migration grants. The
--   REVOKE below closes that at the privilege layer too, so the append-only
--   guarantee does not rest on RLS alone (defense in depth, matching the
--   Constitution's "database is the load-bearing backstop" philosophy).
--
-- SAFE
--   Purely additive: no existing service_role/super_admin policy is touched, no
--   row is written or deleted, no RPC is redefined. DROP POLICY IF EXISTS precedes
--   every CREATE POLICY and every ALTER TABLE uses IF EXISTS — safe to replay.
--   No money, ledger, payment, invoice, identity or session table is touched.

BEGIN;

-- ── founding_merchant_allocations (176) — mutable ──────────────────────────
ALTER TABLE IF EXISTS public.founding_merchant_allocations FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.founding_merchant_allocations TO app_tenant;
DROP POLICY IF EXISTS app_tenant_founding_merchant_allocations_guc ON public.founding_merchant_allocations;
CREATE POLICY app_tenant_founding_merchant_allocations_guc
    ON public.founding_merchant_allocations
    FOR ALL TO app_tenant
    USING (site_id = public.current_site_id())
    WITH CHECK (site_id = public.current_site_id());

-- ── site_domains (185) — mutable ────────────────────────────────────────────
ALTER TABLE IF EXISTS public.site_domains FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.site_domains TO app_tenant;
DROP POLICY IF EXISTS app_tenant_site_domains_guc ON public.site_domains;
CREATE POLICY app_tenant_site_domains_guc
    ON public.site_domains
    FOR ALL TO app_tenant
    USING (site_id = public.current_site_id())
    WITH CHECK (site_id = public.current_site_id());

-- ── site_domain_verifications (185) — append-only, SELECT only ─────────────
ALTER TABLE IF EXISTS public.site_domain_verifications FORCE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.site_domain_verifications TO app_tenant;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.site_domain_verifications FROM app_tenant;
DROP POLICY IF EXISTS app_tenant_site_domain_verifications_guc ON public.site_domain_verifications;
CREATE POLICY app_tenant_site_domain_verifications_guc
    ON public.site_domain_verifications
    FOR SELECT TO app_tenant
    USING (site_id = public.current_site_id());

-- ── subscription_coupon_redemptions (184) — append-only, SELECT only ───────
ALTER TABLE IF EXISTS public.subscription_coupon_redemptions FORCE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE public.subscription_coupon_redemptions TO app_tenant;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.subscription_coupon_redemptions FROM app_tenant;
DROP POLICY IF EXISTS app_tenant_subscription_coupon_redemptions_guc ON public.subscription_coupon_redemptions;
CREATE POLICY app_tenant_subscription_coupon_redemptions_guc
    ON public.subscription_coupon_redemptions
    FOR SELECT TO app_tenant
    USING (site_id = public.current_site_id());

COMMIT;
