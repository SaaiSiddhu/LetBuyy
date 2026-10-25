--395 DOWN: retire only this source-derived writer generation; keep carts, orders and durable receipts.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
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
LOCK TABLE public.carts,public.checkout_sessions,public.idempotency_keys IN ACCESS EXCLUSIVE MODE NOWAIT;
DO $cart_writer_generation$
DECLARE expected record; p pg_catalog.pg_proc%ROWTYPE;
BEGIN
 FOR expected IN SELECT * FROM (VALUES
 ('public.write_storefront_cart(uuid,uuid,text,timestamp with time zone,jsonb,uuid,integer)','245ea1fa888e09b93163b065b07892ca'),
 ('public.edit_storefront_configured_cart_line(uuid,uuid,text,timestamp with time zone,text,uuid,text,uuid,integer,jsonb)','91e086f9e1cfad35335b949fe3c23a51')
 ) AS bound(signature,body_md5) LOOP
  SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(expected.signature);
  IF p.oid IS NULL OR pg_catalog.md5(p.prosrc) IS DISTINCT FROM expected.body_md5 OR NOT p.prosecdef
   OR p.proowner IS DISTINCT FROM (SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.carts'::regclass)
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
   OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) acl
      WHERE acl.grantor<>p.proowner OR acl.grantee NOT IN(p.proowner,'service_role'::regrole)
       OR acl.privilege_type<>'EXECUTE' OR (acl.grantee<>p.proowner AND acl.is_grantable)) THEN
   RAISE EXCEPTION '395 rollback refuses a changed cart writer generation or private ACL';
  END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.idempotency_keys WHERE starts_with(scope,'cart.configured_line_edit:') AND status<>'completed') THEN
  RAISE EXCEPTION '395 rollback refuses unresolved configured-cart intent; preserve the current writer';
 END IF;
END $cart_writer_generation$;
DROP FUNCTION public.edit_storefront_configured_cart_line(uuid,uuid,text,timestamptz,text,uuid,text,uuid,integer,jsonb) RESTRICT;
DROP FUNCTION public.write_storefront_cart(uuid,uuid,text,timestamptz,jsonb,uuid,integer) RESTRICT;
NOTIFY pgrst,'reload schema';
COMMIT;
