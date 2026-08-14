-- Rollback for 191_theme_purchases_rls_tenant_scope.sql
--
-- PARTIAL BY DESIGN. Migration 191 is the RISK-SEC-001 remediation: it removed two baseline policies
-- on theme_purchases that used USING (true) / WITH CHECK (true) with no role qualifier, i.e. every
-- anon and authenticated client could read every merchant's purchase records and insert purchases
-- under any user_id.
--
-- THIS ROLLBACK DELIBERATELY DOES NOT RECREATE THOSE TWO POLICIES.
--   "Users create theme purchases"   FOR INSERT WITH CHECK (true)
--   "Users view own theme purchases" FOR SELECT USING (true)
-- Restoring them would reopen a cross-tenant data leak and breach ART-08/09 + R-1..R-4 (no
-- USING (true) to PUBLIC) and SEC-R1 (fail closed). Reinstating that posture is an ARB decision,
-- never a deploy step — a rollback file must not be the thing that reopens a known leak.
--
-- What this file does revert: the three scoped policies 191 added. Once they are gone theme_purchases
-- carries no policy at all, so RLS denies every non-service_role client — fail-closed, which is the
-- correct end state. The gateway is unaffected: it reads and writes through service_role, which
-- bypasses RLS; the dropped tp_service_role policy only made that intent explicit.
--
-- Money safety: purchase amounts, the canonical ledger, and all payment RPCs are untouched — this
-- file changes access control only. Non-destructive: no table, column, index, or row is dropped.
-- Re-runnable (IF EXISTS on every drop).

DROP POLICY IF EXISTS tp_authenticated_insert ON public.theme_purchases;
DROP POLICY IF EXISTS tp_authenticated_select ON public.theme_purchases;
DROP POLICY IF EXISTS tp_service_role ON public.theme_purchases;
