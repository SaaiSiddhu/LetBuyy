-- Empty-only maintenance rollback. Retained command evidence is never deleted.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:356:inventory-adjustment',0));
LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
DO $quiescent$ BEGIN
 IF current_setting('transaction_isolation')<>'read committed'
  OR EXISTS(SELECT 1 FROM pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted
   AND (l.pid IS NULL OR l.pid<>pg_backend_pid())) OR EXISTS(SELECT 1 FROM pg_prepared_xacts) THEN
  RAISE EXCEPTION 'rollback356 refuses concurrent/prepared writes or non-read-committed state';END IF;
END $quiescent$;
LOCK TABLE public.inventory_adjustment_receipts IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.migration_privilege_journal IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
DECLARE signature text; f record; j record; relation_row record; shape text; allowed_role oid;
 signatures constant text[]:=ARRAY['public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb)','public.guard_inventory_adjustment_receipt_v1()'];
BEGIN
 IF EXISTS(SELECT 1 FROM public.inventory_adjustment_receipts) THEN
  RAISE EXCEPTION 'rollback356 refuses retained inventory adjustment receipts';END IF;
 IF (SELECT count(*) FROM public.migration_privilege_journal WHERE migration='356')<>3
  OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='356' AND NOT(object_signature=ANY(signatures) OR object_signature='public.inventory_adjustment_receipts'))
  OR EXISTS(SELECT object_signature FROM public.migration_privilege_journal WHERE migration='356' GROUP BY object_signature HAVING count(*)<>1)
  OR (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('apply_inventory_adjustment_v1','guard_inventory_adjustment_receipt_v1'))<>2 THEN
  RAISE EXCEPTION 'rollback356 refuses missing/changed function family or provenance';END IF;
 FOREACH signature IN ARRAY signatures LOOP
  SELECT p.* INTO f FROM pg_proc p WHERE p.oid=to_regprocedure(signature);
  IF NOT FOUND THEN RAISE EXCEPTION 'rollback356 refuses missing typed function %',signature;END IF;
  SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='356' AND object_signature=signature;
  allowed_role:=CASE WHEN f.proname='apply_inventory_adjustment_v1' THEN 'app_tenant'::regrole::oid ELSE f.proowner END;
  IF NOT FOUND OR j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner
   OR j.grantee IS DISTINCT FROM pg_get_userbyid(f.proowner) OR j.privilege IS DISTINCT FROM 'FUNCTION EXECUTION FENCE' OR j.action IS DISTINCT FROM 'granted'
   OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')
   OR f.proowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
   OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
   OR f.prosecdef IS DISTINCT FROM (f.proname='apply_inventory_adjustment_v1')
   OR f.prorettype IS DISTINCT FROM (CASE WHEN f.proname='apply_inventory_adjustment_v1' THEN 'jsonb'::regtype::oid ELSE 'trigger'::regtype::oid END)
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) x
    WHERE x.grantee NOT IN(f.proowner,allowed_role) OR x.grantor<>f.proowner OR (x.grantee<>f.proowner AND x.is_grantable))
   OR NOT has_function_privilege(allowed_role,f.oid,'EXECUTE') THEN
   RAISE EXCEPTION 'rollback356 refuses changed function body/owner/ACL/provenance: %',signature;END IF;
 END LOOP;
 SELECT * INTO relation_row FROM pg_class WHERE oid='public.inventory_adjustment_receipts'::regclass;
 SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='356' AND object_signature='public.inventory_adjustment_receipts';
 IF NOT FOUND OR j.object_oid IS DISTINCT FROM relation_row.oid OR j.object_owner IS DISTINCT FROM relation_row.relowner
  OR j.grantee IS DISTINCT FROM pg_get_userbyid(relation_row.relowner) OR j.privilege IS DISTINCT FROM 'PRIVATE RECEIPT SHAPE' OR j.action IS DISTINCT FROM 'granted'
  OR relation_row.relowner<>(SELECT oid FROM pg_roles WHERE rolname=current_user)
  OR NOT relation_row.relrowsecurity OR NOT relation_row.relforcerowsecurity
  OR EXISTS(SELECT 1 FROM aclexplode(coalesce(relation_row.relacl,acldefault('r',relation_row.relowner))) x WHERE x.grantee<>relation_row.relowner OR x.grantor<>relation_row.relowner) THEN
  RAISE EXCEPTION 'rollback356 refuses changed receipt owner/ACL/provenance';END IF;
SELECT jsonb_build_object(
 'relation',jsonb_build_array(t.relkind,t.relpersistence,t.relrowsecurity,t.relforcerowsecurity,t.reloptions,t.relreplident),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid=t.oid),
 'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid::regclass::text) FROM pg_index i WHERE i.indrelid=t.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(x.tgname,pg_get_triggerdef(x.oid),x.tgenabled) ORDER BY x.tgname) FROM pg_trigger x WHERE x.tgrelid=t.oid AND NOT x.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(x.polname,x.polcmd,x.polpermissive,x.polroles,pg_get_expr(x.polqual,x.polrelid),pg_get_expr(x.polwithcheck,x.polrelid)) ORDER BY x.polname) FROM pg_policy x WHERE x.polrelid=t.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(x.oid) ORDER BY x.rulename) FROM pg_rewrite x WHERE x.ev_class=t.oid)
 )::text INTO shape FROM pg_class t WHERE t.oid='public.inventory_adjustment_receipts'::regclass;
 IF j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex') THEN
  RAISE EXCEPTION 'rollback356 refuses changed receipt shape';END IF;
END $preflight$;
DROP FUNCTION public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb) RESTRICT;
DROP TABLE public.inventory_adjustment_receipts RESTRICT;
DROP FUNCTION public.guard_inventory_adjustment_receipt_v1() RESTRICT;
DELETE FROM public.migration_privilege_journal WHERE migration='356';
NOTIFY pgrst,'reload schema';
COMMIT;
