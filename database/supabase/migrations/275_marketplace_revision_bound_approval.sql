-- Phase 6.1: approval attaches to the exact buyer-facing/compliance revision reviewed.
-- Inventory and sellability toggles stay independent; material edits withdraw the submission.
BEGIN;

ALTER TABLE public.channel_listings
  ADD COLUMN submitted_product_fingerprint text,
  ADD COLUMN approved_product_fingerprint text,
  ADD COLUMN submitted_product_snapshot jsonb,
  ADD COLUMN approved_product_snapshot jsonb,
  ADD COLUMN assigned_reviewer_id uuid,
  ADD COLUMN reviewer_assigned_at timestamptz,
  ADD COLUMN reviewer_assigned_by uuid,
  ADD CONSTRAINT channel_listings_submitted_fingerprint_check
    CHECK (submitted_product_fingerprint IS NULL OR submitted_product_fingerprint ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT channel_listings_approved_fingerprint_check
    CHECK (approved_product_fingerprint IS NULL OR approved_product_fingerprint ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT channel_listings_submitted_snapshot_check
    CHECK (submitted_product_snapshot IS NULL OR jsonb_typeof(submitted_product_snapshot) = 'object'),
  ADD CONSTRAINT channel_listings_approved_snapshot_check
    CHECK (approved_product_snapshot IS NULL OR jsonb_typeof(approved_product_snapshot) = 'object');

-- 222 retired the migration actor because it was an unused approval bypass. `system` is narrower:
-- it can only describe automatic invalidation, cannot approve or publish, and carries no human id.
ALTER TABLE public.channel_listing_moderation_events
  DROP CONSTRAINT channel_listing_moderation_events_actor_realm_check,
  ADD CONSTRAINT channel_listing_moderation_events_actor_realm_check
    CHECK (actor_realm IN ('merchant', 'operator', 'system')),
  ADD COLUMN event_type text NOT NULL DEFAULT 'status_transition',
  ADD COLUMN assigned_reviewer_id uuid,
  ADD COLUMN previous_assigned_reviewer_id uuid,
  ADD CONSTRAINT channel_listing_moderation_events_event_type_check
    CHECK (event_type IN ('status_transition', 'reviewer_assignment'));

CREATE OR REPLACE FUNCTION public.marketplace_listing_review_snapshot(p_listing_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'channel', cl.channel,
    'marketplace_category_id', cl.marketplace_category_id,
    'pricing_policy', cl.pricing_policy,
    'compliance_flags', cl.compliance_flags,
    'product', jsonb_build_object(
      'site_id', p.site_id,
      'store_id', p.store_id,
      'name', p.name,
      'slug', p.slug,
      'url_handle', p.url_handle,
      'description', p.description,
      'price', p.price,
      'compare_price', p.compare_price,
      'images', p.images,
      'thumbnail_url', p.thumbnail_url,
      'category', p.category,
      'tags', p.tags,
      'seo_title', p.seo_title,
      'seo_description', p.seo_description,
      'product_type', p.product_type,
      'vendor', p.vendor,
      'country_of_origin', p.country_of_origin,
      'importer_details', p.importer_details,
      'hs_code', p.hs_code,
      'hsn_code', p.hsn_code,
      'charge_tax', p.charge_tax,
      'is_physical', p.is_physical,
      'weight', p.weight,
      'weight_unit', p.weight_unit
    ),
    'variants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'title', v.title,
        'price', v.price,
        'compare_price', v.compare_price,
        'weight', v.weight,
        'weight_unit', v.weight_unit,
        'option1', v.option1,
        'option2', v.option2,
        'option3', v.option3,
        'image_url', v.image_url,
        'position', v.position
      ) ORDER BY v.position, v.created_at, v.id)
      FROM public.product_variants v WHERE v.product_id = p.id
    ), '[]'::jsonb),
    'options', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', o.name, 'values', o."values", 'position', o."position"
      ) ORDER BY o.position, o.created_at, o.id)
      FROM public.product_options o WHERE o.product_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.channel_listings cl
  JOIN public.products p ON p.id = cl.product_id
  WHERE cl.id = p_listing_id AND cl.channel = 'marketplace';
