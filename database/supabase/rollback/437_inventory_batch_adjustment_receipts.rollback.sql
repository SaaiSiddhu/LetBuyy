-- Empty/retained-data-compatible source rollback; committed new effects require forward repair.
BEGIN;
SET LOCAL search_path=pg_catalog,public,pg_temp;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='300s';
DO $prepared437$BEGIN IF EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts)THEN
 RAISE EXCEPTION 'rollback437 refuses concurrent/prepared writes or non-read-committed state';END IF;END $prepared437$;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:356:inventory-adjustment',0));
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:437:inventory-batch',0));
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
DO $quiescent437$BEGIN IF current_setting('transaction_isolation')<>'read committed'
 OR EXISTS(SELECT 1 FROM pg_locks l WHERE l.locktype='transactionid'AND l.mode='ExclusiveLock'AND l.granted
 AND(l.pid IS NULL OR l.pid<>pg_backend_pid()))OR EXISTS(SELECT 1 FROM pg_prepared_xacts)THEN
 RAISE EXCEPTION 'rollback437 refuses concurrent/prepared writes or non-read-committed state';END IF;END $quiescent437$;
LOCK TABLE public.inventory_adjustment_receipts IN ACCESS EXCLUSIVE MODE NOWAIT;
DO $dependency437$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb)');
 IF NOT FOUND OR f.proowner<>current_user::regrole::oid
 OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'cd6ed6b6d356b3ce5f1013e6db2e8e8c2c69c63d89ddb7d19cbefe8dceaa5293'
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a
 WHERE a.grantor<>f.proowner OR NOT(a.grantee=ANY(ARRAY[current_user::regrole::oid,'app_tenant'::regrole::oid]))OR(a.grantee<>f.proowner AND a.is_grantable))
 THEN RAISE EXCEPTION 'rollback437 refuses changed dependency: public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb)';END IF;END $dependency437$;
DO $dependency437$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.assert_product_edit_actor_v1(uuid,uuid,text)');
 IF NOT FOUND OR f.proowner<>current_user::regrole::oid
 OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'0dc7ff20a4f1e99496c2cad437d0746ded832be5f2ffc9cc8d9e5086340a3933'
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a
 WHERE a.grantor<>f.proowner OR NOT(a.grantee=ANY(ARRAY[current_user::regrole::oid]))OR(a.grantee<>f.proowner AND a.is_grantable))
 THEN RAISE EXCEPTION 'rollback437 refuses changed dependency: public.assert_product_edit_actor_v1(uuid,uuid,text)';END IF;END $dependency437$;
DO $dependency437$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.guard_inventory_adjustment_receipt_v1()');
 IF NOT FOUND OR f.proowner<>current_user::regrole::oid
 OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'8178f95a3f4609f7d6cadf5a784cf08a8cb15d7123aa56c417afbc31f2a9af3f'
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a
 WHERE a.grantor<>f.proowner OR NOT(a.grantee=ANY(ARRAY[current_user::regrole::oid]))OR(a.grantee<>f.proowner AND a.is_grantable))
 THEN RAISE EXCEPTION 'rollback437 refuses changed dependency: public.guard_inventory_adjustment_receipt_v1()';END IF;END $dependency437$;
