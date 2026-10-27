-- Owner-approved ART-14 Amendment4, 27Oct2026. Reuse the existing domain lifecycle.
-- No existing store/domain is provisioned, promoted, exposed or overwritten by this migration.
ALTER TABLE public.site_domains
  ADD COLUMN purpose text NOT NULL DEFAULT 'storefront',
  ADD COLUMN checkout_parent_domain_id uuid,
  ADD CONSTRAINT site_domains_purpose_check CHECK (purpose IN ('storefront','checkout')),
  ADD CONSTRAINT site_domains_checkout_shape_check CHECK (
    (purpose='storefront' AND checkout_parent_domain_id IS NULL)
    OR (purpose='checkout' AND role='redirect' AND redirect_to IS NULL)),
  ADD CONSTRAINT site_domains_id_site_key UNIQUE (id,site_id),
  ADD CONSTRAINT site_domains_checkout_parent_fkey
    FOREIGN KEY (checkout_parent_domain_id,site_id)
    REFERENCES public.site_domains(id,site_id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX site_domains_one_checkout_per_site
  ON public.site_domains(site_id) WHERE purpose='checkout' AND deleted_at IS NULL;
CREATE INDEX site_domains_checkout_maintenance
  ON public.site_domains(id) WHERE purpose='checkout' AND deleted_at IS NULL;

CREATE FUNCTION public.guard_checkout_domain_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE parent public.site_domains%ROWTYPE; handle text;
BEGIN
  IF TG_OP='UPDATE' AND OLD.purpose<>NEW.purpose THEN
    RAISE EXCEPTION 'Domain purpose is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.purpose<>'checkout' THEN RETURN NEW; END IF;
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
CREATE TRIGGER site_domains_checkout_guard BEFORE INSERT OR UPDATE ON public.site_domains
  FOR EACH ROW EXECUTE FUNCTION public.guard_checkout_domain_v1();

CREATE FUNCTION public.revoke_child_checkout_domain_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.purpose='storefront' AND (NEW.deleted_at IS NOT NULL OR NEW.status<>'active' OR NEW.ssl_status<>'active') THEN
    UPDATE public.site_domains SET status='verifying',ssl_status='pending',updated_at=now()
      WHERE site_id=NEW.site_id AND checkout_parent_domain_id=NEW.id
        AND purpose='checkout' AND deleted_at IS NULL AND status='active';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER site_domains_checkout_parent_revocation AFTER UPDATE OF status,ssl_status,deleted_at
  ON public.site_domains FOR EACH ROW EXECUTE FUNCTION public.revoke_child_checkout_domain_v1();

REVOKE ALL ON FUNCTION public.guard_checkout_domain_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.revoke_child_checkout_domain_v1() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
