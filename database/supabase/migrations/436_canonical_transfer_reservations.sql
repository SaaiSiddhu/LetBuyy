-- Human decision3November2026: use the existing canonical reservation kernel;
-- an outbound transfer commits when shipped. SOURCE/LOCAL CANDIDATE ONLY.
BEGIN;
SET LOCAL search_path=pg_catalog,public,pg_temp;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='300s';
-- Reuse the canonical native/provider-admin catalog fence. Existing prepared
-- writers are refused before either catalog or domain lock acquisition.
DO $prepared436$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
  RAISE EXCEPTION 'migration436 refuses concurrent/prepared writes or non-read-committed state';
 END IF;
END $prepared436$;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:414:warehouse-commands',0));
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:356:inventory-adjustment',0));
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:436:inventory',0));
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
DO $quiescent436$ BEGIN
 IF current_setting('transaction_isolation')<>'read committed'
  OR EXISTS(SELECT 1 FROM pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted
   AND (l.pid IS NULL OR l.pid<>pg_backend_pid())) OR EXISTS(SELECT 1 FROM pg_prepared_xacts) THEN
  RAISE EXCEPTION 'migration436 refuses concurrent/prepared writes or non-read-committed state';
 END IF;
END $quiescent436$;
DO $preflight436$ BEGIN
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='436')
 OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'AND (table_name='inventory_transfer_lines'AND column_name='reservation_id'OR table_name='inventory_levels'AND column_name='free_quantity')) THEN
  RAISE EXCEPTION 'migration436 refuses an existing unreviewed cutover';END IF;
END $preflight436$;
LOCK TABLE public.inventory_levels,public.inventory_reservations,public.inventory_transfers,public.inventory_transfer_lines IN SHARE ROW EXCLUSIVE MODE NOWAIT;
-- ACL array order is not a permission difference. Compare the exact original
-- grant entries in C order, retaining every principal, grantor and grant option.
-- Owner/body guards and raw journal preimages remain unchanged for rollback.
DO $original436$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.commit_inventory_reservation(uuid,uuid,text,uuid,text)');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'6b66d38e0224aa83b14a7c34e24a9a84b6c7bbe25f5e378a9ddd7d6bbea41a63'OR coalesce((SELECT pg_catalog.jsonb_agg(entry.value::text ORDER BY entry.value::text COLLATE "C") FROM pg_catalog.unnest(f.proacl) AS entry(value)),'null'::jsonb)IS DISTINCT FROM '["app_tenant=X/postgres","postgres=X/postgres","service_role=X/postgres"]'::jsonb THEN RAISE EXCEPTION 'migration436 refuses changed original function: public.commit_inventory_reservation(uuid,uuid,text,uuid,text)';END IF;END $original436$;
DO $original436$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.set_inventory_level_available(uuid,uuid,uuid,integer,uuid,text,text,text)');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'1228943cef63df33710a0311824f1236de2e1c8aba0fde97acd2915ef20b9376'OR coalesce((SELECT pg_catalog.jsonb_agg(entry.value::text ORDER BY entry.value::text COLLATE "C") FROM pg_catalog.unnest(f.proacl) AS entry(value)),'null'::jsonb)IS DISTINCT FROM '["app_tenant=X/postgres","postgres=X/postgres","service_role=X/postgres"]'::jsonb THEN RAISE EXCEPTION 'migration436 refuses changed original function: public.set_inventory_level_available(uuid,uuid,uuid,integer,uuid,text,text,text)';END IF;END $original436$;
DO $original436$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.adjust_inventory_level(uuid,uuid,uuid,integer,uuid,text,text,text)');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'fef31757de0a466d4d59a90cc3b143bebbbc7291b3e5e6063b758900d4dad346'OR coalesce((SELECT pg_catalog.jsonb_agg(entry.value::text ORDER BY entry.value::text COLLATE "C") FROM pg_catalog.unnest(f.proacl) AS entry(value)),'null'::jsonb)IS DISTINCT FROM '["app_tenant=X/postgres","postgres=X/postgres","service_role=X/postgres"]'::jsonb THEN RAISE EXCEPTION 'migration436 refuses changed original function: public.adjust_inventory_level(uuid,uuid,uuid,integer,uuid,text,text,text)';END IF;END $original436$;
DO $original436$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.receive_inventory_transfer_line(inventory_transfers,inventory_transfer_lines,integer,uuid,text,text)');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'fc20e17f8ef443dcedd4ff77068bc1738ca0611f3681a702e26a6f4a44e3cb7b'OR coalesce((SELECT pg_catalog.jsonb_agg(entry.value::text ORDER BY entry.value::text COLLATE "C") FROM pg_catalog.unnest(f.proacl) AS entry(value)),'null'::jsonb)IS DISTINCT FROM '["postgres=X/postgres"]'::jsonb THEN RAISE EXCEPTION 'migration436 refuses changed original function: public.receive_inventory_transfer_line(inventory_transfers,inventory_transfer_lines,integer,uuid,text,text)';END IF;END $original436$;
DO $original436$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.receive_purchase_order_line(purchase_orders,purchase_order_lines,integer,uuid,text,text)');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'d90ce98f89f06f3094f0cb195b3541a21290039fb4e3f62f962e1ac15268a3e1'OR coalesce((SELECT pg_catalog.jsonb_agg(entry.value::text ORDER BY entry.value::text COLLATE "C") FROM pg_catalog.unnest(f.proacl) AS entry(value)),'null'::jsonb)IS DISTINCT FROM '["postgres=X/postgres"]'::jsonb THEN RAISE EXCEPTION 'migration436 refuses changed original function: public.receive_purchase_order_line(purchase_orders,purchase_order_lines,integer,uuid,text,text)';END IF;END $original436$;
DO $original436$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.release_order_inventory(uuid,uuid,text,text)');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'bb715e81f3a3f9d67046e1e605c2a2517b2b36253d2a3b7ffb1aed9277a9a8a9'OR coalesce((SELECT pg_catalog.jsonb_agg(entry.value::text ORDER BY entry.value::text COLLATE "C") FROM pg_catalog.unnest(f.proacl) AS entry(value)),'null'::jsonb)IS DISTINCT FROM '["app_tenant=X/postgres","postgres=X/postgres","service_role=X/postgres"]'::jsonb THEN RAISE EXCEPTION 'migration436 refuses changed original function: public.release_order_inventory(uuid,uuid,text,text)';END IF;END $original436$;
DO $original436$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.create_order_return_and_refund(uuid,jsonb,text,text,boolean,uuid,text,text)');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'2fbfde898591976f0ca08832a0c473f7cf602cc536677bd6e1d0d0ff0a1f3140'OR coalesce((SELECT pg_catalog.jsonb_agg(entry.value::text ORDER BY entry.value::text COLLATE "C") FROM pg_catalog.unnest(f.proacl) AS entry(value)),'null'::jsonb)IS DISTINCT FROM '["app_tenant=X/postgres","postgres=X/postgres","service_role=X/postgres"]'::jsonb THEN RAISE EXCEPTION 'migration436 refuses changed original function: public.create_order_return_and_refund(uuid,jsonb,text,text,boolean,uuid,text,text)';END IF;END $original436$;
DO $original436$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.reserve_inventory(uuid,uuid,uuid,uuid,integer,integer,text,uuid,text)');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'76499b5579697cf5530e8105d3453e0d56a25aa42c6c17d3025d0e766bdeb5aa'OR coalesce((SELECT pg_catalog.jsonb_agg(entry.value::text ORDER BY entry.value::text COLLATE "C") FROM pg_catalog.unnest(f.proacl) AS entry(value)),'null'::jsonb)IS DISTINCT FROM '["app_tenant=X/postgres","postgres=X/postgres","service_role=X/postgres"]'::jsonb THEN RAISE EXCEPTION 'migration436 refuses changed original function: public.reserve_inventory(uuid,uuid,uuid,uuid,integer,integer,text,uuid,text)';END IF;END $original436$;
DO $original436$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.release_inventory_reservation(uuid,uuid,text,text,uuid,text)');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'091db94817d7cbd1fa6b28afc963109f3158d1b8a3fd67a06f5edf1d46572e04'OR coalesce((SELECT pg_catalog.jsonb_agg(entry.value::text ORDER BY entry.value::text COLLATE "C") FROM pg_catalog.unnest(f.proacl) AS entry(value)),'null'::jsonb)IS DISTINCT FROM '["app_tenant=X/postgres","postgres=X/postgres","service_role=X/postgres"]'::jsonb THEN RAISE EXCEPTION 'migration436 refuses changed original function: public.release_inventory_reservation(uuid,uuid,text,text,uuid,text)';END IF;END $original436$;
DO $original436$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.expire_inventory_reservations(integer,text)');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'93799f0b6d0fba8d1ba66e20c04890586ac7eaa9141e9f52804f1d87a873d5fb'OR coalesce((SELECT pg_catalog.jsonb_agg(entry.value::text ORDER BY entry.value::text COLLATE "C") FROM pg_catalog.unnest(f.proacl) AS entry(value)),'null'::jsonb)IS DISTINCT FROM '["app_tenant=X/postgres","postgres=X/postgres","service_role=X/postgres"]'::jsonb THEN RAISE EXCEPTION 'migration436 refuses changed original function: public.expire_inventory_reservations(integer,text)';END IF;END $original436$;
DO $original436$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.create_inventory_transfer_with_lines(uuid,uuid,uuid,jsonb,text,uuid,text,text)');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'a9388a24b113ba8311c25335963d194c94f2b5b2a7caa92c266998d4955b1e11'OR coalesce((SELECT pg_catalog.jsonb_agg(entry.value::text ORDER BY entry.value::text COLLATE "C") FROM pg_catalog.unnest(f.proacl) AS entry(value)),'null'::jsonb)IS DISTINCT FROM '["postgres=X/postgres"]'::jsonb THEN RAISE EXCEPTION 'migration436 refuses changed original function: public.create_inventory_transfer_with_lines(uuid,uuid,uuid,jsonb,text,uuid,text,text)';END IF;END $original436$;
DO $original436$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.ship_inventory_transfer(uuid,uuid,text,text)');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'a548031245c5b5f754af0a957583f1d004cacb7543f2c153e95c40ced041a739'OR coalesce((SELECT pg_catalog.jsonb_agg(entry.value::text ORDER BY entry.value::text COLLATE "C") FROM pg_catalog.unnest(f.proacl) AS entry(value)),'null'::jsonb)IS DISTINCT FROM '["postgres=X/postgres"]'::jsonb THEN RAISE EXCEPTION 'migration436 refuses changed original function: public.ship_inventory_transfer(uuid,uuid,text,text)';END IF;END $original436$;
DO $original436$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text)');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'809ba14c50b12749c2ff988061be4be9a5921606d03aa61980980aad08e96dcc'OR coalesce((SELECT pg_catalog.jsonb_agg(entry.value::text ORDER BY entry.value::text COLLATE "C") FROM pg_catalog.unnest(f.proacl) AS entry(value)),'null'::jsonb)IS DISTINCT FROM '["postgres=X/postgres"]'::jsonb THEN RAISE EXCEPTION 'migration436 refuses changed original function: public.create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text)';END IF;END $original436$;
DO $fence436$DECLARE relation regclass;v_grant record;role_sql text;BEGIN
 FOREACH relation IN ARRAY ARRAY['public.inventory_levels'::regclass,'public.inventory_reservations'::regclass,'public.inventory_transfers'::regclass,'public.inventory_transfer_lines'::regclass]LOOP
  IF (SELECT relowner<>current_user::regrole::oid OR NOT relrowsecurity OR NOT relforcerowsecurity FROM pg_class WHERE oid=relation)
   OR EXISTS(SELECT 1 FROM pg_attribute c CROSS JOIN LATERAL aclexplode(c.attacl)column_acl WHERE c.attrelid=relation AND column_acl.grantee<>(SELECT relowner FROM pg_class WHERE oid=relation)AND column_acl.privilege_type IN('INSERT','UPDATE'))THEN RAISE EXCEPTION 'migration436 refuses unreviewed inventory relation profile';END IF;
  FOR v_grant IN SELECT *FROM aclexplode(coalesce((SELECT relacl FROM pg_class WHERE oid=relation),acldefault('r',current_user::regrole::oid)))WHERE grantee<>current_user::regrole::oid AND privilege_type IN('INSERT','UPDATE','DELETE','TRUNCATE')LOOP
   IF v_grant.grantor<>current_user::regrole::oid OR v_grant.is_grantable OR v_grant.grantee NOT IN(0,'anon'::regrole::oid,'authenticated'::regrole::oid,'app_tenant'::regrole::oid,'service_role'::regrole::oid)THEN RAISE EXCEPTION 'migration436 refuses unreviewed raw inventory grants';END IF;
   role_sql:=CASE WHEN v_grant.grantee=0 THEN 'PUBLIC'ELSE quote_ident(pg_get_userbyid(v_grant.grantee))END;
   INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
   VALUES('436',relation::text,CASE WHEN v_grant.grantee=0 THEN 'PUBLIC'ELSE pg_get_userbyid(v_grant.grantee)END,'INVENTORY436 ORIGINAL DML:'||v_grant.privilege_type,'revoked',relation,current_user::regrole::oid,'raw-dml-revoked');
   EXECUTE format('REVOKE %s ON TABLE %s FROM %s',v_grant.privilege_type,relation,role_sql);
  END LOOP;
 END LOOP;
