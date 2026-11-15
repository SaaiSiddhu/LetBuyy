"""Prepare reviewed static SQL from the owned437 catalog; never executed by a migration."""
from pathlib import Path
import json,re
root=Path.cwd(); v=root/'docs/evidence/merchant-local-completion-2026-11-02/verification-2026-11-05'
p=json.loads((v/'variant-retirement-v96-owned-profiles.json').read_text())
fs={f['signature'].split('(')[0]:f for f in p['functions']}
names=['apply_product_edit_v1','product_edit_snapshot_v1','create_order_with_inventory_reservations']
original={n:fs[n]['definition'].rstrip()+';\n' for n in names}; updated=dict(original)
s=updated['apply_product_edit_v1']
s=s.replace('WHERE id=v_variant_id AND product_id=p_product_id FOR UPDATE;', 'WHERE id=v_variant_id AND product_id=p_product_id AND deleted_at IS NULL FOR UPDATE;')
s=s.replace('WHERE product_id=p_product_id AND NOT id=ANY(retained);', 'WHERE product_id=p_product_id AND deleted_at IS NULL AND NOT id=ANY(retained);')
start=s.index('        -- Stable stock/history/reservation references')
end=s.index('\n    END IF;',start)
s=s[:start]+'''        -- Retain UUID, stock/price/order history. The canonical row guard checks
        -- every stock dimension and open work while holding this variant lock.
        UPDATE public.product_variants SET deleted_at=clock_timestamp()
            WHERE product_id=p_product_id AND id=ANY(removed) AND deleted_at IS NULL;'''+s[end:]
