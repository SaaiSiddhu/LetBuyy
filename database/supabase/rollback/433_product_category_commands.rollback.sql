-- Empty-only category retirement. Retained records recover forward.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:433:product-categories',0));
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
  RAISE EXCEPTION 'rollback433 refuses concurrent/prepared writes or non-read-committed state';END IF;
END $quiescent$;

LOCK TABLE public.product_categories,public.product_category_command_receipts,public.products,public.audit_activity_events IN ACCESS EXCLUSIVE MODE;
DO $rollback433$
DECLARE signature text; f record; shape text; relation_row record; item record; trigger_row record; j record;
BEGIN
 IF EXISTS(SELECT 1 FROM public.product_categories)OR EXISTS(SELECT 1 FROM public.product_category_command_receipts)
  OR EXISTS(SELECT 1 FROM public.audit_activity_events WHERE resource_type='product_category')
  OR EXISTS(SELECT 1 FROM public.outbox_events WHERE event_type='category.metadata.updated')THEN
  RAISE EXCEPTION 'rollback433 refuses retained category history; recover forward';END IF;
 IF(SELECT count(*)FROM public.migration_privilege_journal WHERE migration='433')<>14
  OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='433'AND NOT(object_signature=ANY(ARRAY['public.guard_product_category_receipt_v1()','public.protect_product_category_audit_v1()','public.product_category_slug_v1(uuid,text)','public.assert_product_category_actor_v1(uuid,uuid,boolean)','public.product_category_snapshot_v1(uuid)','public.observe_product_category_label_v1()','public.read_product_category_v1(uuid,uuid,uuid)','public.read_product_category_page_v1(uuid,uuid,integer,integer,text)','public.apply_product_category_command_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)','public.product_categories','public.product_category_command_receipts','public.products:products_category_label','public.audit_activity_events:audit_product_category_immutable','public.audit_activity_events:audit_product_category_no_truncate'])))
  OR EXISTS(SELECT object_signature FROM public.migration_privilege_journal WHERE migration='433'GROUP BY object_signature HAVING count(*)<>1)THEN
  RAISE EXCEPTION 'rollback433 refuses missing or changed provenance';END IF;
 FOREACH signature IN ARRAY ARRAY['public.guard_product_category_receipt_v1()','public.protect_product_category_audit_v1()','public.product_category_slug_v1(uuid,text)','public.assert_product_category_actor_v1(uuid,uuid,boolean)','public.product_category_snapshot_v1(uuid)','public.observe_product_category_label_v1()','public.read_product_category_v1(uuid,uuid,uuid)','public.read_product_category_page_v1(uuid,uuid,integer,integer,text)','public.apply_product_category_command_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)'] LOOP
  SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure(signature);
  IF NOT FOUND THEN RAISE EXCEPTION 'rollback433 refuses missing function';END IF;
  SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='433'AND object_signature=signature;
  shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'acl',
 (SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a),
 'owner',f.proowner,'language',f.prolang,'kind',f.prokind,'config',f.proconfig,'strict',f.proisstrict,
 'leakproof',f.proleakproof,'parallel',f.proparallel,'volatility',f.provolatile,'security',f.prosecdef,
 'support',f.prosupport,'cost',f.procost,'rows',f.prorows)::text;
  IF j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner OR f.proowner<>current_user::regrole::oid
   OR j.grantee IS DISTINCT FROM current_user OR j.action IS DISTINCT FROM 'granted'OR j.privilege IS DISTINCT FROM 'CATEGORY FUNCTION PROFILE'
   OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex')THEN
   RAISE EXCEPTION 'rollback433 refuses changed function profile: %',signature;END IF;
 END LOOP;
 FOREACH signature IN ARRAY ARRAY['public.product_categories','public.product_category_command_receipts'] LOOP
  SELECT * INTO relation_row FROM pg_class WHERE oid=to_regclass(signature);
  SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='433'AND object_signature=signature;
  IF relation_row.relowner<>current_user::regrole::oid OR j.object_oid IS DISTINCT FROM relation_row.oid OR j.object_owner IS DISTINCT FROM relation_row.relowner
   OR j.grantee IS DISTINCT FROM current_user OR j.action IS DISTINCT FROM 'granted'OR j.privilege IS DISTINCT FROM 'CATEGORY TABLE PROFILE'
   OR NOT relation_row.relrowsecurity OR NOT relation_row.relforcerowsecurity
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(relation_row.relacl,acldefault('r',relation_row.relowner)))a WHERE a.grantee<>relation_row.relowner OR a.grantor<>relation_row.relowner)THEN
   RAISE EXCEPTION 'rollback433 refuses changed private table profile';END IF;
  SELECT jsonb_build_object(
 'relation',jsonb_build_array(t.relkind,t.relpersistence,t.relrowsecurity,t.relforcerowsecurity,t.reloptions,t.relreplident),
 'acl',(SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner)))a),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum)FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred)ORDER BY c.conname)FROM pg_constraint c WHERE c.conrelid=t.oid),
 'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid)ORDER BY i.indexrelid::regclass::text)FROM pg_index i WHERE i.indrelid=t.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(x.tgname,pg_get_triggerdef(x.oid),x.tgenabled)ORDER BY x.tgname)FROM pg_trigger x WHERE x.tgrelid=t.oid AND NOT x.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(x.polname,x.polcmd,x.polpermissive,x.polroles,pg_get_expr(x.polqual,x.polrelid),pg_get_expr(x.polwithcheck,x.polrelid))ORDER BY x.polname)FROM pg_policy x WHERE x.polrelid=t.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(x.oid)ORDER BY x.rulename)FROM pg_rewrite x WHERE x.ev_class=t.oid)
 )::text INTO shape FROM pg_class t WHERE t.oid=to_regclass(signature);
  IF j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex')THEN RAISE EXCEPTION 'rollback433 refuses changed table shape';END IF;
 END LOOP;
 FOR item IN SELECT * FROM(VALUES('public.products','products_category_label'),('public.audit_activity_events','audit_product_category_immutable'),('public.audit_activity_events','audit_product_category_no_truncate'))v(relation_name,trigger_name) LOOP
  SELECT * INTO relation_row FROM pg_class WHERE oid=to_regclass(item.relation_name);
  SELECT * INTO trigger_row FROM pg_trigger WHERE tgrelid=relation_row.oid AND tgname=item.trigger_name AND NOT tgisinternal;
  IF NOT FOUND THEN RAISE EXCEPTION 'rollback433 refuses missing trigger';END IF;
  SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='433'AND object_signature=item.relation_name||':'||item.trigger_name;
  shape:=jsonb_build_object('row',to_jsonb(trigger_row),'definition',pg_get_triggerdef(trigger_row.oid),'owner',relation_row.relowner)::text;
  IF j.object_oid IS DISTINCT FROM trigger_row.oid OR j.object_owner IS DISTINCT FROM relation_row.relowner OR relation_row.relowner<>current_user::regrole::oid
   OR j.grantee IS DISTINCT FROM current_user OR j.action IS DISTINCT FROM 'granted'OR j.privilege IS DISTINCT FROM 'CATEGORY TRIGGER PROFILE'
   OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex')THEN RAISE EXCEPTION 'rollback433 refuses changed trigger profile';END IF;
 END LOOP;
