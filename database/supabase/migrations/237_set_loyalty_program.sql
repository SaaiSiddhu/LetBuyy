-- 237 — loyalty_programs gets its canonical writer (F-LOY-3, backend half).
--
-- WHAT WAS MISSING. 231 built loyalty_programs, 231/233 built the money RPCs, 234 wired redemption
-- into checkout and 235 fixed the earn path -- and nothing anywhere could create a programme row.
-- Measured: the only TypeScript references to the table are two .select() calls
-- (routes/storefront/buyer-realm-wiring.ts, queue-workers/src/loyalty-earn.ts). So loyalty could be
-- enabled only by hand-written SQL, and the earn sweeper -- which scans for is_active = true -- had
-- no store that could ever match. A complete money path that cannot be turned on.
--
-- WHY AN RPC RATHER THAN A TABLE WRITE. redeem_loyalty_points reads point_value_minor AT REDEMPTION
-- TIME (231, unchanged by 233's cap parameter). Halving it therefore halves the rupee value of every
-- point ALREADY EARNED at that store. That is a liability revaluation, and a revaluation that leaves
-- no record of who made it, when, or how much value moved is exactly the kind of silent money change
-- this schema's ledger design exists to prevent. So the write carries its own audit row, written in
-- the same transaction: a TypeScript-side audit insert can fail after the settings change has
-- already landed, leaving an unattributed change, and there is no way to notice afterwards.
--
-- Migration 236 revoked INSERT/UPDATE/DELETE on the stored-value ledgers from service_role but
-- deliberately left loyalty_programs writable, on the stated grounds that its writer did not exist
-- yet. This is that writer. The table stays reachable by service_role -- fencing it now would only
-- break the RPC's own callers without adding a control, since a SECURITY DEFINER function does not
-- consult the caller's privileges either way -- and the control that matters is that the route calls
-- this function instead of an UPDATE.
--
-- WHAT IS NOT DECIDED HERE. Whether a merchant may devalue outstanding points at all is an OWNER
-- question (recorded as D-LOY-REVALUE). D-17 makes the programme merchant-funded, which argues the
-- merchant may set their own rate; the cost falls on buyers who already earned. This migration takes
-- no side: it permits the change and makes it fully attributable, including the size of the swing.
-- Encoding a policy here would be choosing the owner's answer because it was easy to implement.
--
-- WHAT IS NOT REUSED, and why. public.log_audit_event() is the repository's existing audit trigger
-- (attached to employees, employee_invites, subscriptions, super_admin_allowlist). It is NOT
-- attached here, for two measured reasons: it records auth.uid() as the actor, which is NULL for the
-- canonical merchant realm -- merchant identity is users_custom via the identity platform, not
-- GoTrue -- so every row would read actor_type = 'system'; and it takes COALESCE(NEW.id, OLD.id),
-- which fails outright on a table whose primary key is site_id and which has no id column at all.
--
-- Rollback: database/supabase/rollback/237_set_loyalty_program.rollback.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. loyalty_outstanding_points — the site-wide balance, built ON the per-account projection
-- ---------------------------------------------------------------------------
-- Deliberately a SUM over loyalty_balance(account) rather than a second CASE over entry_type. A
-- re-implemented CASE is a second definition of what a loyalty balance IS, and the two would
-- eventually disagree -- the failure this ledger design was written to remove. If the entry-type
-- mapping ever changes, it changes in one place.
CREATE OR REPLACE FUNCTION public.loyalty_outstanding_points(p_site_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(public.loyalty_balance(a.id)), 0)::bigint
    FROM public.loyalty_accounts a
   WHERE a.site_id = p_site_id;
$$;

-- ---------------------------------------------------------------------------
-- 2. set_loyalty_program — the merchant's opt-in and rate, with its audit row
-- ---------------------------------------------------------------------------
-- NULL means LEAVE UNCHANGED, for every setting. This is a money decision, not a style one: with
-- replace semantics a client that omitted point_value_minor would silently reset it to the column
-- default of 100 paise, revaluing every outstanding point at that store as a side effect of a
-- request that meant to toggle a boolean. On creation the omitted settings take the table's own
-- defaults, which are the safe ones (inactive, earn 0, cap 50%, 1 point = INR 1).
CREATE OR REPLACE FUNCTION public.set_loyalty_program(
  p_site_id uuid,
  p_is_active boolean DEFAULT NULL,
  p_earn_rate_bps integer DEFAULT NULL,
  p_redeem_cap_bps integer DEFAULT NULL,
  p_point_value_minor bigint DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_actor_type text DEFAULT 'user',
  p_actor_email text DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_guc text;
  v_before public.loyalty_programs%ROWTYPE;
  v_after public.loyalty_programs%ROWTYPE;
  v_created boolean := false;
  v_outstanding bigint;
  v_liability_delta bigint;
BEGIN
  IF p_site_id IS NULL THEN
    RAISE EXCEPTION 'site is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sites WHERE id = p_site_id) THEN
    RAISE EXCEPTION 'site % does not exist', p_site_id;
  END IF;

  -- Defence in depth, and the reason the route calls this INSIDE the tenant transaction rather than
  -- on the admin client. When app.site_id is set, the site the route resolved ownership for and the
  -- site this function writes must be the same one -- so a route that resolves store A and then
  -- passes store B is refused by the database, not merely by review. When the GUC is unset the check
  -- does not apply: a service_role caller (an operator tool, a migration) has no tenant context to
  -- compare against, and inventing one here would be a second answer to "which tenant is this".
  v_tenant_guc := NULLIF(current_setting('app.site_id', true), '');
  IF v_tenant_guc IS NOT NULL AND v_tenant_guc::uuid <> p_site_id THEN
    RAISE EXCEPTION 'tenant context % does not match the requested site %', v_tenant_guc, p_site_id;
  END IF;

  -- Range checks ahead of the table CHECKs. The constraints are the backstop; these exist so a route
  -- can map a named error instead of a raw constraint violation, and so the message says which value.
  IF p_earn_rate_bps IS NOT NULL AND (p_earn_rate_bps < 0 OR p_earn_rate_bps > 10000) THEN
    RAISE EXCEPTION 'earn_rate_bps must be between 0 and 10000, got %', p_earn_rate_bps;
  END IF;
  IF p_redeem_cap_bps IS NOT NULL AND (p_redeem_cap_bps < 0 OR p_redeem_cap_bps > 10000) THEN
    RAISE EXCEPTION 'redeem_cap_bps must be between 0 and 10000, got %', p_redeem_cap_bps;
  END IF;
  IF p_point_value_minor IS NOT NULL AND p_point_value_minor <= 0 THEN
    RAISE EXCEPTION 'point_value_minor must be greater than zero, got %', p_point_value_minor;
  END IF;
  -- audit_logs constrains actor_type; rejecting here keeps the settings change and its audit row
  -- from parting company at the very last statement.
  IF p_actor_type IS NULL OR p_actor_type NOT IN ('user', 'employee', 'super_admin', 'system') THEN
    RAISE EXCEPTION 'actor_type must be one of user, employee, super_admin, system';
  END IF;

  -- One writer at a time per site. Without the lock two concurrent edits can each read the same
  -- "before" row, and the audit trail would then show two changes from the same starting state.
  SELECT * INTO v_before FROM public.loyalty_programs WHERE site_id = p_site_id FOR UPDATE;
  v_created := NOT FOUND;

  -- Read BEFORE the write. The number does not change with the settings, but capturing it here ties
  -- it to the state the merchant was actually looking at.
  v_outstanding := public.loyalty_outstanding_points(p_site_id);

  INSERT INTO public.loyalty_programs AS lp (
    site_id, is_active, earn_rate_bps, redeem_cap_bps, point_value_minor
  ) VALUES (
    p_site_id,
    COALESCE(p_is_active, false),
    COALESCE(p_earn_rate_bps, 0),
    COALESCE(p_redeem_cap_bps, 5000),
    COALESCE(p_point_value_minor, 100)
  )
  ON CONFLICT (site_id) DO UPDATE SET
    is_active         = COALESCE(p_is_active, lp.is_active),
    earn_rate_bps     = COALESCE(p_earn_rate_bps, lp.earn_rate_bps),
    redeem_cap_bps    = COALESCE(p_redeem_cap_bps, lp.redeem_cap_bps),
    point_value_minor = COALESCE(p_point_value_minor, lp.point_value_minor),
    updated_at        = now()
  RETURNING * INTO v_after;

  -- The size of the revaluation, in paise, stated rather than left to be inferred from two rates.
  -- NULL on creation: there was no prior value, so nothing was revalued.
  v_liability_delta := CASE
    WHEN v_created THEN NULL
    ELSE v_outstanding * (v_after.point_value_minor - v_before.point_value_minor)
  END;

  INSERT INTO public.audit_logs (
    actor_id, actor_type, actor_email, action, resource_type, resource_id,
    old_values, new_values, metadata
  ) VALUES (
    p_actor_id,
    p_actor_type,
    p_actor_email,
    CASE WHEN v_created THEN 'loyalty_program.created' ELSE 'loyalty_program.updated' END,
    'loyalty_program',
    p_site_id,
    CASE WHEN v_created THEN NULL ELSE to_jsonb(v_before) END,
    to_jsonb(v_after),
    jsonb_build_object(
      'request_id', p_request_id,
      'outstanding_points', v_outstanding,
      'point_value_minor_before', CASE WHEN v_created THEN NULL ELSE v_before.point_value_minor END,
      'point_value_minor_after', v_after.point_value_minor,
      'liability_delta_minor', v_liability_delta
    )
  );

  RETURN jsonb_build_object(
    'site_id', v_after.site_id,
    'is_active', v_after.is_active,
    'earn_rate_bps', v_after.earn_rate_bps,
    'redeem_cap_bps', v_after.redeem_cap_bps,
    'point_value_minor', v_after.point_value_minor,
    'updated_at', v_after.updated_at,
    'created', v_created,
    'outstanding_points', v_outstanding,
    'liability_delta_minor', v_liability_delta
  );
END;
$$;

REVOKE ALL ON FUNCTION public.loyalty_outstanding_points(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_loyalty_program(uuid, boolean, integer, integer, bigint, uuid, text, text, text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.loyalty_outstanding_points(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.set_loyalty_program(uuid, boolean, integer, integer, bigint, uuid, text, text, text) TO service_role;
  END IF;
  -- app_tenant executes the writer INSIDE the tenant transaction, which is what makes the GUC fence
  -- above load-bearing. This is not a second write path: app_tenant still has no INSERT or UPDATE on
  -- loyalty_programs at all, so this function remains the only way it can change the table, and the
  -- function refuses any site other than the one the transaction is scoped to.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    GRANT EXECUTE ON FUNCTION public.loyalty_outstanding_points(uuid) TO app_tenant;
    GRANT EXECUTE ON FUNCTION public.set_loyalty_program(uuid, boolean, integer, integer, bigint, uuid, text, text, text) TO app_tenant;
  END IF;
END
$$;

COMMIT;
