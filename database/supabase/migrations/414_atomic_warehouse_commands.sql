-- Owner decision 2026-10-30: continue the accepted sequence after413.
-- Source/local qualification only. Existing warehouse RPCs remain the stock writers.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:414:warehouse-commands',0));

CREATE TABLE public.warehouse_command_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 idempotency_key text NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 8 AND 200 AND idempotency_key=btrim(idempotency_key)),
 site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES public.users_custom(id) ON DELETE RESTRICT,
 operation text NOT NULL CHECK(operation IN('purchase_order.create','purchase_order.receive','transfer.create','transfer.ship','transfer.receive')),
 target_id uuid NOT NULL,
 authority_guard regprocedure NOT NULL DEFAULT 'public.assert_product_edit_actor_v1(uuid,uuid,text)'::regprocedure,
 command jsonb NOT NULL CHECK(jsonb_typeof(command)='object'),
 response jsonb NOT NULL CHECK(jsonb_typeof(response)='object'),
 request_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz CHECK(deleted_at IS NULL),
 created_by uuid NOT NULL REFERENCES public.users_custom(id) ON DELETE RESTRICT,
 updated_by uuid NOT NULL REFERENCES public.users_custom(id) ON DELETE RESTRICT,
 CHECK(created_by=actor_id AND updated_by=actor_id AND updated_at=created_at)
);
CREATE INDEX warehouse_command_receipts_target_idx ON public.warehouse_command_receipts(site_id,target_id,created_at);
ALTER TABLE public.warehouse_command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_command_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.warehouse_command_receipts FROM PUBLIC,anon,authenticated,app_tenant,service_role;

CREATE FUNCTION public.guard_warehouse_command_receipt_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN RAISE EXCEPTION 'Warehouse acknowledgements are immutable' USING ERRCODE='42501';END
$fn$;
CREATE TRIGGER warehouse_command_receipts_immutable BEFORE UPDATE OR DELETE ON public.warehouse_command_receipts
 FOR EACH ROW EXECUTE FUNCTION public.guard_warehouse_command_receipt_v1();

