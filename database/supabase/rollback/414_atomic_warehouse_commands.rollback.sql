-- Empty-only maintenance rollback. Retained command evidence is never deleted.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:414:warehouse-commands',0));
-- Preserve native catalog exclusion. Managed PostgreSQL requires the reviewed
-- provider-admin bootstrap; no advisory/event-trigger substitute is accepted.
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
DO $quiescent$ BEGIN
 IF current_setting('transaction_isolation')<>'read committed'
  OR EXISTS(SELECT 1 FROM pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted
   AND (l.pid IS NULL OR l.pid<>pg_backend_pid())) OR EXISTS(SELECT 1 FROM pg_prepared_xacts) THEN
  RAISE EXCEPTION 'rollback414 refuses concurrent/prepared writes or non-read-committed state';END IF;
END $quiescent$;
LOCK TABLE public.warehouse_command_receipts IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.migration_privilege_journal IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
DECLARE signature text; f record; j record; relation_row record; shape text; allowed_role oid;
 signatures constant text[]:=ARRAY['public.apply_warehouse_command_v1(uuid,uuid,text,text,uuid,jsonb,text)','public.guard_warehouse_command_receipt_v1()'];
BEGIN
 IF EXISTS(SELECT 1 FROM public.warehouse_command_receipts) THEN
  RAISE EXCEPTION 'rollback414 refuses retained warehouse command receipts';END IF;
 IF (SELECT count(*) FROM public.migration_privilege_journal WHERE migration='414' AND privilege IN('FUNCTION EXECUTION FENCE','PRIVATE RECEIPT SHAPE'))<>3
  OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='414' AND privilege IN('FUNCTION EXECUTION FENCE','PRIVATE RECEIPT SHAPE') AND NOT(object_signature=ANY(signatures) OR object_signature='public.warehouse_command_receipts'))
  OR EXISTS(SELECT object_signature FROM public.migration_privilege_journal WHERE migration='414' AND privilege IN('FUNCTION EXECUTION FENCE','PRIVATE RECEIPT SHAPE') GROUP BY object_signature HAVING count(*)<>1)
  OR (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('apply_warehouse_command_v1','guard_warehouse_command_receipt_v1'))<>2 THEN
  RAISE EXCEPTION 'rollback414 refuses missing/changed function family or provenance';END IF;
 FOREACH signature IN ARRAY signatures LOOP
  SELECT p.* INTO f FROM pg_proc p WHERE p.oid=to_regprocedure(signature);
  IF NOT FOUND THEN RAISE EXCEPTION 'rollback414 refuses missing typed function %',signature;END IF;
  SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='414' AND object_signature=signature;
  allowed_role:=CASE WHEN f.proname='apply_warehouse_command_v1' THEN 'app_tenant'::regrole::oid ELSE f.proowner END;
  IF NOT FOUND OR j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner
   OR j.grantee IS DISTINCT FROM pg_get_userbyid(f.proowner) OR j.privilege IS DISTINCT FROM 'FUNCTION EXECUTION FENCE' OR j.action IS DISTINCT FROM 'granted'
   OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')
   OR f.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
   OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
   OR f.prosecdef IS DISTINCT FROM (f.proname='apply_warehouse_command_v1')
   OR f.prorettype IS DISTINCT FROM (CASE WHEN f.proname='apply_warehouse_command_v1' THEN 'jsonb'::regtype::oid ELSE 'trigger'::regtype::oid END)
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) x
    WHERE x.grantee NOT IN(f.proowner,allowed_role) OR x.grantor<>f.proowner OR (x.grantee<>f.proowner AND x.is_grantable))
   OR NOT has_function_privilege(allowed_role,f.oid,'EXECUTE') THEN
   RAISE EXCEPTION 'rollback414 refuses changed function body/owner/ACL/provenance: %',signature;END IF;
 END LOOP;
 SELECT * INTO relation_row FROM pg_class WHERE oid='public.warehouse_command_receipts'::regclass;
 SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='414' AND object_signature='public.warehouse_command_receipts';
 IF NOT FOUND OR j.object_oid IS DISTINCT FROM relation_row.oid OR j.object_owner IS DISTINCT FROM relation_row.relowner
  OR j.grantee IS DISTINCT FROM pg_get_userbyid(relation_row.relowner) OR j.privilege IS DISTINCT FROM 'PRIVATE RECEIPT SHAPE' OR j.action IS DISTINCT FROM 'granted'
  OR relation_row.relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
  OR NOT relation_row.relrowsecurity OR NOT relation_row.relforcerowsecurity
  OR EXISTS(SELECT 1 FROM aclexplode(coalesce(relation_row.relacl,acldefault('r',relation_row.relowner))) x WHERE x.grantee<>relation_row.relowner OR x.grantor<>relation_row.relowner) THEN
  RAISE EXCEPTION 'rollback414 refuses changed receipt owner/ACL/provenance';END IF;
