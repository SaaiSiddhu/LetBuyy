-- Complete the existing catalog read projection; stock mutations, quantities and histories are unchanged. SOURCE/LOCAL ONLY.
BEGIN;
SET LOCAL search_path=pg_catalog,public,pg_temp;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='300s';
DO $prepared439$BEGIN IF EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts)THEN
 RAISE EXCEPTION 'migration439 refuses concurrent/prepared writes or non-read-committed state';END IF;END $prepared439$;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:439:catalog-availability',0));
DO $managed_catalog_fence$
BEGIN
 IF (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user) THEN
  LOCK TABLE pg_catalog.pg_proc,pg_catalog.pg_class,pg_catalog.pg_attribute,
 pg_catalog.pg_attrdef,pg_catalog.pg_constraint,pg_catalog.pg_trigger,
 pg_catalog.pg_policy,pg_catalog.pg_index,pg_catalog.pg_namespace,
 pg_catalog.pg_type,pg_catalog.pg_depend,pg_catalog.pg_rewrite,
 pg_catalog.pg_authid,pg_catalog.pg_auth_members,pg_catalog.pg_database,
 pg_catalog.pg_inherits,pg_catalog.pg_description,pg_catalog.pg_seclabel,
 pg_catalog.pg_extension,pg_catalog.pg_default_acl,pg_catalog.pg_init_privs,
 pg_catalog.pg_statistic_ext,pg_catalog.pg_shdepend
 IN SHARE ROW EXCLUSIVE MODE NOWAIT;
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
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['pg_catalog.pg_proc'::pg_catalog.regclass,'pg_catalog.pg_class'::pg_catalog.regclass,'pg_catalog.pg_attribute'::pg_catalog.regclass,'pg_catalog.pg_attrdef'::pg_catalog.regclass,'pg_catalog.pg_constraint'::pg_catalog.regclass,'pg_catalog.pg_trigger'::pg_catalog.regclass,'pg_catalog.pg_policy'::pg_catalog.regclass,'pg_catalog.pg_index'::pg_catalog.regclass,'pg_catalog.pg_namespace'::pg_catalog.regclass,'pg_catalog.pg_type'::pg_catalog.regclass,'pg_catalog.pg_depend'::pg_catalog.regclass,'pg_catalog.pg_rewrite'::pg_catalog.regclass,'pg_catalog.pg_authid'::pg_catalog.regclass,'pg_catalog.pg_auth_members'::pg_catalog.regclass,'pg_catalog.pg_database'::pg_catalog.regclass,'pg_catalog.pg_inherits'::pg_catalog.regclass,'pg_catalog.pg_description'::pg_catalog.regclass,'pg_catalog.pg_seclabel'::pg_catalog.regclass,'pg_catalog.pg_extension'::pg_catalog.regclass,'pg_catalog.pg_default_acl'::pg_catalog.regclass,'pg_catalog.pg_init_privs'::pg_catalog.regclass,'pg_catalog.pg_statistic_ext'::pg_catalog.regclass,'pg_catalog.pg_shdepend'::pg_catalog.regclass]::oid[]) catalog_oid
    WHERE NOT EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.pid=pg_catalog.pg_backend_pid()
     AND l.locktype='relation' AND l.relation=catalog_oid AND l.granted
     AND l.mode IN('ShareRowExclusiveLock','ExclusiveLock','AccessExclusiveLock')
     AND l.database IN(0,(SELECT oid FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())))) THEN
   RAISE EXCEPTION 'LETBUYY_NATIVE_CATALOG_LOCKS_REQUIRED';END IF;
 END IF;
END $managed_catalog_fence$;
DO $quiescent439$BEGIN IF current_setting('transaction_isolation')<>'read committed'
 OR EXISTS(SELECT 1 FROM pg_locks l WHERE l.locktype='transactionid'AND l.mode='ExclusiveLock'AND l.granted
 AND(l.pid IS NULL OR l.pid<>pg_backend_pid()))OR EXISTS(SELECT 1 FROM pg_prepared_xacts)THEN
 RAISE EXCEPTION 'migration439 refuses concurrent/prepared writes or non-read-committed state';END IF;END $quiescent439$;
