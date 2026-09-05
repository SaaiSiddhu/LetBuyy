-- 231 — merchant-funded loyalty (CAP-FB-LOYALTY, D-9), authorized by D-17 (owner, 2026-09-06).
--
-- D-17: loyalty is MERCHANT-FUNDED and OPT-IN. A merchant enables it for their store and sets the
-- rate; points earned on their orders are their marketing spend. Redemption is TENDER against the
-- canonical ledger, and the balance is a LEDGER PROJECTION. The owner accepted the cost that points
-- are therefore PER-MERCHANT, not one marketplace-wide balance.
--
-- What this replaces, and why the shape differs. System A's loyalty_service.dart does:
--     newBalance = loyalty.points + pointsEarned;  await ref.update({'points': newBalance});
-- a read-modify-write on a mutable field. Two concurrent awards lose one another, and the lost
-- update silently MINTS or DESTROYS money with no record that it happened. Here there is no mutable
-- balance at all: entries are append-only and the balance is SUM(CASE entry_type ...), exactly as
-- gift_card_ledger_entries already does for the repository's other stored-value instrument.
--
-- SCOPE. This migration ships the ledger and its RPCs. It deliberately does NOT modify
-- create_checkout_order: that function has been redefined by EIGHT migrations, and 218 exists only to
-- restore the idempotency advisory lock that 213 and 215 silently dropped. Wiring tender into it is a
-- dedicated phase that must diff all eight definitions and prove every prior fix survives. Until then
-- no order earns or spends points, and that is stated rather than implied.
--
-- Rollback: database/supabase/rollback/231_merchant_funded_loyalty_ledger.rollback.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. loyalty_programs — the merchant's opt-in and rate (D-17)
-- ---------------------------------------------------------------------------
-- Keyed BY site: a store has exactly one programme, and its absence means "not enrolled". Defaulting
-- is_active to false is the opt-in: creating a row must never start awarding points by itself.
CREATE TABLE IF NOT EXISTS public.loyalty_programs (
  site_id uuid PRIMARY KEY REFERENCES public.sites(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  -- Basis points of the order total earned as points. 0 with is_active = true is legitimate: the
  -- merchant is enrolled and paused, which is different from not being enrolled at all.
  earn_rate_bps integer NOT NULL DEFAULT 0,
  -- The most of one order that points may pay for. 5000 = 50%, matching System A's own cap.
  redeem_cap_bps integer NOT NULL DEFAULT 5000,
  -- What ONE point is worth, in paise. Integer, so redemption value is exact integer multiplication
  -- and never a rounded float. 100 = one rupee, which is System A's 1 point = INR 1.
  point_value_minor bigint NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_programs_earn_rate_check CHECK (earn_rate_bps BETWEEN 0 AND 10000),
  -- A cap above 100% would let points pay more than the order is worth.
  CONSTRAINT loyalty_programs_redeem_cap_check CHECK (redeem_cap_bps BETWEEN 0 AND 10000),
  CONSTRAINT loyalty_programs_point_value_check CHECK (point_value_minor > 0)
);

-- ---------------------------------------------------------------------------
-- 2. loyalty_accounts — one balance per (merchant, buyer)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  buyer_account_id uuid NOT NULL REFERENCES public.buyer_accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_accounts_status_check CHECK (status IN ('active', 'frozen', 'closed')),
  -- One account per pair. A second account would be a second balance for the same person at the same
  -- merchant, and the two would disagree.
  CONSTRAINT loyalty_accounts_site_buyer_key UNIQUE (site_id, buyer_account_id)
);

