-- Migration 191: Tighten theme_purchases RLS — close wide-open policies
--
-- RISK-SEC-001 REMEDIATION (Phase AE — partner readiness)
--
-- FINDING:  Two RLS policies on public.theme_purchases used USING (true) /
--           WITH CHECK (true) with no role qualifier, making them effective
--           for PUBLIC (including anonymous and authenticated roles).
--           This means any Supabase-auth-session client could SELECT all
--           theme purchase records regardless of ownership, and INSERT
--           purchases on behalf of any user_id.
--
--           Baseline policies (both wide-open):
--             "Users create theme purchases"  FOR INSERT  WITH CHECK (true)   -- line 24159
--             "Users view own theme purchases" FOR SELECT USING (true)        -- line 24201
--
-- REMEDIATION APPROACH:
--   1. Drop the two wide-open policies.
--   2. Add an explicit TO service_role pass-through (matches the pattern from
--      migration 163 — D2 live data leak fix — used for orders/products).
--      The gateway uses service_role which bypasses RLS; the explicit policy
--      makes the intent visible and consistent.
--   3. Add TO authenticated scoped policies: user_id = auth.uid().
--
-- ARCHITECTURE NOTE (user_id vs auth.uid()):
--   theme_purchases.user_id FK → users_custom(id).  users_custom is the
--   platform's custom auth table; its UUIDs are NOT the same UUID space as
--   Supabase auth.users.id (auth.uid()).  Therefore the effective behaviour of
--   the TO authenticated policies is:
--     • A gateway (service_role): RLS bypassed entirely — no change.
--     • A direct Supabase-auth client (authenticated role): user_id = auth.uid()
--       will match only if users_custom.id happens to equal the Supabase auth
--       UUID for that session.  In the current architecture this is not the
--       normal case, so the authenticated policies effectively deny any direct
--       client access to other users' purchase rows.  This is the correct
--       defensive posture: theme_purchases must never be directly browsable by
--       an arbitrary authenticated client.
--
-- MONEY SAFETY: this migration does NOT touch purchase amounts, the canonical
--   ledger, checkout, or any payment RPCs.  It ONLY adds/replaces access-control
--   policies.  No financial data is modified.
--
-- IDEMPOTENCY: uses DROP POLICY IF EXISTS before each CREATE POLICY; safe to
--   replay without error if partially applied.
--
-- MIGRATION SAFETY VALIDATOR: no DROP TABLE / DROP COLUMN / TRUNCATE /
--   RENAME — passes all forbidden-pattern checks.

BEGIN;

-- ---------------------------------------------------------
-- Remove the two wide-open policies from the baseline
-- ---------------------------------------------------------

DROP POLICY IF EXISTS "Users create theme purchases" ON public.theme_purchases;
DROP POLICY IF EXISTS "Users view own theme purchases" ON public.theme_purchases;

-- ---------------------------------------------------------
-- Service-role pass-through (gateway access — service_role
-- has BYPASSRLS but explicit policy makes intent clear and
-- matches the migration 163 / D2 pattern).
-- ---------------------------------------------------------

DROP POLICY IF EXISTS tp_service_role ON public.theme_purchases;
CREATE POLICY tp_service_role
  ON public.theme_purchases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------
-- Authenticated role: SELECT limited to own records
-- ---------------------------------------------------------

DROP POLICY IF EXISTS tp_authenticated_select ON public.theme_purchases;
CREATE POLICY tp_authenticated_select
  ON public.theme_purchases
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------
-- Authenticated role: INSERT limited to own user_id
-- ---------------------------------------------------------

DROP POLICY IF EXISTS tp_authenticated_insert ON public.theme_purchases;
CREATE POLICY tp_authenticated_insert
  ON public.theme_purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMIT;