LOCK TABLE public.products,public.product_variants,public.inventory_levels,public.inventory_locations IN SHARE MODE NOWAIT;
DO $admit439$BEGIN
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='439')
 OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='catalog_available_quantity')THEN
  RAISE EXCEPTION 'migration439 refuses an existing unreviewed projection';END IF;
END $admit439$;
CREATE FUNCTION public.catalog_available_quantity(p public.products) RETURNS bigint
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $function$
 WITH actual AS (
  SELECT id,store_id FROM public.products WHERE id=(p).id AND store_id=(p).store_id AND deleted_at IS NULL
 ), live_variants AS MATERIALIZED (
  -- The canonical editor admits 100 rows. Refuse to total a truncated legacy matrix.
  SELECT v.id AS variant_id FROM public.product_variants v JOIN actual p ON p.id=v.product_id WHERE v.deleted_at IS NULL LIMIT 101
 ), skus AS (
  SELECT variant_id FROM live_variants
  UNION ALL SELECT NULL::uuid FROM actual WHERE NOT EXISTS(SELECT 1 FROM live_variants)
 ), quantities AS (
  SELECT chosen.available FROM actual p CROSS JOIN skus s LEFT JOIN LATERAL (
   SELECT greatest(i.available::bigint-i.reserved::bigint,0) AS available
   FROM public.inventory_levels i JOIN public.inventory_locations loc ON loc.id=i.location_id
   WHERE i.product_id=p.id AND i.store_id=p.store_id AND i.variant_id IS NOT DISTINCT FROM s.variant_id
    AND i.deleted_at IS NULL AND loc.store_id=p.store_id AND loc.status='active' AND loc.deleted_at IS NULL
   ORDER BY loc.is_default DESC,i.updated_at ASC,i.id LIMIT 1
  ) chosen ON true
 )
 SELECT CASE WHEN count(*)=0 OR count(*)>100 OR count(available)<>count(*) THEN NULL ELSE sum(available)::bigint END FROM quantities;
$function$;
REVOKE ALL ON FUNCTION public.catalog_available_quantity(public.products) FROM PUBLIC,anon,authenticated,service_role,app_tenant;
GRANT EXECUTE ON FUNCTION public.catalog_available_quantity(public.products) TO service_role,app_tenant;
COMMENT ON FUNCTION public.catalog_available_quantity(public.products) IS 'Read-only catalog free quantity: live variants or base SKU, canonical active location per SKU, missing inventory is unknown. Base edit quantity is unchanged.';
DO $save439$DECLARE f record;shape text;BEGIN
 SELECT *INTO STRICT f FROM pg_proc WHERE oid='public.catalog_available_quantity(public.products)'::regprocedure;
 IF f.proowner<>current_user::regrole::oid OR f.prosecdef OR f.provolatile<>'s'
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a
  WHERE a.grantor<>f.proowner OR a.grantee NOT IN(f.proowner,'service_role'::regrole,'app_tenant'::regrole)
   OR(a.grantee<>f.proowner AND a.is_grantable))THEN RAISE EXCEPTION 'migration439 refuses unreviewed function authority';END IF;
 shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'owner',f.proowner,'acl',f.proacl,'language',f.prolang,'kind',f.prokind,'strict',f.proisstrict,'leakproof',f.proleakproof,'parallel',f.proparallel,'volatile',f.provolatile,'cost',f.procost,'rows',f.prorows,'support',f.prosupport,'config',f.proconfig,'comment',obj_description(f.oid,'pg_proc'))::text;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 VALUES('439','public.catalog_available_quantity(public.products)',current_user,'CATALOG439 CURRENT FUNCTION','granted',f.oid,f.proowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
END $save439$;
NOTIFY pgrst,'reload schema';
COMMIT;