updated['apply_product_edit_v1']=s
updated['product_edit_snapshot_v1']=updated['product_edit_snapshot_v1'].replace('WHERE pv.product_id = p.id','WHERE pv.product_id = p.id AND pv.deleted_at IS NULL')
s=updated['create_order_with_inventory_reservations']
# Exact predicate replacements retain every authoritative price/GST/order/reservation branch.
s,n1=re.subn(r'WHERE id = v_variant_id\s+AND product_id = v_product_id', 'WHERE id = v_variant_id AND deleted_at IS NULL\n               AND product_id = v_product_id',s)
s,n2=re.subn(r'WHERE product_id\s*=\s*v_product_id\s*\)', 'WHERE product_id = v_product_id AND deleted_at IS NULL)',s)
s,n3=re.subn(r'WHERE pv.product_id\s*=\s*v_product_id', 'WHERE pv.product_id=v_product_id AND pv.deleted_at IS NULL',s)
assert (n1,n2,n3)==(1,1,1),(n1,n2,n3)
updated['create_order_with_inventory_reservations']=s
h=(root/'database/supabase/migrations/437_inventory_batch_adjustment_receipts.sql').read_text()
fence=h[:h.index('LOCK TABLE public.inventory_adjustment_receipts')].replace('437','438').replace('inventory-batch','variant-retirement')
# The cutover changes existing canonical owners only. No new table/runtime.
fence+='''LOCK TABLE public.inventory_levels,public.product_variants,public.products,
 public.inventory_reservations,public.purchase_order_lines,public.purchase_orders,
 public.inventory_transfer_lines,public.inventory_transfers,public.fulfillment_order_lines,
 public.fulfillment_orders,public.order_items,public.orders,public.return_lines,public.returns
 IN ACCESS EXCLUSIVE MODE NOWAIT;
'''
checks='''DO $admit438$BEGIN IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='438')
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.product_variants'::regclass AND attname='deleted_at')
 OR EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('guard_product_variant_retirement_v1','guard_live_variant_reference_v1','guard_retired_variant_work_reopen_v1','project_product_variant_retirement_v1','guard_variant_retirement_cache_v1'))
 THEN RAISE EXCEPTION 'migration438 refuses existing/unreviewed cutover';END IF;END $admit438$;
'''
checks+='''DO $actor438$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.assert_product_edit_actor_v1(uuid,uuid,text)');
 IF NOT FOUND OR f.proowner<>current_user::regrole::oid
 OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'0dc7ff20a4f1e99496c2cad437d0746ded832be5f2ffc9cc8d9e5086340a3933'
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a WHERE a.grantee<>f.proowner OR a.grantor<>f.proowner)
 THEN RAISE EXCEPTION 'migration438 refuses changed actor authority';END IF;END $actor438$;
'''
for n in names:
 f=fs[n]; grantees="current_user::regrole::oid,'app_tenant'::regrole::oid" if n=='apply_product_edit_v1' else 'current_user::regrole::oid'
 checks+=f"""DO $dependency438$DECLARE f record;BEGIN SELECT *INTO f FROM pg_proc WHERE oid=to_regprocedure('public.{f['signature']}');
 IF NOT FOUND OR f.proowner<>current_user::regrole::oid
 OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'{f['hash']}'
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a
 WHERE a.grantor<>f.proowner OR NOT(a.grantee=ANY(ARRAY[{grantees}]))OR(a.grantee<>f.proowner AND a.is_grantable))
 THEN RAISE EXCEPTION 'migration438 refuses changed dependency: public.{f['signature']}';END IF;END $dependency438$;
"""
helpers='''-- All existing variants remain live; expansion preserves their original row facts.
CREATE TEMP TABLE variant438_before ON COMMIT DROP AS SELECT id,to_jsonb(v) AS facts FROM public.product_variants v;
ALTER TABLE public.product_variants ADD COLUMN deleted_at timestamptz;
COMMENT ON COLUMN public.product_variants.deleted_at IS 'Canonical retirement marker. UUID and historical facts are retained; no new stock or purchase authority.';
CREATE OR REPLACE FUNCTION public.guard_product_variant_retirement_v1() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE tenant uuid;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'PRODUCT_VARIANT_HISTORY_IMMUTABLE';END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'PRODUCT_VARIANT_RETIRED';END IF;
  RETURN NEW;
 END IF;
 IF OLD.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'PRODUCT_VARIANT_RETIRED';END IF;
 IF NEW.deleted_at IS NULL THEN RETURN NEW;END IF;
 IF (to_jsonb(NEW)-'deleted_at') IS DISTINCT FROM (to_jsonb(OLD)-'deleted_at') THEN
  RAISE EXCEPTION 'PRODUCT_VARIANT_RETIREMENT_INVALID';END IF;
 SELECT store_id INTO STRICT tenant FROM public.products WHERE id=OLD.product_id AND deleted_at IS NULL;
 PERFORM public.assert_product_edit_actor_v1(tenant,nullif(current_setting('app.actor_id',true),'')::uuid,'products:write');
 IF coalesce(OLD.inventory_qty,0)<>0
 OR EXISTS(SELECT 1 FROM public.inventory_levels l WHERE l.variant_id=OLD.id AND
  (coalesce(l.available,0)<>0 OR coalesce(l.reserved,0)<>0 OR coalesce(l.incoming,0)<>0
  OR coalesce(l.on_hand_quantity,0)<>0 OR coalesce(l.available_quantity,0)<>0
  OR coalesce(l.committed_quantity,0)<>0 OR coalesce(l.unavailable_quantity,0)<>0
  OR coalesce(l.incoming_quantity,0)<>0 OR coalesce(l.reserved_quantity,0)<>0 OR coalesce(l.safety_stock_quantity,0)<>0))
 OR EXISTS(SELECT 1 FROM public.inventory_reservations r WHERE r.variant_id=OLD.id AND r.status IN('active','hold'))
 OR EXISTS(SELECT 1 FROM public.purchase_order_lines l JOIN public.purchase_orders w ON w.id=l.purchase_order_id
  WHERE l.variant_id=OLD.id AND w.status NOT IN('received','cancelled','closed'))
 OR EXISTS(SELECT 1 FROM public.inventory_transfer_lines l JOIN public.inventory_transfers w ON w.id=l.transfer_id
  WHERE l.variant_id=OLD.id AND w.status NOT IN('received','cancelled'))
 OR EXISTS(SELECT 1 FROM public.fulfillment_order_lines l JOIN public.fulfillment_orders w ON w.id=l.fulfillment_order_id
  WHERE l.variant_id=OLD.id AND w.status NOT IN('fulfilled','cancelled'))
 OR EXISTS(SELECT 1 FROM public.order_items l JOIN public.orders w ON w.id=l.order_id
  WHERE l.variant_id=OLD.id::text AND (w.status NOT IN('delivered','cancelled','refunded','returned','rto')
   OR w.return_status NOT IN('none','refunded','closed','cancelled') OR w.refund_status IN('pending','processing')))
 OR EXISTS(SELECT 1 FROM public.return_lines l JOIN public.returns w ON w.id=l.return_id
  WHERE l.variant_id=OLD.id AND w.status NOT IN('rejected','refunded','closed','cancelled'))
 THEN RAISE EXCEPTION 'PRODUCT_VARIANT_RETIREMENT_BLOCKED';END IF;
 NEW.deleted_at:=clock_timestamp();RETURN NEW;
END $fn$;
CREATE TRIGGER product_variant_retirement438 BEFORE INSERT OR UPDATE OR DELETE ON public.product_variants
 FOR EACH ROW EXECUTE FUNCTION public.guard_product_variant_retirement_v1();
-- Every new stock/reference takes the same variant lock as retirement. A concurrent
-- reference either commits first and blocks retirement, or observes the tombstone.
CREATE OR REPLACE FUNCTION public.guard_live_variant_reference_v1() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE v public.product_variants%ROWTYPE;variant_uuid uuid;
BEGIN
 IF NEW.variant_id IS NULL THEN RETURN NEW;END IF;
 variant_uuid:=NEW.variant_id::text::uuid;
 SELECT *INTO v FROM public.product_variants WHERE id=variant_uuid FOR UPDATE;
 IF NOT FOUND OR v.deleted_at IS NOT NULL OR v.product_id IS DISTINCT FROM NEW.product_id THEN
  RAISE EXCEPTION 'PRODUCT_VARIANT_RETIRED';END IF;
 RETURN NEW;
END $fn$;
'''
for table in ['inventory_levels','inventory_reservations']:
 helpers+=f'CREATE TRIGGER live_variant438 BEFORE INSERT OR UPDATE ON public.{table} FOR EACH ROW EXECUTE FUNCTION public.guard_live_variant_reference_v1();\n'