DO $check_functions437$DECLARE signature text;f record;j record;shape text;BEGIN FOREACH signature IN ARRAY ARRAY['public.adjust_inventory_level(uuid,uuid,uuid,integer,uuid,text,text,text)','public.apply_inventory_adjustment_batch_v1(uuid,uuid,text,jsonb)']LOOP SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure(signature);shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'owner',f.proowner,'acl',f.proacl,'language',f.prolang,'kind',f.prokind,'strict',f.proisstrict,'leakproof',f.proleakproof,'parallel',f.proparallel,'volatile',f.provolatile,'cost',f.procost,'rows',f.prorows,'support',f.prosupport,'config',f.proconfig,'comment',obj_description(f.oid,'pg_proc'))::text;SELECT *INTO j FROM public.migration_privilege_journal WHERE migration='437'AND object_signature=signature AND privilege='INVENTORY437 CURRENT FUNCTION';IF NOT FOUND OR j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner OR f.proowner IS DISTINCT FROM current_user::regrole::oid OR j.grantee IS DISTINCT FROM current_user OR j.action IS DISTINCT FROM 'granted'OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex')THEN RAISE EXCEPTION 'rollback437 refuses changed function profile: %',signature;END IF;END LOOP;END $check_functions437$;
DO $check_receipt437$DECLARE shape text;j record;BEGIN
SELECT jsonb_build_object(
 'acl',t.relacl,
 'relation',jsonb_build_array(t.relkind,t.relpersistence,t.relrowsecurity,t.relforcerowsecurity,t.reloptions,t.relreplident),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid=t.oid),
 'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid::regclass::text) FROM pg_index i WHERE i.indrelid=t.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(x.tgname,pg_get_triggerdef(x.oid),x.tgenabled) ORDER BY x.tgname) FROM pg_trigger x WHERE x.tgrelid=t.oid AND NOT x.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(x.polname,x.polcmd,x.polpermissive,x.polroles,pg_get_expr(x.polqual,x.polrelid),pg_get_expr(x.polwithcheck,x.polrelid)) ORDER BY x.polname) FROM pg_policy x WHERE x.polrelid=t.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(x.oid) ORDER BY x.rulename) FROM pg_rewrite x WHERE x.ev_class=t.oid)
 )::text INTO shape FROM pg_class t WHERE t.oid='public.inventory_adjustment_receipts'::regclass;
 SELECT *INTO j FROM public.migration_privilege_journal WHERE migration='437'AND object_signature='public.inventory_adjustment_receipts'AND privilege='INVENTORY437 CURRENT RECEIPT';
 IF NOT FOUND OR j.object_oid IS DISTINCT FROM 'public.inventory_adjustment_receipts'::regclass::oid OR j.object_owner IS DISTINCT FROM current_user::regrole::oid OR j.grantee IS DISTINCT FROM current_user OR j.action IS DISTINCT FROM 'granted'OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex')THEN RAISE EXCEPTION 'rollback437 refuses changed receipt profile';END IF;
 IF (SELECT relowner<>current_user::regrole::oid OR NOT relrowsecurity OR NOT relforcerowsecurity FROM pg_class WHERE oid='public.inventory_adjustment_receipts'::regclass)
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce((SELECT relacl FROM pg_class WHERE oid='public.inventory_adjustment_receipts'::regclass),acldefault('r',current_user::regrole::oid)))a WHERE a.grantee<>current_user::regrole::oid)
 OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.inventory_adjustment_receipts'::regclass AND a.attacl IS NOT NULL)
 THEN RAISE EXCEPTION 'rollback437 refuses changed receipt authority';END IF;
END $check_receipt437$;
DO $retained437$BEGIN IF EXISTS(SELECT 1 FROM public.inventory_adjustment_receipts WHERE operation='inventory.adjustment.batch.v1')
 OR EXISTS(SELECT 1 FROM public.outbox_events WHERE event_type='inventory.level.adjusted'AND idempotency_key LIKE 'inventory.level.adjusted:audit:%')THEN
 RAISE EXCEPTION 'rollback437 refuses retained inventory batch acknowledgements or adjustment effects; use compatible forward repair';END IF;END $retained437$;