END $fence436$;
-- Existing inventory reservations remain the sole hold/commit owner. The line
-- reference binds a non-expiring warehouse hold; it is never a second counter.
ALTER TABLE public.inventory_transfer_lines
 ADD COLUMN reservation_id uuid UNIQUE REFERENCES public.inventory_reservations(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_levels ADD COLUMN free_quantity integer
 GENERATED ALWAYS AS (greatest(available-reserved,0)) STORED;
CREATE INDEX inventory_levels_free_page436_idx ON public.inventory_levels(store_id,free_quantity,id) WHERE deleted_at IS NULL;

-- Existing compatibility columns are projections of the same raw quantities.
-- Neither a legacy writer nor a historical event can make them a second stock
-- authority. Raw available is physical stock; reserved is its held subset.
CREATE FUNCTION public.sync_inventory_level_quantities_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 NEW.on_hand_quantity:=NEW.available;
 NEW.available_quantity:=greatest(NEW.available-NEW.reserved,0);
 NEW.reserved_quantity:=NEW.reserved;
 NEW.incoming_quantity:=NEW.incoming;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.sync_inventory_level_quantities_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
CREATE TRIGGER inventory_levels_canonical_quantities436 BEFORE INSERT OR UPDATE ON public.inventory_levels
 FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_level_quantities_v1();

CREATE FUNCTION public.sync_inventory_catalog_cache_v1(p_product_id uuid,p_variant_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE v_site uuid; v_free integer;
BEGIN
 SELECT store_id INTO STRICT v_site FROM public.products WHERE id=p_product_id;
 SELECT greatest(i.available-i.reserved,0) INTO v_free FROM public.inventory_levels i
 JOIN public.inventory_locations l ON l.id=i.location_id AND l.store_id=v_site
 WHERE i.store_id=v_site AND i.product_id=p_product_id AND i.variant_id IS NOT DISTINCT FROM p_variant_id
  AND i.deleted_at IS NULL AND l.deleted_at IS NULL AND l.status='active'
 ORDER BY l.is_default DESC,i.updated_at ASC,i.id LIMIT 1;
 v_free:=coalesce(v_free,0);
 IF p_variant_id IS NULL THEN
  UPDATE public.products SET stock=v_free,updated_at=now() WHERE id=p_product_id AND stock IS DISTINCT FROM v_free;
 ELSE
  UPDATE public.product_variants SET inventory_qty=v_free,updated_at=now()
   WHERE id=p_variant_id AND product_id=p_product_id AND inventory_qty IS DISTINCT FROM v_free;
 END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.sync_inventory_catalog_cache_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,app_tenant,service_role;

CREATE FUNCTION public.assert_transfer_reservation_binding_v1(p_reservation_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE r public.inventory_reservations%ROWTYPE; l public.inventory_transfer_lines%ROWTYPE; t public.inventory_transfers%ROWTYPE; base integer;
BEGIN
 IF p_reservation_id IS NULL THEN RETURN;END IF;
 SELECT * INTO r FROM public.inventory_reservations WHERE id=p_reservation_id;
 IF NOT FOUND THEN RETURN;END IF;
 SELECT * INTO l FROM public.inventory_transfer_lines WHERE reservation_id=p_reservation_id;
 IF NOT FOUND THEN
  IF NOT isfinite(r.expires_at) THEN RAISE EXCEPTION 'INVENTORY_TRANSFER_BINDING_REQUIRED' USING ERRCODE='23514';END IF;
  RETURN;
 END IF;
 SELECT * INTO STRICT t FROM public.inventory_transfers WHERE id=l.transfer_id;
 IF coalesce(l.metadata#>>'{canonical_reservation436,base_received}','0') !~ '^[0-9]{1,7}$' THEN
  RAISE EXCEPTION 'INVENTORY_TRANSFER_BINDING_INVALID' USING ERRCODE='23514';END IF;
 base:=coalesce(l.metadata#>>'{canonical_reservation436,base_received}','0')::integer;
 IF r.deleted_at IS NOT NULL OR l.deleted_at IS NOT NULL OR t.deleted_at IS NOT NULL
  OR t.status NOT IN('reserved','shipped','partially_received','received')
  OR l.site_id<>t.site_id OR r.store_id<>t.site_id OR r.product_id<>l.product_id
  OR r.variant_id IS DISTINCT FROM l.variant_id OR r.location_id<>t.source_location_id OR r.order_id IS NOT NULL
  OR base>l.quantity_received OR base+r.quantity<>l.quantity_requested
  OR r.expires_at IS DISTINCT FROM 'infinity'::timestamptz
  OR (t.status='reserved' AND r.status NOT IN('active','hold'))
  OR (t.status IN('shipped','partially_received','received') AND r.status<>'committed') THEN
  RAISE EXCEPTION 'INVENTORY_TRANSFER_BINDING_INVALID' USING ERRCODE='23514';
 END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.assert_transfer_reservation_binding_v1(uuid) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
CREATE FUNCTION public.guard_transfer_reservation_binding_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE v_line record;
BEGIN
 IF TG_TABLE_NAME='inventory_reservations' THEN
  IF TG_OP<>'DELETE' THEN PERFORM public.assert_transfer_reservation_binding_v1(NEW.id);END IF;
 ELSIF TG_TABLE_NAME='inventory_transfers' THEN
  FOR v_line IN SELECT reservation_id FROM public.inventory_transfer_lines WHERE transfer_id=NEW.id LOOP
   PERFORM public.assert_transfer_reservation_binding_v1(v_line.reservation_id);
  END LOOP;
 ELSE
  IF TG_OP<>'INSERT' THEN PERFORM public.assert_transfer_reservation_binding_v1(OLD.reservation_id);END IF;
  IF TG_OP<>'DELETE' THEN PERFORM public.assert_transfer_reservation_binding_v1(NEW.reservation_id);END IF;
 END IF;
 RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_transfer_reservation_binding_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
CREATE CONSTRAINT TRIGGER inventory_reservation_transfer_binding436
 AFTER INSERT OR UPDATE ON public.inventory_reservations DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION public.guard_transfer_reservation_binding_v1();
CREATE CONSTRAINT TRIGGER inventory_transfer_reservation_binding436
 AFTER INSERT OR UPDATE OR DELETE ON public.inventory_transfer_lines DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION public.guard_transfer_reservation_binding_v1();
CREATE CONSTRAINT TRIGGER inventory_transfer_parent_binding436
 AFTER UPDATE ON public.inventory_transfers DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION public.guard_transfer_reservation_binding_v1();

CREATE OR REPLACE FUNCTION public.commit_inventory_reservation(p_store_id uuid, p_reservation_id uuid, p_idempotency_key text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_reservation public.inventory_reservations%ROWTYPE;
  v_new_available integer;
BEGIN
  PERFORM public.require_inventory_site_guc(p_store_id);

  SELECT * INTO v_reservation
    FROM public.inventory_reservations
   WHERE id = p_reservation_id
     AND store_id = p_store_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory reservation not found';
  END IF;

  IF v_reservation.status = 'committed' THEN
    RETURN jsonb_build_object('reservation_id', v_reservation.id, 'status', 'committed', 'idempotent', true);
  END IF;

  IF v_reservation.status NOT IN ('active', 'hold') THEN
    RAISE EXCEPTION 'inventory reservation cannot be committed from status %', v_reservation.status;
  END IF;

  PERFORM id FROM public.inventory_levels WHERE store_id=p_store_id AND product_id=v_reservation.product_id
    AND variant_id IS NOT DISTINCT FROM v_reservation.variant_id AND location_id=v_reservation.location_id
    AND deleted_at IS NULL AND available>=v_reservation.quantity AND reserved>=v_reservation.quantity FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INSUFFICIENT_INVENTORY';END IF;

  UPDATE public.inventory_levels
     SET available = GREATEST(available - v_reservation.quantity, 0),
         reserved = GREATEST(reserved - v_reservation.quantity, 0),
         available_quantity = GREATEST(COALESCE(available_quantity, available) - v_reservation.quantity, 0),
         reserved_quantity = GREATEST(COALESCE(reserved_quantity, reserved) - v_reservation.quantity, 0),
         committed_quantity = COALESCE(committed_quantity, 0) + v_reservation.quantity,
         updated_at = now()
   WHERE store_id = p_store_id
     AND product_id = v_reservation.product_id
     AND variant_id IS NOT DISTINCT FROM v_reservation.variant_id
     AND location_id = v_reservation.location_id
   RETURNING available INTO v_new_available;

  -- T17: keep the shopper-visible cache in sync with the sale this reservation just finalized.
  PERFORM public.sync_inventory_catalog_cache_v1(v_reservation.product_id,v_reservation.variant_id);

  UPDATE public.inventory_reservations
     SET status = 'committed',
         committed_at = now(),
         commit_idempotency_key = p_idempotency_key,
         updated_at = now()
   WHERE id = v_reservation.id
   RETURNING * INTO v_reservation;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation.id,
    'status', v_reservation.status,
    'quantity', v_reservation.quantity,
    'request_id', p_request_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_inventory_level_available(p_product_id uuid, p_variant_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_available integer DEFAULT 0, p_actor_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT 'adjustment'::text, p_notes text DEFAULT NULL::text, p_request_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_product RECORD;
    v_location_id UUID;
    v_level RECORD;
    v_previous_available INTEGER := 0;
    v_delta INTEGER := 0;
    v_level_json JSONB;
BEGIN
    IF p_available < 0 THEN
        RAISE EXCEPTION 'available inventory cannot be negative';
    END IF;

    SELECT id, store_id
      INTO v_product
      FROM products
     WHERE id = p_product_id
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'product not found';
    END IF;

    PERFORM public.require_inventory_site_guc(v_product.store_id);

    IF p_variant_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM product_variants
            WHERE id = p_variant_id
              AND product_id = p_product_id
       ) THEN
        RAISE EXCEPTION 'variant not found for product';
    END IF;

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
            p_available,
            0,
            0,
            NOW()
        )
        RETURNING * INTO v_level;
        v_delta := p_available;
    ELSE
        v_previous_available := COALESCE(v_level.available, 0);
        -- Public absolute stock is free stock; preserve the existing held subset.
        p_available := p_available + COALESCE(v_level.reserved, 0);
        v_delta := p_available - v_previous_available;

        IF p_available < COALESCE(v_level.reserved, 0) THEN
            RAISE EXCEPTION 'available inventory cannot be below reserved quantity';
        END IF;

        UPDATE inventory_levels
           SET available = p_available,
               updated_at = NOW()
         WHERE id = v_level.id
         RETURNING * INTO v_level;
    END IF;

    IF v_delta <> 0 THEN
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
            v_delta,
            CASE
                WHEN p_reason IN ('sale', 'return', 'adjustment', 'recount', 'transfer', 'damaged', 'reserved', 'unreserved')
                THEN p_reason
                ELSE 'adjustment'
            END,
            p_notes,
            p_actor_id
        );
    END IF;

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
        'inventory.level.set',
        jsonb_build_object(
            'store_id', v_product.store_id,
            'product_id', p_product_id,
            'variant_id', p_variant_id,
            'location_id', v_location_id,
            'available', p_available,
            'delta', v_delta
        ),
        'inventory.level.set:' || p_product_id::TEXT || ':' || COALESCE(p_variant_id::TEXT, 'default') || ':' || v_location_id::TEXT || ':' || COALESCE(p_request_id, gen_random_uuid()::TEXT),
        p_request_id,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    SELECT to_jsonb(v_level) INTO v_level_json;
    RETURN v_level_json;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.receive_inventory_transfer_line(p_transfer inventory_transfers, p_line inventory_transfer_lines, p_quantity integer, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_source_level_id UUID;
    v_dest_level_id UUID;
    v_new_available integer;
BEGIN
    IF p_line.reservation_id IS NULL THEN RAISE EXCEPTION 'WAREHOUSE_STATE_CONFLICT'; END IF;
    PERFORM public.assert_transfer_reservation_binding_v1(p_line.reservation_id);
    v_source_level_id := ensure_inventory_level_for_location(p_line.product_id, p_line.variant_id, p_transfer.source_location_id);
    v_dest_level_id := ensure_inventory_level_for_location(p_line.product_id, p_line.variant_id, p_transfer.destination_location_id);

    UPDATE inventory_transfer_lines
       SET quantity_received = quantity_received + p_quantity,
           status = CASE WHEN quantity_received + p_quantity >= quantity_requested THEN 'received' ELSE 'partially_received' END,
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_line.id;

    -- Source stock was committed once at shipment; receiving only adds destination stock.

    UPDATE inventory_levels
       SET available = available + p_quantity,
           available_quantity = COALESCE(available_quantity, available) + p_quantity,
           on_hand_quantity = COALESCE(on_hand_quantity, available + reserved) + p_quantity,
           updated_at = NOW()
     WHERE id = v_dest_level_id
     RETURNING available INTO v_new_available;

    -- T17: the destination location just received stock -- sync the cache to its new total.
    PERFORM public.sync_inventory_catalog_cache_v1(p_line.product_id,p_line.variant_id);

    INSERT INTO inventory_transfer_receipts (
        site_id, transfer_id, transfer_line_id, product_id, variant_id,
        source_location_id, destination_location_id, quantity_received,
        idempotency_key, request_id, created_by
    )
    VALUES (
        p_transfer.site_id, p_transfer.id, p_line.id, p_line.product_id, p_line.variant_id,
        p_transfer.source_location_id, p_transfer.destination_location_id, p_quantity,
        p_idempotency_key || ':line:' || p_line.id::TEXT, p_request_id, p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO inventory_events (
        site_id, inventory_level_id, location_id, product_id, variant_id,
        event_type, quantity_delta, on_hand_quantity, available_quantity,
        committed_quantity, unavailable_quantity, incoming_quantity, reserved_quantity,
        safety_stock_quantity, source_type, source_id, idempotency_key, request_id, metadata, created_by
    )
    SELECT
        p_transfer.site_id, il.id, p_transfer.destination_location_id, p_line.product_id, p_line.variant_id,
        'transfer_received', p_quantity, COALESCE(il.on_hand_quantity, il.available + il.reserved),
        COALESCE(il.available_quantity, il.available), COALESCE(il.committed_quantity, 0),
        COALESCE(il.unavailable_quantity, 0), COALESCE(il.incoming_quantity, il.incoming),
        COALESCE(il.reserved_quantity, il.reserved), COALESCE(il.safety_stock_quantity, 0),
        'inventory_transfer', p_transfer.id, 'inventory.transfer_received:' || p_line.id::TEXT || ':' || p_idempotency_key,
        p_request_id, jsonb_build_object('quantity_received', p_quantity), p_actor_id
    FROM inventory_levels il WHERE il.id = v_dest_level_id
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.receive_purchase_order_line(p_po purchase_orders, p_line purchase_order_lines, p_quantity integer, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_level_id UUID;
    v_new_available integer;
BEGIN
    v_level_id := ensure_inventory_level_for_location(p_line.product_id, p_line.variant_id, p_line.location_id);

    UPDATE purchase_order_lines
       SET quantity_received = quantity_received + p_quantity,
           status = CASE WHEN quantity_received + p_quantity >= quantity_ordered THEN 'received' ELSE 'partially_received' END,
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_line.id;

    UPDATE inventory_levels
       SET available = available + p_quantity,
           incoming = GREATEST(incoming - p_quantity, 0),
           available_quantity = COALESCE(available_quantity, available) + p_quantity,
           incoming_quantity = GREATEST(COALESCE(incoming_quantity, incoming) - p_quantity, 0),
           on_hand_quantity = COALESCE(on_hand_quantity, available + reserved) + p_quantity,
           updated_at = NOW()
     WHERE id = v_level_id
     RETURNING available INTO v_new_available;

    -- T17: a PO receipt increases on-hand stock -- sync the cache to its new total.
    PERFORM public.sync_inventory_catalog_cache_v1(p_line.product_id,p_line.variant_id);

    INSERT INTO purchase_order_receipts (
        site_id, purchase_order_id, purchase_order_line_id, product_id, variant_id, location_id,
        quantity_received, idempotency_key, request_id, created_by
    )
    VALUES (
        p_po.site_id, p_po.id, p_line.id, p_line.product_id, p_line.variant_id, p_line.location_id,
        p_quantity, p_idempotency_key || ':line:' || p_line.id::TEXT, p_request_id, p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

    INSERT INTO inventory_events (
        site_id, inventory_level_id, location_id, product_id, variant_id,
        event_type, quantity_delta, on_hand_quantity, available_quantity,
        committed_quantity, unavailable_quantity, incoming_quantity, reserved_quantity,
        safety_stock_quantity, source_type, source_id, idempotency_key, request_id, metadata, created_by
    )
    SELECT
        p_po.site_id, il.id, p_line.location_id, p_line.product_id, p_line.variant_id,
        'po_received', p_quantity, COALESCE(il.on_hand_quantity, il.available + il.reserved),
        COALESCE(il.available_quantity, il.available), COALESCE(il.committed_quantity, 0),
        COALESCE(il.unavailable_quantity, 0), COALESCE(il.incoming_quantity, il.incoming),
        COALESCE(il.reserved_quantity, il.reserved), COALESCE(il.safety_stock_quantity, 0),
        'purchase_order', p_po.id, 'inventory.po_received:' || p_line.id::TEXT || ':' || p_idempotency_key,
        p_request_id, jsonb_build_object('quantity_received', p_quantity), p_actor_id
    FROM inventory_levels il WHERE il.id = v_level_id
    ON CONFLICT (site_id, idempotency_key) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_order_inventory(p_order_id uuid, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_release_reason text DEFAULT 'order_cancelled'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_level_id UUID;
    v_new_available integer;
BEGIN
    SELECT id, store_id
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM inventory_reservations
        WHERE order_id = p_order_id
          AND status = 'released'
          AND deleted_at IS NULL
    ) THEN
        RETURN TRUE;
    END IF;

    FOR v_item IN
        SELECT product_id, NULLIF(variant_id, '')::uuid AS variant_id, quantity
          FROM order_items
         WHERE order_id = p_order_id
           AND deleted_at IS NULL
    LOOP
        SELECT il.id
          INTO v_level_id
          FROM inventory_levels il
          JOIN inventory_locations loc ON loc.id = il.location_id
         WHERE il.product_id = v_item.product_id
           AND (
                (v_item.variant_id IS NULL AND il.variant_id IS NULL)
                OR il.variant_id = v_item.variant_id
           )
           AND loc.store_id = v_order.store_id
           AND loc.status = 'active'
           AND loc.deleted_at IS NULL
         ORDER BY loc.is_default DESC, il.updated_at ASC
         LIMIT 1
         FOR UPDATE OF il;

        IF FOUND THEN
            UPDATE inventory_levels
               SET available = available + v_item.quantity,
                   updated_at = NOW()
             WHERE id = v_level_id
             RETURNING available INTO v_new_available;

            -- T17: order cancellation restores stock -- the shopper-visible cache must move too.
            PERFORM public.sync_inventory_catalog_cache_v1(v_item.product_id,v_item.variant_id);

            INSERT INTO inventory_adjustments (
                product_id,
                variant_id,
                location_id,
                quantity_change,
                reason,
                reference_id,
                note,
                created_by
            )
            SELECT
                v_item.product_id,
                v_item.variant_id,
                location_id,
                v_item.quantity,
                'return',
                p_order_id,
                p_release_reason,
                p_actor_id
            FROM inventory_levels
            WHERE id = v_level_id;
        END IF;
    END LOOP;

    -- CAP-C47: a released commitment is no longer committed.
    --
    -- commit_inventory_reservation adds v_reservation.quantity to the level's committed_quantity and
    -- NOTHING has ever subtracted it -- not this function, not expire_unpaid_committed_reservations,
    -- not release_order_inventory_with_ledger (whose single mention of the column is a name in an
    -- inventory_events INSERT). So the column only grew, and the figure apps/merchant_app shows the
    -- merchant as "committed" drifted upward without bound. No oversell risk: reserve_inventory gates
    -- on `available`, which this function already restores correctly.
    --
    -- Driven by the order's status='committed' RESERVATIONS, deliberately not by the order_items loop
    -- above. That loop restores `available` per item and knows nothing about whether a commit ever
    -- happened -- an order cancelled while merely reserved never incremented committed_quantity, and
    -- subtracting its item quantities would corrupt the column in the opposite direction. This
    -- subtracts exactly what the commit added, grouped per level in case one level backs several
    -- reservations. GREATEST(0, ...) is a floor for rows committed before the column was maintained.
    UPDATE inventory_levels il
       SET committed_quantity = GREATEST(0, COALESCE(il.committed_quantity, 0) - committed.total_quantity),
           updated_at = NOW()
      FROM (
            SELECT location_id, product_id, variant_id, SUM(quantity) AS total_quantity
              FROM inventory_reservations
             WHERE order_id = p_order_id
               AND status = 'committed'
               AND deleted_at IS NULL
             GROUP BY location_id, product_id, variant_id
      ) AS committed
     WHERE il.location_id = committed.location_id
       AND il.product_id = committed.product_id
       AND (
            (committed.variant_id IS NULL AND il.variant_id IS NULL)
            OR il.variant_id = committed.variant_id
       );

    UPDATE inventory_reservations
       SET status = 'released',
           released_at = NOW(),
           release_reason = p_release_reason,
           updated_at = NOW()
     WHERE order_id = p_order_id
       AND deleted_at IS NULL;

    UPDATE orders
       SET inventory_released_at = NOW(),
           updated_at = NOW()
     WHERE id = p_order_id;

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
        v_order.store_id,
        'order',
        p_order_id::TEXT,
        'inventory.released',
        jsonb_build_object('store_id', v_order.store_id, 'order_id', p_order_id),
        'inventory.released:' || p_order_id::TEXT,
        p_request_id,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_order_return_and_refund(p_order_id uuid, p_lines jsonb DEFAULT NULL::jsonb, p_reason text DEFAULT NULL::text, p_refund_method text DEFAULT 'original_payment'::text, p_restock boolean DEFAULT false, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_order RECORD;
    v_existing_return_id UUID;
    v_return_id UUID;
    v_refund_id UUID;
    v_refund_transaction_id UUID;
    v_payment_transaction_id UUID;
    v_line RECORD;
    v_item RECORD;
    v_quantity INTEGER;
    v_restock_quantity INTEGER;
    v_returnable INTEGER;
    v_refund_amount NUMERIC(12,2);
    v_total_refund NUMERIC(12,2) := 0;
    v_return_line_id UUID;
    v_level_id UUID;
    v_location_id UUID;
    v_new_available integer;
BEGIN
    IF p_idempotency_key IS NULL OR BTRIM(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    IF p_refund_method NOT IN ('original_payment', 'gift_card', 'manual') THEN
        RAISE EXCEPTION 'unsupported refund method: %', p_refund_method;
    END IF;

    SELECT *
      INTO v_order
      FROM orders
     WHERE id = p_order_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'order not found';
    END IF;

    IF v_order.status IN ('cancelled', 'refunded') THEN
        RAISE EXCEPTION 'order cannot be returned from status %', v_order.status;
    END IF;

    SELECT id
      INTO v_existing_return_id
      FROM returns
     WHERE site_id = v_order.store_id
       AND idempotency_key = p_idempotency_key
       AND deleted_at IS NULL
     LIMIT 1;

    IF v_existing_return_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id),
            'return_id', v_existing_return_id,
            'idempotent_replay', true
        );
    END IF;

    SELECT id
      INTO v_payment_transaction_id
      FROM payment_transactions
     WHERE order_id = p_order_id
       AND site_id = v_order.store_id
       AND status IN ('captured', 'completed', 'partially_refunded')
       AND deleted_at IS NULL
     ORDER BY captured_at DESC NULLS LAST, created_at DESC
     LIMIT 1;

    INSERT INTO returns (
        site_id,
        order_id,
        status,
        customer_email,
        reason,
        refund_method,
        idempotency_key,
        request_id,
        authorized_at,
        metadata,
        created_by
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        'approved',
        v_order.customer_email,
        p_reason,
        p_refund_method,
        p_idempotency_key,
        p_request_id,
        NOW(),
        jsonb_build_object('restock_requested', p_restock),
        p_actor_id
    )
    RETURNING id INTO v_return_id;

    IF p_lines IS NOT NULL AND jsonb_typeof(p_lines) = 'array' AND jsonb_array_length(p_lines) > 0 THEN
        FOR v_line IN
            SELECT *
            FROM jsonb_to_recordset(p_lines) AS x(order_item_id UUID, quantity INTEGER, restock_quantity INTEGER)
        LOOP
            SELECT *
              INTO v_item
              FROM order_items
             WHERE id = v_line.order_item_id
               AND order_id = p_order_id
               AND deleted_at IS NULL
             FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'order item % not found', v_line.order_item_id;
            END IF;

            v_quantity := COALESCE(v_line.quantity, 0);
            v_returnable := GREATEST(COALESCE(v_item.fulfilled_quantity, 0), v_item.quantity) - COALESCE(v_item.returned_quantity, 0);

            IF v_quantity <= 0 OR v_quantity > v_returnable THEN
                RAISE EXCEPTION 'invalid return quantity for order item %', v_item.id;
            END IF;

            v_refund_amount := ROUND(COALESCE(v_item.unit_price, 0) * v_quantity, 2);
            v_total_refund := v_total_refund + v_refund_amount;
            v_restock_quantity := CASE
                WHEN p_restock THEN LEAST(COALESCE(v_line.restock_quantity, v_quantity), v_quantity)
                ELSE 0
            END;

            INSERT INTO return_lines (
                site_id,
                return_id,
                order_id,
                order_item_id,
                product_id,
                variant_id,
                quantity,
                received_quantity,
                restock_quantity,
                refund_amount,
                reason,
                status,
                created_by
            )
            VALUES (
                v_order.store_id,
                v_return_id,
                p_order_id,
                v_item.id,
                v_item.product_id,
                v_item.variant_id,
                v_quantity,
                v_restock_quantity,
                v_restock_quantity,
                v_refund_amount,
                p_reason,
                CASE WHEN p_restock THEN 'restocked' ELSE 'authorized' END,
                p_actor_id
            )
            RETURNING id INTO v_return_line_id;

            UPDATE order_items
               SET returned_quantity = COALESCE(returned_quantity, 0) + v_quantity,
                   refunded_quantity = COALESCE(refunded_quantity, 0) + v_quantity,
                   fulfillment_status = CASE
                       WHEN COALESCE(returned_quantity, 0) + v_quantity >= quantity THEN 'returned'
                       ELSE fulfillment_status
                   END,
                   updated_at = NOW()
             WHERE id = v_item.id;

            IF v_restock_quantity > 0 THEN
                SELECT il.id, il.location_id
                  INTO v_level_id, v_location_id
                  FROM inventory_levels il
                  JOIN inventory_locations loc ON loc.id = il.location_id
                 WHERE il.product_id = v_item.product_id
                   AND ((v_item.variant_id IS NULL AND il.variant_id IS NULL) OR il.variant_id = v_item.variant_id)
                   AND loc.store_id = v_order.store_id
                   AND loc.status = 'active'
                   AND loc.deleted_at IS NULL
                 ORDER BY loc.is_default DESC, il.updated_at ASC
                 LIMIT 1
                 FOR UPDATE OF il;

                IF v_level_id IS NOT NULL THEN
                    UPDATE inventory_levels
                       SET available = available + v_restock_quantity,
                           available_quantity = COALESCE(available_quantity, available) + v_restock_quantity,
                           on_hand_quantity = COALESCE(on_hand_quantity, available + reserved) + v_restock_quantity,
                           updated_at = NOW()
                     WHERE id = v_level_id
                     RETURNING available INTO v_new_available;

                    -- T17: a restocked return must move the shopper-visible cache too.
                    PERFORM public.sync_inventory_catalog_cache_v1(v_item.product_id,v_item.variant_id);

                    INSERT INTO restock_events (
                        site_id,
                        return_id,
                        return_line_id,
                        inventory_level_id,
                        location_id,
                        product_id,
                        variant_id,
                        order_id,
                        quantity,
                        status,
                        idempotency_key,
                        request_id,
                        metadata,
                        created_by
                    )
                    VALUES (
                        v_order.store_id,
                        v_return_id,
                        v_return_line_id,
                        v_level_id,
                        v_location_id,
                        v_item.product_id,
                        v_item.variant_id,
                        p_order_id,
                        v_restock_quantity,
                        'committed',
                        'restock.return:' || v_return_line_id::TEXT,
                        p_request_id,
                        jsonb_build_object('reason', p_reason),
                        p_actor_id
                    )
                    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

                    INSERT INTO inventory_events (
                        site_id,
                        inventory_level_id,
                        location_id,
                        product_id,
                        variant_id,
                        order_id,
                        event_type,
                        quantity_delta,
                        on_hand_quantity,
                        available_quantity,
                        committed_quantity,
                        unavailable_quantity,
                        incoming_quantity,
                        reserved_quantity,
                        safety_stock_quantity,
                        source_type,
                        source_id,
                        idempotency_key,
                        request_id,
                        metadata,
                        created_by
                    )
                    SELECT
                        v_order.store_id,
                        il.id,
                        il.location_id,
                        v_item.product_id,
                        v_item.variant_id,
                        p_order_id,
                        'return_restocked',
                        v_restock_quantity,
                        COALESCE(il.on_hand_quantity, il.available + il.reserved),
                        COALESCE(il.available_quantity, il.available),
                        COALESCE(il.committed_quantity, 0),
                        COALESCE(il.unavailable_quantity, 0),
                        COALESCE(il.incoming_quantity, il.incoming),
                        COALESCE(il.reserved_quantity, il.reserved),
                        COALESCE(il.safety_stock_quantity, 0),
                        'return',
                        v_return_id,
                        'inventory.return_restocked:' || v_return_line_id::TEXT,
                        p_request_id,
                        jsonb_build_object('return_id', v_return_id, 'return_line_id', v_return_line_id),
                        p_actor_id
                    FROM inventory_levels il
                    WHERE il.id = v_level_id
                    ON CONFLICT (site_id, idempotency_key) DO NOTHING;
                END IF;
            END IF;
        END LOOP;
    ELSE
        FOR v_item IN
            SELECT *
              FROM order_items
             WHERE order_id = p_order_id
               AND deleted_at IS NULL
             FOR UPDATE
        LOOP
            v_quantity := GREATEST(COALESCE(v_item.fulfilled_quantity, 0), v_item.quantity) - COALESCE(v_item.returned_quantity, 0);
            IF v_quantity <= 0 THEN
                CONTINUE;
            END IF;

            v_refund_amount := ROUND(COALESCE(v_item.unit_price, 0) * v_quantity, 2);
            v_total_refund := v_total_refund + v_refund_amount;
            v_restock_quantity := CASE WHEN p_restock THEN v_quantity ELSE 0 END;

            INSERT INTO return_lines (
                site_id,
                return_id,
                order_id,
                order_item_id,
                product_id,
                variant_id,
                quantity,
                received_quantity,
                restock_quantity,
                refund_amount,
                reason,
                status,
                created_by
            )
            VALUES (
                v_order.store_id,
                v_return_id,
                p_order_id,
                v_item.id,
                v_item.product_id,
                v_item.variant_id,
                v_quantity,
                v_restock_quantity,
                v_restock_quantity,
                v_refund_amount,
                p_reason,
                CASE WHEN p_restock THEN 'restocked' ELSE 'authorized' END,
                p_actor_id
            )
            RETURNING id INTO v_return_line_id;

            UPDATE order_items
               SET returned_quantity = COALESCE(returned_quantity, 0) + v_quantity,
                   refunded_quantity = COALESCE(refunded_quantity, 0) + v_quantity,
                   fulfillment_status = 'returned',
                   updated_at = NOW()
             WHERE id = v_item.id;

            IF v_restock_quantity > 0 THEN
                SELECT il.id, il.location_id
                  INTO v_level_id, v_location_id
                  FROM inventory_levels il
                  JOIN inventory_locations loc ON loc.id = il.location_id
                 WHERE il.product_id = v_item.product_id
                   AND ((v_item.variant_id IS NULL AND il.variant_id IS NULL) OR il.variant_id = v_item.variant_id)
                   AND loc.store_id = v_order.store_id
                   AND loc.status = 'active'
                   AND loc.deleted_at IS NULL
                 ORDER BY loc.is_default DESC, il.updated_at ASC
                 LIMIT 1
                 FOR UPDATE OF il;

                IF v_level_id IS NOT NULL THEN
                    UPDATE inventory_levels
                       SET available = available + v_restock_quantity,
                           available_quantity = COALESCE(available_quantity, available) + v_restock_quantity,
                           on_hand_quantity = COALESCE(on_hand_quantity, available + reserved) + v_restock_quantity,
                           updated_at = NOW()
                     WHERE id = v_level_id
                     RETURNING available INTO v_new_available;

                    -- T17: a restocked return must move the shopper-visible cache too.
                    PERFORM public.sync_inventory_catalog_cache_v1(v_item.product_id,v_item.variant_id);

                    INSERT INTO restock_events (
                        site_id,
                        return_id,
                        return_line_id,
                        inventory_level_id,
                        location_id,
                        product_id,
                        variant_id,
                        order_id,
                        quantity,
                        status,
                        idempotency_key,
                        request_id,
                        metadata,
                        created_by
                    )
                    VALUES (
                        v_order.store_id,
                        v_return_id,
                        v_return_line_id,
                        v_level_id,
                        v_location_id,
                        v_item.product_id,
                        v_item.variant_id,
                        p_order_id,
                        v_restock_quantity,
                        'committed',
                        'restock.return:' || v_return_line_id::TEXT,
                        p_request_id,
                        jsonb_build_object('reason', p_reason),
                        p_actor_id
                    )
                    ON CONFLICT (site_id, idempotency_key) DO NOTHING;

                    INSERT INTO inventory_events (
                        site_id,
                        inventory_level_id,
                        location_id,
                        product_id,
                        variant_id,
                        order_id,
                        event_type,
                        quantity_delta,
                        on_hand_quantity,
                        available_quantity,
                        committed_quantity,
                        unavailable_quantity,
                        incoming_quantity,
                        reserved_quantity,
                        safety_stock_quantity,
                        source_type,
                        source_id,
                        idempotency_key,
                        request_id,
                        metadata,
                        created_by
                    )
                    SELECT
                        v_order.store_id,
                        il.id,
                        il.location_id,
                        v_item.product_id,
                        v_item.variant_id,
                        p_order_id,
                        'return_restocked',
                        v_restock_quantity,
                        COALESCE(il.on_hand_quantity, il.available + il.reserved),
                        COALESCE(il.available_quantity, il.available),
                        COALESCE(il.committed_quantity, 0),
                        COALESCE(il.unavailable_quantity, 0),
                        COALESCE(il.incoming_quantity, il.incoming),
                        COALESCE(il.reserved_quantity, il.reserved),
                        COALESCE(il.safety_stock_quantity, 0),
                        'return',
                        v_return_id,
                        'inventory.return_restocked:' || v_return_line_id::TEXT,
                        p_request_id,
                        jsonb_build_object('return_id', v_return_id, 'return_line_id', v_return_line_id),
                        p_actor_id
                    FROM inventory_levels il
                    WHERE il.id = v_level_id
                    ON CONFLICT (site_id, idempotency_key) DO NOTHING;
                END IF;
            END IF;
        END LOOP;
    END IF;

    IF v_total_refund <= 0 THEN
        RAISE EXCEPTION 'no refundable amount remains';
    END IF;

    INSERT INTO refunds (
        site_id,
        order_id,
        return_id,
        payment_transaction_id,
        amount,
        currency,
        status,
        refund_method,
        provider,
        idempotency_key,
        request_id,
        reason,
        metadata,
        created_by
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        v_return_id,
        v_payment_transaction_id,
        v_total_refund,
        COALESCE(v_order.currency, 'INR'),
        'pending',
        p_refund_method,
        COALESCE(v_order.payment_gateway, v_order.payment_method),
        p_idempotency_key || ':refund',
        p_request_id,
        p_reason,
        jsonb_build_object('restock_requested', p_restock),
        p_actor_id
    )
    RETURNING id INTO v_refund_id;

    INSERT INTO refund_lines (
        site_id,
        refund_id,
        return_line_id,
        order_item_id,
        amount,
        quantity,
        created_by
    )
    SELECT
        v_order.store_id,
        v_refund_id,
        rl.id,
        rl.order_item_id,
        rl.refund_amount,
        rl.quantity,
        p_actor_id
    FROM return_lines rl
    WHERE rl.return_id = v_return_id
      AND rl.deleted_at IS NULL;

    INSERT INTO refund_transactions (
        site_id,
        order_id,
        payment_transaction_id,
        amount,
        currency,
        status,
        refund_method,
        reason,
        idempotency_key,
        request_id,
        metadata,
        created_by
    )
    VALUES (
        v_order.store_id,
        p_order_id,
        v_payment_transaction_id,
        v_total_refund,
        COALESCE(v_order.currency, 'INR'),
        'pending',
        p_refund_method,
        p_reason,
        p_idempotency_key || ':refund_transaction',
        p_request_id,
        jsonb_build_object('return_id', v_return_id, 'refund_id', v_refund_id),
        p_actor_id
    )
    ON CONFLICT (site_id, idempotency_key) DO NOTHING
    RETURNING id INTO v_refund_transaction_id;

    UPDATE returns
       SET metadata = metadata || jsonb_build_object('refund_id', v_refund_id, 'refund_transaction_id', v_refund_transaction_id),
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = v_return_id;

    UPDATE orders
       SET return_status = 'authorized',
           refund_status = 'pending',
           updated_at = NOW(),
           updated_by = p_actor_id
     WHERE id = p_order_id;

    INSERT INTO outbox_events (
        site_id,
        store_id,
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        idempotency_key,
        request_id,
        trace_id,
        schema_version,
        actor_id
    )
    VALUES (
        v_order.store_id,
        v_order.store_id,
        'refund',
        v_refund_id::TEXT,
        'refund.requested',
        jsonb_build_object(
            'site_id', v_order.store_id,
            'order_id', p_order_id,
            'return_id', v_return_id,
            'refund_id', v_refund_id,
            'amount', v_total_refund,
            'refund_method', p_refund_method
        ),
        'refund.requested:' || v_refund_id::TEXT,
        p_request_id,
        p_request_id,
        1,
        p_actor_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN jsonb_build_object(
        'order', (SELECT to_jsonb(o) FROM orders o WHERE o.id = p_order_id),
        'return_id', v_return_id,
        'refund_id', v_refund_id,
        'refund_transaction_id', v_refund_transaction_id,
        'amount', v_total_refund,
        'status', 'pending'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_inventory(p_store_id uuid, p_product_id uuid, p_variant_id uuid, p_location_id uuid, p_quantity integer, p_ttl_seconds integer DEFAULT 1200, p_idempotency_key text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_existing public.inventory_reservations%ROWTYPE;
  v_level public.inventory_levels%ROWTYPE;
  v_reservation public.inventory_reservations%ROWTYPE;
  v_expires_at timestamptz;
BEGIN
  PERFORM public.require_inventory_site_guc(p_store_id);

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'inventory reservation quantity must be positive';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'inventory reservation idempotency key is required';
  END IF;

  SELECT * INTO v_existing
    FROM public.inventory_reservations
   WHERE store_id = p_store_id
     AND idempotency_key = p_idempotency_key
     AND deleted_at IS NULL
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'reservation_id', v_existing.id,
      'status', v_existing.status,
      'quantity', v_existing.quantity,
      'expires_at', v_existing.expires_at,
      'idempotent', true
    );
  END IF;

  SELECT * INTO v_level
    FROM public.inventory_levels
   WHERE store_id = p_store_id
     AND product_id = p_product_id
     AND variant_id IS NOT DISTINCT FROM p_variant_id
     AND location_id = p_location_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory level not found';
  END IF;

  IF (COALESCE(v_level.available, 0) - COALESCE(v_level.reserved, 0)) < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_INVENTORY';
  END IF;

  v_expires_at := now() + make_interval(secs => LEAST(GREATEST(COALESCE(p_ttl_seconds, 1200), 60), 86400));

  UPDATE public.inventory_levels
     SET reserved = reserved + p_quantity,
         reserved_quantity = COALESCE(reserved_quantity, reserved) + p_quantity,
         available_quantity = COALESCE(available_quantity, available),
         on_hand_quantity = COALESCE(on_hand_quantity, available + reserved),
         updated_at = now()
   WHERE id = v_level.id;

  PERFORM public.sync_inventory_catalog_cache_v1(p_product_id,p_variant_id);

  INSERT INTO public.inventory_reservations (
    store_id,
    product_id,
    variant_id,
    location_id,
    quantity,
    status,
    idempotency_key,
    expires_at,
    created_by
  ) VALUES (
    p_store_id,
    p_product_id,
    p_variant_id,
    p_location_id,
    p_quantity,
    'active',
    p_idempotency_key,
    v_expires_at,
    p_actor_id
  )
  RETURNING * INTO v_reservation;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation.id,
    'status', v_reservation.status,
    'quantity', v_reservation.quantity,
    'expires_at', v_reservation.expires_at,
    'idempotent', false,
    'request_id', p_request_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_inventory_reservation(p_store_id uuid, p_reservation_id uuid, p_idempotency_key text, p_reason text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_reservation public.inventory_reservations%ROWTYPE;
BEGIN
  PERFORM public.require_inventory_site_guc(p_store_id);

  SELECT * INTO v_reservation
    FROM public.inventory_reservations
   WHERE id = p_reservation_id
     AND store_id = p_store_id
     AND deleted_at IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory reservation not found';
  END IF;

  IF v_reservation.status IN ('released', 'expired', 'cancelled') THEN
    RETURN jsonb_build_object('reservation_id', v_reservation.id, 'status', v_reservation.status, 'idempotent', true);
  END IF;

  IF v_reservation.status NOT IN ('active', 'hold') THEN
    RAISE EXCEPTION 'inventory reservation cannot be released from status %', v_reservation.status;
  END IF;

  UPDATE public.inventory_levels
     SET reserved = GREATEST(reserved - v_reservation.quantity, 0),
         reserved_quantity = GREATEST(COALESCE(reserved_quantity, reserved) - v_reservation.quantity, 0),
         updated_at = now()
   WHERE store_id = p_store_id
     AND product_id = v_reservation.product_id
     AND variant_id IS NOT DISTINCT FROM v_reservation.variant_id
     AND location_id = v_reservation.location_id;

  PERFORM public.sync_inventory_catalog_cache_v1(v_reservation.product_id,v_reservation.variant_id);

    UPDATE public.inventory_reservations
     SET status = 'released',
         released_at = now(),
         release_reason = COALESCE(p_reason, 'released'),
         release_idempotency_key = p_idempotency_key,
         updated_at = now()
   WHERE id = v_reservation.id
   RETURNING * INTO v_reservation;

  RETURN jsonb_build_object(
    'reservation_id', v_reservation.id,
    'status', v_reservation.status,
    'quantity', v_reservation.quantity,
    'request_id', p_request_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_inventory_reservations(p_limit integer DEFAULT 100, p_request_id text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_reservation public.inventory_reservations%ROWTYPE;
  v_count integer := 0;
BEGIN
  FOR v_reservation IN
    SELECT *
      FROM public.inventory_reservations
     WHERE status IN ('active', 'hold')
       AND expires_at <= now()
       AND deleted_at IS NULL
     ORDER BY expires_at ASC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 1000)
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.inventory_levels
       SET reserved = GREATEST(reserved - v_reservation.quantity, 0),
           reserved_quantity = GREATEST(COALESCE(reserved_quantity, reserved) - v_reservation.quantity, 0),
           updated_at = now()
     WHERE store_id = v_reservation.store_id
       AND product_id = v_reservation.product_id
       AND variant_id IS NOT DISTINCT FROM v_reservation.variant_id
       AND location_id = v_reservation.location_id;

    PERFORM public.sync_inventory_catalog_cache_v1(v_reservation.product_id,v_reservation.variant_id);

    UPDATE public.inventory_reservations
       SET status = 'expired',
           released_at = now(),
           release_reason = 'ttl_expired',
           updated_at = now()
     WHERE id = v_reservation.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_inventory_transfer_with_lines(p_site_id uuid,p_source_location_id uuid,p_destination_location_id uuid,p_lines jsonb,p_notes text DEFAULT NULL,p_actor_id uuid DEFAULT NULL,p_request_id text DEFAULT NULL,p_idempotency_key text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE v_transfer_id uuid; v_line_id uuid; v_reservation_id uuid; v_item record; v_level_id uuid; v_held jsonb;
BEGIN
 PERFORM public.require_inventory_site_guc(p_site_id);
 IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key))<8 OR p_source_location_id=p_destination_location_id
  OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 200 THEN
  RAISE EXCEPTION 'WAREHOUSE_INVALID';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.inventory_locations WHERE id=p_source_location_id AND store_id=p_site_id AND deleted_at IS NULL AND status='active')
 OR NOT EXISTS(SELECT 1 FROM public.inventory_locations WHERE id=p_destination_location_id AND store_id=p_site_id AND deleted_at IS NULL AND status='active') THEN
  RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';END IF;
 -- Product locks precede level/reservation locks, in a stable order for a batch.
 FOR v_item IN SELECT DISTINCT x.product_id FROM jsonb_to_recordset(p_lines)x(product_id uuid)ORDER BY x.product_id LOOP
  PERFORM id FROM public.products WHERE id=v_item.product_id AND store_id=p_site_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';END IF;
 END LOOP;
 INSERT INTO public.inventory_transfers(site_id,transfer_number,source_location_id,destination_location_id,status,notes,idempotency_key,request_id,created_by)
 VALUES(p_site_id,'TR-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(gen_random_uuid()::text,1,8)),p_source_location_id,p_destination_location_id,'reserved',p_notes,p_idempotency_key,p_request_id,p_actor_id)
 RETURNING id INTO v_transfer_id;
 FOR v_item IN SELECT * FROM jsonb_to_recordset(p_lines)x(product_id uuid,variant_id uuid,quantity integer) LOOP
  IF v_item.quantity IS NULL OR v_item.quantity<=0 OR v_item.quantity>999999 THEN RAISE EXCEPTION 'WAREHOUSE_INVALID';END IF;
  IF v_item.variant_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.product_variants WHERE id=v_item.variant_id AND product_id=v_item.product_id)THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';END IF;
  v_line_id:=gen_random_uuid();
  v_level_id:=public.ensure_inventory_level_for_location(v_item.product_id,v_item.variant_id,p_source_location_id);
  v_held:=public.reserve_inventory(p_site_id,v_item.product_id,v_item.variant_id,p_source_location_id,v_item.quantity,1200,'warehouse.transfer:'||v_line_id::text,p_actor_id,p_request_id);
  v_reservation_id:=(v_held->>'reservation_id')::uuid;
  UPDATE public.inventory_reservations SET expires_at='infinity'::timestamptz WHERE id=v_reservation_id AND store_id=p_site_id;
  INSERT INTO public.inventory_transfer_lines(id,site_id,transfer_id,product_id,variant_id,quantity_requested,quantity_shipped,status,created_by,reservation_id)
  VALUES(v_line_id,p_site_id,v_transfer_id,v_item.product_id,v_item.variant_id,v_item.quantity,0,'reserved',p_actor_id,v_reservation_id);
  PERFORM public.sync_inventory_catalog_cache_v1(v_item.product_id,v_item.variant_id);
  INSERT INTO public.inventory_events(site_id,inventory_level_id,location_id,product_id,variant_id,event_type,quantity_delta,on_hand_quantity,available_quantity,committed_quantity,unavailable_quantity,incoming_quantity,reserved_quantity,safety_stock_quantity,source_type,source_id,idempotency_key,request_id,metadata,created_by)
  SELECT p_site_id,i.id,p_source_location_id,v_item.product_id,v_item.variant_id,'transfer_reserved',-v_item.quantity,i.available,i.available-i.reserved,coalesce(i.committed_quantity,0),coalesce(i.unavailable_quantity,0),i.incoming,i.reserved,coalesce(i.safety_stock_quantity,0),'inventory_transfer',v_transfer_id,'inventory.transfer_reserved:'||v_transfer_id::text||':'||v_item.product_id::text||':'||coalesce(v_item.variant_id::text,'default'),p_request_id,jsonb_build_object('source_location_id',p_source_location_id,'destination_location_id',p_destination_location_id),p_actor_id
  FROM public.inventory_levels i WHERE i.id=v_level_id;
 END LOOP;
 RETURN jsonb_build_object('transfer',(SELECT to_jsonb(t)FROM public.inventory_transfers t WHERE id=v_transfer_id),'lines',(SELECT jsonb_agg(to_jsonb(l)ORDER BY l.created_at,l.id)FROM public.inventory_transfer_lines l WHERE l.transfer_id=v_transfer_id));
END $fn$;

CREATE OR REPLACE FUNCTION public.ship_inventory_transfer(p_transfer_id uuid,p_actor_id uuid DEFAULT NULL,p_request_id text DEFAULT NULL,p_idempotency_key text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE v_transfer public.inventory_transfers%ROWTYPE; v_line public.inventory_transfer_lines%ROWTYPE;
BEGIN
 SELECT * INTO v_transfer FROM public.inventory_transfers WHERE id=p_transfer_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';END IF;
 PERFORM public.require_inventory_site_guc(v_transfer.site_id);
 IF v_transfer.status='shipped' THEN RETURN jsonb_build_object('transfer',to_jsonb(v_transfer));END IF;
 IF v_transfer.status<>'reserved' THEN RAISE EXCEPTION 'WAREHOUSE_STATE_CONFLICT';END IF;
 PERFORM p.id FROM public.products p JOIN public.inventory_transfer_lines l ON l.product_id=p.id AND l.site_id=v_transfer.site_id
  WHERE p.store_id=v_transfer.site_id AND l.transfer_id=p_transfer_id AND l.deleted_at IS NULL ORDER BY p.id FOR UPDATE OF p;
 FOR v_line IN SELECT *FROM public.inventory_transfer_lines WHERE transfer_id=p_transfer_id AND deleted_at IS NULL ORDER BY product_id,variant_id,id FOR UPDATE LOOP
  IF v_line.reservation_id IS NULL THEN RAISE EXCEPTION 'WAREHOUSE_STATE_CONFLICT';END IF;
  PERFORM public.assert_transfer_reservation_binding_v1(v_line.reservation_id);
  PERFORM public.commit_inventory_reservation(v_transfer.site_id,v_line.reservation_id,'warehouse.ship:'||v_line.id::text,p_actor_id,p_request_id);
  UPDATE public.inventory_transfer_lines SET quantity_shipped=quantity_requested,status='shipped',updated_at=now(),updated_by=p_actor_id WHERE id=v_line.id;
  INSERT INTO public.inventory_events(site_id,inventory_level_id,location_id,product_id,variant_id,event_type,quantity_delta,on_hand_quantity,available_quantity,committed_quantity,unavailable_quantity,incoming_quantity,reserved_quantity,safety_stock_quantity,source_type,source_id,idempotency_key,request_id,metadata,created_by)
  SELECT v_transfer.site_id,i.id,v_transfer.source_location_id,v_line.product_id,v_line.variant_id,'transfer_shipped',-v_line.quantity_requested,i.available,i.available-i.reserved,coalesce(i.committed_quantity,0),coalesce(i.unavailable_quantity,0),i.incoming,i.reserved,coalesce(i.safety_stock_quantity,0),'inventory_transfer',p_transfer_id,'inventory.transfer_shipped:'||v_line.id::text,p_request_id,jsonb_build_object('destination_location_id',v_transfer.destination_location_id),p_actor_id
  FROM public.inventory_levels i WHERE i.store_id=v_transfer.site_id AND i.product_id=v_line.product_id AND i.variant_id IS NOT DISTINCT FROM v_line.variant_id AND i.location_id=v_transfer.source_location_id AND i.deleted_at IS NULL;
 END LOOP;
 UPDATE public.inventory_transfers SET status='shipped',shipped_at=coalesce(shipped_at,now()),updated_at=now(),updated_by=p_actor_id WHERE id=p_transfer_id;
 RETURN jsonb_build_object('transfer',(SELECT to_jsonb(t)FROM public.inventory_transfers t WHERE id=p_transfer_id));
END $fn$;

-- Convert only a fully attributable retained population. No receipt is rewritten.
-- Metadata linking is not a new Merchant edit. Preserve the original line's
-- update timestamp while holding the table lock, and restore the exact known
-- timestamp trigger before constraints are validated or the transaction commits.
-- Binding/security triggers remain enabled throughout the cutover.
DO $timestamp436$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.inventory_transfer_lines'::regclass
  AND tgname='trg_inventory_transfer_lines_updated_at' AND NOT tgisinternal
  AND tgfoid=to_regprocedure('public.update_updated_at()') AND tgtype=19
  AND tgenabled='O' AND tgqual IS NULL AND octet_length(tgargs)=0 AND tgattr=''::int2vector) THEN
  RAISE EXCEPTION 'migration436 refuses unreviewed transfer timestamp trigger';
 END IF;
END $timestamp436$;
ALTER TABLE public.inventory_transfer_lines DISABLE TRIGGER trg_inventory_transfer_lines_updated_at;
DO $retained436$DECLARE x record;held jsonb;rid uuid;remaining integer;BEGIN
 IF EXISTS(SELECT 1 FROM public.inventory_transfer_lines WHERE metadata?'canonical_reservation436')THEN RAISE EXCEPTION 'migration436 refuses unreviewed retained reservation metadata';END IF;
 IF EXISTS(SELECT 1 FROM public.inventory_transfers t JOIN public.inventory_transfer_lines l ON l.transfer_id=t.id
  WHERE t.deleted_at IS NULL AND l.deleted_at IS NULL AND t.status IN('reserved','shipped','partially_received')AND
  (l.site_id<>t.site_id OR l.quantity_received>l.quantity_shipped OR l.quantity_shipped>l.quantity_requested OR t.status='reserved'AND(l.quantity_shipped<>0 OR l.quantity_received<>0)))THEN RAISE EXCEPTION 'migration436 refuses inconsistent retained transfers';END IF;
 FOR x IN SELECT i.*,coalesce((SELECT sum(l.quantity_requested-l.quantity_received)FROM public.inventory_transfer_lines l JOIN public.inventory_transfers t ON t.id=l.transfer_id
  WHERE t.site_id=i.store_id AND t.source_location_id=i.location_id AND l.site_id=i.store_id AND l.product_id=i.product_id AND l.variant_id IS NOT DISTINCT FROM i.variant_id AND t.deleted_at IS NULL AND l.deleted_at IS NULL AND t.status IN('reserved','shipped','partially_received')),0)::integer AS transfer_hold,
  coalesce((SELECT sum(r.quantity)FROM public.inventory_reservations r WHERE r.store_id=i.store_id AND r.product_id=i.product_id AND r.variant_id IS NOT DISTINCT FROM i.variant_id AND r.location_id=i.location_id AND r.deleted_at IS NULL AND r.status IN('active','hold')),0)::integer AS ordinary_hold
  FROM public.inventory_levels i WHERE i.deleted_at IS NULL ORDER BY i.store_id,i.product_id,i.variant_id,i.location_id FOR UPDATE LOOP
  IF x.reserved<>x.transfer_hold+x.ordinary_hold OR x.available<0 OR x.reserved<0 OR x.incoming<0 THEN RAISE EXCEPTION 'migration436 refuses unexplained retained inventory variance';END IF;
  IF x.transfer_hold>0 THEN UPDATE public.inventory_levels SET available=available+x.transfer_hold,reserved=reserved-x.transfer_hold,available_quantity=available+x.transfer_hold,reserved_quantity=reserved-x.transfer_hold,updated_at=now()WHERE id=x.id;END IF;
 END LOOP;
 FOR x IN SELECT l.*,t.source_location_id,t.status AS transfer_status FROM public.inventory_transfer_lines l JOIN public.inventory_transfers t ON t.id=l.transfer_id WHERE t.deleted_at IS NULL AND l.deleted_at IS NULL AND t.status IN('reserved','shipped','partially_received')AND l.quantity_received<l.quantity_requested ORDER BY l.site_id,l.product_id,l.variant_id,l.id FOR UPDATE OF l,t LOOP
  remaining:=x.quantity_requested-x.quantity_received;
  PERFORM set_config('app.site_id',x.site_id::text,true);
  held:=public.reserve_inventory(x.site_id,x.product_id,x.variant_id,x.source_location_id,remaining,1200,'warehouse.backfill436:'||x.id::text,x.created_by,'migration436');rid:=(held->>'reservation_id')::uuid;
  UPDATE public.inventory_reservations SET expires_at='infinity'::timestamptz WHERE id=rid;
  UPDATE public.inventory_transfer_lines SET reservation_id=rid,metadata=metadata||jsonb_build_object('canonical_reservation436',jsonb_build_object('base_received',x.quantity_received))WHERE id=x.id;
  IF x.transfer_status<>'reserved' THEN PERFORM public.commit_inventory_reservation(x.site_id,rid,'warehouse.backfill436.ship:'||x.id::text,x.created_by,'migration436');END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.inventory_levels WHERE deleted_at IS NULL AND(available<reserved OR reserved<0 OR incoming<0))THEN RAISE EXCEPTION 'migration436 refuses oversubscribed retained inventory';END IF;
END $retained436$;
SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE public.inventory_transfer_lines ENABLE TRIGGER trg_inventory_transfer_lines_updated_at;
ALTER TABLE public.inventory_levels ADD CONSTRAINT inventory_levels_canonical_hold436 CHECK(available>=reserved AND available>=0 AND reserved>=0 AND incoming>=0);
-- Keep canonical multi-line checkout facts stable across its own stock cache writes.
CREATE OR REPLACE FUNCTION public.create_order_with_inventory_reservations(p_store_id uuid, p_customer_name text, p_customer_email text, p_customer_phone text DEFAULT NULL::text, p_shipping_address jsonb DEFAULT '{}'::jsonb, p_items jsonb DEFAULT '[]'::jsonb, p_payment_method text DEFAULT 'cod'::text, p_notes text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text, p_actor_id uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_locked_product_versions jsonb;
  v_ref jsonb; v_cart public.carts%ROWTYPE; v_cart_line jsonb;
  v_niche jsonb; v_product_facts jsonb; v_variant_facts jsonb;
  v_selected_options jsonb; v_option_names text[]; v_saved_options jsonb;
  v_has_variants boolean; v_names text[] := ARRAY['toys','electronics','food','furniture','gifts','personalization','beauty','sports','books'];
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_product record;
  v_variant public.product_variants%ROWTYPE;
  v_location_id uuid;
  v_reservation jsonb;
  v_reservation_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(10,2) := 0;
  v_line_total numeric(10,2);
  v_unit_price numeric(10,2);
  v_variant_title text;
  v_sku text;
  v_order_items jsonb := '[]'::jsonb;
  v_order_json jsonb;
BEGIN
  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'store_id is required';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items must be a non-empty array';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.sites
     WHERE id = p_store_id
       AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'store not found';
  END IF;

  IF public.current_site_id() IS NULL THEN
    PERFORM set_config('app.site_id', p_store_id::text, true);
  END IF;
  PERFORM public.require_inventory_site_guc(p_store_id);

  -- Preserve234's idempotency/advisory-first boundary. Align385/inventory lock order
  -- across ALL products before accepting any line, so distinct configurations share stock.
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE i ? 'niche' OR i ? 'niche_snapshot'
    OR i ? 'catalog_source' OR i ? 'personalization') THEN RAISE EXCEPTION 'CART_FACT_INPUT_INVALID'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE i ? 'cart_fact_ref'
    GROUP BY i->'cart_fact_ref'->>'cart_id',i->'cart_fact_ref'->>'line_id' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'CART_FACT_REFERENCE_DUPLICATED'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE i ? 'cart_fact_ref') AND (
    EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE NOT i ? 'cart_fact_ref')
    OR (SELECT count(DISTINCT i->'cart_fact_ref'->>'cart_id') FROM jsonb_array_elements(p_items) i)>1) THEN RAISE EXCEPTION 'CART_FACT_INPUT_INVALID'; END IF;
  -- Lock cart capabilities in deterministic order before product/inventory locks.
  PERFORM c.id FROM public.carts c WHERE c.store_id=p_store_id AND c.id IN
    (SELECT (i->'cart_fact_ref'->>'cart_id')::uuid FROM jsonb_array_elements(p_items) i WHERE i ? 'cart_fact_ref')
    ORDER BY c.id FOR UPDATE;
  PERFORM il.id FROM public.inventory_levels il WHERE il.store_id=p_store_id AND il.product_id IN
    (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(p_items) i) ORDER BY il.id FOR UPDATE;
  PERFORM pv.id FROM public.product_variants pv JOIN public.products p ON p.id=pv.product_id
    WHERE p.store_id=p_store_id AND pv.product_id IN (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(p_items) i)
    ORDER BY pv.id FOR UPDATE OF pv;
  PERFORM po.id FROM public.product_options po JOIN public.products p ON p.id=po.product_id
    WHERE p.store_id=p_store_id AND po.product_id IN (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(p_items) i)
    ORDER BY po.id FOR UPDATE OF po;
  PERFORM p.id FROM public.products p WHERE p.store_id=p_store_id AND p.id IN
    (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(p_items) i) ORDER BY p.id FOR UPDATE;

  -- All inventory/variant/option/product rows above are already locked in canonical order.
  -- Own reservation/cache writes can advance revisions between same-SKU lines.
  -- Validate each accepted cart line against this single pre-effect observation;
  -- external catalog changes are still refused before any reservation.
  SELECT coalesce(jsonb_object_agg(p.id::text,to_jsonb(p.version)),'{}'::jsonb)
    INTO v_locked_product_versions FROM public.products p
   WHERE p.store_id=p_store_id AND p.id IN
    (SELECT (i->>'product_id')::uuid FROM jsonb_array_elements(p_items) i);

  v_order_number := 'LB-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_variant_id := NULLIF(v_item ->> 'variant_id', '')::uuid;
    v_quantity := COALESCE((v_item ->> 'quantity')::integer, 0);

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'invalid quantity for product %', v_product_id;
    END IF;

    SELECT id, name, price, sku, is_active, store_id, version, metadata, images
      INTO v_product
      FROM public.products
     WHERE id = v_product_id
       AND store_id = p_store_id
       AND deleted_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product not found: %', v_product_id;
    END IF;

    IF COALESCE(v_product.is_active, false) = false THEN
      RAISE EXCEPTION 'product is not active: %', v_product.name;
    END IF;

    v_unit_price := v_product.price;
    v_variant_title := NULL;
    v_sku := v_product.sku;

    IF v_variant_id IS NOT NULL THEN
      SELECT *
        INTO v_variant
        FROM public.product_variants
       WHERE id = v_variant_id
         AND product_id = v_product_id FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'variant not found for product %', v_product_id;
      END IF;

      v_unit_price := COALESCE(NULLIF(v_variant.price, 0), v_product.price);
      v_variant_title := v_variant.title;
      v_sku := COALESCE(v_variant.sku, v_product.sku);
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.product_variants WHERE product_id=v_product_id) INTO v_has_variants;

    SELECT coalesce(jsonb_object_agg(k,value),'{}'::jsonb) INTO v_product_facts
      FROM jsonb_each(coalesce(v_product.metadata,'{}'::jsonb)) AS facts(k,value) WHERE k=ANY(v_names);
    v_variant_facts := CASE WHEN v_variant_id IS NULL THEN '{}'::jsonb ELSE coalesce(v_variant.metadata,'{}'::jsonb) END;
    SELECT array_agg(name ORDER BY position,id) INTO v_option_names FROM public.product_options WHERE product_id=v_product_id;
    v_selected_options := CASE WHEN v_variant_id IS NULL THEN '{}'::jsonb ELSE
      jsonb_strip_nulls(jsonb_build_object(coalesce(v_option_names[1],'Option 1'),v_variant.option1,
        coalesce(v_option_names[2],'Option 2'),v_variant.option2,coalesce(v_option_names[3],'Option 3'),v_variant.option3)) END;
    IF v_has_variants AND v_variant_id IS NULL AND (v_item ? 'cart_fact_ref' OR v_product_facts<>'{}'::jsonb
      OR EXISTS(SELECT 1 FROM public.product_variants pv WHERE pv.product_id=v_product_id AND (pv.metadata<>'{}'::jsonb OR pv.option1 IS NOT NULL OR pv.option2 IS NOT NULL OR pv.option3 IS NOT NULL))
      OR EXISTS(SELECT 1 FROM public.product_options po WHERE po.product_id=v_product_id)) THEN RAISE EXCEPTION 'CART_VARIANT_REQUIRED'; END IF;
    v_ref := v_item->'cart_fact_ref';
    v_niche := NULL;
    IF v_ref IS NOT NULL THEN
      SELECT * INTO v_cart FROM public.carts WHERE id=(v_ref->>'cart_id')::uuid AND store_id=p_store_id
        AND session_id=v_ref->>'cart_token' AND status='active' AND deleted_at IS NULL
        AND fact_acceptance_version=1 AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE;
      IF NOT FOUND OR jsonb_array_length(v_cart.items)<>jsonb_array_length(p_items) THEN RAISE EXCEPTION 'CART_FACT_REFERENCE_INVALID'; END IF;
      IF (SELECT count(*) FROM jsonb_array_elements(v_cart.items) line WHERE line->>'id'=v_ref->>'line_id')<>1 THEN
        RAISE EXCEPTION 'CART_FACT_REFERENCE_INVALID'; END IF;
      SELECT line INTO v_cart_line FROM jsonb_array_elements(v_cart.items) line WHERE line->>'id'=v_ref->>'line_id';
      IF v_cart_line->>'product_id' IS DISTINCT FROM v_product_id::text
        OR nullif(v_cart_line->>'variant_id','') IS DISTINCT FROM v_variant_id::text
        OR nullif(v_cart_line->>'marketplace_listing_id','') IS DISTINCT FROM nullif(v_item->>'marketplace_listing_id','')
        OR (v_cart_line->>'quantity')::integer IS DISTINCT FROM v_quantity
        OR v_cart_line->'product_version' IS DISTINCT FROM (v_locked_product_versions->v_product_id::text)
        OR v_ref->'product_version' IS DISTINCT FROM v_cart_line->'product_version'
        OR v_ref->'configuration_fingerprint' IS DISTINCT FROM v_cart_line->'configuration_fingerprint'
        OR v_ref->'snapshot_fingerprint' IS DISTINCT FROM v_cart_line->'snapshot_fingerprint'
        OR coalesce(v_cart_line->>'snapshot_fingerprint','') !~ '^[0-9a-f]{64}$'
        OR v_cart_line->'catalog_source'->'product_facts' IS DISTINCT FROM v_product_facts
        OR v_cart_line->'catalog_source'->'variant_facts' IS DISTINCT FROM v_variant_facts
        OR v_cart_line->'catalog_source'->'selected_options' IS DISTINCT FROM v_selected_options
        OR v_cart_line->'catalog_source'->'images' IS DISTINCT FROM coalesce(to_jsonb(v_product.images),'[]'::jsonb)
        THEN RAISE EXCEPTION 'CART_FACTS_CHANGED'; END IF;
      v_niche := v_cart_line->'niche_snapshot';
      IF jsonb_typeof(v_niche) IS DISTINCT FROM 'object' OR v_niche->'version' IS DISTINCT FROM '1'::jsonb
        OR jsonb_typeof(v_niche->'facts') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'CART_FACT_REFERENCE_INVALID'; END IF;
      SELECT coalesce(jsonb_object_agg(o->>'name',o->'value'),'{}'::jsonb) INTO v_saved_options
        FROM jsonb_array_elements(coalesce(v_niche->'selected_options','[]'::jsonb)) o;
      IF v_saved_options IS DISTINCT FROM v_selected_options THEN RAISE EXCEPTION 'CART_FACTS_CHANGED'; END IF;
    ELSIF v_product_facts<>'{}'::jsonb OR v_variant_facts<>'{}'::jsonb OR v_selected_options<>'{}'::jsonb THEN
      -- Existing non-niche direct order clients remain compatible. Factful/configured
      -- items must go through the same server cart, never a second snapshot writer.
      RAISE EXCEPTION 'CART_FACT_REFERENCE_REQUIRED';
    END IF;

    SELECT il.location_id
      INTO v_location_id
      FROM public.inventory_levels il
      JOIN public.inventory_locations loc ON loc.id = il.location_id
     WHERE il.product_id = v_product_id
       AND il.variant_id IS NOT DISTINCT FROM v_variant_id
       AND COALESCE(il.store_id, loc.store_id) = p_store_id
       AND loc.status = 'active'
       AND loc.deleted_at IS NULL
       AND il.deleted_at IS NULL
     ORDER BY loc.is_default DESC, il.updated_at ASC
     LIMIT 1;

    IF NOT FOUND OR v_location_id IS NULL THEN
      RAISE EXCEPTION 'inventory level not found for product %', v_product_id;
    END IF;

    SELECT public.reserve_inventory(
      p_store_id,
      v_product_id,
      v_variant_id,
      v_location_id,
      v_quantity,
      1200,
      'checkout.reserve:' || COALESCE(p_request_id, v_order_number) || ':' || jsonb_array_length(v_order_items)::text || ':' || v_product_id::text || ':' || COALESCE(v_variant_id::text, 'default'),
      p_actor_id,
      p_request_id
    )
    INTO v_reservation;
    v_reservation_id := (v_reservation ->> 'reservation_id')::uuid;

    v_line_total := v_unit_price * v_quantity;
    v_subtotal := v_subtotal + v_line_total;

    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'variant_id', v_variant_id,
      'reservation_id', v_reservation_id,
      'location_id', v_location_id,
      'name', v_product.name,
      'variant_title', v_variant_title,
      'sku', v_sku,
      'quantity', v_quantity,
      'price', v_unit_price,
      'total', v_line_total,
      'images', coalesce(to_jsonb(v_product.images),'[]'::jsonb)
    ) || CASE WHEN v_niche IS NOT NULL THEN jsonb_build_object('niche',v_niche,'cart_id',v_cart.id,'cart_line_id',v_cart_line->>'id',
        'product_version',v_cart_line->'product_version','configuration_fingerprint',v_cart_line->'configuration_fingerprint',
        'snapshot_fingerprint',v_cart_line->'snapshot_fingerprint') ELSE '{}'::jsonb END);
  END LOOP;

  INSERT INTO public.orders (
    store_id,
    order_number,
    customer_name,
    customer_email,
    customer_phone,
    shipping_address,
    items,
    subtotal,
    shipping_cost,
    discount,
    total,
    coupon_code,
    payment_method,
    status,
    payment_status,
    notes,
    inventory_reserved_at,
    created_by
  )
  VALUES (
    p_store_id,
    v_order_number,
    p_customer_name,
    p_customer_email,
    COALESCE(p_customer_phone, ''),
    COALESCE(p_shipping_address, '{}'::jsonb),
    v_order_items,
    v_subtotal,
    0,
    0,
    v_subtotal,
    p_coupon_code,
    p_payment_method,
    CASE WHEN p_payment_method = 'cod' THEN 'confirmed' ELSE 'pending' END,
    'pending',
    COALESCE(p_notes, ''),
    now(),
    p_actor_id
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_order_items)
  LOOP
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_variant_id := NULLIF(v_item ->> 'variant_id', '')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_location_id := (v_item ->> 'location_id')::uuid;
    v_reservation_id := (v_item ->> 'reservation_id')::uuid;

    UPDATE public.inventory_reservations
       SET order_id = v_order_id,
           updated_at = now()
     WHERE id = v_reservation_id
       AND store_id = p_store_id;

    PERFORM public.commit_inventory_reservation(
      p_store_id,
      v_reservation_id,
      'checkout.commit:' || v_order_id::text || ':' || v_reservation_id::text,
      p_actor_id,
      p_request_id
    );

    INSERT INTO public.inventory_adjustments (
      product_id,
      variant_id,
      location_id,
      quantity_change,
      reason,
      reference_id,
      note,
      created_by
    )
    VALUES (
      v_product_id,
      v_variant_id,
      v_location_id,
      -v_quantity,
      'sale',
      v_order_id,
      'Committed by reserve_inventory -> commit_inventory_reservation',
      p_actor_id
    );

    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      sku,
      title,
      variant_title,
      quantity,
      unit_price,
      total,
      product_snapshot
    )
    VALUES (
      v_order_id,
      v_product_id,
      v_variant_id,
      v_item ->> 'sku',
      v_item ->> 'name',
      v_item ->> 'variant_title',
      v_quantity,
      (v_item ->> 'price')::numeric,
      (v_item ->> 'total')::numeric,
      v_item - 'reservation_id' - 'location_id'
    );
  END LOOP;

  INSERT INTO public.outbox_events (
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
    p_store_id,
    'order',
    v_order_id::text,
    'order.created',
    jsonb_build_object(
      'store_id', p_store_id,
      'order_id', v_order_id,
      'order_number', v_order_number,
      'total', v_subtotal,
      'payment_method', p_payment_method
    ),
    'order.created:' || v_order_id::text,
    p_request_id,
    p_actor_id
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  INSERT INTO public.audit_activity_events (
    store_id,
    actor_id,
    actor_type,
    action,
    resource_type,
    resource_id,
    request_id,
    after_state
  )
  VALUES (
    p_store_id,
    p_actor_id,
    'user',
    'order.create',
    'order',
    v_order_id::text,
    p_request_id,
    jsonb_build_object(
      'order_id', v_order_id,
      'order_number', v_order_number,
      'total', v_subtotal
    )
  );

  SELECT to_jsonb(o)
    INTO v_order_json
    FROM public.orders o
   WHERE o.id = v_order_id;

  IF v_ref IS NOT NULL THEN
    UPDATE public.carts SET status='converted',checkout_handoff=coalesce(checkout_handoff,'{}'::jsonb)||jsonb_build_object('order_id',v_order_id),updated_at=now()
      WHERE id=v_cart.id AND store_id=p_store_id AND status='active';
    IF NOT FOUND THEN RAISE EXCEPTION 'CART_FACT_REFERENCE_INVALID'; END IF;
  END IF;
  RETURN v_order_json;
END;
$function$;

-- Recompute only the existing default/fallback cache; never sum all warehouses.
DO $cache436$DECLARE x record;BEGIN FOR x IN SELECT DISTINCT product_id,variant_id FROM public.inventory_levels ORDER BY product_id,variant_id LOOP PERFORM public.sync_inventory_catalog_cache_v1(x.product_id,x.variant_id);END LOOP;END $cache436$;
DO $current436$DECLARE signature text;v_fn record;shape text;BEGIN FOREACH signature IN ARRAY ARRAY['public.commit_inventory_reservation(uuid,uuid,text,uuid,text)','public.set_inventory_level_available(uuid,uuid,uuid,integer,uuid,text,text,text)','public.adjust_inventory_level(uuid,uuid,uuid,integer,uuid,text,text,text)','public.receive_inventory_transfer_line(inventory_transfers,inventory_transfer_lines,integer,uuid,text,text)','public.receive_purchase_order_line(purchase_orders,purchase_order_lines,integer,uuid,text,text)','public.release_order_inventory(uuid,uuid,text,text)','public.create_order_return_and_refund(uuid,jsonb,text,text,boolean,uuid,text,text)','public.reserve_inventory(uuid,uuid,uuid,uuid,integer,integer,text,uuid,text)','public.release_inventory_reservation(uuid,uuid,text,text,uuid,text)','public.expire_inventory_reservations(integer,text)','public.create_inventory_transfer_with_lines(uuid,uuid,uuid,jsonb,text,uuid,text,text)','public.ship_inventory_transfer(uuid,uuid,text,text)','public.sync_inventory_catalog_cache_v1(uuid,uuid)','public.sync_inventory_level_quantities_v1()','public.assert_transfer_reservation_binding_v1(uuid)','public.guard_transfer_reservation_binding_v1()','public.create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text)']LOOP
 SELECT *INTO STRICT v_fn FROM pg_proc WHERE oid=to_regprocedure(signature);shape:=jsonb_build_object('definition',pg_get_functiondef(v_fn.oid),'owner',v_fn.proowner,'acl',v_fn.proacl,'language',v_fn.prolang,'kind',v_fn.prokind,'strict',v_fn.proisstrict,'leakproof',v_fn.proleakproof,'parallel',v_fn.proparallel,'volatile',v_fn.provolatile,'cost',v_fn.procost,'rows',v_fn.prorows,'support',v_fn.prosupport,'config',v_fn.proconfig,'comment',obj_description(v_fn.oid,'pg_proc'))::text;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)VALUES('436',signature,current_user,'INVENTORY436 CURRENT FUNCTION','granted',v_fn.oid,v_fn.proowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
 END LOOP;END $current436$;
DO $tables436$DECLARE signature text;v_table record;shape text;BEGIN FOREACH signature IN ARRAY ARRAY['public.inventory_levels','public.inventory_reservations','public.inventory_transfers','public.inventory_transfer_lines']LOOP SELECT *INTO STRICT v_table FROM pg_class WHERE oid=to_regclass(signature);shape:=jsonb_build_object('relation',jsonb_build_array(v_table.relkind,v_table.relpersistence,v_table.relrowsecurity,v_table.relforcerowsecurity,v_table.reloptions,v_table.relreplident),'acl',v_table.relacl,
 'columns',(SELECT jsonb_agg(jsonb_build_array(c.attnum,c.attname,c.atttypid,c.atttypmod,c.attnotnull,c.attidentity,c.attgenerated,c.attcollation,c.attacl,pg_get_expr(d.adbin,d.adrelid))ORDER BY c.attnum)FROM pg_attribute c LEFT JOIN pg_attrdef d ON d.adrelid=c.attrelid AND d.adnum=c.attnum WHERE c.attrelid=v_table.oid AND c.attnum>0 AND NOT c.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred)ORDER BY c.conname)FROM pg_constraint c WHERE c.conrelid=v_table.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(i.indexrelid,pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready)ORDER BY i.indexrelid)FROM pg_index i WHERE i.indrelid=v_table.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(t.oid,t.tgname,pg_get_triggerdef(t.oid),t.tgenabled)ORDER BY t.tgname)FROM pg_trigger t WHERE t.tgrelid=v_table.oid AND NOT t.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,p.polroles,pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid))ORDER BY p.polname)FROM pg_policy p WHERE p.polrelid=v_table.oid))::text;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)VALUES('436',signature,current_user,'INVENTORY436 CURRENT TABLE','granted',v_table.oid,v_table.relowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
 END LOOP;END $tables436$;
-- Close replaced canonical functions by name after their latest definitions.
REVOKE ALL ON FUNCTION public.commit_inventory_reservation(uuid,uuid,text,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.set_inventory_level_available(uuid,uuid,uuid,integer,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.adjust_inventory_level(uuid,uuid,uuid,integer,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.receive_inventory_transfer_line(inventory_transfers,inventory_transfer_lines,integer,uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.receive_purchase_order_line(purchase_orders,purchase_order_lines,integer,uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_order_inventory(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_order_return_and_refund(uuid,jsonb,text,text,boolean,uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reserve_inventory(uuid,uuid,uuid,uuid,integer,integer,text,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_inventory_reservation(uuid,uuid,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.expire_inventory_reservations(integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_inventory_transfer_with_lines(uuid,uuid,uuid,jsonb,text,uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ship_inventory_transfer(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_order_with_inventory_reservations(uuid,text,text,text,jsonb,jsonb,text,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
COMMIT;
