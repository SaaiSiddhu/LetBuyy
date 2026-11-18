-- Pre-use schema rollback only. Used financial snapshots must be preserved.
BEGIN;

-- Refuse stale ABI/overloads before any historical rollback mutation.
DO $managed_catalog_fence$
BEGIN
 IF (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN
  LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
 ELSE
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE p.oid=pg_catalog.to_regprocedure('letbuyy_maintenance.lock_catalogs_v1()')
 AND n.nspname='letbuyy_maintenance' AND n.nspowner='supabase_admin'::regrole
 AND p.proowner='supabase_admin'::regrole AND p.prosecdef AND p.prokind='f' AND NOT p.proretset
 AND p.prorettype='pg_catalog.void'::regtype AND p.prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
 AND p.pronargs=0 AND p.pronargdefaults=0 AND p.proargnames IS NULL AND p.proargmodes IS NULL AND p.proallargtypes IS NULL
 AND NOT p.proisstrict AND NOT p.proleakproof AND p.prosupport=0 AND p.provolatile='v' AND p.proparallel='u'
 AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]
 AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex')='4772eebc5017ef1e188b188f87f1cca8fb8f2b9cfd1e928798ef5cd5dfebfabc'
 AND EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.oid=p.proowner AND r.rolsuper)
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)))a
  WHERE a.grantor<>p.proowner OR a.grantee NOT IN(p.proowner,'postgres'::regrole) OR (a.grantee<>p.proowner AND a.is_grantable))
 AND pg_catalog.has_function_privilege('postgres',p.oid,'EXECUTE')
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner)))a
  WHERE a.grantor<>n.nspowner OR a.grantee NOT IN(n.nspowner,'postgres'::regrole)
   OR(a.grantee<>n.nspowner AND (a.is_grantable OR a.privilege_type<>'USAGE')))
 AND pg_catalog.has_schema_privilege('postgres',n.oid,'USAGE')
 AND (SELECT count(*) FROM pg_catalog.pg_proc x WHERE x.pronamespace=n.oid AND x.proname=p.proname)=1) THEN
   RAISE EXCEPTION 'LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED' USING ERRCODE='42501';END IF;
  PERFORM letbuyy_maintenance.lock_catalogs_v1();
  -- Prove actual backend-held relation locks, including cluster-shared catalogs.
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['pg_catalog.pg_proc'::pg_catalog.regclass]::oid[]) catalog_oid
    WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
     AND l.locktype='relation' AND l.relation=catalog_oid AND l.granted
     AND l.mode IN('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')
     AND l.database IN(0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())))) THEN
   RAISE EXCEPTION 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED';END IF;
 END IF;
