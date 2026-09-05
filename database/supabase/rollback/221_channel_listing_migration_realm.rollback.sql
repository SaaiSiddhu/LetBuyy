-- Rollback of 221: restore 217's transition_channel_listing body and the original two-realm
-- actor_realm CHECK exactly. Any 'migration'-realm moderation event already written would then
-- violate the restored CHECK -- there are none, because no import script exists yet to write one.

BEGIN;

ALTER TABLE public.channel_listing_moderation_events
  DROP CONSTRAINT channel_listing_moderation_events_actor_realm_check;
ALTER TABLE public.channel_listing_moderation_events
  ADD CONSTRAINT channel_listing_moderation_events_actor_realm_check
  CHECK (actor_realm IN ('merchant', 'operator'));

CREATE OR REPLACE FUNCTION public.transition_channel_listing(
  p_site_id uuid,
  p_listing_id uuid,
  p_to_status text,
  p_actor_realm text,
  p_actor_id uuid,
  p_reason text,
  p_idempotency_key text
)
RETURNS TABLE (
  listing_id uuid,
  from_status text,
  to_status text,
  event_id uuid,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_existing public.channel_listing_moderation_events%ROWTYPE;
  v_listing public.channel_listings%ROWTYPE;
  v_product_ok boolean;
  v_now timestamp with time zone := now();
  v_event_id uuid;
  v_allowed boolean := false;
BEGIN
  IF p_site_id IS NULL THEN
    RAISE EXCEPTION 'site_id is required';
  END IF;
  IF p_listing_id IS NULL THEN
    RAISE EXCEPTION 'listing_id is required';
  END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) = 0 OR length(p_idempotency_key) > 200 THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;
  IF p_actor_realm IS NULL OR p_actor_realm NOT IN ('merchant', 'operator') THEN
    RAISE EXCEPTION 'unsupported actor_realm: %', p_actor_realm;
  END IF;
  IF p_to_status IS NULL OR p_to_status NOT IN ('draft', 'pending_review', 'approved', 'rejected', 'paused', 'delisted') THEN
    RAISE EXCEPTION 'unsupported status: %', p_to_status;
  END IF;

  -- Lock BEFORE the existence check (206:114): two concurrent replays of one key serialize here.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 0));

  SELECT * INTO v_existing
    FROM public.channel_listing_moderation_events e
   WHERE e.site_id = p_site_id AND e.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.listing_id, v_existing.from_status, v_existing.to_status, v_existing.id, true;
    RETURN;
  END IF;

  -- Realm fence. Merchant edges must run inside the tenant transaction for this very site (GUC set by
  -- withTenantTx from a validated claim; an unset GUC fails closed). Operator edges are refused when the
  -- caller's role is app_tenant — the only role a merchant request can run as — and when a tenant GUC
  -- is set, because an operator never acts inside a tenant transaction. service_role is a member of
  -- app_tenant (164:21), so membership is NOT the test. Inside a SECURITY DEFINER function current_user
  -- is the DEFINER, not the caller (measured on postgres:16: current_user=postgres, role=app_tenant after
  -- SET LOCAL ROLE app_tenant), so the caller's SET ROLE is read through the `role` setting.
  IF p_actor_realm = 'merchant' THEN
    IF public.current_site_id() IS NULL OR public.current_site_id() <> p_site_id THEN
      RAISE EXCEPTION 'tenant context required for merchant transitions';
    END IF;
  ELSE
    IF current_setting('role', true) = 'app_tenant' OR public.current_site_id() IS NOT NULL THEN
      RAISE EXCEPTION 'operator transitions are not permitted from a tenant context';
    END IF;
  END IF;

  SELECT * INTO v_listing
    FROM public.channel_listings l
   WHERE l.id = p_listing_id AND l.site_id = p_site_id
   FOR UPDATE;
  IF NOT FOUND THEN
    -- Same message for "wrong site": no cross-tenant existence oracle.
    RAISE EXCEPTION 'listing not found';
  END IF;

  -- The edge matrix (MARKETPLACE_CHANNEL_MODEL.md §4).
  IF p_actor_realm = 'merchant' THEN
    v_allowed :=
         (v_listing.status = 'draft' AND p_to_status = 'pending_review')
      OR (v_listing.status = 'rejected' AND p_to_status = 'draft')
      OR (v_listing.status = 'approved' AND p_to_status = 'paused')
      OR (v_listing.status = 'paused' AND p_to_status = 'approved' AND v_listing.approved_at IS NOT NULL)
      OR (v_listing.status IN ('draft', 'pending_review', 'approved', 'paused', 'rejected') AND p_to_status = 'delisted');
  ELSE
    v_allowed :=
         (v_listing.status = 'pending_review' AND p_to_status IN ('approved', 'rejected'))
      OR (v_listing.status = 'approved' AND p_to_status = 'delisted');
  END IF;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_transition: % -> % by %', v_listing.status, p_to_status, p_actor_realm;
  END IF;

  IF p_to_status = 'pending_review' THEN
    IF v_listing.channel = 'marketplace' AND v_listing.marketplace_category_id IS NULL THEN
      RAISE EXCEPTION 'marketplace listings require a marketplace_category_id before review';
    END IF;
    SELECT (p.is_active = true AND p.deleted_at IS NULL AND COALESCE(p.site_id, p.store_id) = v_listing.site_id)
      INTO v_product_ok
      FROM public.products p
     WHERE p.id = v_listing.product_id;
    IF NOT COALESCE(v_product_ok, false) THEN
      RAISE EXCEPTION 'product is not sellable';
    END IF;
  END IF;

  IF p_actor_realm = 'operator' AND p_to_status IN ('rejected', 'delisted') AND (p_reason IS NULL OR length(btrim(p_reason)) = 0) THEN
    RAISE EXCEPTION 'a reason is required for operator % decisions', p_to_status;
  END IF;

  -- Mark the transaction so the status guard trigger lets exactly this write through.
  PERFORM set_config('app.channel_listing_transition', 'rpc', true);

  UPDATE public.channel_listings l
     SET status = p_to_status,
         version = l.version + 1,
         updated_at = v_now,
         updated_by = COALESCE(p_actor_id, l.updated_by),
         submitted_at = CASE WHEN p_to_status = 'pending_review' THEN v_now ELSE l.submitted_at END,
         approved_at = CASE WHEN p_to_status = 'approved' AND p_actor_realm = 'operator' THEN v_now ELSE l.approved_at END,
         reviewed_at = CASE WHEN p_actor_realm = 'operator' THEN v_now ELSE l.reviewed_at END,
         reviewed_by = CASE WHEN p_actor_realm = 'operator' THEN p_actor_id ELSE l.reviewed_by END,
         rejection_reason = CASE WHEN p_to_status = 'rejected' THEN p_reason
                                 WHEN p_to_status = 'draft' THEN NULL
                                 ELSE l.rejection_reason END
   WHERE l.id = v_listing.id;

  INSERT INTO public.channel_listing_moderation_events (site_id, listing_id, from_status, to_status, actor_realm, actor_id, reason, idempotency_key)
  VALUES (p_site_id, v_listing.id, v_listing.status, p_to_status, p_actor_realm, p_actor_id, p_reason, p_idempotency_key)
  RETURNING id INTO v_event_id;

  PERFORM set_config('app.channel_listing_transition', '', true);

  RETURN QUERY SELECT v_listing.id, v_listing.status, p_to_status, v_event_id, false;
END;
$$;

COMMIT;