$$;
REVOKE ALL ON FUNCTION public.marketplace_listing_review_snapshot(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.marketplace_listing_review_fingerprint(p_listing_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT encode(extensions.digest(convert_to(snapshot.payload::text, 'UTF8'), 'sha256'), 'hex')
    FROM (SELECT public.marketplace_listing_review_snapshot(p_listing_id) AS payload) snapshot
   WHERE snapshot.payload IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.marketplace_listing_review_fingerprint(uuid) FROM PUBLIC;

-- Pending submissions can bind to the content being reviewed now. Older approvals have no
-- historical fingerprint, so they cannot safely inherit approval for today's content: withdraw
-- them to draft with an explicit system audit event and require merchant resubmission.
UPDATE public.channel_listings cl
   SET submitted_product_snapshot = public.marketplace_listing_review_snapshot(cl.id),
       submitted_product_fingerprint = public.marketplace_listing_review_fingerprint(cl.id)
 WHERE cl.channel = 'marketplace' AND cl.status = 'pending_review';
DO $$
DECLARE
  v_listing public.channel_listings%ROWTYPE;
BEGIN
  FOR v_listing IN
    SELECT * FROM public.channel_listings
     WHERE channel = 'marketplace' AND status IN ('approved', 'paused')
     FOR UPDATE
  LOOP
    PERFORM set_config('app.channel_listing_transition', 'rpc', true);
    UPDATE public.channel_listings
       SET status = 'draft', submitted_product_fingerprint = NULL,
           version = version + 1, updated_at = now()
     WHERE id = v_listing.id;
    INSERT INTO public.channel_listing_moderation_events
      (site_id, listing_id, from_status, to_status, actor_realm, actor_id, reason, idempotency_key)
    VALUES
      (v_listing.site_id, v_listing.id, v_listing.status, 'draft', 'system', NULL,
       'Historical approval has no bound product revision; merchant resubmission is required.',
       'revision-baseline:' || v_listing.id::text || ':' || gen_random_uuid()::text);
    PERFORM set_config('app.channel_listing_transition', '', true);
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.channel_listing_review_revision_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_fingerprint text;
  v_snapshot jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' OR NEW.submitted_product_fingerprint IS NOT NULL
       OR NEW.approved_product_fingerprint IS NOT NULL OR NEW.submitted_product_snapshot IS NOT NULL
       OR NEW.approved_product_snapshot IS NOT NULL THEN
      RAISE EXCEPTION 'channel listings must be created as an unreviewed draft';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    IF NEW.submitted_product_fingerprint IS DISTINCT FROM OLD.submitted_product_fingerprint
       OR NEW.approved_product_fingerprint IS DISTINCT FROM OLD.approved_product_fingerprint
       OR NEW.submitted_product_snapshot IS DISTINCT FROM OLD.submitted_product_snapshot
       OR NEW.approved_product_snapshot IS DISTINCT FROM OLD.approved_product_snapshot THEN
      RAISE EXCEPTION 'review fingerprints change only with a valid listing transition';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'pending_review' AND OLD.status = 'draft' THEN
    v_snapshot := public.marketplace_listing_review_snapshot(OLD.id);
    v_fingerprint := encode(extensions.digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'), 'hex');
    IF v_fingerprint IS NULL THEN RAISE EXCEPTION 'marketplace review revision is unavailable'; END IF;
    NEW.submitted_product_fingerprint := v_fingerprint;
    NEW.approved_product_fingerprint := OLD.approved_product_fingerprint;
    NEW.submitted_product_snapshot := v_snapshot;
    NEW.approved_product_snapshot := OLD.approved_product_snapshot;
  ELSIF NEW.status = 'approved' AND OLD.status = 'pending_review' THEN
    -- The gateway pre-check improves the response, but is not the authority: assignment may
    -- change after that read. transition_channel_listing locks the listing row, so this trigger
    -- compares the actor carried by the same atomic transition with the current locked assignment.
    IF OLD.assigned_reviewer_id IS NULL OR NEW.reviewed_by IS DISTINCT FROM OLD.assigned_reviewer_id THEN
      RAISE EXCEPTION 'marketplace_review_assignment_required';
    END IF;
    v_snapshot := public.marketplace_listing_review_snapshot(OLD.id);
    v_fingerprint := encode(extensions.digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'), 'hex');
    IF OLD.submitted_product_fingerprint IS NULL OR OLD.submitted_product_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'marketplace product changed after submission; return to draft and resubmit';
    END IF;
    NEW.submitted_product_fingerprint := OLD.submitted_product_fingerprint;
    NEW.approved_product_fingerprint := v_fingerprint;
    NEW.submitted_product_snapshot := OLD.submitted_product_snapshot;
    NEW.approved_product_snapshot := v_snapshot;
  ELSIF NEW.status = 'approved' AND OLD.status = 'paused' THEN
    v_fingerprint := public.marketplace_listing_review_fingerprint(OLD.id);
    IF OLD.approved_product_fingerprint IS NULL OR OLD.approved_product_fingerprint IS DISTINCT FROM v_fingerprint THEN
      RAISE EXCEPTION 'marketplace product changed after approval; resubmission is required';
    END IF;
    NEW.submitted_product_fingerprint := OLD.submitted_product_fingerprint;
    NEW.approved_product_fingerprint := OLD.approved_product_fingerprint;
    NEW.submitted_product_snapshot := OLD.submitted_product_snapshot;
    NEW.approved_product_snapshot := OLD.approved_product_snapshot;
  ELSIF NEW.status = 'draft' AND OLD.status IN ('rejected', 'pending_review', 'approved', 'paused') THEN
    NEW.submitted_product_fingerprint := NULL;
    NEW.approved_product_fingerprint := OLD.approved_product_fingerprint;
    NEW.submitted_product_snapshot := NULL;
    NEW.approved_product_snapshot := OLD.approved_product_snapshot;
    NEW.assigned_reviewer_id := NULL;
    NEW.reviewer_assigned_at := NULL;
    NEW.reviewer_assigned_by := NULL;
  ELSIF NEW.status = 'rejected' AND OLD.status = 'pending_review' THEN
    IF OLD.assigned_reviewer_id IS NULL OR NEW.reviewed_by IS DISTINCT FROM OLD.assigned_reviewer_id THEN
      RAISE EXCEPTION 'marketplace_review_assignment_required';
    END IF;
    NEW.submitted_product_fingerprint := OLD.submitted_product_fingerprint;
    NEW.approved_product_fingerprint := OLD.approved_product_fingerprint;
    NEW.submitted_product_snapshot := OLD.submitted_product_snapshot;
    NEW.approved_product_snapshot := OLD.approved_product_snapshot;
    NULL;
  ELSIF NEW.status = 'paused' AND OLD.status = 'approved' THEN
    IF OLD.approved_product_fingerprint IS DISTINCT FROM public.marketplace_listing_review_fingerprint(OLD.id) THEN
      RAISE EXCEPTION 'marketplace product changed after approval; resubmission is required';
    END IF;
    NEW.submitted_product_fingerprint := OLD.submitted_product_fingerprint;
    NEW.approved_product_fingerprint := OLD.approved_product_fingerprint;
    NEW.submitted_product_snapshot := OLD.submitted_product_snapshot;
    NEW.approved_product_snapshot := OLD.approved_product_snapshot;
  ELSIF NEW.status = 'delisted' AND OLD.status IN ('draft', 'pending_review', 'approved', 'paused', 'rejected') THEN
    NEW.submitted_product_fingerprint := OLD.submitted_product_fingerprint;
    NEW.approved_product_fingerprint := OLD.approved_product_fingerprint;
    NEW.submitted_product_snapshot := OLD.submitted_product_snapshot;
    NEW.approved_product_snapshot := OLD.approved_product_snapshot;
    NULL;
  ELSE
    RAISE EXCEPTION 'invalid listing status transition: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.channel_listing_review_revision_guard() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_channel_listings_review_revision_guard ON public.channel_listings;
CREATE TRIGGER trg_channel_listings_review_revision_guard
  BEFORE INSERT OR UPDATE OF status, submitted_product_fingerprint, approved_product_fingerprint,
    submitted_product_snapshot, approved_product_snapshot ON public.channel_listings
  FOR EACH ROW EXECUTE FUNCTION public.channel_listing_review_revision_guard();

CREATE OR REPLACE FUNCTION public.channel_listing_reviewer_assignment_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_reviewer_id IS NOT NULL OR NEW.reviewer_assigned_at IS NOT NULL OR NEW.reviewer_assigned_by IS NOT NULL THEN
      RAISE EXCEPTION 'reviewer assignment must be created through the claim RPC';
    END IF;
    RETURN NEW;
  END IF;
  IF ROW(NEW.assigned_reviewer_id, NEW.reviewer_assigned_at, NEW.reviewer_assigned_by)
     IS DISTINCT FROM ROW(OLD.assigned_reviewer_id, OLD.reviewer_assigned_at, OLD.reviewer_assigned_by) THEN
    IF current_setting('role', true) = 'app_tenant' OR public.current_site_id() IS NOT NULL
       OR current_setting('app.channel_listing_assignment_transition', true) IS DISTINCT FROM 'rpc' THEN
      RAISE EXCEPTION 'reviewer assignment changes only through the operator claim RPC';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.channel_listing_reviewer_assignment_guard() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_channel_listings_reviewer_assignment_guard ON public.channel_listings;
CREATE TRIGGER trg_channel_listings_reviewer_assignment_guard
  BEFORE INSERT OR UPDATE OF assigned_reviewer_id, reviewer_assigned_at, reviewer_assigned_by
  ON public.channel_listings
  FOR EACH ROW EXECUTE FUNCTION public.channel_listing_reviewer_assignment_guard();

CREATE OR REPLACE FUNCTION public.claim_marketplace_listing_review(
  p_site_id uuid,
  p_listing_id uuid,
  p_reviewer_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_expected_version integer
)
RETURNS TABLE(listing_id uuid, assigned_reviewer_id uuid, version integer, event_id uuid, replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_listing public.channel_listings%ROWTYPE;
  v_existing public.channel_listing_moderation_events%ROWTYPE;
  v_event_id uuid;
  v_now timestamptz := now();
BEGIN
  IF p_site_id IS NULL OR p_listing_id IS NULL OR p_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'site_id, listing_id and reviewer_id are required';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 8 OR length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'reviewer claim requires a reason of 8 to 1000 characters';
  END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) = 0 OR length(p_idempotency_key) > 200 THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'expected listing version is required';
  END IF;
  IF current_setting('role', true) = 'app_tenant' OR public.current_site_id() IS NOT NULL THEN
    RAISE EXCEPTION 'operator claims are not permitted from a tenant context';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':claim:' || p_idempotency_key, 0));
  SELECT * INTO v_existing FROM public.channel_listing_moderation_events e
   WHERE e.site_id = p_site_id AND e.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.event_type <> 'reviewer_assignment' OR v_existing.listing_id <> p_listing_id
       OR v_existing.assigned_reviewer_id <> p_reviewer_id OR v_existing.actor_id <> p_reviewer_id
       OR v_existing.reason IS DISTINCT FROM p_reason THEN
      RAISE EXCEPTION 'idempotency_key_conflict';
    END IF;
    RETURN QUERY SELECT p_listing_id, p_reviewer_id,
      (SELECT l.version FROM public.channel_listings l WHERE l.id = p_listing_id AND l.site_id = p_site_id),
      v_existing.id, true;
    RETURN;
  END IF;

  SELECT * INTO v_listing FROM public.channel_listings l
   WHERE l.id = p_listing_id AND l.site_id = p_site_id FOR UPDATE;
  IF NOT FOUND OR v_listing.channel <> 'marketplace' THEN RAISE EXCEPTION 'listing not found'; END IF;
  IF v_listing.status <> 'pending_review' THEN RAISE EXCEPTION 'listing is not awaiting review'; END IF;
  IF v_listing.version <> p_expected_version THEN RAISE EXCEPTION 'stale_listing_version'; END IF;
  IF v_listing.assigned_reviewer_id IS NOT NULL THEN RAISE EXCEPTION 'listing_already_claimed'; END IF;

  PERFORM set_config('app.channel_listing_assignment_transition', 'rpc', true);
  UPDATE public.channel_listings SET assigned_reviewer_id = p_reviewer_id,
      reviewer_assigned_at = v_now, reviewer_assigned_by = p_reviewer_id,
      updated_at = v_now
   WHERE id = v_listing.id;
  INSERT INTO public.channel_listing_moderation_events
    (site_id, listing_id, from_status, to_status, actor_realm, actor_id, reason, idempotency_key,
     event_type, assigned_reviewer_id)
  VALUES (p_site_id, p_listing_id, v_listing.status, v_listing.status, 'operator', p_reviewer_id,
      btrim(p_reason), p_idempotency_key, 'reviewer_assignment', p_reviewer_id)
  RETURNING id INTO v_event_id;
  PERFORM set_config('app.channel_listing_assignment_transition', '', true);

  RETURN QUERY SELECT p_listing_id, p_reviewer_id, v_listing.version, v_event_id, false;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_marketplace_listing_review(uuid, uuid, uuid, text, text, integer) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.claim_marketplace_listing_review(uuid, uuid, uuid, text, text, integer) TO service_role;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.assign_marketplace_listing_reviewer(
  p_site_id uuid,
  p_listing_id uuid,
  p_assigning_operator_id uuid,
  p_reviewer_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_expected_version integer
)
RETURNS TABLE(listing_id uuid, previous_reviewer_id uuid, assigned_reviewer_id uuid, version integer, event_id uuid, replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_listing public.channel_listings%ROWTYPE;
  v_existing public.channel_listing_moderation_events%ROWTYPE;
  v_event_id uuid;
  v_now timestamptz := now();
BEGIN
  IF p_site_id IS NULL OR p_listing_id IS NULL OR p_assigning_operator_id IS NULL OR p_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'site, listing, assigning operator and reviewer are required';
  END IF;
  IF p_assigning_operator_id = p_reviewer_id THEN
    RAISE EXCEPTION 'lead reassignment must select another reviewer';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 8 OR length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'reviewer assignment requires a reason of 8 to 1000 characters';
  END IF;
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) = 0 OR length(p_idempotency_key) > 200 THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;
  IF p_expected_version IS NULL OR p_expected_version < 1 THEN
    RAISE EXCEPTION 'expected listing version is required';
  END IF;
  IF current_setting('role', true) = 'app_tenant' OR public.current_site_id() IS NOT NULL THEN
    RAISE EXCEPTION 'operator assignment is not permitted from a tenant context';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':assign:' || p_idempotency_key, 0));
  SELECT * INTO v_existing FROM public.channel_listing_moderation_events e
   WHERE e.site_id = p_site_id AND e.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.event_type <> 'reviewer_assignment' OR v_existing.listing_id <> p_listing_id
       OR v_existing.actor_id <> p_assigning_operator_id OR v_existing.assigned_reviewer_id <> p_reviewer_id
       OR v_existing.reason IS DISTINCT FROM p_reason THEN
      RAISE EXCEPTION 'idempotency_key_conflict';
    END IF;
    RETURN QUERY SELECT p_listing_id, v_existing.previous_assigned_reviewer_id, p_reviewer_id,
      (SELECT l.version FROM public.channel_listings l WHERE l.id = p_listing_id AND l.site_id = p_site_id),
      v_existing.id, true;
    RETURN;
  END IF;

  SELECT * INTO v_listing FROM public.channel_listings l
   WHERE l.id = p_listing_id AND l.site_id = p_site_id FOR UPDATE;
  IF NOT FOUND OR v_listing.channel <> 'marketplace' THEN RAISE EXCEPTION 'listing not found'; END IF;
  IF v_listing.status <> 'pending_review' THEN RAISE EXCEPTION 'listing is not awaiting review'; END IF;
  IF v_listing.version <> p_expected_version THEN RAISE EXCEPTION 'stale_listing_version'; END IF;
  IF v_listing.assigned_reviewer_id IS NOT NULL AND v_listing.assigned_reviewer_id = p_reviewer_id THEN
    RAISE EXCEPTION 'reviewer_already_assigned';
  END IF;

  PERFORM set_config('app.channel_listing_assignment_transition', 'rpc', true);
  UPDATE public.channel_listings AS listing SET assigned_reviewer_id = p_reviewer_id,
      reviewer_assigned_at = v_now, reviewer_assigned_by = p_assigning_operator_id,
      version = listing.version + 1, updated_at = v_now
   WHERE listing.id = v_listing.id;
  INSERT INTO public.channel_listing_moderation_events
    (site_id, listing_id, from_status, to_status, actor_realm, actor_id, reason, idempotency_key,
     event_type, assigned_reviewer_id, previous_assigned_reviewer_id)
  VALUES (p_site_id, p_listing_id, v_listing.status, v_listing.status, 'operator', p_assigning_operator_id,
      btrim(p_reason), p_idempotency_key, 'reviewer_assignment', p_reviewer_id, v_listing.assigned_reviewer_id)
  RETURNING id INTO v_event_id;
  PERFORM set_config('app.channel_listing_assignment_transition', '', true);

  RETURN QUERY SELECT p_listing_id, v_listing.assigned_reviewer_id, p_reviewer_id,
    v_listing.version + 1, v_event_id, false;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_marketplace_listing_reviewer(uuid, uuid, uuid, uuid, text, text, integer) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.assign_marketplace_listing_reviewer(uuid, uuid, uuid, uuid, text, text, integer) TO service_role;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.invalidate_marketplace_listing_review(p_product_id uuid, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_listing public.channel_listings%ROWTYPE;
  v_count integer := 0;
BEGIN
  FOR v_listing IN
    SELECT * FROM public.channel_listings
     WHERE product_id = p_product_id AND channel = 'marketplace'
       AND status IN ('pending_review', 'approved', 'paused')
     FOR UPDATE
  LOOP
    PERFORM set_config('app.channel_listing_transition', 'rpc', true);
    UPDATE public.channel_listings
       SET status = 'draft', submitted_product_fingerprint = NULL,
           submitted_product_snapshot = NULL, version = version + 1, updated_at = now()
     WHERE id = v_listing.id;
    INSERT INTO public.channel_listing_moderation_events
      (site_id, listing_id, from_status, to_status, actor_realm, actor_id, reason, idempotency_key)
    VALUES
      (v_listing.site_id, v_listing.id, v_listing.status, 'draft', 'system', NULL,
       p_reason, 'revision-invalidation:' || v_listing.id::text || ':' || gen_random_uuid()::text);
    PERFORM set_config('app.channel_listing_transition', '', true);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_marketplace_listing_review(uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.invalidate_review_after_product_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF ROW(
       NEW.site_id, NEW.store_id, NEW.name, NEW.slug, NEW.url_handle, NEW.description,
       NEW.price, NEW.compare_price, NEW.images, NEW.thumbnail_url, NEW.category, NEW.tags,
       NEW.seo_title, NEW.seo_description, NEW.product_type, NEW.vendor,
       NEW.country_of_origin, NEW.importer_details, NEW.hs_code, NEW.hsn_code,
       NEW.charge_tax, NEW.is_physical, NEW.weight, NEW.weight_unit
     ) IS DISTINCT FROM ROW(
       OLD.site_id, OLD.store_id, OLD.name, OLD.slug, OLD.url_handle, OLD.description,
       OLD.price, OLD.compare_price, OLD.images, OLD.thumbnail_url, OLD.category, OLD.tags,
       OLD.seo_title, OLD.seo_description, OLD.product_type, OLD.vendor,
       OLD.country_of_origin, OLD.importer_details, OLD.hs_code, OLD.hsn_code,
       OLD.charge_tax, OLD.is_physical, OLD.weight, OLD.weight_unit
     ) THEN
    PERFORM public.invalidate_marketplace_listing_review(
      NEW.id, 'Material product details changed; merchant resubmission is required.'
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_review_after_product_change() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_products_invalidate_marketplace_review ON public.products;
CREATE TRIGGER trg_products_invalidate_marketplace_review
  AFTER UPDATE OF site_id, store_id, name, slug, url_handle, description, price, compare_price,
    images, thumbnail_url, category, tags, seo_title, seo_description, product_type, vendor,
    country_of_origin, importer_details, hs_code, hsn_code, charge_tax, is_physical, weight, weight_unit
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_review_after_product_change();

CREATE OR REPLACE FUNCTION public.invalidate_review_after_variant_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_product_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_product_id := NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_product_id := OLD.product_id;
  ELSE
    IF ROW(NEW.product_id, NEW.title, NEW.price, NEW.compare_price, NEW.weight, NEW.weight_unit,
           NEW.option1, NEW.option2, NEW.option3, NEW.image_url, NEW."position") IS NOT DISTINCT FROM
       ROW(OLD.product_id, OLD.title, OLD.price, OLD.compare_price, OLD.weight, OLD.weight_unit,
           OLD.option1, OLD.option2, OLD.option3, OLD.image_url, OLD."position") THEN RETURN NEW; END IF;
    PERFORM public.invalidate_marketplace_listing_review(
      OLD.product_id, 'Material product variant changed; merchant resubmission is required.'
    );
    v_product_id := NEW.product_id;
  END IF;
  PERFORM public.invalidate_marketplace_listing_review(
    v_product_id, 'Material product variant changed; merchant resubmission is required.'
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_review_after_variant_change() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_product_variants_invalidate_marketplace_review ON public.product_variants;
CREATE TRIGGER trg_product_variants_invalidate_marketplace_review
  AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_review_after_variant_change();

CREATE OR REPLACE FUNCTION public.invalidate_review_after_option_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_product_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN v_product_id := NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN v_product_id := OLD.product_id;
  ELSE
    IF ROW(NEW.product_id, NEW.name, NEW."values", NEW."position") IS NOT DISTINCT FROM
       ROW(OLD.product_id, OLD.name, OLD."values", OLD."position") THEN RETURN NEW; END IF;
    v_product_id := OLD.product_id;
    PERFORM public.invalidate_marketplace_listing_review(
      OLD.product_id, 'Material product options changed; merchant resubmission is required.'
    );
    IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN v_product_id := NEW.product_id; END IF;
  END IF;
  PERFORM public.invalidate_marketplace_listing_review(
    v_product_id, 'Material product options changed; merchant resubmission is required.'
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_review_after_option_change() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_product_options_invalidate_marketplace_review ON public.product_options;
CREATE TRIGGER trg_product_options_invalidate_marketplace_review
  AFTER INSERT OR UPDATE OR DELETE ON public.product_options
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_review_after_option_change();

CREATE OR REPLACE FUNCTION public.invalidate_review_after_listing_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF ROW(NEW.channel, NEW.marketplace_category_id, NEW.pricing_policy, NEW.compliance_flags)
     IS DISTINCT FROM ROW(OLD.channel, OLD.marketplace_category_id, OLD.pricing_policy, OLD.compliance_flags) THEN
    PERFORM public.invalidate_marketplace_listing_review(
      NEW.product_id, 'Material marketplace listing details changed; merchant resubmission is required.'
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_review_after_listing_change() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_channel_listings_invalidate_review ON public.channel_listings;
CREATE TRIGGER trg_channel_listings_invalidate_review
  AFTER UPDATE OF channel, marketplace_category_id, pricing_policy, compliance_flags ON public.channel_listings
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_review_after_listing_change();

COMMENT ON COLUMN public.channel_listings.submitted_product_fingerprint IS
  'SHA-256 of the buyer-facing/compliance product revision and marketplace listing terms submitted for review.';
COMMENT ON COLUMN public.channel_listings.approved_product_fingerprint IS
  'SHA-256 of the exact marketplace revision last approved; material edits withdraw the listing to draft.';
COMMENT ON COLUMN public.channel_listings.submitted_product_snapshot IS
  'Sanitized buyer-facing/compliance revision snapshot submitted for operator comparison; excludes inventory and internal cost/identity fields.';
COMMENT ON COLUMN public.channel_listings.approved_product_snapshot IS
  'Sanitized revision snapshot last approved, retained as the before side of a later re-review diff.';

COMMIT;
