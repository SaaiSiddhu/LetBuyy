-- Pre-use rollback only. Never discard or reinterpret a newly admitted custom hostname.
BEGIN;

-- Refuse stale ABI/overloads before any historical rollback mutation.
DO $managed_catalog_fence$
BEGIN
 IF (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN
  LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
 ELSE
  IF current_user<>'postgres' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE p.oid=pg_catalog.to_regprocedure('letbuyy_maintenance.lock_catalogs_v1()')
 AND n.nspname='letbuyy_maintenance' AND n.nspowner='supabase_admin'::regrole
 AND p.proowner='supabase_admin'::regrole AND p.prosecdef AND p.prokind='f' AND NOT p.proretset
 AND p.prorettype='pg_catalog.void'::regtype AND p.prolang=(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
 AND p.pronargs=0 AND p.pronargdefaults=0 AND p.proargnames IS NULL AND p.proargmodes IS NULL AND p.proallargtypes IS NULL
 AND NOT p.proisstrict AND NOT p.proleakproof AND p.prosupport=0 AND p.provolatile='v' AND p.proparallel='u'
 AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']::text[]
 AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex')='4772eebc5017ef1e188b188f87f1cca8fb8f2b9cfd1e928798ef5cd5dfebfabc'
 AND EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.oid=p.proowner AND r.rolsuper)
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)))a
  WHERE a.grantor<>p.proowner OR a.grantee NOT IN(p.proowner,'postgres'::regrole) OR (a.grantee<>p.proowner AND a.is_grantable))
 AND pg_catalog.has_function_privilege('postgres',p.oid,'EXECUTE')
 AND NOT EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner)))a
  WHERE a.grantor<>n.nspowner OR a.grantee NOT IN(n.nspowner,'postgres'::regrole)
   OR(a.grantee<>n.nspowner AND (a.is_grantable OR a.privilege_type<>'USAGE')))
 AND pg_catalog.has_schema_privilege('postgres',n.oid,'USAGE')
 AND (SELECT count(*) FROM pg_catalog.pg_proc x WHERE x.pronamespace=n.oid AND x.proname=p.proname)=1) THEN
   RAISE EXCEPTION 'LETBUYY_PROVIDER_ADMIN_CATALOG_FENCE_REQUIRED' USING ERRCODE='42501';END IF;
  PERFORM letbuyy_maintenance.lock_catalogs_v1();
  -- Prove actual backend-held relation locks, including cluster-shared catalogs.
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['pg_catalog.pg_proc'::pg_catalog.regclass]::oid[]) catalog_oid
    WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
     AND l.locktype='relation' AND l.relation=catalog_oid AND l.granted
     AND l.mode IN('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')
     AND l.database IN(0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())))) THEN
   RAISE EXCEPTION 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED';END IF;
 END IF;
END $managed_catalog_fence$;
DO $rollback_typed_family$
DECLARE expected record; live pg_catalog.pg_proc%ROWTYPE;
BEGIN
 FOR expected IN SELECT * FROM (VALUES
 ('public.guard_checkout_domain_v1()',ARRAY[]::text[],'trigger',false)
 ) AS bounded(signature,input_names,result_type,definer) LOOP
  SELECT * INTO live FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(expected.signature);
  IF live.oid IS NULL OR live.prokind<>'f' OR live.prosecdef IS DISTINCT FROM expected.definer OR live.proretset
   OR live.prorettype IS DISTINCT FROM expected.result_type::regtype OR live.provariadic<>0
   OR COALESCE(live.proargnames[1:live.pronargs],ARRAY[]::text[]) IS DISTINCT FROM expected.input_names
   OR live.proargmodes IS NOT NULL OR live.proallargtypes IS NOT NULL
   OR (SELECT count(*) FROM pg_catalog.pg_proc other WHERE other.pronamespace=live.pronamespace AND other.proname=live.proname)<>1
   OR (expected.definer AND (pg_catalog.has_function_privilege('anon',live.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated',live.oid,'EXECUTE'))) THEN
   RAISE EXCEPTION 'Rollback410 refuses changed typed function family';
  END IF;
 END LOOP;
END $rollback_typed_family$;

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
