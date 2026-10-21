-- Deploy an application compatible with the predecessor reader before retiring
-- this RPC. No transfer, inventory or merchant data is changed.
BEGIN;
LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
DO $guard$
DECLARE p pg_catalog.pg_proc%ROWTYPE;
BEGIN
  SELECT * INTO p FROM pg_catalog.pg_proc
    WHERE oid=pg_catalog.to_regprocedure('public.read_merchant_transfer_metrics(uuid)');
  IF p.oid IS NULL OR p.prokind<>'f' OR p.prosecdef OR p.proretset
    OR p.prorettype<>'jsonb'::regtype OR p.pronargdefaults<>0 OR p.provariadic<>0
    OR p.provolatile<>'s' OR p.proisstrict OR p.proleakproof OR p.proparallel<>'u'
    OR p.proargnames IS DISTINCT FROM ARRAY['p_site_id']::text[]
    OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
    OR p.proowner<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.sites'::regclass)
    OR p.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='sql')
    OR pg_catalog.md5(p.prosrc)<>'03331c59962e3ae320be9bf928a44442'
    OR (SELECT count(*) FROM pg_catalog.pg_proc q WHERE q.pronamespace=p.pronamespace AND q.proname=p.proname)<>1
    OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
    OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE a.grantee NOT IN(p.proowner,'service_role'::regrole::oid) OR (a.grantee<>p.proowner AND a.is_grantable)) THEN
    RAISE EXCEPTION 'Migration380 rollback refuses a changed reader definition, owner or privileges';
  END IF;
END $guard$;
DROP FUNCTION public.read_merchant_transfer_metrics(uuid) RESTRICT;
NOTIFY pgrst, 'reload schema';
COMMIT;
