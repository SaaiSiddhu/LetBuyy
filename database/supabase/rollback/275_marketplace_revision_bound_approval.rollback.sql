-- Fails closed on rollback: previously approved marketplace listings return to draft and must
-- resubmit. System invalidation events remain append-only, so the truthful `system` realm remains.
BEGIN;

DO $$
DECLARE
  v_listing public.channel_listings%ROWTYPE;
BEGIN
  FOR v_listing IN
    SELECT * FROM public.channel_listings
     WHERE channel = 'marketplace' AND status IN ('pending_review', 'approved', 'paused')
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
       'Revision-bound approval enforcement was rolled back; merchant resubmission is required.',
       'revision-rollback:' || v_listing.id::text || ':' || gen_random_uuid()::text);
    PERFORM set_config('app.channel_listing_transition', '', true);
  END LOOP;
END
$$;

DROP TRIGGER IF EXISTS trg_channel_listings_invalidate_review ON public.channel_listings;
DROP TRIGGER IF EXISTS trg_channel_listings_reviewer_assignment_guard ON public.channel_listings;
DROP TRIGGER IF EXISTS trg_product_options_invalidate_marketplace_review ON public.product_options;
DROP TRIGGER IF EXISTS trg_product_variants_invalidate_marketplace_review ON public.product_variants;
DROP TRIGGER IF EXISTS trg_products_invalidate_marketplace_review ON public.products;
DROP TRIGGER IF EXISTS trg_channel_listings_review_revision_guard ON public.channel_listings;

DROP FUNCTION IF EXISTS public.invalidate_review_after_listing_change();
DROP FUNCTION IF EXISTS public.invalidate_review_after_option_change();
DROP FUNCTION IF EXISTS public.invalidate_review_after_variant_change();
DROP FUNCTION IF EXISTS public.invalidate_review_after_product_change();
DROP FUNCTION IF EXISTS public.invalidate_marketplace_listing_review(uuid, text);
DROP FUNCTION IF EXISTS public.channel_listing_review_revision_guard();
DROP FUNCTION IF EXISTS public.channel_listing_reviewer_assignment_guard();
DROP FUNCTION IF EXISTS public.assign_marketplace_listing_reviewer(uuid, uuid, uuid, uuid, text, text, integer);
DROP FUNCTION IF EXISTS public.claim_marketplace_listing_review(uuid, uuid, uuid, text, text, integer);
DROP FUNCTION IF EXISTS public.marketplace_listing_review_fingerprint(uuid);
DROP FUNCTION IF EXISTS public.marketplace_listing_review_snapshot(uuid);

ALTER TABLE public.channel_listings
  DROP CONSTRAINT IF EXISTS channel_listings_submitted_fingerprint_check,
  DROP CONSTRAINT IF EXISTS channel_listings_approved_fingerprint_check,
  DROP CONSTRAINT IF EXISTS channel_listings_submitted_snapshot_check,
  DROP CONSTRAINT IF EXISTS channel_listings_approved_snapshot_check,
  DROP COLUMN IF EXISTS submitted_product_fingerprint,
  DROP COLUMN IF EXISTS approved_product_fingerprint,
  DROP COLUMN IF EXISTS submitted_product_snapshot,
  DROP COLUMN IF EXISTS approved_product_snapshot,
  DROP COLUMN IF EXISTS assigned_reviewer_id,
  DROP COLUMN IF EXISTS reviewer_assigned_at,
  DROP COLUMN IF EXISTS reviewer_assigned_by;

-- Assignment event metadata stays in the append-only moderation history, including after rollback.

COMMIT;