for table in ['purchase_order_lines','inventory_transfer_lines','fulfillment_order_lines','order_items']:
 helpers+=f'CREATE TRIGGER live_variant438 BEFORE INSERT OR UPDATE OF variant_id,product_id ON public.{table} FOR EACH ROW EXECUTE FUNCTION public.guard_live_variant_reference_v1();\n'
helpers+='''-- Terminal historical work remains readable. Reopening work cannot reactivate a retired SKU.
CREATE OR REPLACE FUNCTION public.guard_retired_variant_work_reopen_v1() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE variant_uuid uuid; terminal boolean;
BEGIN
 terminal:=CASE TG_TABLE_NAME
  WHEN 'purchase_orders' THEN NEW.status IN('received','cancelled','closed')
  WHEN 'inventory_transfers' THEN NEW.status IN('received','cancelled')
  WHEN 'fulfillment_orders' THEN NEW.status IN('fulfilled','cancelled')
  WHEN 'returns' THEN NEW.status IN('rejected','refunded','closed','cancelled')
  WHEN 'orders' THEN (to_jsonb(NEW)->>'status') IN('delivered','cancelled','refunded','returned','rto')
    AND (to_jsonb(NEW)->>'return_status') IN('none','refunded','closed','cancelled')
    AND (to_jsonb(NEW)->>'refund_status') NOT IN('pending','processing') ELSE false END;
 IF terminal THEN RETURN NEW;END IF;
 FOR variant_uuid IN
  SELECT l.variant_id FROM public.purchase_order_lines l WHERE TG_TABLE_NAME='purchase_orders'AND l.purchase_order_id=NEW.id
  UNION SELECT l.variant_id FROM public.inventory_transfer_lines l WHERE TG_TABLE_NAME='inventory_transfers'AND l.transfer_id=NEW.id
  UNION SELECT l.variant_id FROM public.fulfillment_order_lines l WHERE TG_TABLE_NAME='fulfillment_orders'AND l.fulfillment_order_id=NEW.id
  UNION SELECT l.variant_id FROM public.return_lines l WHERE TG_TABLE_NAME='returns'AND l.return_id=NEW.id
  UNION SELECT l.variant_id::uuid FROM public.order_items l WHERE TG_TABLE_NAME='orders'AND l.order_id=NEW.id AND l.variant_id IS NOT NULL
 LOOP
  IF variant_uuid IS NULL THEN CONTINUE;END IF;
  PERFORM 1 FROM public.product_variants v WHERE v.id=variant_uuid AND v.deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_VARIANT_RETIRED';END IF;
 END LOOP;
 RETURN NEW;
END $fn$;
'''
for table in ['purchase_orders','inventory_transfers','fulfillment_orders','returns']:
 helpers+=f'CREATE TRIGGER live_variant_reopen438 BEFORE UPDATE OF status ON public.{table} FOR EACH ROW EXECUTE FUNCTION public.guard_retired_variant_work_reopen_v1();\n'