CREATE FUNCTION public.apply_warehouse_command_v1(p_site_id uuid,p_actor_id uuid,p_key text,p_operation text,
 p_target_id uuid,p_command jsonb,p_request_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE
 receipt public.warehouse_command_receipts%ROWTYPE; has_receipt boolean;
 target uuid; allowed text[]; line jsonb; lines jsonb; effective_lines jsonb;
 line_key text; result jsonb; response jsonb; receipt_id uuid:=gen_random_uuid();
 row_po public.purchase_orders%ROWTYPE; row_transfer public.inventory_transfers%ROWTYPE;
 item record; product uuid; variant uuid; location uuid; quantity integer;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'app_tenant' THEN
  RAISE EXCEPTION 'WAREHOUSE_FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('letbuyy:migration:414:warehouse-commands',0));
 IF p_site_id IS NULL OR p_actor_id IS NULL OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 200 OR p_key<>btrim(p_key)
  OR p_operation IS NULL OR p_operation NOT IN('purchase_order.create','purchase_order.receive','transfer.create','transfer.ship','transfer.receive')
  OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR octet_length(p_command::text)>131072
  OR p_request_id IS NULL OR length(p_request_id) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'WAREHOUSE_INVALID';END IF;
 -- Check current authority before reading any previous private acknowledgement.
 PERFORM public.assert_product_edit_actor_v1(p_site_id,p_actor_id,'products:write');
 PERFORM id FROM public.sites WHERE id=p_site_id AND deleted_at IS NULL
  AND(custom_user_id=p_actor_id OR user_id=p_actor_id) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_FORBIDDEN' USING ERRCODE='42501';END IF;
 -- Existing effects call existing helpers. A caller cannot shadow any public
 -- relation used anywhere in that call chain through its temporary schema.
 IF EXISTS(SELECT 1 FROM pg_class t JOIN pg_class p ON p.relnamespace='public'::regnamespace AND p.relname=t.relname
   WHERE t.relnamespace=pg_my_temp_schema()) THEN RAISE EXCEPTION 'WAREHOUSE_FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:warehouse.command.v1:'||p_key,0));
 SELECT * INTO receipt FROM public.warehouse_command_receipts WHERE idempotency_key=p_key;
 has_receipt:=FOUND;
 IF has_receipt AND(receipt.site_id IS DISTINCT FROM p_site_id OR receipt.actor_id IS DISTINCT FROM p_actor_id
  OR receipt.operation IS DISTINCT FROM p_operation OR receipt.command IS DISTINCT FROM p_command
  OR(p_operation NOT IN('purchase_order.create','transfer.create') AND receipt.target_id IS DISTINCT FROM p_target_id)) THEN
  RAISE EXCEPTION 'WAREHOUSE_KEY_CONFLICT';END IF;
 IF (p_operation IN('purchase_order.create','transfer.create')) IS DISTINCT FROM (p_target_id IS NULL) THEN
  RAISE EXCEPTION 'WAREHOUSE_INVALID';END IF;
 target:=CASE WHEN has_receipt THEN receipt.target_id ELSE p_target_id END;
 IF target IS NOT NULL THEN
  IF p_operation LIKE 'purchase_order.%' THEN
   SELECT * INTO row_po FROM public.purchase_orders WHERE id=target AND site_id=p_site_id AND deleted_at IS NULL FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';END IF;
  ELSE
   SELECT * INTO row_transfer FROM public.inventory_transfers WHERE id=target AND site_id=p_site_id AND deleted_at IS NULL FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';END IF;
  END IF;
 END IF;
 IF has_receipt THEN RETURN receipt.response;END IF;
 -- An older expiring HTTP/domain cache cannot prove an atomic outcome.
 -- Preserve it and refuse to reapply the uncertain command, including soft-deleted evidence.
 IF EXISTS(SELECT 1 FROM public.idempotency_keys k WHERE k.site_id=p_site_id AND k.key=p_key
   AND(k.scope LIKE 'inventory.purchase_orders.%' OR k.scope LIKE 'inventory.transfers.%' OR k.scope LIKE 'http:%/inventory/%'))
  OR EXISTS(SELECT 1 FROM public.purchase_orders WHERE site_id=p_site_id AND idempotency_key=p_key)
  OR EXISTS(SELECT 1 FROM public.inventory_transfers WHERE site_id=p_site_id AND idempotency_key=p_key)
  OR EXISTS(SELECT 1 FROM public.purchase_order_receipts WHERE site_id=p_site_id AND left(idempotency_key,length(p_key)+6)=p_key||':line:')
  OR EXISTS(SELECT 1 FROM public.inventory_transfer_receipts WHERE site_id=p_site_id AND left(idempotency_key,length(p_key)+6)=p_key||':line:') THEN
  RAISE EXCEPTION 'WAREHOUSE_LEGACY_KEY';END IF;
 allowed:=CASE p_operation
  WHEN 'purchase_order.create' THEN ARRAY['supplier_id','location_id','expected_at','notes','lines']
  WHEN 'transfer.create' THEN ARRAY['source_location_id','destination_location_id','notes','lines']
  WHEN 'transfer.ship' THEN ARRAY[]::text[] ELSE ARRAY['lines'] END;
 IF NOT(p_command ?& allowed) OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_command) k WHERE NOT(k=ANY(allowed))) THEN
  RAISE EXCEPTION 'WAREHOUSE_INVALID';END IF;
 IF p_command ? 'notes' AND(jsonb_typeof(p_command->'notes') NOT IN('null','string') OR length(p_command->>'notes')>1000) THEN
  RAISE EXCEPTION 'WAREHOUSE_INVALID';END IF;
 lines:=p_command->'lines';
 IF p_operation IN('purchase_order.create','transfer.create') THEN
  IF jsonb_typeof(lines) IS DISTINCT FROM 'array' OR jsonb_array_length(lines) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'WAREHOUSE_INVALID';END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(lines) LOOP
   allowed:=CASE WHEN p_operation='purchase_order.create' THEN ARRAY['product_id','variant_id','quantity','unit_cost'] ELSE ARRAY['product_id','variant_id','quantity'] END;
   IF jsonb_typeof(line) IS DISTINCT FROM 'object' OR NOT(line ?& allowed)
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(line) k WHERE NOT(k=ANY(allowed)))
    OR jsonb_typeof(line->'product_id') IS DISTINCT FROM 'string'
    OR jsonb_typeof(line->'variant_id') NOT IN('null','string')
    OR jsonb_typeof(line->'quantity') IS DISTINCT FROM 'number' OR line->>'quantity' !~ '^[0-9]+$'
    OR (line->>'quantity')::numeric NOT BETWEEN 1 AND 999999
    OR(p_operation='purchase_order.create' AND(jsonb_typeof(line->'unit_cost') IS DISTINCT FROM 'number'
      OR (line->>'unit_cost')::numeric NOT BETWEEN 0 AND 999999)) THEN RAISE EXCEPTION 'WAREHOUSE_INVALID';END IF;
   product:=(line->>'product_id')::uuid;variant:=(line->>'variant_id')::uuid;
   PERFORM id FROM public.products WHERE id=product AND store_id=p_site_id AND deleted_at IS NULL FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';END IF;
   IF variant IS NOT NULL THEN
    PERFORM id FROM public.product_variants WHERE id=variant AND product_id=product AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';END IF;
   END IF;
  END LOOP;
  IF p_operation='purchase_order.create' THEN
   IF jsonb_typeof(p_command->'location_id') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_command->'supplier_id') NOT IN('null','string')
    OR jsonb_typeof(p_command->'expected_at') NOT IN('null','string') THEN RAISE EXCEPTION 'WAREHOUSE_INVALID';END IF;
   location:=(p_command->>'location_id')::uuid;
   PERFORM id FROM public.inventory_locations WHERE id=location AND store_id=p_site_id AND deleted_at IS NULL FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';END IF;
   IF p_command->>'supplier_id' IS NOT NULL THEN
    PERFORM id FROM public.suppliers WHERE id=(p_command->>'supplier_id')::uuid AND site_id=p_site_id AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';END IF;
   END IF;
   result:=public.create_purchase_order_with_lines(p_site_id,(p_command->>'supplier_id')::uuid,location,lines,
    (p_command->>'expected_at')::timestamptz,p_command->>'notes',p_actor_id,p_request_id,p_key);
   target:=(result->'purchase_order'->>'id')::uuid;
  ELSE
   IF jsonb_typeof(p_command->'source_location_id') IS DISTINCT FROM 'string'
    OR jsonb_typeof(p_command->'destination_location_id') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'WAREHOUSE_INVALID';END IF;
   FOR location IN SELECT x::uuid FROM unnest(ARRAY[p_command->>'source_location_id',p_command->>'destination_location_id']) x ORDER BY x LOOP
    PERFORM id FROM public.inventory_locations WHERE id=location AND store_id=p_site_id AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';END IF;
   END LOOP;
   result:=public.create_inventory_transfer_with_lines(p_site_id,(p_command->>'source_location_id')::uuid,(p_command->>'destination_location_id')::uuid,
    lines,p_command->>'notes',p_actor_id,p_request_id,p_key);
   target:=(result->'transfer'->>'id')::uuid;
  END IF;
 ELSIF p_operation='transfer.ship' THEN
  IF row_transfer.status<>'reserved' THEN RAISE EXCEPTION 'WAREHOUSE_STATE_CONFLICT';END IF;
  result:=public.ship_inventory_transfer(target,p_actor_id,p_request_id,p_key);
 ELSE
  IF(p_operation='purchase_order.receive' AND row_po.status IN('received','cancelled','closed'))
   OR(p_operation='transfer.receive' AND row_transfer.status NOT IN('reserved','shipped','partially_received')) THEN
   RAISE EXCEPTION 'WAREHOUSE_STATE_CONFLICT';END IF;
  -- Legacy receive-all remains compatible but its exact line quantities are
  -- frozen inside this first accepted transaction and retained in the receipt.
  effective_lines:='[]'::jsonb;
  IF lines='null'::jsonb THEN
   IF p_operation='purchase_order.receive' THEN
    FOR item IN SELECT * FROM public.purchase_order_lines WHERE purchase_order_id=target AND site_id=p_site_id AND deleted_at IS NULL ORDER BY id FOR UPDATE LOOP
     quantity:=item.quantity_ordered-item.quantity_received;
     IF quantity>0 THEN effective_lines:=effective_lines||jsonb_build_array(jsonb_build_object('purchase_order_line_id',item.id,'quantity',quantity));END IF;
    END LOOP;
   ELSE
    FOR item IN SELECT * FROM public.inventory_transfer_lines WHERE transfer_id=target AND site_id=p_site_id AND deleted_at IS NULL ORDER BY id FOR UPDATE LOOP
     quantity:=(CASE WHEN row_transfer.status='reserved' THEN item.quantity_requested ELSE item.quantity_shipped END)-item.quantity_received;
     IF quantity>0 THEN effective_lines:=effective_lines||jsonb_build_array(jsonb_build_object('transfer_line_id',item.id,'quantity',quantity));END IF;
    END LOOP;
   END IF;
  ELSE effective_lines:=lines;END IF;
  IF jsonb_typeof(effective_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(effective_lines) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'WAREHOUSE_INVALID';END IF;
  line_key:=CASE WHEN p_operation='purchase_order.receive' THEN 'purchase_order_line_id' ELSE 'transfer_line_id' END;
  IF(SELECT count(DISTINCT value->>line_key) FROM jsonb_array_elements(effective_lines))<>jsonb_array_length(effective_lines) THEN RAISE EXCEPTION 'WAREHOUSE_INVALID';END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(effective_lines) LOOP
   IF jsonb_typeof(line) IS DISTINCT FROM 'object' OR NOT(line ?& ARRAY[line_key,'quantity'])
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(line) k WHERE k NOT IN(line_key,'quantity'))
    OR jsonb_typeof(line->line_key) IS DISTINCT FROM 'string'
    OR jsonb_typeof(line->'quantity') IS DISTINCT FROM 'number' OR line->>'quantity' !~ '^[0-9]+$'
    OR (line->>'quantity')::numeric NOT BETWEEN 1 AND 999999 THEN RAISE EXCEPTION 'WAREHOUSE_INVALID';END IF;
   IF p_operation='purchase_order.receive' THEN
    SELECT * INTO item FROM public.purchase_order_lines WHERE id=(line->>line_key)::uuid AND purchase_order_id=target AND site_id=p_site_id AND deleted_at IS NULL FOR UPDATE;
   ELSE
    SELECT * INTO item FROM public.inventory_transfer_lines WHERE id=(line->>line_key)::uuid AND transfer_id=target AND site_id=p_site_id AND deleted_at IS NULL FOR UPDATE;
   END IF;
   IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';END IF;
  END LOOP;
  IF p_operation='purchase_order.receive' THEN result:=public.receive_purchase_order(target,effective_lines,p_actor_id,p_request_id,p_key);
  ELSE result:=public.receive_inventory_transfer(target,effective_lines,p_actor_id,p_request_id,p_key);END IF;
 END IF;
 IF target IS NULL THEN RAISE EXCEPTION 'WAREHOUSE_ACK_UNAVAILABLE';END IF;
 -- Canonical stable snapshots, including lines on ship and exact replay.
 IF p_operation LIKE 'purchase_order.%' THEN
  SELECT jsonb_build_object('purchase_order',to_jsonb(po),'lines',(SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.id),'[]'::jsonb)
    FROM public.purchase_order_lines l WHERE l.purchase_order_id=target AND l.site_id=p_site_id AND l.deleted_at IS NULL))
   INTO result FROM public.purchase_orders po WHERE po.id=target AND po.site_id=p_site_id AND po.deleted_at IS NULL;
 ELSE
  SELECT jsonb_build_object('transfer',to_jsonb(t),'lines',(SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.id),'[]'::jsonb)
    FROM public.inventory_transfer_lines l WHERE l.transfer_id=target AND l.site_id=p_site_id AND l.deleted_at IS NULL))
   INTO result FROM public.inventory_transfers t WHERE t.id=target AND t.site_id=p_site_id AND t.deleted_at IS NULL;
 END IF;
 IF result IS NULL THEN RAISE EXCEPTION 'WAREHOUSE_ACK_UNAVAILABLE';END IF;
 response:=result||jsonb_build_object('command_receipt',jsonb_build_object('id',receipt_id,'key',p_key,'site_id',p_site_id,
  'actor_id',p_actor_id,'operation',p_operation,'target_id',target,'command',p_command,'effective_lines',effective_lines));
 INSERT INTO public.warehouse_command_receipts(id,idempotency_key,site_id,actor_id,operation,target_id,command,response,request_id,created_by,updated_by)
  VALUES(receipt_id,p_key,p_site_id,p_actor_id,p_operation,target,p_command,response,p_request_id,p_actor_id,p_actor_id);
 RETURN response;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_warehouse_command_receipt_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.apply_warehouse_command_v1(uuid,uuid,text,text,uuid,jsonb,text) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.apply_warehouse_command_v1(uuid,uuid,text,text,uuid,jsonb,text) TO app_tenant;

