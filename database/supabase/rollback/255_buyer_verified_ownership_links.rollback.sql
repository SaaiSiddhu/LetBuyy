-- Rollback of 255: remove verified buyer ownership and explicit order links.
--
-- DESTRUCTIVE, and deliberately so only where 255 created the data:
--   * buyer_order_links is dropped. Every order link recorded after 255 is lost, and ownership falls
--     back to 225's email chain, which is the unverified-takeover path 255 exists to close. Export the
--     table first if the rollback is meant to be temporary.
--   * buyer_store_customers loses link_basis and verified_at; the link rows themselves stay.
--   * buyer_accounts loses email_verified_at; email_verified stays.
-- Kept on purpose: every audit_logs row 255's functions wrote. The actor_type constraint returns to its
-- pre-255 list as NOT VALID, so those rows remain as evidence while new 'buyer' rows are refused.
--
-- Precondition: request_order_return(uuid, uuid, text, text) must be the live signature. Restoring it
-- replaces that exact function; if the signature has moved on, this file refuses rather than adding an
-- overload beside it (F-ROLLBACK-1).

BEGIN;

DO $rollback_precondition$
BEGIN
  IF to_regprocedure('public.request_order_return(uuid, uuid, text, text)') IS NULL THEN
    RAISE EXCEPTION 'rollback 255 expects public.request_order_return(uuid, uuid, text, text); the live signature differs, so restoring 225''s body would add an overload. Refusing.';
  END IF;
END;
$rollback_precondition$;

DROP FUNCTION IF EXISTS public.link_buyer_store_customer(uuid, uuid);
DROP FUNCTION IF EXISTS public.claim_buyer_orders(uuid, uuid);
DROP FUNCTION IF EXISTS public.resolve_buyer_store_customer_link(uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.resolve_buyer_order_link(uuid, uuid, uuid, text);

-- 225's body, restored verbatim.
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

DROP TABLE IF EXISTS public.buyer_order_links;

ALTER TABLE public.buyer_store_customers DROP CONSTRAINT IF EXISTS buyer_store_customers_verified_at_check;
ALTER TABLE public.buyer_store_customers DROP CONSTRAINT IF EXISTS buyer_store_customers_link_basis_check;
ALTER TABLE public.buyer_store_customers DROP COLUMN IF EXISTS verified_at;
ALTER TABLE public.buyer_store_customers DROP COLUMN IF EXISTS link_basis;

DROP TRIGGER IF EXISTS buyer_accounts_stamp_email_verified_at ON public.buyer_accounts;
DROP FUNCTION IF EXISTS public.buyer_accounts_stamp_email_verified_at();
ALTER TABLE public.buyer_accounts DROP COLUMN IF EXISTS email_verified_at;

ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_type_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_actor_type_check
  CHECK (actor_type = ANY (ARRAY['user'::text, 'employee'::text, 'super_admin'::text, 'system'::text])) NOT VALID;

COMMIT;
