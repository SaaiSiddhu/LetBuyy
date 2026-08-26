-- T12: the TTL sweeper cannot see the inventory state the system actually uses.
--
-- create_order_with_inventory_reservations reserves ('active', TTL) and then
-- IMMEDIATELY commits ('committed', TTL no longer relevant) every reservation
-- synchronously at order creation, for BOTH payment rails -- before a prepaid
-- (razorpay) order has ever been paid. expire_inventory_reservations (141,
-- the existing TTL sweeper) only ever selects status IN ('active', 'hold'),
-- and release_inventory_reservation explicitly raises for any other status.
-- The result: a committed reservation behind an abandoned/failed/never-
-- attempted online payment has NO automatic release path. Proven empirically
-- in T11 (CAP-C43): backdating a committed reservation's expires_at and
-- calling the sweeper directly released 0 rows.
--
-- Decision (T12 W0/W1): committing at order creation is CORRECT for COD --
-- there is no future payment event to gate on; a COD order is a real
-- fulfilment commitment the moment it is placed, and the existing behaviour
-- is deliberate, not a bug. It is WRONG only for the razorpay rail, where the
-- customer has not paid yet. Rather than defer commit-at-creation for
-- razorpay orders (rejected: create_checkout_order is a named change-control
-- hotspot, and order_items / inventory_adjustments / inventory_events inside
-- it all assume commit-at-creation already happened -- splitting that apart
-- correctly is a bigger, riskier change than this phase's mandate), this adds
-- a second, additive sweep that extends the SAME TTL-release pattern to the
-- one state the original sweeper cannot see: a committed reservation whose
-- order is on the razorpay rail, still unpaid, not cancelled/refunded, and
-- past a grace period measured from the reservation's own commit time (a
-- fresh interval -- the original TTL was consumed by the near-instant
-- reserve->commit transition and is no longer meaningful once committed).
--
-- Reuses release_order_inventory_with_ledger (000_baseline.sql) rather than
-- inventing new release logic: it already correctly restores
-- inventory_levels.available for a committed reservation (no status filter
-- on its own UPDATE), is already idempotent (an orders-row FOR UPDATE lock
-- serializes concurrent calls for the same order, and an early
-- status = 'released' guard makes every call after the first a no-op), and
-- is the exact same path order cancellation already uses successfully. This
-- migration adds no new release mechanism -- only a new, additive way to
-- decide WHEN that existing mechanism should fire.
--
-- orders.inventory_released_at IS NULL is both the "not already released"
-- guard AND the reason this cannot race the payment-webhook release path
-- (T12 also flips services/webhook-service's markOrderFailed to call the
-- same underlying release on an explicit payment.failed signal): whichever
-- path runs first sets inventory_released_at and reservation status to
-- 'released', so the other path's WHERE clause simply no longer matches.
--
-- Note: while proving this migration's function actually releases a real
-- committed reservation end-to-end (T12 W3), release_order_inventory and
-- release_order_inventory_with_ledger (000_baseline.sql) turned out to be
-- completely broken -- a pre-existing uuid/text type mismatch that made
-- them fail on every invocation, for every order, on every existing release
-- path (cancellation, refund). Fixed separately in
-- 212_fix_release_order_inventory_variant_type_mismatch.sql, required for
-- this migration's function to work at all.
--
-- Existing data: 20 committed reservations against 15 unpaid orders (all
-- disclosed T8-T11 session test purchases) are NOT touched by this
-- migration's DDL. They become eligible for release the next time this
-- function runs (scheduled sweeper cadence, or the explicit calls made as
-- part of this phase's own W3 behavioural proof) -- ordinary flow, not a
-- special backfill step.
CREATE OR REPLACE FUNCTION public.expire_unpaid_committed_reservations(
  p_limit integer DEFAULT 100,
  p_grace_seconds integer DEFAULT 1800,
  p_request_id text DEFAULT NULL::text
)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_count integer := 0;
BEGIN
  -- No require_inventory_site_guc call: like expire_inventory_reservations,
  -- this is a scheduled background sweep across every tenant, not a
  -- per-request tenant-scoped operation -- consistent with the existing
  -- sweeper's own design in this same function group.
  FOR v_order_id IN
    SELECT o.id
      FROM public.orders o
     WHERE o.payment_method <> 'cod'
       AND o.payment_status IS DISTINCT FROM 'paid'
       AND o.status NOT IN ('cancelled', 'refunded')
       AND o.inventory_released_at IS NULL
       AND o.deleted_at IS NULL
       AND EXISTS (
         SELECT 1
           FROM public.inventory_reservations r
          WHERE r.order_id = o.id
            AND r.status = 'committed'
            AND r.deleted_at IS NULL
            AND r.committed_at IS NOT NULL
            AND r.committed_at <= now() - make_interval(
              secs => LEAST(GREATEST(COALESCE(p_grace_seconds, 1800), 60), 604800)
            )
       )
     ORDER BY o.id
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 1000)
     FOR UPDATE OF o SKIP LOCKED
  LOOP
    -- release_order_inventory_with_ledger re-locks this same orders row
    -- FOR UPDATE internally -- a transaction re-acquiring its own row lock
    -- is safe in Postgres, not a deadlock.
    PERFORM public.release_order_inventory_with_ledger(
      v_order_id,
      NULL,
      p_request_id,
      'ttl_expired_unpaid'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;
