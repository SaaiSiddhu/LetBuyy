-- N3.3: a retry receipt around the existing additive stock writer, not another stock engine.
-- Explicit dependency: reviewed346 assert_product_edit_actor_v1(...,'products:write').
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:356:inventory-adjustment',0));
DO $dependency$ BEGIN
 IF to_regprocedure('public.assert_product_edit_actor_v1(uuid,uuid,text)') IS NULL
  OR to_regprocedure('public.adjust_inventory_level(uuid,uuid,uuid,integer,uuid,text,text,text)') IS NULL
  OR EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='356') THEN
  RAISE EXCEPTION 'migration356 requires its canonical owners and absent356 provenance';END IF;
END $dependency$;

CREATE TABLE public.inventory_adjustment_receipts (
 idempotency_key text PRIMARY KEY CHECK(length(idempotency_key) BETWEEN 8 AND 200 AND idempotency_key=btrim(idempotency_key)),
 operation text NOT NULL CHECK(operation='inventory.adjustment.v1'),
 store_id uuid NOT NULL, actor_id uuid NOT NULL, product_id uuid NOT NULL,
 -- A regprocedure default records a real pg_depend edge without reauthorizing historical rows.
 authority_guard regprocedure NOT NULL DEFAULT 'public.assert_product_edit_actor_v1(uuid,uuid,text)'::regprocedure,
 command jsonb NOT NULL CHECK(jsonb_typeof(command)='object'),
 response jsonb NOT NULL CHECK(jsonb_typeof(response)='object'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_adjustment_receipts_product_idx ON public.inventory_adjustment_receipts(store_id,product_id,created_at);
ALTER TABLE public.inventory_adjustment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustment_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.inventory_adjustment_receipts FROM PUBLIC,anon,authenticated,app_tenant,service_role;

CREATE FUNCTION public.guard_inventory_adjustment_receipt_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN RAISE EXCEPTION 'inventory adjustment receipts are immutable' USING ERRCODE='42501';END
$fn$;
CREATE TRIGGER inventory_adjustment_receipts_immutable BEFORE UPDATE OR DELETE ON public.inventory_adjustment_receipts
 FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_adjustment_receipt_v1();

-- Canonical key namespace: inventory.adjustment.v1, globally bound to one actor,
-- store and normalized command. Trace request IDs can change on exact retries.
CREATE FUNCTION public.apply_inventory_adjustment_v1(p_store_id uuid,p_actor_id uuid,p_key text,p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE
 v_product_id uuid; v_variant_id uuid; v_location_id uuid; effective_location uuid; delta integer;
 reason text; notes text; level_row public.inventory_levels%ROWTYPE;
 receipt public.inventory_adjustment_receipts%ROWTYPE; has_receipt boolean; response jsonb;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'app_tenant' THEN
  RAISE EXCEPTION 'INVENTORY_ADJUST_FORBIDDEN' USING ERRCODE='42501';END IF;
 -- The same shared/exclusive maintenance lock is held until this transaction ends.
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('letbuyy:migration:356:inventory-adjustment',0));
 IF p_store_id IS NULL OR p_actor_id IS NULL OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 200 OR p_key<>btrim(p_key)
  OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR octet_length(p_command::text)>4096
  OR NOT(p_command ?& ARRAY['product_id','variant_id','location_id','adjustment','reason','notes'])
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_command) k WHERE k NOT IN('product_id','variant_id','location_id','adjustment','reason','notes'))
  OR jsonb_typeof(p_command->'product_id') IS DISTINCT FROM 'string'
  OR jsonb_typeof(p_command->'variant_id') NOT IN('string','null')
  OR jsonb_typeof(p_command->'location_id') NOT IN('string','null')
  OR jsonb_typeof(p_command->'adjustment') IS DISTINCT FROM 'number'
  OR p_command->>'adjustment' !~ '^-?[0-9]+$'
  OR jsonb_typeof(p_command->'reason') IS DISTINCT FROM 'string'
  OR p_command->>'reason' NOT IN('received','sold','returned','damaged','correction','transfer','sale','return','adjustment','recount')
  OR jsonb_typeof(p_command->'notes') NOT IN('string','null') OR length(p_command->>'notes')>500 THEN
  RAISE EXCEPTION 'INVENTORY_ADJUST_INVALID';END IF;
 v_product_id:=(p_command->>'product_id')::uuid;v_variant_id:=(p_command->>'variant_id')::uuid;
 v_location_id:=(p_command->>'location_id')::uuid;delta:=(p_command->>'adjustment')::integer;notes:=p_command->>'notes';
 IF delta NOT BETWEEN -99999 AND 99999 THEN RAISE EXCEPTION 'INVENTORY_ADJUST_INVALID';END IF;
 PERFORM public.assert_product_edit_actor_v1(p_store_id,p_actor_id,'products:write');
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:inventory.adjustment.v1:'||p_key,0));
 SELECT * INTO receipt FROM public.inventory_adjustment_receipts WHERE idempotency_key=p_key;
 has_receipt:=FOUND;
 IF has_receipt AND (receipt.operation<>'inventory.adjustment.v1' OR receipt.store_id IS DISTINCT FROM p_store_id
  OR receipt.actor_id IS DISTINCT FROM p_actor_id OR receipt.product_id IS DISTINCT FROM v_product_id OR receipt.command IS DISTINCT FROM p_command) THEN
  RAISE EXCEPTION 'INVENTORY_ADJUST_KEY_CONFLICT';END IF;
 -- An old HTTP cache cannot establish its actor or atomic stock/receipt outcome.
 -- Keep it intact and refuse reapplication, including expired/failed/deleted rows.
 IF NOT has_receipt AND EXISTS(SELECT 1 FROM public.idempotency_keys k WHERE k.site_id=p_store_id
  AND k.scope='http:POST:/inventory/adjust' AND k.key=p_key) THEN
  RAISE EXCEPTION 'INVENTORY_ADJUST_LEGACY_KEY';END IF;
 PERFORM p.id FROM public.products p WHERE p.id=v_product_id AND p.store_id=p_store_id AND p.deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVENTORY_ADJUST_NOT_FOUND';END IF;
 -- An omitted legacy default stays bound to its originally acknowledged location on retry.
 effective_location:=coalesce(v_location_id,CASE WHEN has_receipt THEN (receipt.response->>'location_id')::uuid END);
 IF effective_location IS NULL THEN effective_location:=public.ensure_default_inventory_location(p_store_id);END IF;
 PERFORM l.id FROM public.inventory_locations l WHERE l.id=effective_location AND l.store_id=p_store_id AND l.deleted_at IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVENTORY_ADJUST_NOT_FOUND';END IF;
 -- Serialize creation of a missing legacy level without replacing the stock writer.
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:inventory-level:'||v_product_id::text||':'||coalesce(v_variant_id::text,'default')||':'||effective_location::text,0));
 SELECT il.* INTO level_row FROM public.inventory_levels il WHERE il.store_id=p_store_id AND il.product_id=v_product_id
  AND il.variant_id IS NOT DISTINCT FROM v_variant_id AND il.location_id=effective_location FOR UPDATE;
 IF FOUND AND level_row.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'INVENTORY_ADJUST_NOT_FOUND';END IF;
 IF v_variant_id IS NOT NULL THEN
  PERFORM pv.id FROM public.product_variants pv WHERE pv.id=v_variant_id AND pv.product_id=v_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVENTORY_ADJUST_NOT_FOUND';END IF;
 END IF;
 -- Compatible with existing level -> variant -> parent stock/edit lock ordering.
 PERFORM p.id FROM public.products p WHERE p.id=v_product_id AND p.store_id=p_store_id AND p.deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVENTORY_ADJUST_NOT_FOUND';END IF;
 IF has_receipt THEN
  IF level_row.id IS DISTINCT FROM (receipt.response->>'id')::uuid THEN RAISE EXCEPTION 'INVENTORY_ADJUST_NOT_FOUND';END IF;
  RETURN jsonb_build_object('level',receipt.response,'replayed',true);
 END IF;
 reason:=CASE p_command->>'reason' WHEN 'sold' THEN 'sale' WHEN 'returned' THEN 'return'
  WHEN 'received' THEN 'adjustment' WHEN 'correction' THEN 'adjustment' ELSE p_command->>'reason' END;
 response:=public.adjust_inventory_level(v_product_id,v_variant_id,effective_location,delta,p_actor_id,reason,notes,
  nullif(current_setting('app.request_id',true),''));
 INSERT INTO public.inventory_adjustment_receipts(idempotency_key,operation,store_id,actor_id,product_id,command,response)
 VALUES(p_key,'inventory.adjustment.v1',p_store_id,p_actor_id,v_product_id,p_command,response);
 RETURN jsonb_build_object('level',response,'replayed',false);
