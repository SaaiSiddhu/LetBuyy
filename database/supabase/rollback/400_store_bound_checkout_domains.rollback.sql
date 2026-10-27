-- Drain origin-bound handoffs and disable branded-host emission before rollback.
-- Preserve every newly created domain row and its checkout-only fields in metadata;
-- make these aliases inactive before removing their type discriminator. Existing
-- storefront rows and verification history are never rewritten or deleted.
DROP TRIGGER IF EXISTS site_domains_checkout_parent_revocation ON public.site_domains;
DROP TRIGGER IF EXISTS site_domains_checkout_guard ON public.site_domains;
UPDATE public.site_domains d SET
  metadata=d.metadata||jsonb_build_object('checkout_rollback_archive_v1',
    jsonb_build_object('purpose',d.purpose,'parent_domain_id',d.checkout_parent_domain_id,
      'status',d.status,'ssl_status',d.ssl_status,'deleted_at',d.deleted_at,'updated_at',d.updated_at)),
  deleted_at=COALESCE(d.deleted_at,now()),status='error',ssl_status='unavailable',updated_at=now()
WHERE d.purpose='checkout';
DROP FUNCTION public.revoke_child_checkout_domain_v1();
DROP FUNCTION public.guard_checkout_domain_v1();
DROP INDEX public.site_domains_checkout_maintenance;
DROP INDEX public.site_domains_one_checkout_per_site;
ALTER TABLE public.site_domains
  DROP CONSTRAINT site_domains_checkout_parent_fkey,
  DROP CONSTRAINT site_domains_id_site_key,
  DROP CONSTRAINT site_domains_checkout_shape_check,
  DROP CONSTRAINT site_domains_purpose_check,
  DROP COLUMN checkout_parent_domain_id,
  DROP COLUMN purpose;
NOTIFY pgrst,'reload schema';
