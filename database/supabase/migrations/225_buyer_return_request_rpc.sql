-- 225: request_order_return -- a marketplace buyer opening a return on their OWN order.
-- CAP-FB-RETURNS, under D-9.
--
-- ============================================================================
-- WHY AN RPC AND NOT A ROUTE DOING THREE QUERIES
-- ============================================================================
-- The first cut of this did the work in TypeScript: read the buyer's links, read their store
-- customers, read the order, compare, check for an open return, insert. tenant-isolation-validator
-- flagged it, and the flag was CORRECT -- return_requests is a genuine tenant table that merchants
-- read through verifySiteOwnership, so it is nothing like buyer_store_customers, which tenant roles
-- are revoked from entirely.
--
-- The tempting fix was to assign `const db = getSupabaseAdmin(c)` first, because the validator's
-- pattern only matches a direct chain and routes/returns.ts already reads the table that way
-- undetected. That would have silenced the check WITHOUT CHANGING ANYTHING -- the exact dodge this
-- programme has argued against elsewhere, and it would have taught the next author the wrong shape.
--
-- The house pattern for a platform actor writing tenant data is a SECURITY DEFINER RPC:
-- create_checkout_order writes orders for a store the same way. So that is what this is.
--
-- It also fixes a REAL DEFECT the TypeScript version had, not just a lint complaint: checking for an
-- open return and then inserting is not atomic, so two concurrent taps could both pass the check and
-- create two pending returns for one order -- two queue entries for one dispute, and two chances to
-- refund it. The advisory lock below makes that impossible. This is the same class of bug migration
-- 206 fixed for checkout and that 213/215 silently reintroduced (CHK-0), so it is guarded rather than
-- assumed away.
--
-- ============================================================================
-- THE OWNERSHIP CHAIN
-- ============================================================================
-- orders has no customer FK, only customer_email, so ownership is:
--
--   p_buyer_account_id
--     -> buyer_store_customers   (platform-owned link, migration 223)
--     -> store_customers.email   (that buyer's identity at that seller)
--     -> orders (site_id, customer_email)
--
-- BOTH the seller and the email must match. Matching on email alone would let a buyer reach an
-- identically-addressed customer at a store they have never bought from -- and email collisions
-- across stores are ordinary, since store_customers is UNIQUE (store_id, email), not UNIQUE (email).
--
-- The function returns NULL rather than raising when the order is not the buyer's, so the caller
-- answers "not found" for both "no such order" and "not yours" and cannot become an oracle for
-- whether an order id exists.
--
-- Rollback: database/supabase/rollback/225_buyer_return_request_rpc.rollback.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.request_order_return(
  p_buyer_account_id uuid,
  p_order_id uuid,
  p_reason text,
  p_description text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  order_id uuid,
  reason text,
  description text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_order       RECORD;
  v_existing_id uuid;
  v_new_id      uuid;
BEGIN
  IF p_buyer_account_id IS NULL OR p_order_id IS NULL OR p_reason IS NULL THEN
    RAISE EXCEPTION 'buyer account, order and reason are required';
  END IF;

  -- Serialize per order. Without this, two concurrent requests both see no open return and both
  -- insert one. Keyed on the order because that is the thing a duplicate would be about.
  PERFORM pg_advisory_xact_lock(hashtextextended('return_request:' || p_order_id::text, 0));

  -- Ownership. Both predicates are required; see the header.
  SELECT o.id, o.site_id, o.customer_email
    INTO v_order
    FROM public.orders o
    JOIN public.store_customers sc
      ON sc.store_id = o.site_id
     AND lower(sc.email) = lower(o.customer_email)
    JOIN public.buyer_store_customers bsc
      ON bsc.store_customer_id = sc.id
     AND bsc.buyer_account_id = p_buyer_account_id
   WHERE o.id = p_order_id
   LIMIT 1;

  IF NOT FOUND THEN
    -- Not this buyer's order, or no such order. The caller cannot tell which, deliberately.
    RETURN;
  END IF;

  SELECT rr.id INTO v_existing_id
    FROM public.return_requests rr
   WHERE rr.order_id = v_order.id
     AND rr.status IN ('pending', 'approved', 'processing')
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'a return request is already open for this order'
      USING ERRCODE = '23505';
  END IF;

  -- status is written here, never taken from the caller. return_requests also carries
  -- refund_amount, approved_at, refunded_at, processed_by and admin_notes -- all merchant-owned, and
  -- none of them is a parameter of this function, so a buyer cannot file a return that is already
  -- refunded for an amount of their choosing.
  INSERT INTO public.return_requests (order_id, store_id, reason, description, status)
  VALUES (v_order.id, v_order.site_id, p_reason, nullif(btrim(coalesce(p_description, '')), ''), 'pending')
  RETURNING return_requests.id INTO v_new_id;

  RETURN QUERY
  SELECT rr.id, rr.order_id, rr.reason, rr.description, rr.status, rr.created_at
    FROM public.return_requests rr
   WHERE rr.id = v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_order_return(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_order_return(uuid, uuid, text, text) TO service_role;

COMMIT;