SELECT jsonb_build_object(
 'relation',jsonb_build_array(t.relkind,t.relpersistence,t.relrowsecurity,t.relforcerowsecurity,t.reloptions,t.relreplident),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid=t.oid),
 'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid::regclass::text) FROM pg_index i WHERE i.indrelid=t.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(x.tgname,pg_get_triggerdef(x.oid),x.tgenabled) ORDER BY x.tgname) FROM pg_trigger x WHERE x.tgrelid=t.oid AND NOT x.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(x.polname,x.polcmd,x.polpermissive,x.polroles,pg_get_expr(x.polqual,x.polrelid),pg_get_expr(x.polwithcheck,x.polrelid)) ORDER BY x.polname) FROM pg_policy x WHERE x.polrelid=t.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(x.oid) ORDER BY x.rulename) FROM pg_rewrite x WHERE x.ev_class=t.oid)
 )::text INTO shape FROM pg_class t WHERE t.oid='public.warehouse_command_receipts'::regclass;
 IF j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex') THEN
  RAISE EXCEPTION 'rollback414 refuses changed receipt shape';END IF;
END $preflight$;
DO $restore_effects$
DECLARE j record; original record; p record; entry record; signature text; original_path text; role_sql text;
 effect_signatures constant text[]:=ARRAY[
  'public.create_purchase_order_with_lines(uuid,uuid,uuid,jsonb,timestamptz,text,uuid,text,text)',
  'public.receive_purchase_order(uuid,jsonb,uuid,text,text)',
  'public.create_inventory_transfer_with_lines(uuid,uuid,uuid,jsonb,text,uuid,text,text)',
  'public.ship_inventory_transfer(uuid,uuid,text,text)',
  'public.receive_inventory_transfer(uuid,jsonb,uuid,text,text)',
  'public.receive_purchase_order_line(public.purchase_orders,public.purchase_order_lines,integer,uuid,text,text)',
  'public.receive_inventory_transfer_line(public.inventory_transfers,public.inventory_transfer_lines,integer,uuid,text,text)'
 ];
BEGIN
 IF(SELECT count(*) FROM public.migration_privilege_journal WHERE migration='414' AND privilege='WAREHOUSE EFFECT FENCE')<>7
  OR(SELECT count(DISTINCT object_signature)FROM public.migration_privilege_journal WHERE migration='414' AND privilege='WAREHOUSE EFFECT FENCE')<>7
  OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='414' AND privilege='WAREHOUSE EFFECT FENCE' AND NOT(object_signature=ANY(effect_signatures))) THEN
  RAISE EXCEPTION 'rollback414 refuses missing effect provenance';END IF;
 FOR j IN SELECT * FROM public.migration_privilege_journal WHERE migration='414' AND privilege='WAREHOUSE EFFECT FENCE' LOOP
  signature:=j.object_signature;
  SELECT * INTO p FROM pg_proc WHERE oid=to_regprocedure(signature);
  IF NOT FOUND OR p.oid IS DISTINCT FROM j.object_oid OR p.proowner IS DISTINCT FROM j.object_owner
   OR p.proowner<>current_user::regrole::oid OR NOT p.prosecdef
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
   OR encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') IS DISTINCT FROM j.object_definition_hash
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a WHERE a.grantee<>p.proowner OR a.grantor<>p.proowner) THEN
   RAISE EXCEPTION 'rollback414 refuses changed raw effect: %',signature;END IF;
  SELECT * INTO original FROM public.migration_privilege_journal WHERE migration='414' AND object_signature=signature
   AND privilege LIKE 'WAREHOUSE ORIGINAL SEARCH_PATH=%';
  IF NOT FOUND OR original.object_oid IS DISTINCT FROM p.oid OR original.object_owner IS DISTINCT FROM p.proowner THEN
   RAISE EXCEPTION 'rollback414 refuses missing original effect profile';END IF;
  original_path:=substr(original.privilege,length('WAREHOUSE ORIGINAL SEARCH_PATH=')+1);
  IF original_path NOT IN('public','public, pg_temp') THEN RAISE EXCEPTION 'rollback414 refuses unknown original search path';END IF;
  EXECUTE format('ALTER FUNCTION %s SET search_path=%s',signature,original_path);
  IF encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') IS DISTINCT FROM original.object_definition_hash THEN
   RAISE EXCEPTION 'rollback414 refuses changed original function definition';END IF;
  FOR entry IN SELECT * FROM public.migration_privilege_journal WHERE migration='414' AND object_signature=signature
   AND action='revoked' AND privilege IN('EXECUTE','EXECUTE WITH GRANT OPTION') ORDER BY grantee LOOP
   IF entry.grantee NOT IN('PUBLIC','anon','authenticated','app_tenant','service_role') OR entry.privilege<>'EXECUTE' OR entry.object_oid IS DISTINCT FROM p.oid OR entry.object_owner IS DISTINCT FROM p.proowner THEN RAISE EXCEPTION 'rollback414 refuses changed privilege provenance';END IF;
   role_sql:=CASE WHEN entry.grantee='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(entry.grantee) END;
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %s%s',signature,role_sql,CASE WHEN entry.privilege='EXECUTE WITH GRANT OPTION' THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;
 END LOOP;
END $restore_effects$;

DROP FUNCTION public.apply_warehouse_command_v1(uuid,uuid,text,text,uuid,jsonb,text) RESTRICT;
DROP TABLE public.warehouse_command_receipts RESTRICT;
DROP FUNCTION public.guard_warehouse_command_receipt_v1() RESTRICT;
DELETE FROM public.migration_privilege_journal WHERE migration='414';
NOTIFY pgrst,'reload schema';
COMMIT;
