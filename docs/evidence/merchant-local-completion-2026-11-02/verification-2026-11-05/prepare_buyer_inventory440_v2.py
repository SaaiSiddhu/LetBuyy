from pathlib import Path
import json,hashlib
v=Path(__file__).resolve().parent;root=v.parents[3];m=root/'database/supabase/migrations';r=root/'database/supabase/rollback'
assert max(int(p.name.split('_')[0])for p in m.glob('*.sql'))==439
f=m/'440_buyer_inventory_projection.sql';d=r/'440_buyer_inventory_projection.rollback.sql';assert not f.exists()and not d.exists()
profiles=json.loads((v/'buyer-inventory440-owned-provenance.json').read_text())['profiles'];old=next(p for p in profiles if p['signature'].startswith('browse_'));quantity=next(p for p in profiles if p['signature'].startswith('catalog_'));body=old['definition']
old_data="'data',coalesce((SELECT jsonb_agg(product ORDER BY ordinal) FROM page),'[]'),";new_data="'data',coalesce((SELECT jsonb_agg(paged.product||jsonb_build_object('catalog_available_quantity',public.catalog_available_quantity(p)) ORDER BY paged.ordinal) FROM page paged JOIN public.products p ON p.id=paged.id AND p.store_id=p_store_id AND p.deleted_at IS NULL),'[]'),";assert body.count(old_data)==1
new=body.replace(old_data,new_data);needle='FROM public.product_variants v WHERE v.product_id=p.id';assert new.count(needle)==2;new=new.replace(needle,needle+' AND v.deleted_at IS NULL')
prefix=(m/'439_catalog_available_quantity.sql').read_text().split('LOCK TABLE public.products,',1)[0];prefix=prefix.replace('migration439','migration440').replace('prepared439','prepared440').replace('quiescent439','quiescent440').replace('letbuyy:migration:439:catalog-availability','letbuyy:migration:440:buyer-inventory');prefix=prefix.replace('-- Complete the existing catalog read projection; stock mutations, quantities and histories are unchanged. SOURCE/LOCAL ONLY.','-- Complete the existing buyer discovery read using the canonical quantity projection. SOURCE/LOCAL ONLY.')
signature='public.browse_storefront_products_v1(uuid,jsonb,uuid[])';scalar='public.catalog_available_quantity(public.products)'
shape="jsonb_build_object('definition',pg_get_functiondef(f.oid),'owner',f.proowner,'acl',f.proacl,'language',f.prolang,'kind',f.prokind,'strict',f.proisstrict,'leakproof',f.proleakproof,'parallel',f.proparallel,'volatile',f.provolatile,'cost',f.procost,'rows',f.prorows,'support',f.prosupport,'config',f.proconfig,'comment',obj_description(f.oid,'pg_proc'))::text"
guard=f'''DO $quantity_dependency440$DECLARE f record;BEGIN
 SELECT *INTO STRICT f FROM pg_proc WHERE oid=to_regprocedure('{scalar}');
 IF f.proowner<>current_user::regrole::oid OR f.prosecdef
 OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'{quantity['sha256']}'
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a WHERE a.grantor<>f.proowner OR a.grantee NOT IN(f.proowner,'service_role'::regrole,'app_tenant'::regrole)OR(a.grantee<>f.proowner AND a.is_grantable))THEN
 RAISE EXCEPTION 'migration440 refuses changed canonical quantity dependency';END IF;
END $quantity_dependency440$;
'''
up=prefix+'''LOCK TABLE public.products,public.product_variants,public.inventory_levels,public.inventory_locations IN SHARE MODE NOWAIT;
DO $admit440$BEGIN IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='440')OR(SELECT count(*)FROM public.migration_privilege_journal WHERE migration='439')<>1 THEN RAISE EXCEPTION 'migration440 refuses unreviewed migration state';END IF;END $admit440$;
'''+guard+f'''DO $before440$DECLARE f record;shape text;BEGIN
 SELECT *INTO STRICT f FROM pg_proc WHERE oid=to_regprocedure('{signature}');
 IF f.proowner<>current_user::regrole::oid OR f.prosecdef
 OR encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex')<>'{old['sha256']}'
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a WHERE a.grantor<>f.proowner OR a.grantee NOT IN(f.proowner,'service_role'::regrole)OR(a.grantee<>f.proowner AND a.is_grantable))THEN RAISE EXCEPTION 'migration440 refuses changed canonical browse reader';END IF;
 shape:={shape};
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 VALUES('440','{signature}',current_user,'CATALOG440 ORIGINAL FUNCTION','granted',f.oid,f.proowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
END $before440$;
'''+new.rstrip()+';\n'+f'''DO $after440$DECLARE f record;shape text;BEGIN SELECT *INTO STRICT f FROM pg_proc WHERE oid=to_regprocedure('{signature}');shape:={shape};
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 VALUES('440','{signature}',current_user,'CATALOG440 CURRENT FUNCTION','granted',f.oid,f.proowner,encode(sha256(convert_to(shape,'UTF8')),'hex')),
 --439's paired DOWN already refuses extra journal rows: remove440 before439.
 ('439','{signature}',current_user,'CATALOG439 DEPENDENT440','granted',f.oid,f.proowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
END $after440$;
NOTIFY pgrst,'reload schema';
COMMIT;
'''
down=prefix+f'''DO $guard440$DECLARE f record;j record;dep record;shape text;BEGIN
 SELECT *INTO STRICT f FROM pg_proc WHERE oid=to_regprocedure('{signature}');shape:={shape};
 SELECT *INTO STRICT j FROM public.migration_privilege_journal WHERE migration='440'AND object_signature='{signature}'AND privilege='CATALOG440 CURRENT FUNCTION';
 SELECT *INTO STRICT dep FROM public.migration_privilege_journal WHERE migration='439'AND object_signature='{signature}'AND privilege='CATALOG439 DEPENDENT440';
 IF(SELECT count(*)FROM public.migration_privilege_journal WHERE migration='440')<>2 OR j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner OR f.proowner IS DISTINCT FROM current_user::regrole::oid OR j.grantee IS DISTINCT FROM current_user OR j.action IS DISTINCT FROM 'granted'OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex')
 OR dep.object_oid IS DISTINCT FROM f.oid OR dep.object_owner IS DISTINCT FROM f.proowner OR dep.grantee IS DISTINCT FROM current_user OR dep.action IS DISTINCT FROM 'granted'OR dep.object_definition_hash IS DISTINCT FROM j.object_definition_hash THEN RAISE EXCEPTION 'rollback440 refuses changed reader or dependency profile';END IF;
END $guard440$;
'''+body.rstrip()+';\n'+f'''DO $original440$DECLARE f record;j record;shape text;BEGIN
 SELECT *INTO STRICT f FROM pg_proc WHERE oid=to_regprocedure('{signature}');shape:={shape};SELECT *INTO STRICT j FROM public.migration_privilege_journal WHERE migration='440'AND object_signature='{signature}'AND privilege='CATALOG440 ORIGINAL FUNCTION';
 IF j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner OR j.grantee IS DISTINCT FROM current_user OR j.action IS DISTINCT FROM 'granted'OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex')THEN RAISE EXCEPTION 'rollback440 refuses nonidentical restored reader';END IF;
END $original440$;
DELETE FROM public.migration_privilege_journal WHERE migration='439'AND object_signature='{signature}'AND privilege='CATALOG439 DEPENDENT440';
DELETE FROM public.migration_privilege_journal WHERE migration='440';
NOTIFY pgrst,'reload schema';
COMMIT;
'''
f.write_text(up);d.write_text(down);(v/'buyer-inventory440-prepared.json').write_text(json.dumps({'source_provenance':'buyer-inventory440-owned-provenance.json','original_definition_sha256':old['sha256'],'quantity_dependency_sha256':quantity['sha256'],'forward_sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'down_sha256':hashlib.sha256(d.read_bytes()).hexdigest(),'scope':'Source/local only; same canonical browse reader, page-only inventory projection; exclude retired SKU candidates/base witness. No catalog/data write except scoped privilege journal; same function OID/grants preserved.440 must unwind before439.'},indent=2)+'\n');print('Prepared sequential440 plus guarded paired rollback; existing reader only')
