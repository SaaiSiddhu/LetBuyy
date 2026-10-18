-- A merchant correction/resubmission is one state transition from rejected to a newly submitted
-- revision. Keep the existing transition RPC as the only listing-state writer, but run its two
-- legal edges in one tenant transaction and bind retries to the complete request.
BEGIN;

CREATE OR REPLACE FUNCTION public.resubmit_rejected_marketplace_listing(
  p_site_id uuid,
  p_listing_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_idempotency_key text
)
RETURNS TABLE(listing_id uuid, from_status text, to_status text, event_id uuid, replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_existing public.channel_listing_moderation_events%ROWTYPE;
  v_listing public.channel_listings%ROWTYPE;
  v_step record;
  v_final record;
  v_draft_key text;
BEGIN
  IF p_site_id IS NULL OR p_listing_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'site, listing and merchant actor are required';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 8 OR length(btrim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'merchant correction response must contain 8 to 500 characters';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0 OR length(p_idempotency_key) > 120 THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;
  IF current_setting('role', true) IS DISTINCT FROM 'app_tenant'
     OR public.current_site_id() IS NULL
     OR public.current_site_id() <> p_site_id THEN
    RAISE EXCEPTION 'tenant context required for merchant resubmission';
  END IF;

  -- The root key serializes retries before checking the final append-only event receipt.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':resubmit:' || p_idempotency_key, 0));
  SELECT * INTO v_existing
    FROM public.channel_listing_moderation_events e
   WHERE e.site_id = p_site_id AND e.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.listing_id IS DISTINCT FROM p_listing_id
       OR v_existing.from_status IS DISTINCT FROM 'draft'
       OR v_existing.to_status IS DISTINCT FROM 'pending_review'
       OR v_existing.actor_realm IS DISTINCT FROM 'merchant'
       OR v_existing.actor_id IS DISTINCT FROM p_actor_id
       OR v_existing.reason IS DISTINCT FROM btrim(p_reason) THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'idempotency_key_conflict: resubmission key belongs to a different request';
    END IF;
    RETURN QUERY SELECT p_listing_id, v_existing.from_status, v_existing.to_status, v_existing.id, true;
    RETURN;
  END IF;

  SELECT * INTO v_listing
    FROM public.channel_listings l
   WHERE l.id = p_listing_id AND l.site_id = p_site_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'listing not found'; END IF;
  IF v_listing.channel <> 'marketplace' OR v_listing.status <> 'rejected' THEN
    RAISE EXCEPTION 'invalid_transition: only rejected marketplace listings can be resubmitted';
  END IF;

  v_draft_key := 'resubmit-draft:' || p_listing_id::text || ':' || p_idempotency_key;
  IF length(v_draft_key) > 200 THEN RAISE EXCEPTION 'idempotency_key is too long for resubmission'; END IF;

  -- Reuse the canonical transition writer and its revision snapshot/guards. Both calls participate
  -- in this function's transaction, so a failure on the second edge rolls the first edge back.
  SELECT * INTO v_step FROM public.transition_channel_listing(
    p_site_id, p_listing_id, 'draft', 'merchant', p_actor_id, NULL, v_draft_key
  );
  SELECT * INTO v_final FROM public.transition_channel_listing(
    p_site_id, p_listing_id, 'pending_review', 'merchant', p_actor_id, btrim(p_reason), p_idempotency_key
  );
  RETURN QUERY SELECT v_final.listing_id, v_final.from_status, v_final.to_status, v_final.event_id, v_final.replayed;
END;
$$;

REVOKE ALL ON FUNCTION public.resubmit_rejected_marketplace_listing(uuid, uuid, uuid, text, text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    GRANT EXECUTE ON FUNCTION public.resubmit_rejected_marketplace_listing(uuid, uuid, uuid, text, text) TO app_tenant;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE EXECUTE ON FUNCTION public.resubmit_rejected_marketplace_listing(uuid, uuid, uuid, text, text) FROM anon;
  END IF;
END $$;

COMMENT ON FUNCTION public.resubmit_rejected_marketplace_listing(uuid, uuid, uuid, text, text) IS
  'Atomically returns a rejected marketplace listing to draft and resubmits its current product revision for review under the verified merchant tenant.';

COMMIT;