-- Capture every real privilege delta before closing raw execution. The bodies
-- remain canonical; only the guarded owner can invoke their stock effects.
DO $effects$
DECLARE signature text; f record; a record; grantee_sql text; original_path text;
BEGIN
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='414') THEN RAISE EXCEPTION 'migration414 provenance already exists';END IF;
 FOREACH signature IN ARRAY ARRAY[
  'public.create_purchase_order_with_lines(uuid,uuid,uuid,jsonb,timestamptz,text,uuid,text,text)',
  'public.receive_purchase_order(uuid,jsonb,uuid,text,text)',
  'public.create_inventory_transfer_with_lines(uuid,uuid,uuid,jsonb,text,uuid,text,text)',
  'public.ship_inventory_transfer(uuid,uuid,text,text)',
  'public.receive_inventory_transfer(uuid,jsonb,uuid,text,text)',
  'public.receive_purchase_order_line(public.purchase_orders,public.purchase_order_lines,integer,uuid,text,text)',
  'public.receive_inventory_transfer_line(public.inventory_transfers,public.inventory_transfer_lines,integer,uuid,text,text)'
 ] LOOP
  SELECT p.* INTO f FROM pg_proc p WHERE p.oid=to_regprocedure(signature);
  IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR NOT f.prosecdef OR cardinality(f.proconfig) IS DISTINCT FROM 1
   OR f.proconfig[1] NOT IN('search_path=public','search_path=public, pg_temp')
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) x WHERE x.grantor<>f.proowner OR x.grantee NOT IN(f.proowner,0,'anon'::regrole::oid,'authenticated'::regrole::oid,'app_tenant'::regrole::oid,'service_role'::regrole::oid) OR(x.grantee<>f.proowner AND x.is_grantable)) THEN
   RAISE EXCEPTION 'migration414 refuses unreviewed warehouse effect profile: %',signature;END IF;
  original_path:=substr(f.proconfig[1],length('search_path=')+1);
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
   VALUES('414',signature,pg_get_userbyid(f.proowner),'WAREHOUSE ORIGINAL SEARCH_PATH='||original_path,'revoked',f.oid,f.proowner,encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex'));
  FOR a IN SELECT * FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) WHERE grantee<>f.proowner LOOP
   IF a.privilege_type<>'EXECUTE' THEN RAISE EXCEPTION 'migration414 refuses unexpected function privilege';END IF;
   grantee_sql:=CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END;
   INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
    VALUES('414',signature,CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
     CASE WHEN a.is_grantable THEN 'EXECUTE WITH GRANT OPTION' ELSE 'EXECUTE' END,'revoked',f.oid,f.proowner,encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex'));
   EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s',signature,grantee_sql);
  END LOOP;
  EXECUTE format('ALTER FUNCTION %s SET search_path=pg_catalog,public,pg_temp',signature);
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
   SELECT '414',signature,pg_get_userbyid(p.proowner),'WAREHOUSE EFFECT FENCE','granted',p.oid,p.proowner,encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') FROM pg_proc p WHERE p.oid=f.oid;
 END LOOP;
END $effects$;


DO $provenance$
DECLARE signature text; f record; shape text; relation_row record;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.apply_warehouse_command_v1(uuid,uuid,text,text,uuid,jsonb,text)','public.guard_warehouse_command_receipt_v1()'] LOOP
  SELECT p.* INTO f FROM pg_proc p WHERE p.oid=to_regprocedure(signature);
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
  VALUES('414',signature,pg_get_userbyid(f.proowner),'FUNCTION EXECUTION FENCE','granted',f.oid,f.proowner,encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex'));
 END LOOP;
SELECT jsonb_build_object(
 'relation',jsonb_build_array(t.relkind,t.relpersistence,t.relrowsecurity,t.relforcerowsecurity,t.reloptions,t.relreplident),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid=t.oid),
 'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid::regclass::text) FROM pg_index i WHERE i.indrelid=t.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(x.tgname,pg_get_triggerdef(x.oid),x.tgenabled) ORDER BY x.tgname) FROM pg_trigger x WHERE x.tgrelid=t.oid AND NOT x.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(x.polname,x.polcmd,x.polpermissive,x.polroles,pg_get_expr(x.polqual,x.polrelid),pg_get_expr(x.polwithcheck,x.polrelid)) ORDER BY x.polname) FROM pg_policy x WHERE x.polrelid=t.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(x.oid) ORDER BY x.rulename) FROM pg_rewrite x WHERE x.ev_class=t.oid)
 )::text INTO shape FROM pg_class t WHERE t.oid='public.warehouse_command_receipts'::regclass;
 SELECT * INTO relation_row FROM pg_class WHERE oid='public.warehouse_command_receipts'::regclass;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 VALUES('414','public.warehouse_command_receipts',pg_get_userbyid(relation_row.relowner),'PRIVATE RECEIPT SHAPE','granted',relation_row.oid,relation_row.relowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
END $provenance$;
NOTIFY pgrst,'reload schema';
COMMIT;