helpers+='''CREATE TRIGGER live_variant_restock438 BEFORE INSERT OR UPDATE OF variant_id,product_id,disposition,restock_quantity,status ON public.return_lines
 FOR EACH ROW WHEN(NEW.restock_quantity>0 OR(NEW.disposition='restock'AND NEW.status IN('received','inspected','restocked')))
 EXECUTE FUNCTION public.guard_live_variant_reference_v1();
'''
helpers+='CREATE TRIGGER live_variant_reopen438 BEFORE UPDATE OF status,return_status,refund_status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_retired_variant_work_reopen_v1();\n'
helpers+='''-- Older maintenance cache refreshes cannot re-expose a retired identity when
-- a compatibility reader is selected. Canonical live rows remain the sole owner.
CREATE OR REPLACE FUNCTION public.guard_variant_retirement_cache_v1() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM public.product_variants WHERE product_id=NEW.id AND deleted_at IS NOT NULL)THEN
  NEW.variants:=public.product_edit_snapshot_v1(NEW.id)->'variants';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER variant_retirement_cache438 BEFORE UPDATE OF variants ON public.products
 FOR EACH ROW EXECUTE FUNCTION public.guard_variant_retirement_cache_v1();
CREATE OR REPLACE FUNCTION public.project_product_variant_retirement_v1() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 UPDATE public.products SET variants=public.product_edit_snapshot_v1(NEW.product_id)->'variants'
 WHERE id=NEW.product_id;
 RETURN NEW;
END $fn$;
CREATE TRIGGER project_variant_retirement438 AFTER UPDATE OF deleted_at ON public.product_variants
 FOR EACH ROW WHEN(OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
 EXECUTE FUNCTION public.project_product_variant_retirement_v1();
'''
for name in ['guard_product_variant_retirement_v1','guard_live_variant_reference_v1','guard_retired_variant_work_reopen_v1','project_product_variant_retirement_v1','guard_variant_retirement_cache_v1']:
 helpers+=f'REVOKE ALL ON FUNCTION public.{name}() FROM PUBLIC,anon,authenticated,app_tenant,service_role;\n'
# Existing product edit already projects the live snapshot atomically after all edits.
# Existing child-change triggers invalidate public caches/version; no second cache authority.
verify='''DO $parity438$BEGIN IF EXISTS(SELECT 1 FROM variant438_before b FULL JOIN public.product_variants v ON v.id=b.id
 WHERE b.facts IS DISTINCT FROM (to_jsonb(v)-'deleted_at'))THEN RAISE EXCEPTION 'migration438 retained row variance';END IF;END $parity438$;
'''
# Freeze catalog facts rather than mutable optimizer statistics. Down refuses unknown
# subsequent function/schema changes, including PL/pgSQL dependencies absent from pg_depend.
tables=['product_variants','inventory_levels','inventory_reservations','purchase_order_lines','inventory_transfer_lines','fulfillment_order_lines','order_items','purchase_orders','inventory_transfers','fulfillment_orders','return_lines','returns','orders']
ids=','.join("'public."+t+"'::regclass" for t in tables)
shape=f"""SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid)FROM pg_proc p WHERE p.pronamespace='public'::regnamespace),
 'relations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relfrozenxid','relminmxid'] ORDER BY c.oid)FROM pg_class c WHERE c.oid IN({ids})),
 'columns',(SELECT jsonb_agg(to_jsonb(a)ORDER BY a.attrelid,a.attnum)FROM pg_attribute a WHERE a.attrelid IN({ids})),
 'triggers',(SELECT jsonb_agg(to_jsonb(t)ORDER BY t.oid)FROM pg_trigger t WHERE t.tgrelid IN({ids})),
 'constraints',(SELECT jsonb_agg(to_jsonb(c)ORDER BY c.oid)FROM pg_constraint c WHERE c.conrelid IN({ids})),
 'indexes',(SELECT jsonb_agg(to_jsonb(i)ORDER BY i.indexrelid)FROM pg_index i WHERE i.indrelid IN({ids})),
 'defaults',(SELECT jsonb_agg(to_jsonb(d)ORDER BY d.adrelid,d.adnum)FROM pg_attrdef d WHERE d.adrelid IN({ids})),
 'policies',(SELECT jsonb_agg(to_jsonb(p)ORDER BY p.oid)FROM pg_policy p WHERE p.polrelid IN({ids})),
 'comments',(SELECT jsonb_agg(to_jsonb(d)ORDER BY d.classoid,d.objoid,d.objsubid)FROM pg_description d WHERE(d.classoid='pg_class'::regclass AND d.objoid IN({ids}))OR(d.classoid='pg_proc'::regclass AND d.objoid IN(SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace))),
 'roles',(SELECT jsonb_agg(to_jsonb(r)ORDER BY r.oid)FROM pg_roles r),
 'memberships',(SELECT jsonb_agg(to_jsonb(m)ORDER BY m.roleid,m.member,m.grantor)FROM pg_auth_members m),
 'dependencies',(SELECT jsonb_agg(to_jsonb(d)ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype)FROM pg_depend d WHERE (d.refclassid='pg_class'::regclass AND d.refobjid IN({ids}))OR(d.classid='pg_class'::regclass AND d.objid IN({ids})))
 )::text INTO shape;"""
