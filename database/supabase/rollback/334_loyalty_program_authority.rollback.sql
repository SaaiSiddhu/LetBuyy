-- Prefer forward recovery. Restore exact pre334 bodies/ACLs; retain settings,
-- audits, receipts and all ledger entries. No business history is deleted.
BEGIN;
DO $rollback_precondition$
DECLARE e record;p pg_catalog.pg_proc%ROWTYPE;v_count integer;
BEGIN
 FOR e IN SELECT * FROM(VALUES
('set_loyalty_program','public.set_loyalty_program(uuid,boolean,integer,integer,bigint,uuid,text,text,text)',ARRAY['p_site_id','p_is_active','p_earn_rate_bps','p_redeem_cap_bps','p_point_value_minor','p_actor_id','p_actor_type','p_actor_email','p_request_id']::text[]),
('award_loyalty_points','public.award_loyalty_points(uuid,uuid,uuid,text,text,uuid)',ARRAY['p_site_id','p_buyer_account_id','p_order_id','p_idempotency_key','p_request_id','p_actor_id']::text[]),
('redeem_loyalty_points','public.redeem_loyalty_points(uuid,uuid,uuid,bigint,text,bigint,text,uuid)',ARRAY['p_site_id','p_buyer_account_id','p_order_id','p_points','p_idempotency_key','p_max_value_minor','p_request_id','p_actor_id']::text[]),
('restore_loyalty_on_refund','public.restore_loyalty_on_refund(uuid,uuid,uuid,text)',ARRAY['p_site_id','p_order_id','p_actor_id','p_request_id']::text[]),
('read_loyalty_program_v1','public.read_loyalty_program_v1(uuid,uuid)',ARRAY['p_site_id','p_actor_id']::text[]),
('mutate_loyalty_program_v1','public.mutate_loyalty_program_v1(uuid,uuid,jsonb,text,timestamptz,text)',ARRAY['p_site_id','p_actor_id','p_intent','p_key','p_expected_updated_at','p_request_id']::text[]))expected(name,signature,input_names)
 LOOP
  SELECT count(*) INTO v_count FROM pg_catalog.pg_proc q JOIN pg_catalog.pg_namespace n ON n.oid=q.pronamespace WHERE n.nspname='public' AND q.proname=e.name;
  IF v_count<>1 OR pg_catalog.to_regprocedure(e.signature) IS NULL THEN
   RAISE EXCEPTION 'rollback 334 refuses to run: % signature or overload set changed; use a reviewed forward repair',e.name; END IF;
  SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(e.signature);
  IF p.proargnames[1:p.pronargs] IS DISTINCT FROM e.input_names OR p.prorettype<>'jsonb'::regtype OR p.proretset OR p.prokind<>'f' THEN
   RAISE EXCEPTION 'rollback 334 refuses to run: % input names or result ABI changed; use a reviewed forward repair',e.name; END IF;
 END LOOP;
