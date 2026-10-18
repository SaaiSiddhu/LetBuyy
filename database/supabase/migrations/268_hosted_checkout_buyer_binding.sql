-- Phase 2/8: carry verified storefront identity across the isolated hosted checkout origin.
-- The browser never receives the buyer token in the checkout URL; the store-host BFF presents
-- it to this service-only binding function before the signed-cart handoff leaves that host.
BEGIN;

ALTER TABLE public.checkout_sessions
  ADD COLUMN buyer_account_id uuid REFERENCES public.buyer_accounts(id) ON DELETE SET NULL,
  ADD COLUMN buyer_session_epoch integer,
  ADD CONSTRAINT checkout_sessions_buyer_epoch_nonnegative
    CHECK (buyer_session_epoch IS NULL OR buyer_session_epoch >= 0);

CREATE FUNCTION public.bind_hosted_checkout_buyer(
  p_site_id uuid,
  p_cart_id uuid,
  p_cart_token text,
  p_channel text,
  p_buyer_account_id uuid,
  p_buyer_session_epoch integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_status text;
  v_live_epoch integer;
  v_checkout public.checkout_sessions%ROWTYPE;
BEGIN
  IF p_site_id IS NULL OR p_cart_id IS NULL OR p_cart_token IS NULL
     OR btrim(p_cart_token) = '' OR p_channel IS NULL OR p_channel NOT IN ('web','whatsapp','instagram','pos','api')
     OR p_buyer_account_id IS NULL OR p_buyer_session_epoch IS NULL OR p_buyer_session_epoch < 0 THEN
    RAISE EXCEPTION 'hosted checkout buyer binding is invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_cart_id::text, 0));

  SELECT status, session_epoch INTO v_status, v_live_epoch
    FROM public.buyer_accounts
   WHERE id = p_buyer_account_id
   FOR SHARE;
  IF NOT FOUND OR v_status <> 'active' OR v_live_epoch <> p_buyer_session_epoch THEN
    RAISE EXCEPTION 'buyer session is no longer active' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_checkout
    FROM public.checkout_sessions
   WHERE site_id = p_site_id AND cart_id = p_cart_id AND deleted_at IS NULL
   FOR UPDATE;

  IF FOUND THEN
    IF v_checkout.order_id IS NOT NULL OR v_checkout.checkout_state IN ('completed','failed','cancelled','expired') THEN
      RAISE EXCEPTION 'hosted checkout is no longer available for buyer binding' USING ERRCODE = '23505';
    END IF;
    IF v_checkout.cart_token IS DISTINCT FROM p_cart_token THEN
      RAISE EXCEPTION 'hosted checkout cart binding conflicts' USING ERRCODE = '23505';
    END IF;
    IF v_checkout.buyer_account_id IS NOT NULL AND v_checkout.buyer_account_id <> p_buyer_account_id THEN
      RAISE EXCEPTION 'hosted checkout is already bound to another buyer' USING ERRCODE = '23505';
    END IF;

    UPDATE public.checkout_sessions
       SET buyer_account_id = p_buyer_account_id,
           buyer_session_epoch = p_buyer_session_epoch
     WHERE id = v_checkout.id;
    RETURN v_checkout.id;
  END IF;

  INSERT INTO public.checkout_sessions (
    site_id, cart_id, cart_token, channel, status, checkout_state,
    idempotency_key, metadata, buyer_account_id, buyer_session_epoch
  ) VALUES (
    p_site_id, p_cart_id, p_cart_token, p_channel, 'contact', 'contact',
    'checkout:' || p_site_id::text || ':' || p_cart_id::text,
    jsonb_build_object('source','hosted_checkout_v1','buyer_bound',true),
    p_buyer_account_id, p_buyer_session_epoch
  )
  RETURNING id INTO v_checkout.id;
  RETURN v_checkout.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.bind_hosted_checkout_buyer(uuid,uuid,text,text,uuid,integer)
  FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.bind_hosted_checkout_buyer(uuid,uuid,text,text,uuid,integer)
  TO service_role;

COMMIT;