-- ---------------------------------------------------------------------------
-- 3. loyalty_ledger_entries — append-only; the balance is derived from this
-- ---------------------------------------------------------------------------
-- Shape mirrors gift_card_ledger_entries: signed meaning carried by entry_type rather than by a
-- signed amount, so a row can never be ambiguous about direction, and balance_after recorded per
-- entry so a projection can be reconciled against what the writer believed at the time.
CREATE TABLE IF NOT EXISTS public.loyalty_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  loyalty_account_id uuid NOT NULL REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  entry_type text NOT NULL,
  points bigint NOT NULL,
  balance_after bigint NOT NULL,
  idempotency_key text NOT NULL,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_ledger_entries_points_check CHECK (points >= 0),
  -- The balance can never go negative. This is the backstop behind the RPC's own check: an
  -- over-redemption that somehow reached the insert fails here rather than minting a debt.
  CONSTRAINT loyalty_ledger_entries_balance_after_check CHECK (balance_after >= 0),
  CONSTRAINT loyalty_ledger_entries_type_check CHECK (entry_type IN (
    'earned', 'redeemed', 'refund_credit', 'expired', 'adjustment_credit', 'adjustment_debit'
  )),
  -- Replay protection at the DATABASE, not only in the RPC. Two concurrent callers with one key
  -- produce one entry even if both pass the RPC's existence check.
  CONSTRAINT loyalty_ledger_entries_idempotency_key UNIQUE (site_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS loyalty_ledger_entries_account_idx
  ON public.loyalty_ledger_entries (loyalty_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS loyalty_ledger_entries_order_idx
  ON public.loyalty_ledger_entries (order_id) WHERE order_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. The balance projection — ONE definition, used by every reader
-- ---------------------------------------------------------------------------
-- A function rather than a repeated SUM: a second hand-written projection that disagreed with this
-- one would be a second source of truth for a money balance, which is the failure this whole design
-- exists to avoid.
CREATE OR REPLACE FUNCTION public.loyalty_balance(p_loyalty_account_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN entry_type IN ('earned', 'refund_credit', 'adjustment_credit') THEN points
      WHEN entry_type IN ('redeemed', 'expired', 'adjustment_debit') THEN -points
      ELSE 0
    END
  ), 0)::bigint
    FROM public.loyalty_ledger_entries
   WHERE loyalty_account_id = p_loyalty_account_id;
$$;

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_programs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_ledger_entries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_loyalty_programs ON public.loyalty_programs;
CREATE POLICY service_role_loyalty_programs ON public.loyalty_programs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_loyalty_accounts ON public.loyalty_accounts;
CREATE POLICY service_role_loyalty_accounts ON public.loyalty_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS service_role_loyalty_ledger_entries ON public.loyalty_ledger_entries;
CREATE POLICY service_role_loyalty_ledger_entries ON public.loyalty_ledger_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- A merchant may read their own programme (their setting), but NOT the ledger: entries link a
-- platform buyer identity to spending, and the money path writes only through the RPCs below.
DROP POLICY IF EXISTS loyalty_programs_tenant_read ON public.loyalty_programs;
CREATE POLICY loyalty_programs_tenant_read ON public.loyalty_programs
  FOR SELECT TO app_tenant
  USING (site_id = NULLIF(current_setting('app.site_id', true), '')::uuid);

REVOKE ALL ON public.loyalty_accounts FROM app_tenant, authenticated, anon;
REVOKE ALL ON public.loyalty_ledger_entries FROM app_tenant, authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.loyalty_programs FROM app_tenant, authenticated, anon;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    GRANT SELECT ON public.loyalty_programs TO app_tenant;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_programs TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_accounts TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_ledger_entries TO service_role;
  END IF;
END
$$;


-- ---------------------------------------------------------------------------
-- 5. award_loyalty_points — the earn path
-- ---------------------------------------------------------------------------
-- The order total is READ FROM THE ORDER, never accepted from the caller. A caller-supplied total is
-- a caller-chosen number of points, which is a caller-chosen amount of the merchant's money.
CREATE OR REPLACE FUNCTION public.award_loyalty_points(
  p_site_id uuid,
  p_buyer_account_id uuid,
  p_order_id uuid,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_program public.loyalty_programs%ROWTYPE;
  v_account public.loyalty_accounts%ROWTYPE;
  v_order_total numeric(12,2);
  v_points bigint;
  v_balance bigint;
  v_existing public.loyalty_ledger_entries%ROWTYPE;
BEGIN
  IF p_site_id IS NULL OR p_buyer_account_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'site, buyer and order are required';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency key is required';
  END IF;

  -- Serialize concurrent callers sharing (site, key) BEFORE the replay check and before every
  -- mutation. Seed 2 domain-separates this namespace from create_checkout_order (0) and
  -- issue_gift_card (1); sharing a seed would make unrelated money paths block each other.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 2));

  -- Idempotent replay: the same key returns the entry it already wrote, and awards nothing more.
  SELECT * INTO v_existing
    FROM public.loyalty_ledger_entries
   WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'entry_id', v_existing.id, 'points', v_existing.points,
      'balance', v_existing.balance_after, 'replayed', true
    );
  END IF;

  SELECT * INTO v_program FROM public.loyalty_programs WHERE site_id = p_site_id;
  IF NOT FOUND OR NOT v_program.is_active THEN
    -- Not enrolled, or enrolled and paused. Awarding nothing is the correct outcome and is NOT an
    -- error: the caller is a payment hook that must not fail an order because loyalty is off.
    RETURN jsonb_build_object('points', 0, 'balance', NULL, 'awarded', false, 'reason', 'program_inactive');
  END IF;

  -- The order must belong to this site AND be paid. Points on an unpaid order are points on money
  -- that never arrived; points on another site's order would be one merchant funding another's.
  SELECT o.total INTO v_order_total
    FROM public.orders o
   WHERE o.id = p_order_id AND o.site_id = p_site_id AND o.payment_status = 'paid';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order % is not a paid order for site %', p_order_id, p_site_id;
  END IF;

  -- floor(), never round(): rounding up would issue a point the merchant did not fund.
  v_points := floor(COALESCE(v_order_total, 0) * v_program.earn_rate_bps / 10000.0)::bigint;
  IF v_points <= 0 THEN
    RETURN jsonb_build_object('points', 0, 'balance', NULL, 'awarded', false, 'reason', 'below_minimum');
  END IF;

  INSERT INTO public.loyalty_accounts (site_id, buyer_account_id)
  VALUES (p_site_id, p_buyer_account_id)
  ON CONFLICT (site_id, buyer_account_id) DO NOTHING;

  SELECT * INTO v_account
    FROM public.loyalty_accounts
   WHERE site_id = p_site_id AND buyer_account_id = p_buyer_account_id
   FOR UPDATE;

  IF v_account.status <> 'active' THEN
    RAISE EXCEPTION 'loyalty account is %', v_account.status;
  END IF;

  v_balance := public.loyalty_balance(v_account.id) + v_points;

  INSERT INTO public.loyalty_ledger_entries (
    site_id, loyalty_account_id, order_id, entry_type, points, balance_after,
    idempotency_key, request_id, created_by
  ) VALUES (
    p_site_id, v_account.id, p_order_id, 'earned', v_points, v_balance,
    p_idempotency_key, p_request_id, p_actor_id
  );

  RETURN jsonb_build_object('points', v_points, 'balance', v_balance, 'awarded', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. redeem_loyalty_points — the tender path
-- ---------------------------------------------------------------------------
-- Returns the MINOR-UNIT value the redeemed points represent, so the caller applies tender it did not
-- compute. The cap is enforced against the order's own total, read here.
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_site_id uuid,
  p_buyer_account_id uuid,
  p_order_id uuid,
  p_points bigint,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_program public.loyalty_programs%ROWTYPE;
  v_account public.loyalty_accounts%ROWTYPE;
  v_order_total numeric(12,2);
  v_balance bigint;
  v_max_points bigint;
  v_value_minor bigint;
  v_existing public.loyalty_ledger_entries%ROWTYPE;
BEGIN
  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'points to redeem must be greater than zero';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency key is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 2));

  SELECT * INTO v_existing
    FROM public.loyalty_ledger_entries
   WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key
   LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'entry_id', v_existing.id, 'points', v_existing.points,
      'balance', v_existing.balance_after,
      'value_minor', (v_existing.metadata->>'value_minor')::bigint, 'replayed', true
    );
  END IF;

  SELECT * INTO v_program FROM public.loyalty_programs WHERE site_id = p_site_id;
  IF NOT FOUND OR NOT v_program.is_active THEN
    RAISE EXCEPTION 'loyalty is not active for site %', p_site_id;
  END IF;

  SELECT o.total INTO v_order_total
    FROM public.orders o
   WHERE o.id = p_order_id AND o.site_id = p_site_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order % does not belong to site %', p_order_id, p_site_id;
  END IF;

  SELECT * INTO v_account
    FROM public.loyalty_accounts
   WHERE site_id = p_site_id AND buyer_account_id = p_buyer_account_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no loyalty account for this buyer at this site';
  END IF;
  IF v_account.status <> 'active' THEN
    RAISE EXCEPTION 'loyalty account is %', v_account.status;
  END IF;

  -- The balance is recomputed from the ledger INSIDE the lock, never read from a cached column.
  v_balance := public.loyalty_balance(v_account.id);
  IF p_points > v_balance THEN
    RAISE EXCEPTION 'insufficient loyalty points: % requested, % available', p_points, v_balance;
  END IF;

  -- The cap is a property of the ORDER, so it is computed from the order's own total. floor() again:
  -- rounding the cap up would let points pay a rupee more than the merchant agreed to fund.
  v_max_points := floor(
    (COALESCE(v_order_total, 0) * 100) * v_program.redeem_cap_bps / 10000.0 / v_program.point_value_minor
  )::bigint;
  IF p_points > v_max_points THEN
    RAISE EXCEPTION 'redemption exceeds the programme cap: % requested, % allowed on this order', p_points, v_max_points;
  END IF;

  v_value_minor := p_points * v_program.point_value_minor;

  INSERT INTO public.loyalty_ledger_entries (
    site_id, loyalty_account_id, order_id, entry_type, points, balance_after,
    idempotency_key, request_id, metadata, created_by
  ) VALUES (
    p_site_id, v_account.id, p_order_id, 'redeemed', p_points, v_balance - p_points,
    p_idempotency_key, p_request_id,
    jsonb_build_object('value_minor', v_value_minor, 'point_value_minor', v_program.point_value_minor),
    p_actor_id
  );

  RETURN jsonb_build_object(
    'points', p_points, 'balance', v_balance - p_points,
    'value_minor', v_value_minor, 'redeemed', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_loyalty_points(uuid, uuid, uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_loyalty_points(uuid, uuid, uuid, bigint, text, text, uuid) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.award_loyalty_points(uuid, uuid, uuid, text, text, uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.redeem_loyalty_points(uuid, uuid, uuid, bigint, text, text, uuid) TO service_role;
  END IF;
END
$$;

COMMIT;