DROP FUNCTION public.apply_inventory_adjustment_batch_v1(uuid,uuid,text,jsonb);
CREATE OR REPLACE FUNCTION public.adjust_inventory_level(p_product_id uuid, p_variant_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_adjustment integer DEFAULT 0, p_actor_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT 'adjustment'::text, p_notes text DEFAULT NULL::text, p_request_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_product RECORD;
    v_location_id UUID;
    v_level RECORD;
    v_next_available INTEGER;
    v_level_json JSONB;
BEGIN
    SELECT id, store_id
      INTO v_product
      FROM products
     WHERE id = p_product_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'product not found';
    END IF;

    PERFORM public.require_inventory_site_guc(v_product.store_id);

    IF p_location_id IS NULL THEN
        v_location_id := ensure_default_inventory_location(v_product.store_id);
    ELSE
        SELECT id
          INTO v_location_id
          FROM inventory_locations
         WHERE id = p_location_id
           AND store_id = v_product.store_id
           AND deleted_at IS NULL;

        IF v_location_id IS NULL THEN
            RAISE EXCEPTION 'inventory location not found for product store';
        END IF;
    END IF;

    SELECT *
      INTO v_level
      FROM inventory_levels
     WHERE product_id = p_product_id
       AND location_id = v_location_id
       AND (
            (p_variant_id IS NULL AND variant_id IS NULL)
            OR variant_id = p_variant_id
       )
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN
        v_next_available := p_adjustment;
        IF v_next_available < 0 THEN
            RAISE EXCEPTION 'cannot reduce inventory below zero';
        END IF;

        INSERT INTO inventory_levels (
            product_id,
            variant_id,
            location_id,
            available,
            reserved,
            incoming,
            updated_at
        )
        VALUES (
            p_product_id,
            p_variant_id,
            v_location_id,
            v_next_available,
            0,
            0,
            NOW()
        )
        RETURNING * INTO v_level;
    ELSE
        v_next_available := COALESCE(v_level.available, 0) + p_adjustment;

        IF v_next_available < 0 THEN
            RAISE EXCEPTION 'cannot reduce inventory below zero';
        END IF;

        IF v_next_available < COALESCE(v_level.reserved, 0) THEN
            RAISE EXCEPTION 'available inventory cannot be below reserved quantity';
        END IF;

        UPDATE inventory_levels
           SET available = v_next_available,
               updated_at = NOW()
         WHERE id = v_level.id
         RETURNING * INTO v_level;
    END IF;

    INSERT INTO inventory_adjustments (
        product_id,
        variant_id,
        location_id,
        quantity_change,
        reason,
        note,
        created_by
    )
    VALUES (
        p_product_id,
        p_variant_id,
        v_location_id,
        p_adjustment,
        CASE
            WHEN p_reason IN ('sale', 'return', 'adjustment', 'recount', 'transfer', 'damaged', 'reserved', 'unreserved')
            THEN p_reason
            ELSE 'adjustment'
        END,
        p_notes,
        p_actor_id
    );

    PERFORM public.sync_inventory_catalog_cache_v1(p_product_id,p_variant_id);

    INSERT INTO outbox_events (
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        actor_id
    )
    VALUES (
        v_product.store_id,
        'inventory',
        p_product_id::TEXT,
        'inventory.level.adjusted',
        jsonb_build_object(
            'store_id', v_product.store_id,
            'product_id', p_product_id,
            'variant_id', p_variant_id,
            'location_id', v_location_id,
            'adjustment', p_adjustment,
            'available', v_next_available
        ),
        'inventory.level.adjusted:' || p_product_id::TEXT || ':' || COALESCE(p_variant_id::TEXT, 'default') || ':' || v_location_id::TEXT || ':' || COALESCE(p_request_id, gen_random_uuid()::TEXT),
        p_request_id,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    SELECT to_jsonb(v_level) INTO v_level_json;
    RETURN v_level_json;
END;
$function$;
ALTER TABLE public.inventory_adjustment_receipts DROP CONSTRAINT inventory_adjustment_receipts_kind437;
ALTER TABLE public.inventory_adjustment_receipts DROP CONSTRAINT inventory_adjustment_receipts_operation_check;
ALTER TABLE public.inventory_adjustment_receipts ALTER COLUMN product_id SET NOT NULL;
ALTER TABLE public.inventory_adjustment_receipts ADD CONSTRAINT inventory_adjustment_receipts_operation_check CHECK(operation='inventory.adjustment.v1');
DO $original_receipt437$DECLARE shape text;j record;BEGIN
SELECT jsonb_build_object(
 'relation',jsonb_build_array(t.relkind,t.relpersistence,t.relrowsecurity,t.relforcerowsecurity,t.reloptions,t.relreplident),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid=t.oid),
 'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid::regclass::text) FROM pg_index i WHERE i.indrelid=t.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(x.tgname,pg_get_triggerdef(x.oid),x.tgenabled) ORDER BY x.tgname) FROM pg_trigger x WHERE x.tgrelid=t.oid AND NOT x.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(x.polname,x.polcmd,x.polpermissive,x.polroles,pg_get_expr(x.polqual,x.polrelid),pg_get_expr(x.polwithcheck,x.polrelid)) ORDER BY x.polname) FROM pg_policy x WHERE x.polrelid=t.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(x.oid) ORDER BY x.rulename) FROM pg_rewrite x WHERE x.ev_class=t.oid)
 )::text INTO shape FROM pg_class t WHERE t.oid='public.inventory_adjustment_receipts'::regclass;
 SELECT *INTO j FROM public.migration_privilege_journal WHERE migration='356'AND object_signature='public.inventory_adjustment_receipts'AND privilege='PRIVATE RECEIPT SHAPE';
 IF NOT FOUND OR j.object_oid IS DISTINCT FROM 'public.inventory_adjustment_receipts'::regclass::oid OR j.object_owner IS DISTINCT FROM current_user::regrole::oid OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex')THEN RAISE EXCEPTION 'rollback437 refuses changed original receipt shape';END IF;
 IF (SELECT relowner<>current_user::regrole::oid OR NOT relrowsecurity OR NOT relforcerowsecurity FROM pg_class WHERE oid='public.inventory_adjustment_receipts'::regclass)
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce((SELECT relacl FROM pg_class WHERE oid='public.inventory_adjustment_receipts'::regclass),acldefault('r',current_user::regrole::oid)))a WHERE a.grantee<>current_user::regrole::oid)
 OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid='public.inventory_adjustment_receipts'::regclass AND a.attacl IS NOT NULL)
 THEN RAISE EXCEPTION 'rollback437 refuses changed receipt authority';END IF;
END $original_receipt437$;
DO $dependency437$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.adjust_inventory_level(uuid,uuid,uuid,integer,uuid,text,text,text)');
 IF NOT FOUND OR f.proowner<>current_user::regrole::oid
 OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'b37a25b4cc117f78202b7f308685e5c179eed42e6ccb9b6a84ed53cfb6e7d90c'
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a
 WHERE a.grantor<>f.proowner OR NOT(a.grantee=ANY(ARRAY[current_user::regrole::oid,'app_tenant'::regrole::oid,'service_role'::regrole::oid]))OR(a.grantee<>f.proowner AND a.is_grantable))
 THEN RAISE EXCEPTION 'rollback437 refuses changed dependency: public.adjust_inventory_level(uuid,uuid,uuid,integer,uuid,text,text,text)';END IF;END $dependency437$;
DELETE FROM public.migration_privilege_journal WHERE migration='437';
NOTIFY pgrst,'reload schema';
COMMIT;
