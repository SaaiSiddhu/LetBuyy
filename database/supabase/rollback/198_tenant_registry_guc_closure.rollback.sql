-- Rollback for 198_tenant_registry_guc_closure.sql
--
-- Restores the pre-198 state exactly: drops the four app_tenant GUC policies and
-- revokes the grants 198 added. Does NOT touch FORCE ROW LEVEL SECURITY (all four
-- tables were already ENABLE+FORCE before 198, set by 176/184/185) and does NOT
-- touch any pre-existing service_role/super_admin policy.
--
-- WARNING: after this rollback, app_tenant again gets zero matching policies on
-- these four tables. Under FORCE RLS that is still fail-closed (zero rows), but
-- it reopens the R-1 gap 198 closed: a gateway path that queries these tables
-- under app_tenant (withTenantTx) will read them as permanently empty again.
-- Only run this to unblock an incident, and re-apply 198 immediately afterwards.
--
-- Non-destructive: policy and grant changes only. No table, column, index or row
-- is dropped, and no money, ledger, payment or identity object is touched.
-- Re-runnable: every statement uses IF EXISTS.

BEGIN;

DROP POLICY IF EXISTS app_tenant_founding_merchant_allocations_guc ON public.founding_merchant_allocations;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.founding_merchant_allocations FROM app_tenant;

DROP POLICY IF EXISTS app_tenant_site_domains_guc ON public.site_domains;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.site_domains FROM app_tenant;

DROP POLICY IF EXISTS app_tenant_site_domain_verifications_guc ON public.site_domain_verifications;
REVOKE SELECT ON TABLE public.site_domain_verifications FROM app_tenant;
-- Restore the INSERT/UPDATE/DELETE that 164's ALTER DEFAULT PRIVILEGES implied
-- before 198 explicitly revoked it.
GRANT INSERT, UPDATE, DELETE ON TABLE public.site_domain_verifications TO app_tenant;

DROP POLICY IF EXISTS app_tenant_subscription_coupon_redemptions_guc ON public.subscription_coupon_redemptions;
REVOKE SELECT ON TABLE public.subscription_coupon_redemptions FROM app_tenant;
GRANT INSERT, UPDATE, DELETE ON TABLE public.subscription_coupon_redemptions TO app_tenant;

COMMIT;