END $fn$;
REVOKE ALL ON FUNCTION public.guard_inventory_adjustment_receipt_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb) TO app_tenant;

-- Provenance uses the existing migration journal, not another audit subsystem.
DO $provenance$
DECLARE signature text; f record; shape text; relation_row record;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.apply_inventory_adjustment_v1(uuid,uuid,text,jsonb)','public.guard_inventory_adjustment_receipt_v1()'] LOOP
  SELECT p.* INTO f FROM pg_proc p WHERE p.oid=to_regprocedure(signature);
  INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
  VALUES('356',signature,pg_get_userbyid(f.proowner),'FUNCTION EXECUTION FENCE','granted',f.oid,f.proowner,encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex'));
 END LOOP;
SELECT jsonb_build_object(
 'relation',jsonb_build_array(t.relkind,t.relpersistence,t.relrowsecurity,t.relforcerowsecurity,t.reloptions,t.relreplident),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attisdropped,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid=t.oid),
 'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid::regclass::text) FROM pg_index i WHERE i.indrelid=t.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(x.tgname,pg_get_triggerdef(x.oid),x.tgenabled) ORDER BY x.tgname) FROM pg_trigger x WHERE x.tgrelid=t.oid AND NOT x.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(x.polname,x.polcmd,x.polpermissive,x.polroles,pg_get_expr(x.polqual,x.polrelid),pg_get_expr(x.polwithcheck,x.polrelid)) ORDER BY x.polname) FROM pg_policy x WHERE x.polrelid=t.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(x.oid) ORDER BY x.rulename) FROM pg_rewrite x WHERE x.ev_class=t.oid)
 )::text INTO shape FROM pg_class t WHERE t.oid='public.inventory_adjustment_receipts'::regclass;
 SELECT * INTO relation_row FROM pg_class WHERE oid='public.inventory_adjustment_receipts'::regclass;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 VALUES('356','public.inventory_adjustment_receipts',pg_get_userbyid(relation_row.relowner),'PRIVATE RECEIPT SHAPE','granted',relation_row.oid,relation_row.relowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
END $provenance$;
NOTIFY pgrst,'reload schema';
COMMIT;