END $rollback433$;
DROP TRIGGER products_category_label ON public.products;
DROP TRIGGER audit_product_category_immutable ON public.audit_activity_events;
DROP TRIGGER audit_product_category_no_truncate ON public.audit_activity_events;
DROP TRIGGER product_category_receipts_immutable ON public.product_category_command_receipts;
DROP TRIGGER product_category_receipts_no_truncate ON public.product_category_command_receipts;
DROP FUNCTION public.apply_product_category_command_v1(uuid,uuid,text,uuid,integer,uuid,jsonb);
DROP FUNCTION public.read_product_category_page_v1(uuid,uuid,integer,integer,text);
DROP FUNCTION public.read_product_category_v1(uuid,uuid,uuid);
DROP FUNCTION public.observe_product_category_label_v1();
DROP FUNCTION public.product_category_snapshot_v1(uuid);
DROP FUNCTION public.assert_product_category_actor_v1(uuid,uuid,boolean);
DROP FUNCTION public.product_category_slug_v1(uuid,text);
DROP FUNCTION public.protect_product_category_audit_v1();
DROP FUNCTION public.guard_product_category_receipt_v1();
DROP TABLE public.product_category_command_receipts;
DROP TABLE public.product_categories;
DELETE FROM public.migration_privilege_journal WHERE migration='433';
NOTIFY pgrst,'reload schema';
COMMIT;
