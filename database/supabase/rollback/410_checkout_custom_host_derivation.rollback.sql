-- Pre-use rollback only. Never discard or reinterpret a newly admitted custom hostname.
BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.site_domains child JOIN public.site_domains parent
   ON parent.id=child.checkout_parent_domain_id AND parent.site_id=child.site_id
   WHERE child.purpose='checkout' AND child.domain='checkout.'||parent.domain
     AND child.deleted_at IS NULL) THEN
  RAISE EXCEPTION 'New custom checkout history must be retained; use a qualified forward fix' USING ERRCODE='55000';
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.guard_checkout_domain_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE parent public.site_domains%ROWTYPE; handle text;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.purpose='checkout' THEN
      RAISE EXCEPTION 'Checkout domains must be retired through the server lifecycle' USING ERRCODE='42501';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' AND OLD.purpose<>NEW.purpose THEN
    RAISE EXCEPTION 'Domain purpose is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.purpose<>'checkout' THEN RETURN NEW; END IF;
  -- Readiness is established only by the canonical server/provider proof.
  -- A tenant's direct PostgREST privileges must not manufacture active TLS or
  -- edit retirement metadata that drives a provider-domain removal.
  IF current_user NOT IN ('postgres','service_role') THEN
    RAISE EXCEPTION 'Checkout domain state is server managed' USING ERRCODE='42501';
  END IF;
  IF NEW.role<>'redirect' THEN
    RAISE EXCEPTION 'A checkout host cannot become a storefront primary' USING ERRCODE='23514';
  END IF;
  -- The existing atomic storefront-primary RPC redirects other domains in bulk.
  -- Its target update cannot turn a checkout row into primary; its bulk update
  -- must not turn checkout into a storefront redirect. Preserve the same owner/RPC.
  IF TG_OP='UPDATE' AND OLD.purpose='checkout' THEN NEW.redirect_to:=NULL; END IF;
  IF NEW.redirect_to IS NOT NULL THEN
    RAISE EXCEPTION 'A checkout host cannot redirect to a storefront' USING ERRCODE='23514';
  END IF;
  -- A handle/address change must still be able to retire the old immutable
  -- hostname. A deleted row grants no new minting/primary/ownership authority.
  IF TG_OP='UPDATE' AND OLD.checkout_retired_at IS NOT NULL AND NEW.checkout_retired_at IS NULL THEN
    RAISE EXCEPTION 'Retired checkout addresses cannot be reactivated' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND (NEW.deleted_at IS NOT NULL OR NEW.checkout_retired_at IS NOT NULL)
     AND NEW.site_id=OLD.site_id AND NEW.domain=OLD.domain
     AND NEW.checkout_parent_domain_id IS NOT DISTINCT FROM OLD.checkout_parent_domain_id THEN
    RETURN NEW;
  END IF;
  SELECT subdomain INTO handle FROM public.sites WHERE id=NEW.site_id AND deleted_at IS NULL;
  IF handle IS NULL OR NEW.domain<>lower(NEW.domain)
     OR left(NEW.domain,length('checkout.'||handle||'.'))<>'checkout.'||handle||'.' THEN
    RAISE EXCEPTION 'Checkout hostname does not match its store' USING ERRCODE='23514';
  END IF;
  IF NEW.checkout_parent_domain_id IS NOT NULL THEN
    SELECT * INTO parent FROM public.site_domains
      WHERE id=NEW.checkout_parent_domain_id AND site_id=NEW.site_id;
    IF NOT FOUND OR parent.purpose<>'storefront'
       OR NEW.domain<>'checkout.'||handle||'.'||parent.domain THEN
      RAISE EXCEPTION 'Checkout parent does not match its store/domain' USING ERRCODE='23514';
    END IF;
    IF NEW.status='active' AND NEW.deleted_at IS NULL
       AND (parent.status<>'active' OR parent.ssl_status<>'active' OR parent.deleted_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Checkout parent must remain verified' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.status='active' AND NEW.deleted_at IS NULL AND NEW.ssl_status<>'active' THEN
    RAISE EXCEPTION 'Checkout HTTPS must be verified before activation' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
