-- 177_v1_founding_program_rpcs.sql
-- V1 Commercial Launch — Founding Merchant Program RPCs (SECURITY DEFINER).
--
-- All business logic + locking lives here (the gateway adapters are thin callers,
-- honoring their runtime-bridge "no business-sequencing" contract). Every function:
--   * SECURITY DEFINER, search_path pinned to 'public'
--   * race-safe: serialized on the singleton via SELECT ... FOR UPDATE
--   * idempotent: re-runs are no-ops returning existing state
--   * non-fatal: callers must treat a {allocated:false} result as success of the
--     paid subscription (allocation NEVER rolls back billing)
--   * emits domain events ATOMICALLY by inserting into outbox_events in the same txn
--     (event_type is free-text at the DB layer; the TS contract validator is bypassed
--      intentionally so the event is transactional with the state change).
--
-- Canonical eligibility: docs/v1/FOUNDING_ALLOCATION_DEFINITION.md
-- Price-lock proof:       docs/v1/PRICE_LOCK_VERIFICATION.md
-- CREATE OR REPLACE only; additive + replayable. Tables/RLS are from migration 176.

-- ----------------------------------------------------------------------------
-- Internal helper: append a founding domain event to the outbox (atomic).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_founding_event(
    p_site_id uuid,
    p_event_type text,
    p_idempotency_key text,
    p_payload jsonb,
    p_actor_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO outbox_events (
        store_id, site_id, aggregate_type, aggregate_id, event_type,
        payload, idempotency_key, actor_id, schema_version
    ) VALUES (
        p_site_id, p_site_id, 'founding', p_site_id::text, p_event_type,
        COALESCE(p_payload, '{}'::jsonb), p_idempotency_key, p_actor_id, 1
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

-- ----------------------------------------------------------------------------
-- allocate_founding_merchant — race-safe, idempotent, non-fatal allocation.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.allocate_founding_merchant(
    p_site_id uuid,
    p_subscription_id uuid DEFAULT NULL,
    p_idempotency_key text DEFAULT NULL,
    p_actor_id uuid DEFAULT NULL,
    p_actor_type text DEFAULT 'system',
    p_force boolean DEFAULT false,
    p_source_override text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_program founding_merchant_program%ROWTYPE;
    v_existing founding_merchant_allocations%ROWTYPE;
    v_sub subscriptions%ROWTYPE;
    v_site sites%ROWTYPE;
    v_source text;
    v_number integer;
    v_plan_slug text;
    v_locked_monthly integer;
BEGIN
    IF p_site_id IS NULL THEN
        RAISE EXCEPTION 'p_site_id is required';
    END IF;

    -- Serialize ALL allocations on the singleton program row (race-safe core).
    SELECT * INTO v_program FROM founding_merchant_program
        WHERE program_key = 'v1' AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('allocated', false, 'reason', 'program_not_found');
    END IF;

    -- Idempotent replay (inside the serialized section): already allocated → return it.
    SELECT * INTO v_existing FROM founding_merchant_allocations
        WHERE site_id = p_site_id AND released_at IS NULL LIMIT 1;
    IF FOUND THEN
        RETURN jsonb_build_object('allocated', true, 'replayed', true,
            'founding_number', v_existing.founding_number,
            'allocation_source', v_existing.allocation_source,
            'plan_slug', v_existing.plan_slug,
            'locked_monthly_price', v_existing.locked_monthly_price);
    END IF;

    IF NOT v_program.active OR v_program.paused THEN
        RETURN jsonb_build_object('allocated', false, 'reason',
            CASE WHEN v_program.paused THEN 'program_paused' ELSE 'program_inactive' END);
    END IF;
    IF v_program.used_slots >= v_program.total_slots THEN
        RETURN jsonb_build_object('allocated', false, 'reason', 'program_full');
    END IF;

    SELECT * INTO v_site FROM sites WHERE id = p_site_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('allocated', false, 'reason', 'site_not_found');
    END IF;

    IF p_subscription_id IS NOT NULL THEN
        SELECT * INTO v_sub FROM subscriptions WHERE id = p_subscription_id;
    ELSE
        SELECT * INTO v_sub FROM subscriptions
            WHERE store_id = p_site_id AND status = 'active'
            ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- Canonical eligibility (unless admin force): active + paid + trial_status=paid.
    IF NOT p_force THEN
        IF v_sub.id IS NULL OR v_sub.status <> 'active'
           OR COALESCE(v_sub.amount_paid, 0) <= 0
           OR v_site.trial_status <> 'paid' THEN
            RETURN jsonb_build_object('allocated', false, 'reason', 'not_eligible');
        END IF;
    END IF;

    -- Plan must be founding-eligible (launch/growth).
    v_plan_slug := COALESCE(v_sub.plan, '');
    IF v_plan_slug NOT IN ('launch', 'growth') THEN
        IF p_force THEN
            v_plan_slug := 'launch';
        ELSE
            RETURN jsonb_build_object('allocated', false, 'reason', 'plan_not_eligible');
        END IF;
    END IF;

    -- Resolve source + enforce per-pool cap.
    v_source := COALESCE(NULLIF(p_source_override, ''), v_site.intended_allocation_source, 'PUBLIC');
    IF v_source NOT IN ('PUBLIC', 'INVITED', 'PARTNER') THEN
        v_source := 'PUBLIC';
    END IF;
    IF v_source = 'PUBLIC' AND v_program.public_used >= v_program.public_slots THEN
        RETURN jsonb_build_object('allocated', false, 'reason', 'public_pool_full');
    ELSIF v_source = 'INVITED' AND v_program.invited_used >= v_program.invited_slots THEN
        RETURN jsonb_build_object('allocated', false, 'reason', 'invited_pool_full');
    ELSIF v_source = 'PARTNER' AND v_program.partner_used >= v_program.partner_slots THEN
        RETURN jsonb_build_object('allocated', false, 'reason', 'partner_pool_full');
    END IF;

    -- Monotonic join-order badge number (never reused; gaps from reclaims preserved).
    SELECT COALESCE(MAX(founding_number), 0) + 1 INTO v_number FROM founding_merchant_allocations;
    v_locked_monthly := CASE WHEN v_plan_slug = 'growth' THEN v_program.growth_price ELSE v_program.launch_price END;

    INSERT INTO founding_merchant_allocations (
        program_key, site_id, founding_number, allocation_source, subscription_id, plan_slug,
        locked_launch_price, locked_growth_price, locked_monthly_price,
        actor_type, actor_id, created_by
    ) VALUES (
        'v1', p_site_id, v_number, v_source, v_sub.id, v_plan_slug,
        v_program.launch_price, v_program.growth_price, v_locked_monthly,
        p_actor_type, p_actor_id, p_actor_id
    );

    UPDATE founding_merchant_program SET
        used_slots = used_slots + 1,
        public_used = public_used + CASE WHEN v_source = 'PUBLIC' THEN 1 ELSE 0 END,
        invited_used = invited_used + CASE WHEN v_source = 'INVITED' THEN 1 ELSE 0 END,
        partner_used = partner_used + CASE WHEN v_source = 'PARTNER' THEN 1 ELSE 0 END,
        updated_at = now(), updated_by = p_actor_id
    WHERE program_key = 'v1';

    -- Stamp the tenant — the lock lives here and survives upgrade/downgrade/cancel/reactivate.
    UPDATE sites SET
        is_founding_merchant = true,
        founding_number = v_number,
        founding_allocated_at = now(),
        price_lock_enabled = true,
        locked_launch_price = v_program.launch_price,
        locked_growth_price = v_program.growth_price,
        allocation_source = v_source,
        updated_at = now()
    WHERE id = p_site_id;

    -- Atomic domain events.
    PERFORM public.emit_founding_event(p_site_id, 'founding_slot_allocated',
        'founding_slot_allocated:' || p_site_id::text || ':' || v_number::text,
        jsonb_build_object('site_id', p_site_id, 'founding_number', v_number,
            'allocation_source', v_source, 'plan_slug', v_plan_slug,
            'locked_monthly_price', v_locked_monthly), p_actor_id);
    PERFORM public.emit_founding_event(p_site_id, 'merchant_price_locked',
        'merchant_price_locked:' || p_site_id::text || ':' || v_number::text,
        jsonb_build_object('site_id', p_site_id, 'founding_number', v_number,
            'locked_launch_price', v_program.launch_price,
            'locked_growth_price', v_program.growth_price), p_actor_id);
    IF (v_program.used_slots + 1) >= v_program.total_slots THEN
        PERFORM public.emit_founding_event(p_site_id, 'founding_program_full',
            'founding_program_full:v1',
            jsonb_build_object('total_slots', v_program.total_slots), p_actor_id);
    END IF;

    RETURN jsonb_build_object('allocated', true, 'replayed', false,
        'founding_number', v_number, 'allocation_source', v_source,
        'plan_slug', v_plan_slug, 'locked_monthly_price', v_locked_monthly);
END;
$$;

-- ----------------------------------------------------------------------------
-- reclaim_founding_merchant — refund reclaim (auto ≤14d; admin force any time).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reclaim_founding_merchant(
    p_site_id uuid,
    p_reason text,
    p_actor_id uuid DEFAULT NULL,
    p_actor_type text DEFAULT 'system',
    p_force boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_program founding_merchant_program%ROWTYPE;
    v_alloc founding_merchant_allocations%ROWTYPE;
    v_within_window boolean;
BEGIN
    IF p_site_id IS NULL THEN
        RAISE EXCEPTION 'p_site_id is required';
    END IF;

    SELECT * INTO v_program FROM founding_merchant_program
        WHERE program_key = 'v1' FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('reclaimed', false, 'reason', 'program_not_found');
    END IF;

    SELECT * INTO v_alloc FROM founding_merchant_allocations
        WHERE site_id = p_site_id AND released_at IS NULL LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('reclaimed', false, 'reason', 'no_active_allocation');
    END IF;

    -- ≤14 days → reclaim. >14 days → retain historical founder (unless admin force).
    v_within_window := (now() - v_alloc.allocated_at) <= INTERVAL '14 days';
    IF NOT v_within_window AND NOT p_force THEN
        RETURN jsonb_build_object('reclaimed', false, 'reason', 'outside_14d_window',
            'founding_number', v_alloc.founding_number);
    END IF;

    UPDATE founding_merchant_allocations SET
        released_at = now(),
        release_reason = COALESCE(p_reason, 'refund'),
        founding_released = true,
        actor_type = p_actor_type, updated_by = p_actor_id, updated_at = now()
    WHERE id = v_alloc.id;

    UPDATE founding_merchant_program SET
        used_slots = GREATEST(used_slots - 1, 0),
        public_used = public_used - CASE WHEN v_alloc.allocation_source = 'PUBLIC' THEN 1 ELSE 0 END,
        invited_used = invited_used - CASE WHEN v_alloc.allocation_source = 'INVITED' THEN 1 ELSE 0 END,
        partner_used = partner_used - CASE WHEN v_alloc.allocation_source = 'PARTNER' THEN 1 ELSE 0 END,
        updated_at = now(), updated_by = p_actor_id
    WHERE program_key = 'v1';

    -- Clear the lock on the tenant (no longer a founder).
    UPDATE sites SET
        is_founding_merchant = false,
        founding_number = NULL,
        founding_allocated_at = NULL,
        price_lock_enabled = false,
        locked_launch_price = NULL,
        locked_growth_price = NULL,
        allocation_source = NULL,
        updated_at = now()
    WHERE id = p_site_id;

    PERFORM public.emit_founding_event(p_site_id, 'founding_slot_reclaimed',
        'founding_slot_reclaimed:' || v_alloc.id::text,
        jsonb_build_object('site_id', p_site_id, 'founding_number', v_alloc.founding_number,
            'allocation_source', v_alloc.allocation_source,
            'release_reason', COALESCE(p_reason, 'refund'),
            'released_at', now(), 'forced', p_force), p_actor_id);

    RETURN jsonb_build_object('reclaimed', true,
        'founding_number', v_alloc.founding_number,
        'allocation_source', v_alloc.allocation_source,
        'within_14d', v_within_window);
END;
$$;

-- ----------------------------------------------------------------------------
-- get_founding_program_public — non-PII counts for the public landing counter.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_founding_program_public()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v founding_merchant_program%ROWTYPE;
BEGIN
    SELECT * INTO v FROM founding_merchant_program WHERE program_key = 'v1' AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('available', false);
    END IF;
    RETURN jsonb_build_object(
        'available', true,
        'active', v.active,
        'paused', v.paused,
        'total_slots', v.total_slots,
        'used_slots', v.used_slots,
        'remaining_slots', v.remaining_slots,
        'public_remaining', GREATEST(v.public_slots - v.public_used, 0),
        'invited_remaining', GREATEST(v.invited_slots - v.invited_used, 0),
        'partner_remaining', GREATEST(v.partner_slots - v.partner_used, 0),
        'launch_price', v.launch_price,
        'growth_price', v.growth_price
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- set_founding_program_state — admin pause/resume/disable.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_founding_program_state(
    p_active boolean,
    p_paused boolean,
    p_reason text DEFAULT NULL,
    p_actor_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v founding_merchant_program%ROWTYPE;
BEGIN
    UPDATE founding_merchant_program SET
        active = COALESCE(p_active, active),
        paused = COALESCE(p_paused, paused),
        paused_reason = CASE WHEN COALESCE(p_paused, false) THEN p_reason ELSE NULL END,
        updated_at = now(), updated_by = p_actor_id, actor_type = 'super_admin'
    WHERE program_key = 'v1'
    RETURNING * INTO v;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'program_not_found');
    END IF;

    IF v.paused THEN
        PERFORM public.emit_founding_event(NULL, 'founding_program_paused',
            'founding_program_paused:v1:' || extract(epoch from now())::bigint::text,
            jsonb_build_object('reason', p_reason, 'active', v.active), p_actor_id);
    END IF;

    RETURN jsonb_build_object('ok', true, 'active', v.active, 'paused', v.paused);
END;
$$;

-- ----------------------------------------------------------------------------
-- resolve_merchant_locked_price — effective monthly INR for a site+plan.
--   Founder with price_lock_enabled → locked snapshot; else current catalog.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_merchant_locked_price(
    p_site_id uuid,
    p_plan_slug text
) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_site sites%ROWTYPE;
    v_catalog integer;
BEGIN
    SELECT * INTO v_site FROM sites WHERE id = p_site_id AND deleted_at IS NULL;
    IF FOUND AND v_site.price_lock_enabled THEN
        IF p_plan_slug = 'growth' AND v_site.locked_growth_price IS NOT NULL THEN
            RETURN v_site.locked_growth_price;
        ELSIF p_plan_slug = 'launch' AND v_site.locked_launch_price IS NOT NULL THEN
            RETURN v_site.locked_launch_price;
        END IF;
    END IF;

    SELECT price_monthly_inr INTO v_catalog FROM plans
        WHERE slug = p_plan_slug AND site_type = 'store' AND is_active = true
        ORDER BY version DESC LIMIT 1;
    RETURN COALESCE(v_catalog, 0);
END;
$$;

-- ----------------------------------------------------------------------------
-- reconcile_founding_program — drift detection (and optional repair).
--   Compares stored counters against actual active allocation rows.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_founding_program(p_repair boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v founding_merchant_program%ROWTYPE;
    v_actual_total integer;
    v_actual_public integer;
    v_actual_invited integer;
    v_actual_partner integer;
    v_mismatch boolean;
BEGIN
    SELECT * INTO v FROM founding_merchant_program WHERE program_key = 'v1' FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'program_not_found');
    END IF;

    SELECT
        count(*),
        count(*) FILTER (WHERE allocation_source = 'PUBLIC'),
        count(*) FILTER (WHERE allocation_source = 'INVITED'),
        count(*) FILTER (WHERE allocation_source = 'PARTNER')
    INTO v_actual_total, v_actual_public, v_actual_invited, v_actual_partner
    FROM founding_merchant_allocations WHERE released_at IS NULL;

    v_mismatch := (v.used_slots <> v_actual_total)
        OR (v.public_used <> v_actual_public)
        OR (v.invited_used <> v_actual_invited)
        OR (v.partner_used <> v_actual_partner);

    IF v_mismatch AND p_repair THEN
        UPDATE founding_merchant_program SET
            used_slots = v_actual_total,
            public_used = v_actual_public,
            invited_used = v_actual_invited,
            partner_used = v_actual_partner,
            updated_at = now()
        WHERE program_key = 'v1';
    END IF;

    RETURN jsonb_build_object(
        'status', CASE WHEN NOT v_mismatch THEN 'healthy'
                       WHEN p_repair THEN 'repaired' ELSE 'mismatch' END,
        'stored', jsonb_build_object('used', v.used_slots, 'public', v.public_used,
            'invited', v.invited_used, 'partner', v.partner_used),
        'actual', jsonb_build_object('used', v_actual_total, 'public', v_actual_public,
            'invited', v_actual_invited, 'partner', v_actual_partner),
        'repairable', v_mismatch
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- admin_repair_price_lock — re-sync sites lock columns from the active allocation
--   (fixes drift between the allocation ledger and the tenant snapshot).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_repair_price_lock(
    p_site_id uuid,
    p_actor_id uuid DEFAULT NULL,
    p_reason text DEFAULT 'price_lock_repair'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
    v_alloc founding_merchant_allocations%ROWTYPE;
BEGIN
    SELECT * INTO v_alloc FROM founding_merchant_allocations
        WHERE site_id = p_site_id AND released_at IS NULL LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'no_active_allocation');
    END IF;

    UPDATE sites SET
        is_founding_merchant = true,
        founding_number = v_alloc.founding_number,
        founding_allocated_at = v_alloc.allocated_at,
        price_lock_enabled = true,
        locked_launch_price = v_alloc.locked_launch_price,
        locked_growth_price = v_alloc.locked_growth_price,
        allocation_source = v_alloc.allocation_source,
        updated_at = now()
    WHERE id = p_site_id;

    PERFORM public.emit_founding_event(p_site_id, 'merchant_price_locked',
        'merchant_price_locked:repair:' || v_alloc.id::text || ':' || extract(epoch from now())::bigint::text,
        jsonb_build_object('site_id', p_site_id, 'founding_number', v_alloc.founding_number,
            'reason', p_reason, 'repaired', true), p_actor_id);

    RETURN jsonb_build_object('ok', true, 'founding_number', v_alloc.founding_number);
END;
$$;