END $managed_catalog_fence$;
DO $rollback_typed_family$
DECLARE expected record; live pg_catalog.pg_proc%ROWTYPE;
BEGIN
 FOR expected IN SELECT * FROM (VALUES
 ('public.create_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,bigint)',ARRAY['p_store_id','p_customer_name','p_customer_email','p_customer_phone','p_shipping_address','p_items','p_payment_method','p_notes','p_coupon_code','p_gift_card_code','p_shipping_method','p_idempotency_key','p_actor_id','p_request_id','p_shipping_rate_id','p_tax_amount','p_place_of_supply_state','p_tax_lines','p_buyer_account_id','p_loyalty_points']::text[],'jsonb',true),
 ('public.create_storefront_checkout_order_with_delivery_rate(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer,numeric)',ARRAY['p_store_id','p_customer_name','p_customer_email','p_customer_phone','p_shipping_address','p_items','p_payment_method','p_notes','p_coupon_code','p_gift_card_code','p_shipping_method','p_idempotency_key','p_actor_id','p_request_id','p_shipping_rate_id','p_tax_amount','p_place_of_supply_state','p_tax_lines','p_buyer_account_id','p_buyer_session_epoch','p_expected_shipping_amount']::text[],'jsonb',true),
 ('public.create_marketplace_checkout_order(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer)',ARRAY['p_store_id','p_customer_name','p_customer_email','p_customer_phone','p_shipping_address','p_items','p_payment_method','p_notes','p_coupon_code','p_gift_card_code','p_shipping_method','p_idempotency_key','p_actor_id','p_request_id','p_shipping_rate_id','p_tax_amount','p_place_of_supply_state','p_tax_lines','p_buyer_account_id','p_buyer_session_epoch']::text[],'jsonb',true),
 ('public.create_marketplace_checkout_order_with_delivery_rate(uuid,text,text,text,jsonb,jsonb,text,text,text,text,text,text,uuid,text,uuid,numeric,text,jsonb,uuid,integer,numeric)',ARRAY['p_store_id','p_customer_name','p_customer_email','p_customer_phone','p_shipping_address','p_items','p_payment_method','p_notes','p_coupon_code','p_gift_card_code','p_shipping_method','p_idempotency_key','p_actor_id','p_request_id','p_shipping_rate_id','p_tax_amount','p_place_of_supply_state','p_tax_lines','p_buyer_account_id','p_buyer_session_epoch','p_expected_shipping_amount']::text[],'jsonb',true)
 ) AS bounded(signature,input_names,result_type,definer) LOOP
  SELECT * INTO live FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(expected.signature);
  IF live.oid IS NULL OR live.prokind<>'f' OR live.prosecdef IS DISTINCT FROM expected.definer OR live.proretset
   OR live.prorettype IS DISTINCT FROM expected.result_type::regtype OR live.provariadic<>0
   OR live.proargnames[1:live.pronargs] IS DISTINCT FROM expected.input_names
   OR live.proargmodes IS NOT NULL OR live.proallargtypes IS NOT NULL
   OR (SELECT count(*) FROM pg_catalog.pg_proc other WHERE other.pronamespace=live.pronamespace AND other.proname=live.proname)<>1
   OR (expected.definer AND (pg_catalog.has_function_privilege('anon',live.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated',live.oid,'EXECUTE'))) THEN
   RAISE EXCEPTION 'Rollback411 refuses changed typed function family';
  END IF;
 END LOOP;
END $rollback_typed_family$;

ALTER TABLE public.shipping_zones DROP CONSTRAINT shipping_zone_profile_same_site_v1;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.orders WHERE tax_snapshot<>'{}'::jsonb) THEN
    RAISE EXCEPTION 'GST snapshots already used: retain schema and roll back application only';
  END IF;
END; $$;
DROP FUNCTION public.create_storefront_checkout_order_with_quote(uuid,jsonb,text);
CREATE OR REPLACE FUNCTION public.create_checkout_order(p_store_id uuid, p_customer_name text, p_customer_email text, p_customer_phone text, p_shipping_address jsonb, p_items jsonb, p_payment_method text, p_notes text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text, p_gift_card_code text DEFAULT NULL::text, p_shipping_method text DEFAULT 'standard'::text, p_idempotency_key text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_shipping_rate_id uuid DEFAULT NULL::uuid, p_tax_amount numeric DEFAULT NULL::numeric, p_place_of_supply_state text DEFAULT NULL::text, p_tax_lines jsonb DEFAULT NULL::jsonb, p_buyer_account_id uuid DEFAULT NULL::uuid, p_loyalty_points bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    -- F-LOY-1: loyalty applied as TENDER. Named for what it is; the amount is subtracted from what
    -- is PAYABLE, never from the taxable total.
    v_loyalty_amount NUMERIC(12,2) := 0;
    v_loyalty_points_applied BIGINT := 0;
    v_loyalty_residual_minor BIGINT := 0;
    v_loyalty_max_points BIGINT := 0;
    v_loyalty_program public.loyalty_programs%ROWTYPE;
    v_loyalty_result JSONB;
    v_existing_order_id UUID;
    v_order_json JSONB;
    v_order_id UUID;
    v_purchase_id UUID;
    v_order RECORD;
    v_shipping_method TEXT := COALESCE(NULLIF(BTRIM(p_shipping_method), ''), 'standard');
    v_shipping_amount NUMERIC(12,2) := 0;
    v_tax_amount NUMERIC(12,2) := 0;
    v_discount_amount NUMERIC(12,2) := 0;
    v_gift_card_amount NUMERIC(12,2) := 0;
    v_gift_card_balance NUMERIC(12,2) := 0;
    v_grand_total NUMERIC(12,2) := 0;
    v_payment_due NUMERIC(12,2) := 0;
    v_promotion JSONB := jsonb_build_object('valid', false, 'discount', 0);
    v_gift_card RECORD;
    v_payment_transaction_id UUID;
    v_rate_row RECORD;
    v_store_has_rates BOOLEAN := false;
    v_tax_line JSONB;
BEGIN
    IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id is required';
    END IF;

    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    IF p_payment_method NOT IN ('razorpay', 'cod') THEN
        RAISE EXCEPTION 'unsupported payment method: %', p_payment_method;
    END IF;

    -- CHK-0: restored from migration 206 (Phase R3). Serialize concurrent callers sharing the
    -- same (site_id, idempotency_key) BEFORE the existence check below and before every row lock
    -- this function transitively takes. Advisory-FIRST is what prevents a deadlock against
    -- reserve_inventory's FOR UPDATE on inventory_levels and this function's own gift-card
    -- FOR UPDATE on gift_card_accounts. Transaction-scoped: released at COMMIT or ROLLBACK.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':' || p_idempotency_key, 0));

    SELECT order_id
      INTO v_existing_order_id
      FROM checkout_sessions
     WHERE site_id = p_store_id
       AND idempotency_key = p_idempotency_key
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_existing_order_id IS NOT NULL THEN
        SELECT to_jsonb(o)
          INTO v_order_json
          FROM orders o
         WHERE o.id = v_existing_order_id
           AND o.deleted_at IS NULL;

        IF v_order_json IS NOT NULL THEN
            IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE i ? 'cart_fact_ref')
              OR EXISTS(SELECT 1 FROM public.order_items oi WHERE oi.order_id=v_existing_order_id AND oi.product_snapshot ? 'cart_line_id') THEN
              IF (SELECT jsonb_agg(jsonb_build_array(i->>'product_id',nullif(i->>'variant_id',''),(i->>'quantity')::integer,
                nullif(i->>'marketplace_listing_id',''),i->'cart_fact_ref'->>'cart_id',i->'cart_fact_ref'->>'line_id',
                i->'cart_fact_ref'->'product_version',i->'cart_fact_ref'->>'configuration_fingerprint',i->'cart_fact_ref'->>'snapshot_fingerprint')
                ORDER BY i->'cart_fact_ref'->>'line_id') FROM jsonb_array_elements(p_items) i)
                IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_array(oi.product_id::text,nullif(oi.variant_id,''),oi.quantity,
                  oi.marketplace_listing_id::text,oi.product_snapshot->>'cart_id',oi.product_snapshot->>'cart_line_id',
                  oi.product_snapshot->'product_version',oi.product_snapshot->>'configuration_fingerprint',oi.product_snapshot->>'snapshot_fingerprint')
                  ORDER BY oi.product_snapshot->>'cart_line_id') FROM public.order_items oi WHERE oi.order_id=v_existing_order_id AND oi.deleted_at IS NULL) THEN
                RAISE EXCEPTION 'CART_FACT_RECEIPT_CONFLICT'; END IF;
            END IF;
            RETURN v_order_json;
        END IF;
    END IF;

    -- (a) Shipping resolution: server-side rate lookup when the store has configured rates.
    SELECT COUNT(*) > 0
      INTO v_store_has_rates
      FROM public.shipping_rates sr
      JOIN public.shipping_zones sz ON sz.id = sr.zone_id
     WHERE sz.site_id = p_store_id
       AND sr.is_active = true
       AND sr.deleted_at IS NULL;

    IF v_store_has_rates AND p_shipping_rate_id IS NOT NULL THEN
        -- Resolve the specific rate; validate it belongs to this store and is active.
        SELECT sr.type, sr.price,
               sr.min_order_amount, sr.max_order_amount,
               sr.min_weight_grams, sr.max_weight_grams
          INTO v_rate_row
          FROM public.shipping_rates sr
          JOIN public.shipping_zones sz ON sz.id = sr.zone_id
         WHERE sr.id = p_shipping_rate_id
           AND sz.site_id = p_store_id
           AND sr.is_active = true
           AND sr.deleted_at IS NULL;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'shipping rate not found or does not belong to this store: %', p_shipping_rate_id;
        END IF;

        IF v_rate_row.type = 'free' THEN
            v_shipping_amount := 0;
        ELSE
            -- flat / price_based / weight_based: use the configured price column.
            -- Price/weight range checks are advisory (display-only) in V1; cost comes from price column.
            v_shipping_amount := COALESCE(v_rate_row.price, 0);
        END IF;

    ELSIF v_store_has_rates AND p_shipping_rate_id IS NULL THEN
        -- Store has rates but caller did not pass an ID — use legacy fallback.
        IF v_shipping_method = 'express' THEN
            v_shipping_amount := 99;
        ELSE
            v_shipping_amount := 0;
        END IF;

    ELSE
        -- No configured rates: legacy hardcoded fallback (express=99, standard=0).
        IF v_shipping_method = 'express' THEN
            v_shipping_amount := 99;
        ELSIF v_shipping_method = 'standard' THEN
            v_shipping_amount := 0;
        ELSE
            RAISE EXCEPTION 'unsupported shipping method: %', v_shipping_method;
        END IF;
    END IF;

    -- (b) GST: when the gateway has computed tax server-side, accept it; otherwise 0.
    v_tax_amount := COALESCE(p_tax_amount, 0);

    v_order_json := create_order_with_inventory_reservations(
        p_store_id,
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        COALESCE(p_shipping_address, '{}'::JSONB),
        p_items,
        p_payment_method,
        p_notes,
        NULL,
        p_actor_id,
        p_request_id
    );

    v_order_id := (v_order_json ->> 'id')::UUID;

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = v_order_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'created order not found';
    END IF;

    -- CHK-1 (D-3): every checkout gets a parent purchase with exactly one child order, so a
    -- multi-merchant cart later is a constraint change, not a second checkout code path. The
    -- parent deliberately holds no money and no status -- the child order remains the single
    -- source of truth for both (D-PURCHASE-TENANCY, decisions.md 2b). Same transaction as the
    -- order, and downstream of the advisory lock above, so a replayed idempotency key returns
    -- early and can never create a second parent.
    INSERT INTO public.purchases (
        origin_site_id,
        channel,
        customer_email,
        customer_name,
        customer_phone,
        currency,
        idempotency_key
    )
    VALUES (
        p_store_id,
        'storefront',
        p_customer_email,
        p_customer_name,
        p_customer_phone,
        COALESCE(v_order.currency, 'INR'),
        p_idempotency_key
    )
    RETURNING id INTO v_purchase_id;

    UPDATE orders
       SET purchase_id = v_purchase_id
     WHERE id = v_order_id;

    IF NULLIF(BTRIM(COALESCE(p_coupon_code, '')), '') IS NOT NULL THEN
        v_promotion := evaluate_checkout_promotion(
            p_store_id,
            p_coupon_code,
            COALESCE(v_order.subtotal, 0),
            v_shipping_amount,
            p_customer_email
        );
        v_discount_amount := COALESCE((v_promotion ->> 'discount')::NUMERIC, 0);
    END IF;

    -- T15/W2: GST is computed on v_grand_total BEFORE the gift card is even looked up below —
    -- a gift card is TENDER (a payment method), never a pre-tax discount. Confirmed correct as
    -- written: v_tax_amount (from p_tax_amount, computed server-side in the gateway before any
    -- gift-card consideration) is folded into v_grand_total here; the gift card only reduces
    -- v_payment_due afterward. No change needed for this ordering.
    v_grand_total := GREATEST(COALESCE(v_order.subtotal, 0) + v_shipping_amount + v_tax_amount - v_discount_amount, 0);

    IF NULLIF(BTRIM(COALESCE(p_gift_card_code, '')), '') IS NOT NULL THEN
        SELECT *
          INTO v_gift_card
          FROM gift_card_accounts gca
         WHERE gca.site_id = p_store_id
           AND gca.code_hash = encode(extensions.digest(p_gift_card_code, 'sha256'), 'hex')
           AND gca.status = 'active'
           AND gca.deleted_at IS NULL
           AND (gca.expires_at IS NULL OR gca.expires_at >= NOW())
         FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'gift card is invalid or unavailable';
        END IF;

        SELECT COALESCE(
            SUM(
                CASE
                    WHEN entry_type IN ('issued', 'credit', 'refund_credit', 'release') THEN amount
                    WHEN entry_type IN ('debit', 'hold', 'expire', 'fraud_hold') THEN -amount
                    ELSE 0
                END
            ),
            COALESCE(v_gift_card.initial_value, v_gift_card.balance, 0)
        )
          INTO v_gift_card_balance
          FROM gift_card_ledger_entries
         WHERE gift_card_account_id = v_gift_card.id
           AND site_id = p_store_id
           AND deleted_at IS NULL;

        v_gift_card_amount := LEAST(COALESCE(v_gift_card_balance, 0), v_grand_total);

        IF v_gift_card_amount <= 0 THEN
            RAISE EXCEPTION 'gift card has no redeemable balance';
        END IF;

        INSERT INTO gift_card_redemptions (
            site_id,
            gift_card_account_id,
            order_id,
            amount,
            status,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_gift_card.id,
            v_order_id,
            v_gift_card_amount,
            'committed',
            'gift_card.redemption:' || v_order_id::TEXT || ':' || v_gift_card.id::TEXT,
            p_request_id,
            jsonb_build_object('code_last4', v_gift_card.code_last4),
            p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;

        INSERT INTO gift_card_ledger_entries (
            site_id,
            gift_card_account_id,
            order_id,
            entry_type,
            amount,
            balance_after,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_gift_card.id,
            v_order_id,
            'debit',
            v_gift_card_amount,
            COALESCE(v_gift_card_balance, 0) - v_gift_card_amount,
            'gift_card.debit:' || v_order_id::TEXT || ':' || v_gift_card.id::TEXT,
            p_request_id,
            jsonb_build_object('code_last4', v_gift_card.code_last4),
            p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;
    END IF;

    -- ── F-LOY-1: loyalty points as TENDER ────────────────────────────────────────────────────────
    -- Same rule as the gift card above (T15/W2): GST was computed on v_grand_total and is NOT
    -- touched here. Points reduce what is PAYABLE; they are not a pre-tax discount, so the invoice
    -- and the tax lines are identical whether or not points are used.
    --
    -- Applied AFTER the gift card, on what remains. A gift card is money the buyer already holds and
    -- carries no cap; loyalty is the merchant's marketing spend and does. Spending the buyer's own
    -- balance first means points are never burned on an amount a gift card would have covered.
    IF p_loyalty_points IS NOT NULL AND p_loyalty_points > 0 AND p_buyer_account_id IS NOT NULL THEN
        SELECT * INTO v_loyalty_program FROM public.loyalty_programs WHERE site_id = p_store_id;

        -- A store with no programme, or a paused one, simply applies no points. It is not an error:
        -- a buyer whose client offered points must not have their checkout fail because the merchant
        -- turned the programme off in between.
        IF FOUND AND v_loyalty_program.is_active THEN
            v_loyalty_residual_minor := GREATEST(ROUND((v_grand_total - v_gift_card_amount) * 100), 0)::BIGINT;

            -- REFUSE rather than silently apply fewer points. Probing showed the first version of
            -- this block clamped here while an over-request against the BALANCE raised inside
            -- redeem_loyalty_points — two different answers to the same situation, "the client asked
            -- for more than can be applied". Clamping is the worse of the two: the buyer is shown one
            -- figure by the client and charged another, because the points silently dropped out. One
            -- policy, and it is the explicit one — the caller re-reads the balance and the cap and
            -- offers again. Nothing is debited on this path, so there is no partial state to unwind.
            v_loyalty_max_points := FLOOR(v_loyalty_residual_minor / v_loyalty_program.point_value_minor)::BIGINT;
            IF p_loyalty_points > v_loyalty_max_points THEN
                RAISE EXCEPTION 'loyalty points exceed what this order can apply: % requested, % applicable',
                    p_loyalty_points, v_loyalty_max_points;
            END IF;
            v_loyalty_points_applied := p_loyalty_points;

            IF v_loyalty_points_applied > 0 THEN
                -- The residual is passed as the authoritative payable amount (233): this function
                -- knows it exactly, whereas orders.total is mid-mutation here — it still holds the
                -- pre-adjustment figure and is not rewritten until the UPDATE below.
                --
                -- The idempotency key is DERIVED from the checkout's, mirroring the gift card's
                -- 'gift_card.redemption:' convention, so a replayed checkout cannot debit twice. The
                -- checkout's own replay check returns long before this point; this is the backstop.
                v_loyalty_result := public.redeem_loyalty_points(
                    p_store_id,
                    p_buyer_account_id,
                    v_order_id,
                    v_loyalty_points_applied,
                    'loyalty.redemption:' || v_order_id::TEXT,
                    v_loyalty_residual_minor,
                    p_request_id,
                    p_actor_id
                );
                v_loyalty_amount := COALESCE((v_loyalty_result ->> 'value_minor')::BIGINT, 0)::NUMERIC / 100;
            END IF;
        END IF;
    END IF;

    v_payment_due := GREATEST(v_grand_total - v_gift_card_amount - v_loyalty_amount, 0);

    UPDATE orders
       SET shipping_cost = v_shipping_amount,
           shipping_method = v_shipping_method,
           tax = v_tax_amount,
           place_of_supply_state = COALESCE(p_place_of_supply_state, place_of_supply_state),
           discount = v_discount_amount,
           total = v_payment_due,
           coupon_code = NULLIF(UPPER(BTRIM(COALESCE(p_coupon_code, ''))), ''),
           coupon_discount = v_discount_amount,
           currency = COALESCE(currency, 'INR'),
           payment_status = CASE WHEN v_payment_due = 0 THEN 'paid' ELSE payment_status END,
           status = CASE WHEN v_payment_due = 0 THEN 'confirmed' ELSE status END,
           updated_at = NOW()
     WHERE id = v_order_id;

    IF p_tax_lines IS NOT NULL AND jsonb_typeof(p_tax_lines) = 'array' AND jsonb_array_length(p_tax_lines) > 0 THEN
        FOR v_tax_line IN SELECT * FROM jsonb_array_elements(p_tax_lines)
        LOOP
            INSERT INTO order_tax_lines (
                site_id,
                order_id,
                title,
                rate,
                amount,
                jurisdiction,
                metadata,
                created_by
            )
            VALUES (
                p_store_id,
                v_order_id,
                v_tax_line ->> 'title',
                COALESCE((v_tax_line ->> 'rate')::NUMERIC, 0),
                COALESCE((v_tax_line ->> 'amount')::NUMERIC, 0),
                COALESCE(v_tax_line -> 'jurisdiction', '{}'::JSONB),
                jsonb_build_object('source', 'create_checkout_order'),
                p_actor_id
            );
        END LOOP;
    END IF;

    INSERT INTO checkout_sessions (
        site_id,
        order_id,
        customer_email,
        status,
        idempotency_key,
        subtotal,
        shipping_total,
        tax_total,
        discount_total,
        gift_card_total,
        grand_total,
        currency,
        shipping_method,
        payment_method,
        request_id,
        metadata,
        created_by
    )
    VALUES (
        p_store_id,
        v_order_id,
        p_customer_email,
        'completed',
        p_idempotency_key,
        COALESCE(v_order.subtotal, 0),
        v_shipping_amount,
        v_tax_amount,
        v_discount_amount,
        v_gift_card_amount,
        v_grand_total,
        COALESCE(v_order.currency, 'INR'),
        v_shipping_method,
        p_payment_method,
        p_request_id,
        jsonb_build_object('source', 'create_checkout_order', 'payment_due', v_payment_due, 'promotion', v_promotion),
        p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO order_shipping_lines (
        site_id,
        order_id,
        title,
        method,
        amount,
        metadata,
        created_by
    )
    VALUES (
        p_store_id,
        v_order_id,
        CASE WHEN v_shipping_method = 'express' THEN 'Express Shipping' ELSE 'Standard Shipping' END,
        v_shipping_method,
        v_shipping_amount,
        jsonb_build_object('computed_by', 'create_checkout_order', 'shipping_rate_id', p_shipping_rate_id),
        p_actor_id
    );

    IF v_discount_amount > 0 THEN
        INSERT INTO order_line_adjustments (
            site_id,
            order_id,
            adjustment_type,
            source_type,
            source_id,
            title,
            amount,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            v_order_id,
            'promotion',
            CASE WHEN (v_promotion ->> 'promotion_id') IS NOT NULL THEN 'promotion' ELSE 'coupon' END,
            COALESCE(NULLIF(v_promotion ->> 'promotion_id', '')::UUID, NULLIF(v_promotion ->> 'coupon_id', '')::UUID),
            COALESCE(v_promotion ->> 'title', 'Promotion'),
            v_discount_amount,
            v_promotion,
            p_actor_id
        );

        INSERT INTO promotion_redemptions (
            site_id,
            promotion_id,
            promotion_code_id,
            coupon_id,
            order_id,
            customer_email,
            code,
            amount,
            status,
            idempotency_key,
            request_id,
            metadata,
            created_by
        )
        VALUES (
            p_store_id,
            NULLIF(v_promotion ->> 'promotion_id', '')::UUID,
            NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID,
            NULLIF(v_promotion ->> 'coupon_id', '')::UUID,
            v_order_id,
            p_customer_email,
            v_promotion ->> 'code',
            v_discount_amount,
            'committed',
            'promotion.redemption:' || v_order_id::TEXT || ':' || COALESCE(v_promotion ->> 'code', 'unknown'),
            p_request_id,
            v_promotion,
            p_actor_id
        )
        ON CONFLICT (site_id, idempotency_key) DO NOTHING;

        UPDATE promotion_codes
           SET usage_count = usage_count + 1,
               updated_at = NOW()
         WHERE id = NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID;

        UPDATE coupons
           SET usage_count = COALESCE(usage_count, 0) + 1,
               updated_at = NOW()
         WHERE id = NULLIF(v_promotion ->> 'coupon_id', '')::UUID;

        INSERT INTO promotion_usage_counters (
            site_id,
            promotion_id,
            promotion_code_id,
            coupon_id,
            customer_email,
            usage_count
        )
        VALUES (
            p_store_id,
            NULLIF(v_promotion ->> 'promotion_id', '')::UUID,
            NULLIF(v_promotion ->> 'promotion_code_id', '')::UUID,
            NULLIF(v_promotion ->> 'coupon_id', '')::UUID,
            LOWER(p_customer_email),
            1
        )
        ON CONFLICT (site_id, promotion_id, promotion_code_id, coupon_id, customer_email)
        DO UPDATE SET usage_count = promotion_usage_counters.usage_count + 1,
                      updated_at = NOW();
    END IF;

    INSERT INTO payment_transactions (
        order_id,
        store_id,
        site_id,
        gateway,
        amount,
        currency,
        status,
        payment_method,
        metadata,
        request_id,
        idempotency_key,
        created_by,
        captured_at
    )
    VALUES (
        v_order_id,
        p_store_id,
        p_store_id,
        p_payment_method,
        v_payment_due,
        COALESCE(v_order.currency, 'INR'),
        CASE WHEN v_payment_due = 0 THEN 'captured' ELSE 'pending' END,
        p_payment_method,
        jsonb_build_object('source', 'checkout', 'gift_card_total', v_gift_card_amount),
        p_request_id,
        p_idempotency_key || ':payment',
        p_actor_id,
        CASE WHEN v_payment_due = 0 THEN NOW() ELSE NULL END
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_payment_transaction_id;

    INSERT INTO inventory_events (
        site_id,
        inventory_level_id,
        location_id,
        product_id,
        variant_id,
        order_id,
        reservation_id,
        event_type,
        quantity_delta,
        on_hand_quantity,
        available_quantity,
        committed_quantity,
        unavailable_quantity,
        incoming_quantity,
        reserved_quantity,
        safety_stock_quantity,
        source_type,
        source_id,
        idempotency_key,
        request_id,
        metadata,
        created_by
    )
    SELECT
        p_store_id,
        il.id,
        r.location_id,
        oi.product_id,
        NULLIF(oi.variant_id, '')::UUID,
        v_order_id,
        r.id,
        'sale_committed',
        -oi.quantity,
        COALESCE(il.on_hand_quantity, il.available + il.reserved),
        COALESCE(il.available_quantity, il.available),
        oi.quantity,
        COALESCE(il.unavailable_quantity, 0),
        COALESCE(il.incoming_quantity, il.incoming),
        COALESCE(il.reserved_quantity, il.reserved),
        COALESCE(il.safety_stock_quantity, 0),
        'order',
        v_order_id,
        'checkout.sale_committed:' || v_order_id::TEXT || ':' || oi.id::TEXT,
        p_request_id,
        jsonb_build_object('checkout_session_idempotency_key', p_idempotency_key),
        p_actor_id
      FROM order_items oi
      LEFT JOIN inventory_reservations r
        ON r.order_id = oi.order_id
       AND r.product_id = oi.product_id
       AND (
            (r.variant_id IS NULL AND NULLIF(oi.variant_id, '') IS NULL)
            OR r.variant_id = NULLIF(oi.variant_id, '')::UUID
       )
       AND r.deleted_at IS NULL
      LEFT JOIN inventory_levels il
        ON il.location_id = r.location_id
       AND il.product_id = oi.product_id
       AND (
            (il.variant_id IS NULL AND NULLIF(oi.variant_id, '') IS NULL)
            OR il.variant_id = NULLIF(oi.variant_id, '')::UUID
       )
     WHERE oi.order_id = v_order_id
       AND oi.deleted_at IS NULL
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO outbox_events (
        site_id,
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        trace_id,
        schema_version,
        actor_id
    )
    VALUES (
        p_store_id,
        p_store_id,
        'checkout',
        v_order_id::TEXT,
        'checkout.completed',
        jsonb_build_object(
            'site_id', p_store_id,
            'order_id', v_order_id,
            'payment_transaction_id', v_payment_transaction_id,
            'subtotal', COALESCE(v_order.subtotal, 0),
            'shipping_total', v_shipping_amount,
            'tax_total', v_tax_amount,
            'discount_total', v_discount_amount,
            'gift_card_total', v_gift_card_amount,
        'loyalty_total', v_loyalty_amount,
        'loyalty_points_applied', v_loyalty_points_applied,
            'grand_total', v_grand_total,
            'payment_due', v_payment_due,
            'schema_version', 1
        ),
        'checkout.completed:' || v_order_id::TEXT,
        p_request_id,
        p_request_id,
        1,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) item WHERE item ? 'cart_fact_ref') THEN
      UPDATE public.orders SET order_source='checkout',order_locked_at=coalesce(order_locked_at,now()) WHERE id=v_order_id AND store_id=p_store_id;
    END IF;
    SELECT to_jsonb(o)
      INTO v_order_json
      FROM orders o
     WHERE o.id = v_order_id;

    RETURN v_order_json;
END;
$function$;
DROP FUNCTION public.quote_storefront_checkout_totals(uuid,jsonb,jsonb,uuid,text,text);
DROP FUNCTION public.resolve_checkout_gst_v1(uuid,jsonb,jsonb,bigint,bigint,bigint);
DROP TRIGGER guard_order_tax_snapshot ON public.orders;
DROP TRIGGER guard_order_item_tax_snapshot ON public.order_items;
DROP FUNCTION public.guard_checkout_tax_snapshot_v1();
ALTER TABLE public.orders DROP COLUMN tax_snapshot;
ALTER TABLE public.order_items DROP COLUMN tax_snapshot;
CREATE OR REPLACE FUNCTION public.create_storefront_checkout_order_with_delivery_rate(
  p_store_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_items jsonb,
  p_payment_method text,
  p_notes text,
  p_coupon_code text,
  p_gift_card_code text,
  p_shipping_method text,
  p_idempotency_key text,
  p_actor_id uuid,
  p_request_id text,
  p_shipping_rate_id uuid,
  p_tax_amount numeric,
  p_place_of_supply_state text,
  p_tax_lines jsonb,
  p_buyer_account_id uuid,
  p_buyer_session_epoch integer,
  p_expected_shipping_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_rate record;
  v_shipping_amount numeric(10,2);
  v_subtotal numeric(12,2);
  v_country text := lower(btrim(coalesce(p_shipping_address ->> 'country', '')));
  v_state text := lower(btrim(coalesce(p_shipping_address ->> 'state', '')));
  v_state_code text := lower(btrim(coalesce(p_shipping_address ->> 'state_code', '')));
  v_pincode text := btrim(coalesce(p_shipping_address ->> 'zip', p_shipping_address ->> 'pincode', ''));
BEGIN
  IF p_shipping_rate_id IS NULL OR p_expected_shipping_amount IS NULL
     OR p_expected_shipping_amount < 0 OR round(p_expected_shipping_amount, 2) <> p_expected_shipping_amount THEN
    RAISE EXCEPTION 'storefront delivery rate quote is incomplete' USING ERRCODE = '22023';
  END IF;
  IF v_country NOT IN ('in', 'india') OR v_pincode !~ '^[1-9][0-9]{5}$' OR v_state = '' THEN
    RAISE EXCEPTION 'storefront delivery address is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT sr.type, sr.price, sr.min_order_amount, sr.max_order_amount,
         sr.cod_enabled AS rate_cod_enabled,
         sz.countries, sz.states, sz.zip_codes, sz.cod_enabled AS zone_cod_enabled
    INTO v_rate
    FROM public.shipping_rates sr
    JOIN public.shipping_zones sz ON sz.id = sr.zone_id
   WHERE sr.id = p_shipping_rate_id
     AND sr.site_id = p_store_id
     AND sz.store_id = p_store_id
     AND sz.site_id = p_store_id
     AND sr.is_active IS TRUE
     AND sr.deleted_at IS NULL
     AND sz.deleted_at IS NULL
   FOR SHARE OF sr, sz;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'storefront delivery rate is no longer available' USING ERRCODE = '23514';
  END IF;

  IF (p_payment_method = 'cod'
      AND (v_rate.rate_cod_enabled IS DISTINCT FROM true OR v_rate.zone_cod_enabled IS DISTINCT FROM true)) THEN
    RAISE EXCEPTION 'storefront delivery rate does not support COD' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
       SELECT 1 FROM unnest(coalesce(v_rate.countries, ARRAY[]::text[])) AS country(value)
        WHERE lower(btrim(country.value)) IN ('in', 'india')
     )
     OR (coalesce(cardinality(v_rate.states), 0) > 0 AND NOT EXISTS (
       SELECT 1 FROM unnest(v_rate.states) AS state(value)
        WHERE lower(btrim(state.value)) IN (v_state, v_state_code)
     ))
     OR (coalesce(cardinality(v_rate.zip_codes), 0) > 0 AND NOT (v_pincode = ANY(v_rate.zip_codes))) THEN
    RAISE EXCEPTION 'storefront delivery rate does not cover this address' USING ERRCODE = '23514';
  END IF;
  IF v_rate.type IS NULL OR v_rate.type NOT IN ('flat', 'free', 'price_based') THEN
    RAISE EXCEPTION 'storefront delivery rate type is unsupported' USING ERRCODE = '23514';
  END IF;

  SELECT coalesce(sum(
      coalesce(nullif(pv.price, 0), p.price, 0) * (item.value ->> 'quantity')::numeric
    ), 0)
    INTO v_subtotal
    FROM jsonb_array_elements(p_items) AS item(value)
    JOIN public.products p
      ON p.id = (item.value ->> 'product_id')::uuid
     AND p.store_id = p_store_id
     AND p.deleted_at IS NULL
    LEFT JOIN public.product_variants pv
      ON pv.id = nullif(item.value ->> 'variant_id', '')::uuid
     AND pv.product_id = p.id;
  IF (v_rate.min_order_amount IS NOT NULL AND v_subtotal < v_rate.min_order_amount)
     OR (v_rate.max_order_amount IS NOT NULL AND v_subtotal > v_rate.max_order_amount) THEN
    RAISE EXCEPTION 'storefront delivery rate subtotal range changed' USING ERRCODE = '23514';
  END IF;

  v_shipping_amount := CASE WHEN v_rate.type = 'free' THEN 0 ELSE coalesce(v_rate.price, 0) END;
  IF round(v_shipping_amount, 2) IS DISTINCT FROM round(p_expected_shipping_amount, 2) THEN
    RAISE EXCEPTION 'storefront delivery rate quote changed before order creation' USING ERRCODE = '23514';
  END IF;

  IF p_buyer_account_id IS NOT NULL THEN
    IF p_buyer_session_epoch IS NULL THEN
      RAISE EXCEPTION 'buyer session epoch is required' USING ERRCODE = '22023';
    END IF;
    RETURN public.create_checkout_order_for_buyer(
      p_buyer_account_id, p_buyer_session_epoch, p_store_id,
      p_customer_name, p_customer_email, p_customer_phone, p_shipping_address,
      p_items, p_payment_method, p_notes, p_coupon_code, p_gift_card_code,
      p_shipping_method, p_idempotency_key, p_actor_id, p_request_id,
      p_shipping_rate_id, p_tax_amount, p_place_of_supply_state, p_tax_lines, NULL
    );
  END IF;

  RETURN public.create_checkout_order(
    p_store_id, p_customer_name, p_customer_email, p_customer_phone,
    p_shipping_address, p_items, p_payment_method, p_notes, p_coupon_code,
    p_gift_card_code, p_shipping_method, p_idempotency_key, p_actor_id,
    p_request_id, p_shipping_rate_id, p_tax_amount, p_place_of_supply_state,
    p_tax_lines
  );
END;
$function$;

DROP FUNCTION public.list_storefront_shipping_options(uuid,jsonb,jsonb);
DROP FUNCTION public.resolve_storefront_shipping_v1(uuid,jsonb,jsonb,uuid,boolean);
DROP FUNCTION public.checkout_gst_state_code_v1(text);
ALTER TABLE public.shipping_rates DROP CONSTRAINT shipping_rate_reviewed_ranges_v1;
CREATE OR REPLACE FUNCTION public.create_marketplace_checkout_order(
  p_store_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_items jsonb,
  p_payment_method text,
  p_notes text DEFAULT NULL,
  p_coupon_code text DEFAULT NULL,
  p_gift_card_code text DEFAULT NULL,
  p_shipping_method text DEFAULT 'standard',
  p_idempotency_key text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_shipping_rate_id uuid DEFAULT NULL,
  p_tax_amount numeric DEFAULT NULL,
  p_place_of_supply_state text DEFAULT NULL,
  p_tax_lines jsonb DEFAULT NULL,
  p_buyer_account_id uuid DEFAULT NULL,
  p_buyer_session_epoch integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_line record;
  v_listing record;
  v_fingerprint text;
  v_items jsonb := '[]'::jsonb;
  v_order jsonb;
  v_order_id uuid;
  v_existing_order_id uuid;
  v_purchase_channel text;
  v_expected_count integer := 0;
  v_bound_count integer := 0;
  v_duplicate_count integer := 0;
BEGIN
  IF p_store_id IS NULL OR p_idempotency_key IS NULL OR btrim(p_idempotency_key) = ''
     OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'marketplace checkout identity and items are required' USING ERRCODE = '22023';
  END IF;
  IF p_buyer_account_id IS NULL AND p_buyer_session_epoch IS NOT NULL
     OR p_buyer_account_id IS NOT NULL AND p_buyer_session_epoch IS NULL THEN
    RAISE EXCEPTION 'marketplace buyer session binding is incomplete' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_duplicate_count
    FROM (
      SELECT value ->> 'product_id' AS product_id,
             COALESCE(value ->> 'variant_id', '') AS variant_id
        FROM jsonb_array_elements(p_items)
       GROUP BY value ->> 'product_id', COALESCE(value ->> 'variant_id', ''),
         coalesce(value->'cart_fact_ref'->>'configuration_fingerprint',''),coalesce(value->>'marketplace_listing_id','')
      HAVING count(*) > 1
    ) duplicates;
  IF v_duplicate_count > 0 THEN
    RAISE EXCEPTION 'marketplace checkout has duplicate product variants' USING ERRCODE = '22023';
  END IF;

  -- Use the canonical order lock before taking listing locks, matching the storefront writer's
  -- lock order and making origin/listing binding safe under concurrent retries.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':' || p_idempotency_key, 0));
  SELECT order_id INTO v_existing_order_id
    FROM public.checkout_sessions
   WHERE site_id = p_store_id AND idempotency_key = p_idempotency_key AND deleted_at IS NULL
   LIMIT 1;

  IF v_existing_order_id IS NOT NULL THEN
    SELECT p.channel INTO v_purchase_channel FROM public.orders o JOIN public.purchases p ON p.id=o.purchase_id
      WHERE o.id=v_existing_order_id AND o.store_id=p_store_id AND o.deleted_at IS NULL;
    IF v_purchase_channel IS DISTINCT FROM 'marketplace' THEN RAISE EXCEPTION 'checkout idempotency key is already bound to another sales origin' USING ERRCODE='23505'; END IF;
    IF (SELECT jsonb_agg(jsonb_build_array(i->>'product_id',nullif(i->>'variant_id',''),(i->>'quantity')::integer,i->>'marketplace_listing_id')
        ORDER BY i->>'product_id',i->>'variant_id',i->>'marketplace_listing_id',(i->>'quantity')::integer) FROM jsonb_array_elements(p_items) i)
      IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_array(oi.product_id::text,nullif(oi.variant_id,''),oi.quantity,oi.marketplace_listing_id::text)
        ORDER BY oi.product_id::text,oi.variant_id,oi.marketplace_listing_id::text,oi.quantity) FROM public.order_items oi WHERE oi.order_id=v_existing_order_id AND oi.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'marketplace checkout retry item binding conflicts' USING ERRCODE='23505'; END IF;
    IF p_buyer_account_id IS NOT NULL THEN
      v_order := public.create_checkout_order_for_buyer(
        p_buyer_account_id,p_buyer_session_epoch,p_store_id,p_customer_name,p_customer_email,p_customer_phone,p_shipping_address,p_items,
        p_payment_method,p_notes,p_coupon_code,p_gift_card_code,p_shipping_method,p_idempotency_key,p_actor_id,p_request_id,
        p_shipping_rate_id,p_tax_amount,p_place_of_supply_state,p_tax_lines,NULL);
    ELSE
      v_order := public.create_checkout_order(p_store_id,p_customer_name,p_customer_email,p_customer_phone,p_shipping_address,p_items,
        p_payment_method,p_notes,p_coupon_code,p_gift_card_code,p_shipping_method,p_idempotency_key,p_actor_id,p_request_id,
        p_shipping_rate_id,p_tax_amount,p_place_of_supply_state,p_tax_lines,NULL,NULL);
    END IF;
    RETURN v_order;
  END IF;

  -- Lock cart capabilities in deterministic order before product/inventory locks.
  PERFORM c.id FROM public.carts c WHERE c.store_id=p_store_id AND c.id IN
    (SELECT (i->'cart_fact_ref'->>'cart_id')::uuid FROM jsonb_array_elements(p_items) i WHERE i ? 'cart_fact_ref')
    ORDER BY c.id FOR UPDATE;
  PERFORM il.id FROM public.inventory_levels il WHERE il.store_id=p_store_id AND il.product_id IN
    (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(p_items) i) ORDER BY il.id FOR UPDATE;
  PERFORM pv.id FROM public.product_variants pv JOIN public.products p ON p.id=pv.product_id
    WHERE p.store_id=p_store_id AND pv.product_id IN (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(p_items) i)
    ORDER BY pv.id FOR UPDATE OF pv;
  PERFORM po.id FROM public.product_options po JOIN public.products p ON p.id=po.product_id
    WHERE p.store_id=p_store_id AND po.product_id IN (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(p_items) i)
    ORDER BY po.id FOR UPDATE OF po;
  PERFORM p.id FROM public.products p WHERE p.store_id=p_store_id AND p.id IN
    (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(p_items) i) ORDER BY p.id FOR UPDATE;

  FOR v_line IN
    SELECT value, ordinality FROM jsonb_array_elements(p_items) WITH ORDINALITY AS item(value, ordinality)
  LOOP
    v_expected_count := v_expected_count + 1;
    IF jsonb_typeof(v_line.value) IS DISTINCT FROM 'object'
       OR NULLIF(v_line.value ->> 'marketplace_listing_id', '') IS NULL
       OR NULLIF(v_line.value ->> 'product_id', '') IS NULL
       OR COALESCE((v_line.value ->> 'quantity')::integer, 0) < 1 THEN
      RAISE EXCEPTION 'marketplace checkout item is missing listing identity' USING ERRCODE = '22023';
    END IF;

    -- Cart/inventory/variant/options/product locks above match385 and the inner writer.
    -- Retain the existing site/publication and approved-listing checks under these locks.
    SELECT p.id, p.site_id, p.is_active, p.deleted_at, s.status AS site_status,
           s.deleted_at AS site_deleted_at
      INTO v_listing
      FROM public.products p
      JOIN public.sites s ON s.id = p.site_id
     WHERE p.id = (v_line.value ->> 'product_id')::uuid
       AND p.store_id = p_store_id
     FOR SHARE OF p, s;

    IF NOT FOUND OR v_listing.site_id <> p_store_id OR v_listing.is_active IS DISTINCT FROM true
       OR v_listing.deleted_at IS NOT NULL OR v_listing.site_status <> 'published'
       OR v_listing.site_deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'marketplace listing is unavailable for checkout' USING ERRCODE = '23514';
    END IF;

    SELECT cl.id, cl.site_id, cl.product_id, cl.channel, cl.status, cl.visibility,
           cl.approved_product_fingerprint
      INTO v_listing
      FROM public.channel_listings cl
     WHERE cl.id = (v_line.value ->> 'marketplace_listing_id')::uuid
     FOR SHARE;

    IF NOT FOUND OR v_listing.site_id <> p_store_id OR v_listing.product_id <> (v_line.value ->> 'product_id')::uuid
       OR v_listing.channel <> 'marketplace' OR v_listing.status <> 'approved' OR v_listing.visibility <> 'public'
       OR v_listing.approved_product_fingerprint IS NULL THEN
      RAISE EXCEPTION 'marketplace listing is unavailable for checkout' USING ERRCODE = '23514';
    END IF;

    v_fingerprint := public.marketplace_listing_review_fingerprint(v_listing.id);
    IF v_fingerprint IS NULL OR v_fingerprint IS DISTINCT FROM v_listing.approved_product_fingerprint THEN
      RAISE EXCEPTION 'marketplace listing revision is no longer approved' USING ERRCODE = '23514';
    END IF;

    v_items := v_items || jsonb_build_array(
      jsonb_set(v_line.value, '{marketplace_approved_fingerprint}', to_jsonb(v_fingerprint), true)
    );
  END LOOP;

  IF p_buyer_account_id IS NOT NULL THEN
    v_order := public.create_checkout_order_for_buyer(
      p_buyer_account_id, p_buyer_session_epoch, p_store_id, p_customer_name, p_customer_email,
      p_customer_phone, p_shipping_address, v_items, p_payment_method, p_notes, p_coupon_code,
      p_gift_card_code, p_shipping_method, p_idempotency_key, p_actor_id, p_request_id,
      p_shipping_rate_id, p_tax_amount, p_place_of_supply_state, p_tax_lines, NULL
    );
  ELSE
    v_order := public.create_checkout_order(
      p_store_id, p_customer_name, p_customer_email, p_customer_phone, p_shipping_address,
      v_items, p_payment_method, p_notes, p_coupon_code, p_gift_card_code, p_shipping_method,
      p_idempotency_key, p_actor_id, p_request_id, p_shipping_rate_id, p_tax_amount,
      p_place_of_supply_state, p_tax_lines, NULL, NULL
    );
  END IF;

  v_order_id := NULLIF(v_order ->> 'id', '')::uuid;
  IF v_order_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.orders WHERE id = v_order_id AND store_id = p_store_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'canonical marketplace checkout returned an invalid order' USING ERRCODE = '23514';
  END IF;

  IF v_existing_order_id IS NOT NULL AND v_existing_order_id <> v_order_id THEN
    RAISE EXCEPTION 'marketplace checkout idempotency binding changed' USING ERRCODE = '23505';
  END IF;

  IF v_existing_order_id IS NOT NULL THEN
    SELECT p.channel INTO v_purchase_channel
      FROM public.orders o JOIN public.purchases p ON p.id = o.purchase_id
     WHERE o.id = v_order_id AND o.store_id = p_store_id;
    IF v_purchase_channel IS DISTINCT FROM 'marketplace' THEN
      RAISE EXCEPTION 'checkout idempotency key is already bound to another sales origin' USING ERRCODE = '23505';
    END IF;
    SELECT count(*) INTO v_bound_count
      FROM public.order_items oi
      JOIN jsonb_to_recordset(v_items) AS item(product_id uuid, variant_id text, quantity integer, marketplace_listing_id uuid, marketplace_approved_fingerprint text, cart_fact_ref jsonb)
        ON oi.product_id = item.product_id
       AND oi.variant_id IS NOT DISTINCT FROM item.variant_id
       AND oi.quantity = item.quantity
       AND coalesce(oi.product_snapshot->>'cart_id','')=coalesce(item.cart_fact_ref->>'cart_id','')
       AND coalesce(oi.product_snapshot->>'cart_line_id','')=coalesce(item.cart_fact_ref->>'line_id','')
       AND coalesce(oi.product_snapshot->>'configuration_fingerprint','')=coalesce(item.cart_fact_ref->>'configuration_fingerprint','')
       AND coalesce(oi.product_snapshot->>'snapshot_fingerprint','')=coalesce(item.cart_fact_ref->>'snapshot_fingerprint','')
       AND oi.marketplace_listing_id = item.marketplace_listing_id
       AND oi.marketplace_approved_fingerprint = item.marketplace_approved_fingerprint
     WHERE oi.order_id = v_order_id;
    IF v_bound_count <> v_expected_count THEN
      RAISE EXCEPTION 'marketplace checkout retry item binding conflicts' USING ERRCODE = '23505';
    END IF;
  ELSE
    UPDATE public.purchases SET channel = 'marketplace'
     WHERE id = (SELECT purchase_id FROM public.orders WHERE id = v_order_id)
       AND origin_site_id = p_store_id AND idempotency_key = p_idempotency_key AND channel = 'storefront';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'marketplace checkout purchase origin could not be bound' USING ERRCODE = '23514';
    END IF;

    PERFORM set_config('app.marketplace_order_creation', 'on', true);
    UPDATE public.order_items oi
       SET marketplace_listing_id = item.marketplace_listing_id,
           marketplace_approved_fingerprint = item.marketplace_approved_fingerprint
      FROM jsonb_to_recordset(v_items) AS item(product_id uuid, variant_id text, quantity integer, marketplace_listing_id uuid, marketplace_approved_fingerprint text, cart_fact_ref jsonb)
     WHERE oi.order_id = v_order_id
       AND oi.product_id = item.product_id
       AND oi.variant_id IS NOT DISTINCT FROM item.variant_id
       AND oi.quantity = item.quantity
       AND coalesce(oi.product_snapshot->>'cart_id','')=coalesce(item.cart_fact_ref->>'cart_id','')
       AND coalesce(oi.product_snapshot->>'cart_line_id','')=coalesce(item.cart_fact_ref->>'line_id','')
       AND coalesce(oi.product_snapshot->>'configuration_fingerprint','')=coalesce(item.cart_fact_ref->>'configuration_fingerprint','')
       AND coalesce(oi.product_snapshot->>'snapshot_fingerprint','')=coalesce(item.cart_fact_ref->>'snapshot_fingerprint','');
    GET DIAGNOSTICS v_bound_count = ROW_COUNT;
    PERFORM set_config('app.marketplace_order_creation', '', true);
    IF v_bound_count <> v_expected_count THEN
      RAISE EXCEPTION 'marketplace checkout order lines could not be bound to approved listings' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN v_order;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_marketplace_checkout_order_with_delivery_rate(
  p_store_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_items jsonb,
  p_payment_method text,
  p_notes text DEFAULT NULL,
  p_coupon_code text DEFAULT NULL,
  p_gift_card_code text DEFAULT NULL,
  p_shipping_method text DEFAULT 'standard',
  p_idempotency_key text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_shipping_rate_id uuid DEFAULT NULL,
  p_tax_amount numeric DEFAULT NULL,
  p_place_of_supply_state text DEFAULT NULL,
  p_tax_lines jsonb DEFAULT NULL,
  p_buyer_account_id uuid DEFAULT NULL,
  p_buyer_session_epoch integer DEFAULT NULL,
  p_expected_shipping_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_rate record;
  v_shipping_amount numeric(10,2);
  v_country text := lower(btrim(coalesce(p_shipping_address ->> 'country', '')));
  v_state text := lower(btrim(coalesce(p_shipping_address ->> 'state', '')));
  v_state_code text := lower(btrim(coalesce(p_shipping_address ->> 'state_code', '')));
  v_pincode text := btrim(coalesce(p_shipping_address ->> 'zip', p_shipping_address ->> 'pincode', ''));
BEGIN
  IF p_shipping_rate_id IS NULL OR p_expected_shipping_amount IS NULL
     OR p_expected_shipping_amount < 0 OR round(p_expected_shipping_amount, 2) <> p_expected_shipping_amount THEN
    RAISE EXCEPTION 'marketplace delivery rate quote is incomplete' USING ERRCODE = '22023';
  END IF;
  IF v_country NOT IN ('in', 'india') OR v_pincode !~ '^[1-9][0-9]{5}$' OR v_state = '' THEN
    RAISE EXCEPTION 'marketplace delivery address is invalid' USING ERRCODE = '22023';
  END IF;

  SELECT sr.type, sr.price, sr.cod_enabled AS rate_cod_enabled,
         sz.countries, sz.states, sz.zip_codes, sz.cod_enabled AS zone_cod_enabled
    INTO v_rate
    FROM public.shipping_rates sr
    JOIN public.shipping_zones sz ON sz.id = sr.zone_id
   WHERE sr.id = p_shipping_rate_id
     AND sr.site_id = p_store_id
     AND sz.store_id = p_store_id
     AND sz.site_id = p_store_id
     AND sr.is_active IS TRUE
     AND sr.deleted_at IS NULL
     AND sz.deleted_at IS NULL
   FOR SHARE OF sr, sz;
  IF NOT FOUND OR v_rate.rate_cod_enabled IS DISTINCT FROM true
     OR v_rate.zone_cod_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'marketplace delivery rate is no longer available' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
       SELECT 1 FROM unnest(coalesce(v_rate.countries, ARRAY[]::text[])) AS country(value)
        WHERE lower(btrim(country.value)) IN ('in', 'india')
     )
     OR (coalesce(cardinality(v_rate.states), 0) > 0 AND NOT EXISTS (
       SELECT 1 FROM unnest(v_rate.states) AS state(value)
        WHERE lower(btrim(state.value)) IN (v_state, v_state_code)
     ))
     OR (coalesce(cardinality(v_rate.zip_codes), 0) > 0 AND NOT (v_pincode = ANY(v_rate.zip_codes))) THEN
    RAISE EXCEPTION 'marketplace delivery rate does not cover this address' USING ERRCODE = '23514';
  END IF;

  IF v_rate.type IS NULL OR v_rate.type NOT IN ('flat', 'free', 'price_based') THEN
    RAISE EXCEPTION 'marketplace delivery rate type is not supported for checkout' USING ERRCODE = '23514';
  END IF;
  v_shipping_amount := CASE WHEN v_rate.type = 'free' THEN 0 ELSE coalesce(v_rate.price, 0) END;
  IF round(v_shipping_amount, 2) IS DISTINCT FROM round(p_expected_shipping_amount, 2) THEN
    RAISE EXCEPTION 'marketplace delivery rate quote changed before order creation' USING ERRCODE = '23514';
  END IF;

  RETURN public.create_marketplace_checkout_order(
    p_store_id, p_customer_name, p_customer_email, p_customer_phone,
    p_shipping_address, p_items, p_payment_method, p_notes, p_coupon_code,
    p_gift_card_code, p_shipping_method, p_idempotency_key, p_actor_id,
    p_request_id, p_shipping_rate_id, p_tax_amount, p_place_of_supply_state,
    p_tax_lines, p_buyer_account_id, p_buyer_session_epoch
  );
END;
$function$;

COMMIT;