END $rollback_precondition$;
DROP FUNCTION public.read_loyalty_program_v1(uuid,uuid);
DROP FUNCTION public.mutate_loyalty_program_v1(uuid,uuid,jsonb,text,timestamptz,text);
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
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_program public.loyalty_programs%ROWTYPE;
  v_account public.loyalty_accounts%ROWTYPE;
  v_order_total numeric(12,2);
  v_order_buyer uuid;
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

  -- Serialize the logical order as well as its caller-supplied retry key.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':loyalty.earn:' || p_order_id::text, 2));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 2));

  SELECT * INTO v_existing
    FROM public.loyalty_ledger_entries
   WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key
   LIMIT 1;
  IF FOUND THEN
    IF v_existing.order_id IS DISTINCT FROM p_order_id OR v_existing.entry_type<>'earned'
      OR NOT EXISTS(SELECT 1 FROM public.loyalty_accounts a WHERE a.id=v_existing.loyalty_account_id
        AND a.site_id=p_site_id AND a.buyer_account_id=p_buyer_account_id) THEN
      RAISE EXCEPTION 'loyalty earning idempotency payload conflict';
    END IF;
    RETURN jsonb_build_object(
      'entry_id', v_existing.id, 'points', v_existing.points,
      'balance', v_existing.balance_after, 'replayed', true
    );
  END IF;

  SELECT * INTO v_program FROM public.loyalty_programs WHERE site_id = p_site_id;
  IF NOT FOUND OR NOT v_program.is_active THEN
    RETURN jsonb_build_object('points', 0, 'balance', NULL, 'awarded', false, 'reason', 'program_inactive');
  END IF;

  SELECT o.total INTO v_order_total
    FROM public.orders o
   WHERE o.id = p_order_id AND o.site_id = p_site_id AND o.payment_status = 'paid' AND o.deleted_at IS NULL
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order % is not a paid order for site %', p_order_id, p_site_id;
  END IF;

  -- The source subject must still own this order inside the money transaction.
  -- FOR SHARE prevents a concurrent ownership edit from passing this check and
  -- changing the subject before the immutable credit commits.
  SELECT l.buyer_account_id INTO v_order_buyer FROM public.buyer_order_links l
   WHERE l.order_id=p_order_id AND l.site_id=p_site_id FOR SHARE;
  IF NOT FOUND OR v_order_buyer IS DISTINCT FROM p_buyer_account_id THEN
    RAISE EXCEPTION 'loyalty earning buyer does not own the paid order';
  END IF;

  SELECT * INTO v_existing FROM public.loyalty_ledger_entries
   WHERE site_id=p_site_id AND order_id=p_order_id AND entry_type='earned' LIMIT 1;
  IF FOUND THEN
    IF NOT EXISTS(SELECT 1 FROM public.loyalty_accounts a WHERE a.id=v_existing.loyalty_account_id
      AND a.site_id=p_site_id AND a.buyer_account_id=p_buyer_account_id) THEN
      RAISE EXCEPTION 'loyalty earning source ownership conflict; reviewed recovery required';
    END IF;
    RETURN jsonb_build_object('entry_id',v_existing.id,'points',v_existing.points,
      'balance',v_existing.balance_after,'awarded',false,'replayed',true,'reason','already_awarded');
  END IF;

  v_points := public.loyalty_points_for_order_total_v1(v_order_total,v_program.earn_rate_bps);
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

  -- CHANGED BY 235: a frozen or closed account means "do not award", exactly as a paused programme
  -- does. Raising here made the two identical situations behave oppositely, and on the money path
  -- the difference is a failed payment capture.
  IF v_account.status <> 'active' THEN
    RETURN jsonb_build_object('points', 0, 'balance', NULL, 'awarded', false, 'reason', 'account_' || v_account.status);
  END IF;

  v_balance := public.loyalty_balance(v_account.id) + v_points;

  INSERT INTO public.loyalty_ledger_entries (
    site_id, loyalty_account_id, order_id, entry_type, points, balance_after,
    idempotency_key, request_id, metadata, created_by
  ) VALUES (
    p_site_id, v_account.id, p_order_id, 'earned', v_points, v_balance,
    p_idempotency_key, p_request_id,
    -- ADDED BY 243: what a point was worth WHEN IT WAS EARNED. Redemption reads the programme's
    -- CURRENT point_value_minor, so lowering it revalues every outstanding point; until now nothing
    -- recorded the earlier value and the change could not be reconstructed afterwards. This records
    -- the fact and changes no behaviour: redemption still values points at the current rate.
    jsonb_build_object(
      'point_value_minor', v_program.point_value_minor,
      'value_minor', v_points * v_program.point_value_minor,
      'earn_rate_bps', v_program.earn_rate_bps
    ),
    p_actor_id
  );

  RETURN jsonb_build_object('points', v_points, 'balance', v_balance, 'awarded', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_site_id uuid,
  p_buyer_account_id uuid,
  p_order_id uuid,
  p_points bigint,
  p_idempotency_key text,
  -- The authoritative amount this redemption may pay for, in paise. NULL keeps 231's behaviour and
  -- caps against orders.total, which remains correct for a standalone call on a settled order.
  p_max_value_minor bigint DEFAULT NULL,
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
  v_basis_minor bigint;
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
  IF p_max_value_minor IS NOT NULL AND p_max_value_minor < 0 THEN
    RAISE EXCEPTION 'the payable amount cannot be negative';
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

  v_balance := public.loyalty_balance(v_account.id);
  IF p_points > v_balance THEN
    RAISE EXCEPTION 'insufficient loyalty points: % requested, % available', p_points, v_balance;
  END IF;

  -- The basis for the cap: the caller's authoritative amount when given, otherwise the order row.
  -- LEAST of both when both are available, so passing an amount can only ever TIGHTEN the cap —
  -- a caller cannot use this parameter to redeem beyond the programme's limit.
  v_basis_minor := LEAST(
    COALESCE(p_max_value_minor, (COALESCE(v_order_total, 0) * 100)::bigint),
    (COALESCE(v_order_total, 0) * 100)::bigint
  );

  v_max_points := floor(v_basis_minor * v_program.redeem_cap_bps / 10000.0 / v_program.point_value_minor)::bigint;
  IF p_points > v_max_points THEN
    RAISE EXCEPTION 'redemption exceeds the programme cap: % requested, % allowed on this order', p_points, v_max_points;
  END IF;

  v_value_minor := p_points * v_program.point_value_minor;

  -- Belt and braces: the value applied can never exceed what the caller said is payable. The cap
  -- above already guarantees this; if a future edit loosens the cap arithmetic, this still holds.
  IF p_max_value_minor IS NOT NULL AND v_value_minor > p_max_value_minor THEN
    RAISE EXCEPTION 'redemption value % exceeds the payable amount %', v_value_minor, p_max_value_minor;
  END IF;

  INSERT INTO public.loyalty_ledger_entries (
    site_id, loyalty_account_id, order_id, entry_type, points, balance_after,
    idempotency_key, request_id, metadata, created_by
  ) VALUES (
    p_site_id, v_account.id, p_order_id, 'redeemed', p_points, v_balance - p_points,
    p_idempotency_key, p_request_id,
    jsonb_build_object(
      'value_minor', v_value_minor,
      'point_value_minor', v_program.point_value_minor,
      'basis_minor', v_basis_minor
    ),
    p_actor_id
  );

  RETURN jsonb_build_object(
    'points', p_points, 'balance', v_balance - p_points,
    'value_minor', v_value_minor, 'redeemed', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_loyalty_on_refund(
  p_site_id uuid,
  p_order_id uuid,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_guc text;
  v_redemption public.loyalty_ledger_entries%ROWTYPE;
  v_balance bigint;
  v_restored_points bigint := 0;
  v_restored_count integer := 0;
BEGIN
  IF p_site_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'site id and order id are required';
  END IF;

  -- The fence 237, 238 and 239 carry: when a tenant transaction is in force, the site it resolved
  -- and the site this function credits must be the same one.
  v_tenant_guc := NULLIF(current_setting('app.site_id', true), '');
  IF v_tenant_guc IS NOT NULL AND v_tenant_guc::uuid <> p_site_id THEN
    RAISE EXCEPTION 'tenant context % does not match the requested site %', v_tenant_guc, p_site_id;
  END IF;

  -- Loyalty's own advisory seed (2), keyed on the order: two concurrent refund completions for one
  -- order must not both decide the credit is missing. Seed 0 is checkout, 1 gift cards, 3 ad credits.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':loyalty.refund:' || p_order_id::text, 2));

  FOR v_redemption IN
    SELECT *
      FROM public.loyalty_ledger_entries
     WHERE site_id = p_site_id
       AND order_id = p_order_id
       AND entry_type = 'redeemed'
     FOR UPDATE
  LOOP
    -- Recomputed inside the lock from the one projection, never carried in from the caller.
    v_balance := public.loyalty_balance(v_redemption.loyalty_account_id);

    INSERT INTO public.loyalty_ledger_entries (
      site_id, loyalty_account_id, order_id, entry_type, points, balance_after,
      idempotency_key, request_id, metadata, created_by
    ) VALUES (
      p_site_id,
      v_redemption.loyalty_account_id,
      p_order_id,
      'refund_credit',
      v_redemption.points,
      v_balance + v_redemption.points,
      -- Keyed on the ENTRY being reversed, not just the order: an order with two redemptions gets
      -- two credits, and a refund processed twice still credits once.
      'loyalty.refund_credit:' || p_order_id::text || ':' || v_redemption.id::text,
      p_request_id,
      -- ADDED BY 243: the credit carries the value the ORIGINAL redemption used, taken from that
      -- entry's own metadata rather than the programme's current rate. A refund returns what was
      -- actually spent, and if the rate moved in between, the two are no longer the same number.
      jsonb_build_object(
        'redeemed_entry_id', v_redemption.id,
        'points', v_redemption.points,
        'point_value_minor_at_redemption', v_redemption.metadata->>'point_value_minor',
        'value_minor_at_redemption', v_redemption.metadata->>'value_minor'
      ),
      p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    IF FOUND THEN
      v_restored_points := v_restored_points + v_redemption.points;
      v_restored_count := v_restored_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'restored', v_restored_count > 0,
    'restored_points', v_restored_points,
    'restored_entries', v_restored_count
  );
END;
$$;
REVOKE ALL ON FUNCTION public.set_loyalty_program(uuid,boolean,integer,integer,bigint,uuid,text,text,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.set_loyalty_program(uuid,boolean,integer,integer,bigint,uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_loyalty_program(uuid,boolean,integer,integer,bigint,uuid,text,text,text) TO app_tenant;
REVOKE ALL ON FUNCTION public.award_loyalty_points(uuid,uuid,uuid,text,text,uuid) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.award_loyalty_points(uuid,uuid,uuid,text,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.redeem_loyalty_points(uuid,uuid,uuid,bigint,text,bigint,text,uuid) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_points(uuid,uuid,uuid,bigint,text,bigint,text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.restore_loyalty_on_refund(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.restore_loyalty_on_refund(uuid,uuid,uuid,text) TO service_role;
GRANT INSERT,UPDATE,DELETE ON public.loyalty_programs TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