save=f"""DO $save438$DECLARE shape text;BEGIN {shape}
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 VALUES('438','public.product_variants',current_user,'VARIANT438 CURRENT CATALOG','granted','public.product_variants'::regclass,current_user::regrole,encode(sha256(convert_to(shape,'UTF8')),'hex'));
 END $save438$;
NOTIFY pgrst,'reload schema';
COMMIT;
"""
forward=fence+checks+helpers+''.join(updated[n] for n in names)+verify+save
refuse=f"""DO $rollback438$DECLARE shape text;j record;BEGIN {shape}
 SELECT *INTO j FROM public.migration_privilege_journal WHERE migration='438'AND object_signature='public.product_variants'AND privilege='VARIANT438 CURRENT CATALOG';
 IF NOT FOUND OR j.object_oid IS DISTINCT FROM 'public.product_variants'::regclass::oid OR j.object_owner IS DISTINCT FROM current_user::regrole::oid
 OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex')THEN RAISE EXCEPTION 'rollback438 refuses catalog drift';END IF;
 IF EXISTS(SELECT 1 FROM public.product_variants WHERE deleted_at IS NOT NULL)THEN RAISE EXCEPTION 'rollback438 refuses retained retired variants';END IF;
 END $rollback438$;
"""
down=fence+refuse
for table in ['inventory_levels','inventory_reservations','purchase_order_lines','inventory_transfer_lines','fulfillment_order_lines','order_items']:
 down+=f'DROP TRIGGER live_variant438 ON public.{table};\n'
for table in ['purchase_orders','inventory_transfers','fulfillment_orders','returns','orders']:
 down+=f'DROP TRIGGER live_variant_reopen438 ON public.{table};\n'
down+='DROP TRIGGER live_variant_restock438 ON public.return_lines;\nDROP TRIGGER variant_retirement_cache438 ON public.products;\nDROP TRIGGER project_variant_retirement438 ON public.product_variants;\nDROP TRIGGER product_variant_retirement438 ON public.product_variants;\n'
for name in ['guard_product_variant_retirement_v1','guard_live_variant_reference_v1','guard_retired_variant_work_reopen_v1','project_product_variant_retirement_v1','guard_variant_retirement_cache_v1']:
 down+=f'DROP FUNCTION public.{name}();\n'
down+=''.join(original[n] for n in names)
down+="ALTER TABLE public.product_variants DROP COLUMN deleted_at;\nDELETE FROM public.migration_privilege_journal WHERE migration='438';\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n"
for file,body in [('database/supabase/migrations/438_product_variant_retirement.sql',forward),('database/supabase/rollback/438_product_variant_retirement.rollback.sql',down)]:
 path=root/file;path.parent.mkdir(exist_ok=True);path.write_text('-- Approved variant retirement; source/local qualification only.\n'+body)
