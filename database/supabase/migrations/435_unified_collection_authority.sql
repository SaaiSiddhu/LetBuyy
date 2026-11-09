-- Owner decision3November2026: collections owns manual and smart collections.
-- SOURCE/LOCAL CANDIDATE. Never drop the retained compatibility source here.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:435:collections',0));
-- The previous JavaScript rule owner used Unicode default casing. A libc/C
-- lowercase silently changes dotted-I and final-sigma membership. Use existing
-- deterministic ICU casing explicitly; unsupported environments refuse cutover.
DO $unicode435$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_collation WHERE collnamespace='pg_catalog'::regnamespace
  AND collname='und-x-icu'AND collprovider='i'AND collisdeterministic)THEN
  RAISE EXCEPTION 'migration435 requires verified deterministic Unicode casing';END IF;
 IF lower(U&'\0130 \039F\03A3' COLLATE pg_catalog."und-x-icu") IS DISTINCT FROM U&'i\0307 \03BF\03C2' THEN
  RAISE EXCEPTION 'migration435 refuses incompatible Unicode casing';END IF;
END $unicode435$;

DO $preflight435$ BEGIN
 IF EXISTS(SELECT 1 FROM public.migration_privilege_journal WHERE migration='435')
 OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'AND table_name='collections'AND column_name IN('collection_type','match_type','slug','version')) THEN
  RAISE EXCEPTION 'migration435 refuses existing unreviewed collection cutover'; END IF;
END $preflight435$;
LOCK TABLE public.collections,public.smart_collections,public.collection_products IN ACCESS EXCLUSIVE MODE;

DO $original435$ DECLARE f record;BEGIN SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure('public.browse_storefront_products_v1(uuid,jsonb,uuid[])');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR f.prokind<>'f'OR f.proretset OR has_function_privilege('anon',f.oid,'EXECUTE')OR has_function_privilege('authenticated',f.oid,'EXECUTE')OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a WHERE a.grantee=0)OR encode(sha256(convert_to(f.prosrc,'UTF8')),'hex')<>'fbed2d78b14721884ed408797ee8a87d12b1c70b26f11d2a4bce3e19a00a3547'THEN RAISE EXCEPTION 'migration435 refuses changed original function profile: public.browse_storefront_products_v1(uuid,jsonb,uuid[])';END IF;END $original435$;
DO $original435$ DECLARE f record;BEGIN SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure('public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb)');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR f.prokind<>'f'OR f.proretset OR has_function_privilege('anon',f.oid,'EXECUTE')OR has_function_privilege('authenticated',f.oid,'EXECUTE')OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a WHERE a.grantee=0)OR encode(sha256(convert_to(f.prosrc,'UTF8')),'hex')<>'25b36ca094c5341030d703ac16ed4189bcf822431112e0261a16668d3cbf323c'THEN RAISE EXCEPTION 'migration435 refuses changed original function profile: public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb)';END IF;END $original435$;
DO $original435$ DECLARE f record;BEGIN SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure('public.guard_collection_membership_junction_v1()');IF NOT FOUND OR f.proowner<>current_user::regrole::oid OR f.prokind<>'f'OR f.proretset OR has_function_privilege('anon',f.oid,'EXECUTE')OR has_function_privilege('authenticated',f.oid,'EXECUTE')OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a WHERE a.grantee=0)OR encode(sha256(convert_to(f.prosrc,'UTF8')),'hex')<>'aad2e02d6d939ae2ae0f014cf182de46c2828c13a91b02054df755eba8c22216'THEN RAISE EXCEPTION 'migration435 refuses changed original function profile: public.guard_collection_membership_junction_v1()';END IF;END $original435$;
DO $profiles435$ DECLARE signature text;f record;shape text;BEGIN FOREACH signature IN ARRAY ARRAY['public.browse_storefront_products_v1(uuid,jsonb,uuid[])','public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb)','public.guard_collection_membership_junction_v1()']LOOP
 SELECT * INTO STRICT f FROM pg_proc WHERE oid=to_regprocedure(signature);shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'owner',f.proowner,'acl',
 (SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a),
 'language',f.prolang,'kind',f.prokind,'config',f.proconfig,'strict',f.proisstrict,'leakproof',f.proleakproof,
 'parallel',f.proparallel,'volatility',f.provolatile,'security',f.prosecdef,'support',f.prosupport,'cost',f.procost,'rows',f.prorows)::text;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)VALUES('435',signature,current_user,'COLLECTION ORIGINAL FUNCTION','granted',f.oid,f.proowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
 END LOOP;END $profiles435$;
DO $table_profiles435$DECLARE signature text;t record;shape text;BEGIN FOREACH signature IN ARRAY ARRAY['public.collections','public.smart_collections']LOOP SELECT * INTO STRICT t FROM pg_class WHERE oid=to_regclass(signature);
 shape:=jsonb_build_object(
 'relation',jsonb_build_array(t.relkind,t.relpersistence,t.relrowsecurity,t.relforcerowsecurity,t.reloptions,t.relreplident),
 'acl',(SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner)))a),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum)FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred)ORDER BY c.conname)FROM pg_constraint c WHERE c.conrelid=t.oid),
 'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid)ORDER BY i.indexrelid::regclass::text)FROM pg_index i WHERE i.indrelid=t.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(x.tgname,pg_get_triggerdef(x.oid),x.tgenabled)ORDER BY x.tgname)FROM pg_trigger x WHERE x.tgrelid=t.oid AND NOT x.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(x.polname,x.polcmd,x.polpermissive,x.polroles,pg_get_expr(x.polqual,x.polrelid),pg_get_expr(x.polwithcheck,x.polrelid))ORDER BY x.polname)FROM pg_policy x WHERE x.polrelid=t.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(x.oid)ORDER BY x.rulename)FROM pg_rewrite x WHERE x.ev_class=t.oid)
 )::text;INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)VALUES('435',signature,current_user,'COLLECTION ORIGINAL TABLE','granted',t.oid,t.relowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));END LOOP;END $table_profiles435$;
DO $table_acl435$ DECLARE t record;a record;role_sql text;BEGIN
 FOR t IN SELECT * FROM pg_class WHERE oid IN('public.collections'::regclass,'public.smart_collections'::regclass)LOOP
  IF t.relowner<>current_user::regrole::oid OR NOT t.relrowsecurity OR NOT t.relforcerowsecurity THEN RAISE EXCEPTION 'COLLECTION435_TABLE_PROFILE';END IF;
  FOR a IN SELECT * FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner)))WHERE grantee<>t.relowner AND privilege_type IN('INSERT','UPDATE','DELETE','TRUNCATE')LOOP
   role_sql:=CASE WHEN a.grantee=0 THEN 'PUBLIC'ELSE quote_ident(pg_get_userbyid(a.grantee))END;
   INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner)
   VALUES('435',t.oid::regclass::text,CASE WHEN a.grantee=0 THEN 'PUBLIC'ELSE pg_get_userbyid(a.grantee)END,
   a.privilege_type||CASE WHEN a.is_grantable THEN ' WITH GRANT OPTION'ELSE ''END,'revoked',t.oid,t.relowner);
   EXECUTE format('REVOKE %s ON TABLE %s FROM %s',a.privilege_type,t.oid::regclass,role_sql);
  END LOOP;
 END LOOP;END $table_acl435$;

-- Preserve the existing closed vocabulary and every original rule string.
CREATE FUNCTION public.collection_rules_shape_v1(rules jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 SELECT CASE WHEN jsonb_typeof(rules)IS DISTINCT FROM 'array' THEN false
 ELSE jsonb_array_length(rules)<=50 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(rules)r
 WHERE jsonb_typeof(r)IS DISTINCT FROM 'object'
  OR NOT(r?'field' AND r?'op' AND r?'value')
  OR CASE WHEN jsonb_typeof(r)='object'THEN EXISTS(SELECT 1 FROM jsonb_object_keys(r)k WHERE k NOT IN('field','op','value'))ELSE true END
  OR r->>'field'NOT IN('title','product_type','vendor','tag','price','inventory_quantity')
  OR r->>'op'NOT IN('equals','not_equals','contains','starts_with','ends_with','gt','lt')
  OR jsonb_typeof(r->'field')IS DISTINCT FROM 'string'OR jsonb_typeof(r->'op')IS DISTINCT FROM 'string'
  OR jsonb_typeof(r->'value')IS DISTINCT FROM 'string'OR length(r->>'value')>2000) END;
$fn$;

DO $retained435$ BEGIN
 IF EXISTS(SELECT 1 FROM public.smart_collections s WHERE s.id IS NULL OR s.store_id IS NULL
  OR s.version<1 OR s.match_type IS NULL OR s.match_type NOT IN('all','any')
  OR NOT public.collection_rules_shape_v1(s.conditions)
  OR length(btrim(s.name))NOT BETWEEN 1 AND 200 OR length(s.slug)NOT BETWEEN 1 AND 100
  OR s.slug!~'^[a-z0-9]+(-[a-z0-9]+)*$'OR length(coalesce(s.description,''))>2000
  OR NOT EXISTS(SELECT 1 FROM public.sites site WHERE site.id=s.store_id))
 OR EXISTS(SELECT 1 FROM public.smart_collections s JOIN public.collections c ON c.id=s.id) THEN
  RAISE EXCEPTION 'COLLECTION435_RETAINED_RECONCILIATION_REQUIRED';END IF;
END $retained435$;

ALTER TABLE public.collections
 ADD COLUMN collection_type text NOT NULL DEFAULT 'manual',
 ADD COLUMN match_type text NOT NULL DEFAULT 'all',
 ADD COLUMN slug text,
 ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE public.collections
 ADD CONSTRAINT collections_type435 CHECK(collection_type IN('manual','smart')),
 ADD CONSTRAINT collections_match435 CHECK(match_type IN('all','any')),
 ADD CONSTRAINT collections_version435 CHECK(version>0),
 ADD CONSTRAINT collections_smart_slug435 CHECK(collection_type='manual'OR slug IS NOT NULL),
 ADD CONSTRAINT collections_smart_rules435 CHECK(collection_type='manual'OR public.collection_rules_shape_v1(conditions)),
 ADD CONSTRAINT collections_slug435 CHECK(slug IS NULL OR(length(slug)BETWEEN 1 AND 100 AND slug~'^[a-z0-9]+(-[a-z0-9]+)*$'));
CREATE UNIQUE INDEX collections_store_slug435 ON public.collections(store_id,slug)WHERE slug IS NOT NULL;
CREATE INDEX collections_kind_page435 ON public.collections(store_id,collection_type,created_at DESC,id)WHERE deleted_at IS NULL;

-- Previously private rule documents remain private/unpublished by default.
INSERT INTO public.collections(id,store_id,title,slug,description,image_url,is_active,sort_order,
 conditions,collection_type,match_type,version,created_at,updated_at,deleted_at,created_by,updated_by)
 SELECT id,store_id,name,slug,description,NULL,false,'manual',conditions,'smart',match_type,version,
 created_at,NULL,deleted_at,created_by,updated_by FROM public.smart_collections;
DO $parity435$ BEGIN
 IF EXISTS(SELECT 1 FROM public.smart_collections s LEFT JOIN public.collections c ON c.id=s.id
 WHERE c.id IS NULL OR c.store_id IS DISTINCT FROM s.store_id OR c.title IS DISTINCT FROM s.name
 OR c.slug IS DISTINCT FROM s.slug OR c.description IS DISTINCT FROM s.description
 OR c.conditions IS DISTINCT FROM s.conditions OR c.match_type IS DISTINCT FROM s.match_type
 OR c.version IS DISTINCT FROM s.version OR c.created_at IS DISTINCT FROM s.created_at
 OR c.deleted_at IS DISTINCT FROM s.deleted_at OR c.created_by IS DISTINCT FROM s.created_by
 OR c.updated_by IS DISTINCT FROM s.updated_by OR c.collection_type<>'smart'OR c.is_active) THEN
  RAISE EXCEPTION 'COLLECTION435_ZERO_LOSS_PARITY_REQUIRED';END IF;
END $parity435$;
CREATE TRIGGER collections_version435 BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.increment_version();

CREATE TABLE public.collection_metadata_receipts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.sites(id)ON DELETE RESTRICT,
 actor_id uuid NOT NULL,collection_id uuid NOT NULL REFERENCES public.collections(id)ON DELETE RESTRICT,
 authority_guard regprocedure NOT NULL DEFAULT 'public.assert_product_edit_actor_v1(uuid,uuid,text)'::regprocedure,
 idempotency_key uuid NOT NULL,operation text NOT NULL CHECK(operation IN('create','update','delete')),
 expected_version integer CHECK(expected_version IS NULL OR expected_version>0),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 before_state jsonb,response jsonb NOT NULL CHECK(jsonb_typeof(response)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,created_by uuid NOT NULL,updated_by uuid NOT NULL,
 UNIQUE(store_id,actor_id,idempotency_key),CHECK((operation='create')=(expected_version IS NULL))
);
ALTER TABLE public.collection_metadata_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_metadata_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.collection_metadata_receipts FROM PUBLIC,anon,authenticated,app_tenant,service_role;

CREATE FUNCTION public.guard_collection_metadata_receipt_v1()RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
BEGIN RAISE EXCEPTION 'COLLECTION_RECEIPTS_RETAINED' USING ERRCODE='42501';END $fn$;
CREATE TRIGGER collection_metadata_receipts_guard BEFORE UPDATE OR DELETE ON public.collection_metadata_receipts
 FOR EACH ROW EXECUTE FUNCTION public.guard_collection_metadata_receipt_v1();
CREATE TRIGGER collection_metadata_receipts_no_truncate BEFORE TRUNCATE ON public.collection_metadata_receipts
 FOR EACH STATEMENT EXECUTE FUNCTION public.guard_collection_metadata_receipt_v1();

-- A sealed migration source, not a second live rule writer. Deletion remains gated.
CREATE FUNCTION public.seal_legacy_smart_collections_v1()RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
BEGIN RAISE EXCEPTION 'LEGACY_SMART_COLLECTIONS_READ_ONLY' USING ERRCODE='42501';END $fn$;
CREATE TRIGGER smart_collections_sealed435 BEFORE INSERT OR UPDATE OR DELETE ON public.smart_collections
 FOR EACH ROW EXECUTE FUNCTION public.seal_legacy_smart_collections_v1();
CREATE TRIGGER smart_collections_no_truncate435 BEFORE TRUNCATE ON public.smart_collections
 FOR EACH STATEMENT EXECUTE FUNCTION public.seal_legacy_smart_collections_v1();

CREATE FUNCTION public.assert_collection_metadata_actor_v1(p_site uuid,p_actor uuid,p_write boolean)RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF current_setting('role',true)IS DISTINCT FROM 'app_tenant'OR p_site IS NULL OR p_actor IS NULL OR p_write IS NULL
 OR nullif(current_setting('app.site_id',true),'')IS DISTINCT FROM p_site::text
 OR nullif(current_setting('app.actor_id',true),'')IS DISTINCT FROM p_actor::text
 OR nullif(current_setting('request.jwt.claim.sub',true),'')IS DISTINCT FROM p_actor::text THEN
  RAISE EXCEPTION 'COLLECTION_METADATA_FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM id FROM public.users_custom WHERE id=p_actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COLLECTION_METADATA_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_write THEN
  PERFORM id FROM public.sites WHERE id=p_site AND deleted_at IS NULL FOR UPDATE;
 ELSE
  PERFORM id FROM public.sites WHERE id=p_site AND deleted_at IS NULL FOR SHARE;
 END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'COLLECTION_METADATA_FORBIDDEN' USING ERRCODE='42501';END IF;
 BEGIN
  PERFORM public.assert_product_edit_actor_v1(p_site,p_actor,CASE WHEN p_write THEN 'products:write'ELSE 'products:read'END);
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE EXCEPTION 'COLLECTION_METADATA_FORBIDDEN' USING ERRCODE='42501';
 END;
END $fn$;

CREATE FUNCTION public.collection_metadata_snapshot_v1(p_id uuid)RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 SELECT jsonb_build_object('id',c.id,'store_id',c.store_id,'title',c.title,'slug',c.slug,
 'description',c.description,'image_url',c.image_url,'is_active',c.is_active,'collection_type',c.collection_type,
 'conditions',c.conditions,'match_type',c.match_type,'version',c.version,'membership_version',c.membership_version,
 'created_at',c.created_at,'updated_at',c.updated_at,'deleted_at',c.deleted_at,'created_by',c.created_by,'updated_by',c.updated_by)
 FROM public.collections c WHERE c.id=p_id;
$fn$;

CREATE FUNCTION public.apply_collection_metadata_v1(p_site uuid,p_actor uuid,p_operation text,p_target uuid,
 p_version integer,p_key uuid,p_payload jsonb)RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE receipt public.collection_metadata_receipts; c public.collections; before_json jsonb; reply jsonb; k text; v jsonb;
BEGIN
 PERFORM public.assert_collection_metadata_actor_v1(p_site,p_actor,true);
 IF p_key IS NULL OR p_operation IS NULL OR p_operation NOT IN('create','update','delete')
 OR jsonb_typeof(p_payload)IS DISTINCT FROM 'object'OR octet_length(p_payload::text)>131072
 OR (p_operation='create')IS DISTINCT FROM(p_target IS NULL AND p_version IS NULL)
 OR(p_operation<>'create'AND(p_target IS NULL OR p_version IS NULL OR p_version<1))THEN
  RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
 SELECT * INTO receipt FROM public.collection_metadata_receipts WHERE store_id=p_site AND actor_id=p_actor AND idempotency_key=p_key;
 IF FOUND THEN
  IF receipt.operation<>p_operation OR receipt.collection_id IS DISTINCT FROM coalesce(p_target,receipt.collection_id)
  OR receipt.expected_version IS DISTINCT FROM p_version OR receipt.payload IS DISTINCT FROM p_payload THEN
   RAISE EXCEPTION 'COLLECTION_METADATA_KEY_CONFLICT';END IF;
  RETURN receipt.response;
 END IF;
 IF p_operation='delete'AND(p_payload-'collection_type'<>'{}'::jsonb OR jsonb_typeof(p_payload->'collection_type')IS DISTINCT FROM 'string'OR(p_payload->>'collection_type')NOT IN('manual','smart'))THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
 IF p_operation='update'AND p_payload-'collection_type'='{}'::jsonb THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
 IF p_operation<>'delete' THEN
  IF p_payload='{}'::jsonb THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
  FOR k,v IN SELECT key,value FROM jsonb_each(p_payload)LOOP
   IF k NOT IN('title','slug','description','image_url','is_active','collection_type','conditions','match_type')THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
   IF k='title'AND(jsonb_typeof(v)IS DISTINCT FROM 'string'OR length(v#>>'{}')NOT BETWEEN 1 AND 200 OR btrim(v#>>'{}')='')THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
   IF k='slug'AND v<>'null'::jsonb AND(jsonb_typeof(v)IS DISTINCT FROM 'string'OR length(v#>>'{}')NOT BETWEEN 1 AND 100 OR(v#>>'{}')!~'^[a-z0-9]+(-[a-z0-9]+)*$')THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
   IF k IN('description','image_url')AND v<>'null'::jsonb AND(jsonb_typeof(v)IS DISTINCT FROM 'string'OR length(v#>>'{}')>CASE WHEN k='description'THEN 2000 ELSE 2048 END)THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
   IF k='image_url'AND v<>'null'::jsonb AND(v#>>'{}')!~'^https?://[^[:space:]]+$'THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
   IF k='is_active'AND jsonb_typeof(v)IS DISTINCT FROM 'boolean'THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
   IF k='collection_type'AND(jsonb_typeof(v)IS DISTINCT FROM 'string'OR(v#>>'{}')NOT IN('manual','smart'))THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
   IF k='match_type'AND(jsonb_typeof(v)IS DISTINCT FROM 'string'OR(v#>>'{}')NOT IN('all','any'))THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
   IF k='conditions'AND NOT public.collection_rules_shape_v1(v)THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
  END LOOP;
 END IF;
 IF p_operation='create'THEN
  IF p_payload->>'collection_type'='manual'AND(p_payload->'conditions' IS NOT NULL AND p_payload->'conditions'<>'[]'::jsonb OR length(p_payload->>'title')>160 OR length(coalesce(p_payload->>'description',''))>1000)THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
  IF NOT(p_payload?'title'AND p_payload?'collection_type')OR(p_payload->>'collection_type'='smart'AND nullif(p_payload->>'slug','')IS NULL)THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
  INSERT INTO public.collections(store_id,title,slug,description,image_url,is_active,collection_type,conditions,match_type,created_by,updated_by)
  VALUES(p_site,p_payload->>'title',p_payload->>'slug',p_payload->>'description',p_payload->>'image_url',coalesce((p_payload->>'is_active')::boolean,p_payload->>'collection_type'='manual'),
   p_payload->>'collection_type',coalesce(p_payload->'conditions','[]'::jsonb),coalesce(p_payload->>'match_type','all'),p_actor,p_actor)RETURNING * INTO c;
 ELSE
  SELECT * INTO c FROM public.collections WHERE id=p_target AND store_id=p_site AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COLLECTION_METADATA_NOT_FOUND';END IF;
  IF c.version<>p_version THEN RAISE EXCEPTION 'COLLECTION_METADATA_VERSION_CONFLICT';END IF;
  IF p_payload?'collection_type'AND p_payload->>'collection_type'IS DISTINCT FROM c.collection_type THEN RAISE EXCEPTION 'COLLECTION_METADATA_KIND_IMMUTABLE';END IF;
  IF c.collection_type='manual'AND(p_payload?'conditions'OR p_payload?'match_type')THEN RAISE EXCEPTION 'COLLECTION_METADATA_KIND_IMMUTABLE';END IF;
  IF c.collection_type='manual'AND(length(coalesce(p_payload->>'title',''))>160 OR length(coalesce(p_payload->>'description',''))>1000)THEN RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
  before_json:=public.collection_metadata_snapshot_v1(c.id);
  IF p_operation='delete'THEN
   UPDATE public.collections SET deleted_at=clock_timestamp(),is_active=false,updated_by=p_actor WHERE id=c.id RETURNING * INTO c;
  ELSE
   UPDATE public.collections SET title=CASE WHEN p_payload?'title'THEN p_payload->>'title'ELSE title END,
    slug=CASE WHEN p_payload?'slug'THEN p_payload->>'slug'ELSE slug END,
    description=CASE WHEN p_payload?'description'THEN p_payload->>'description'ELSE description END,
    image_url=CASE WHEN p_payload?'image_url'THEN p_payload->>'image_url'ELSE image_url END,
    is_active=CASE WHEN p_payload?'is_active'THEN(p_payload->>'is_active')::boolean ELSE is_active END,
    conditions=CASE WHEN p_payload?'conditions'THEN p_payload->'conditions'ELSE conditions END,
    match_type=CASE WHEN p_payload?'match_type'THEN p_payload->>'match_type'ELSE match_type END,updated_by=p_actor
    WHERE id=c.id AND store_id=p_site AND version=p_version RETURNING * INTO c;
  END IF;
 END IF;
 reply:=public.collection_metadata_snapshot_v1(c.id)||jsonb_build_object('operation',p_operation,'idempotency_key',p_key,'actor_id',p_actor,'expected_version',p_version,'request',p_payload);
 INSERT INTO public.collection_metadata_receipts(store_id,actor_id,collection_id,idempotency_key,operation,expected_version,payload,before_state,response,created_by,updated_by)
 VALUES(p_site,p_actor,c.id,p_key,p_operation,p_version,p_payload,before_json,reply,p_actor,p_actor);
 INSERT INTO public.audit_activity_events(store_id,actor_id,actor_type,action,resource_type,resource_id,request_id,before_state,after_state,metadata)
 VALUES(p_site,p_actor,'user','collection.metadata.'||p_operation,'collection_metadata',c.id::text,
  nullif(current_setting('app.request_id',true),''),before_json,reply,jsonb_build_object('idempotency_key',p_key));
 INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,request_id,actor_id,schema_version)
 VALUES(p_site,p_site,'collection',c.id::text,'collection.metadata.updated',jsonb_build_object('site_id',p_site,'collection_id',c.id,'version',c.version,'operation',p_operation),
  'collection.metadata.updated:'||p_key::text,nullif(current_setting('app.request_id',true),''),p_actor,1);
 RETURN reply;
END $fn$;

-- One canonical rule evaluator. The existing TypeScript evaluator is retained
-- as an independent migration/conformance oracle until semantic parity is green.
CREATE FUNCTION public.collection_rule_text_v1(value text)RETURNS text
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 SELECT lower(btrim(coalesce(value,''),U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') COLLATE pg_catalog."und-x-icu");
$fn$;
CREATE FUNCTION public.collection_rule_number_v1(value text)RETURNS double precision
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE t text:=btrim(coalesce(value,''),U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
 result double precision:=0; radix integer; digit integer; character text; i integer;
BEGIN
 IF t=''THEN RETURN 0;END IF;
 IF t~'^0[xX][0-9a-fA-F]+$'THEN radix:=16;
 ELSIF t~'^0[bB][01]+$'THEN radix:=2;
 ELSIF t~'^0[oO][0-7]+$'THEN radix:=8;
 END IF;
 IF radix IS NOT NULL THEN
  FOR i IN 3..length(t)LOOP
   character:=lower(substr(t,i,1));digit:=strpos('0123456789abcdef',character)-1;
   BEGIN result:=result*radix+digit;EXCEPTION WHEN numeric_value_out_of_range THEN RETURN 'Infinity'::double precision;END;
  END LOOP;
  RETURN result;
 END IF;
 IF t!~'^[+-]?(([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]+)?|Infinity)$'THEN RETURN 0;END IF;
 BEGIN RETURN t::double precision;
 EXCEPTION WHEN numeric_value_out_of_range THEN
  IF t~'[eE]-[0-9]+$'THEN RETURN 0;END IF;
  RETURN CASE WHEN left(t,1)='-'THEN '-Infinity'::double precision ELSE 'Infinity'::double precision END;
 END;
END $fn$;
CREATE FUNCTION public.collection_rule_matches_v1(product jsonb,condition jsonb)RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE field text:=condition->>'field';op text:=condition->>'op';target text:=condition->>'value';
 source text;left_number double precision;right_number double precision;tags text[];tag text;
BEGIN
 IF field='tag'THEN
  IF jsonb_typeof(product->'tags')='array'THEN
   SELECT coalesce(array_agg(public.collection_rule_text_v1(coalesce(v,'null'))),'{}')INTO tags FROM jsonb_array_elements_text(product->'tags')e(v);
  ELSE
   SELECT coalesce(array_agg(public.collection_rule_text_v1(v))FILTER(WHERE public.collection_rule_text_v1(v)<>''),'{}')INTO tags
    FROM unnest(string_to_array(coalesce(product->>'tags',''),','))e(v);
  END IF;
  target:=public.collection_rule_text_v1(target);
  IF op='not_equals'THEN RETURN NOT(target=ANY(tags));END IF;
  FOREACH tag IN ARRAY tags LOOP
   IF(op='equals'AND tag=target)OR(op='contains'AND strpos(tag,target)>0)
    OR(op='starts_with'AND left(tag,length(target))=target)OR(op='ends_with'AND right(tag,length(target))=target)THEN RETURN true;END IF;
  END LOOP;
  RETURN false;
 END IF;
 IF field IN('price','inventory_quantity')THEN
  source:=CASE WHEN field='price'THEN product->>'price'ELSE coalesce(product->>'inventory_quantity',product->>'stock')END;
  left_number:=public.collection_rule_number_v1(source);right_number:=public.collection_rule_number_v1(target);
  IF op='equals'THEN RETURN left_number=right_number;
  ELSIF op='not_equals'THEN RETURN left_number<>right_number;
  ELSIF op='gt'THEN RETURN left_number>right_number;
  ELSIF op='lt'THEN RETURN left_number<right_number;END IF;
  source:=CASE WHEN left_number=0 THEN '0'ELSE left_number::text END;target:=CASE WHEN right_number=0 THEN '0'ELSE right_number::text END;
 ELSE
  source:=public.collection_rule_text_v1(CASE WHEN field='title'THEN coalesce(product->>'title',product->>'name')
   WHEN field='product_type'THEN product->>'product_type'WHEN field='vendor'THEN product->>'vendor'ELSE ''END);
  target:=public.collection_rule_text_v1(target);
  IF op='equals'THEN RETURN source=target;
  ELSIF op='not_equals'THEN RETURN source<>target;
  ELSIF op='gt'THEN RETURN public.collection_rule_number_v1(source)>public.collection_rule_number_v1(target);
  ELSIF op='lt'THEN RETURN public.collection_rule_number_v1(source)<public.collection_rule_number_v1(target);END IF;
 END IF;
 RETURN CASE op WHEN 'contains'THEN strpos(source,target)>0
  WHEN 'starts_with'THEN left(source,length(target))=target
  WHEN 'ends_with'THEN right(source,length(target))=target ELSE false END;
END $fn$;
CREATE FUNCTION public.collection_rules_match_v1(product jsonb,rules jsonb,match_type text)RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE condition jsonb;matched boolean;
BEGIN
 IF NOT public.collection_rules_shape_v1(rules)OR match_type NOT IN('all','any')THEN RAISE EXCEPTION 'COLLECTION_RULES_INVALID';END IF;
 IF jsonb_array_length(rules)=0 THEN RETURN true;END IF;
 FOR condition IN SELECT value FROM jsonb_array_elements(rules)LOOP
  matched:=public.collection_rule_matches_v1(product,condition);
  IF match_type='all'AND NOT matched THEN RETURN false;END IF;
  IF match_type='any'AND matched THEN RETURN true;END IF;
 END LOOP;
 RETURN match_type='all';
END $fn$;
CREATE FUNCTION public.collection_contains_product_v1(p_site uuid,p_collection uuid,p_product jsonb)RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 SELECT coalesce((SELECT CASE WHEN c.collection_type='smart'THEN public.collection_rules_match_v1(p_product,c.conditions,c.match_type)
 ELSE EXISTS(SELECT 1 FROM public.collection_products cp WHERE cp.collection_id=c.id AND cp.product_id=(p_product->>'id')::uuid)END
 FROM public.collections c WHERE c.id=p_collection AND c.store_id=p_site AND c.is_active AND c.deleted_at IS NULL
 AND p_product->>'store_id'=p_site::text),false);
$fn$;

CREATE FUNCTION public.preview_collection_rules_v1(p_site uuid,p_actor uuid,p_collection uuid)RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE c public.collections;result jsonb;
BEGIN
 PERFORM public.assert_collection_metadata_actor_v1(p_site,p_actor,false);
 SELECT * INTO c FROM public.collections WHERE id=p_collection AND store_id=p_site AND collection_type='smart'AND deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'COLLECTION_METADATA_NOT_FOUND';END IF;
 WITH sample AS MATERIALIZED(SELECT id,name,product_type,vendor,tags,price,stock FROM public.products
  WHERE store_id=p_site AND is_active AND deleted_at IS NULL ORDER BY id LIMIT 500),
 matches AS MATERIALIZED(SELECT id FROM sample p WHERE public.collection_rules_match_v1(to_jsonb(p),c.conditions,c.match_type)),
 totals AS(SELECT count(*)n FROM public.products WHERE store_id=p_site AND is_active AND deleted_at IS NULL)
 SELECT jsonb_build_object('store_id',p_site,'collection_id',c.id,'collection_version',c.version,'match_type',c.match_type,
 'condition_count',jsonb_array_length(c.conditions),'count',(SELECT count(*)FROM matches),
 'sample_product_ids',coalesce((SELECT jsonb_agg(id ORDER BY id)FROM(SELECT id FROM matches ORDER BY id LIMIT 10)first_matches),'[]'::jsonb),
 'evaluated_of',(SELECT count(*)FROM sample),'capped_at',500,'catalog_count',totals.n,'count_is_exact',totals.n<=500)INTO result FROM totals;
 RETURN result;
END $fn$;

CREATE FUNCTION public.read_collection_metadata_v1(p_site uuid,p_actor uuid,p_collection uuid)RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
BEGIN
 PERFORM public.assert_collection_metadata_actor_v1(p_site,p_actor,false);
 IF NOT EXISTS(SELECT 1 FROM public.collections WHERE id=p_collection AND store_id=p_site AND deleted_at IS NULL)THEN
  RAISE EXCEPTION 'COLLECTION_METADATA_NOT_FOUND';END IF;
 RETURN public.collection_metadata_snapshot_v1(p_collection);
END $fn$;
CREATE FUNCTION public.read_collection_metadata_page_v1(p_site uuid,p_actor uuid,p_kind text,p_page integer,p_limit integer,p_search text)RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $fn$
DECLARE result jsonb;
BEGIN
 PERFORM public.assert_collection_metadata_actor_v1(p_site,p_actor,false);
 IF p_kind IS NULL OR p_kind NOT IN('manual','smart')OR p_page IS NULL OR p_page NOT BETWEEN 1 AND 10000
 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_search IS NULL OR length(p_search)>200 THEN
  RAISE EXCEPTION 'COLLECTION_METADATA_INVALID';END IF;
 WITH filtered AS MATERIALIZED(SELECT id,created_at FROM public.collections
  WHERE store_id=p_site AND deleted_at IS NULL AND collection_type=p_kind
   AND(p_search=''OR strpos(lower(title),lower(p_search))>0 OR strpos(lower(coalesce(slug,'')),lower(p_search))>0)),
 totals AS(SELECT count(*)n FROM filtered), page_ids AS(SELECT id FROM filtered ORDER BY created_at DESC NULLS LAST,id
  LIMIT p_limit OFFSET(p_page-1)*p_limit)
 SELECT jsonb_build_object('success',true,'data',coalesce((SELECT jsonb_agg(public.collection_metadata_snapshot_v1(c.id)ORDER BY c.created_at DESC NULLS LAST,c.id)
  FROM page_ids page JOIN public.collections c ON c.id=page.id),'[]'::jsonb),
 'meta',jsonb_build_object('store_id',p_site,'page',p_page,'per_page',p_limit,'total',totals.n,
 'total_pages',ceil(totals.n::numeric/p_limit),'total_is_exact',true,'has_next',p_page<ceil(totals.n::numeric/p_limit),'has_prev',p_page>1))INTO result FROM totals;
 RETURN result;
END $fn$;

CREATE FUNCTION public.protect_collection_metadata_audit_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF TG_OP='TRUNCATE' THEN
  IF current_user::regrole::oid IS DISTINCT FROM(SELECT relowner FROM pg_class WHERE oid='public.audit_activity_events'::regclass)
   OR EXISTS(SELECT 1 FROM public.audit_activity_events WHERE resource_type='collection_metadata') THEN
   RAISE EXCEPTION 'COLLECTION_METADATA_AUDIT_RETAINED' USING ERRCODE='42501'; END IF;
  RETURN NULL;
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.resource_type='collection_metadata' AND current_user::regrole::oid IS DISTINCT FROM(SELECT relowner FROM pg_class WHERE oid='public.audit_activity_events'::regclass) THEN
   RAISE EXCEPTION 'COLLECTION_METADATA_AUDIT_FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.resource_type='collection_metadata' OR(TG_OP='UPDATE' AND NEW.resource_type='collection_metadata') THEN
  RAISE EXCEPTION 'COLLECTION_METADATA_AUDIT_RETAINED' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $fn$;
CREATE TRIGGER audit_collection_metadata_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.audit_activity_events
 FOR EACH ROW EXECUTE FUNCTION public.protect_collection_metadata_audit_v1();
CREATE TRIGGER audit_collection_metadata_no_truncate BEFORE TRUNCATE ON public.audit_activity_events
 FOR EACH STATEMENT EXECUTE FUNCTION public.protect_collection_metadata_audit_v1();


CREATE OR REPLACE FUNCTION public.browse_storefront_products_v1(p_store_id uuid, p_query jsonb DEFAULT '{}', p_product_ids uuid[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE query jsonb:='{"page":1,"limit":20,"sort":"display_order"}'::jsonb||coalesce(p_query,'{}'); result jsonb; require_available boolean; page_size integer; page_number integer;
BEGIN
 IF p_store_id IS NULL OR NOT public.storefront_discovery_shape_v1(query,'$query',false) THEN
  RAISE EXCEPTION 'Invalid storefront discovery query' USING ERRCODE='22023';END IF;
 IF query?'min_price' AND query?'max_price' AND (query->>'min_price')::numeric>(query->>'max_price')::numeric
  OR (query?'length_value') IS DISTINCT FROM (query?'length_unit')
  OR query?'pack_size' AND split_part(query->>'pack_size',':',2)::numeric>1000000000
  OR (SELECT count(*)<>count(DISTINCT v) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(query->'connector')='array' THEN query->'connector' ELSE '[]' END) entries(v))
  OR coalesce(array_length(p_product_ids,1),0)>100 OR array_position(p_product_ids,NULL) IS NOT NULL THEN
   RAISE EXCEPTION 'Invalid storefront discovery query' USING ERRCODE='22023';
 END IF;
 page_size:=(query->>'limit')::integer;page_number:=(query->>'page')::integer;
 -- Basic browsing keeps existing sold-out visibility. Actual option/fact/price selections need
 -- one available canonical candidate, including every combined condition below.
 require_available:=(query-ARRAY['page','limit','sort','search','category','country_of_origin','collection_id'])<>'{}'::jsonb;
 WITH base AS MATERIALIZED (
  SELECT p.id,p.store_id,p.name,p.slug,p.description,p.price,p.compare_price,p.category,p.product_type,p.tags,p.images,p.stock,p.track_inventory,p.is_active,p.is_featured,p.country_of_origin,p.importer_details,p.seo_title,p.seo_description,p.created_at,p.updated_at,p.variants,p.metadata,p.display_order
  FROM public.products p WHERE p.store_id=p_store_id AND p.is_active=true AND p.deleted_at IS NULL
   AND(p_product_ids IS NULL OR p.id=ANY(p_product_ids))
   AND(NOT query?'category' OR public.storefront_discovery_trim_v1(p.category)=query->>'category')
   AND(NOT query?'country_of_origin' OR lower(public.storefront_discovery_trim_v1(p.country_of_origin))=lower(query->>'country_of_origin'))
   AND(NOT query?'collection_id' OR public.collection_contains_product_v1(p_store_id,(query->>'collection_id')::uuid,jsonb_build_object('id',p.id,'store_id',p.store_id,'name',p.name,'product_type',p.product_type,'vendor',p.vendor,'tags',p.tags,'price',p.price,'stock',p.stock)))
 ), candidates AS MATERIALIZED (
  SELECT p.id,p.name,p.description,p.tags,p.category,p.country_of_origin,p.created_at,p.display_order,to_jsonb(p)-'display_order' AS product,
   v.variant_id,v.quantity,coalesce(v.price,p.price) AS candidate_price,
   public.storefront_discovery_flat_v1(p.metadata,v.metadata,v.variant_id IS NOT NULL,v.options,to_jsonb(p.images)) AS facts
  FROM base p CROSS JOIN LATERAL(
   SELECT v.id AS variant_id,v.inventory_qty AS quantity,v.price,v.metadata,
    coalesce((SELECT jsonb_object_agg(o.name,to_jsonb(CASE o.position WHEN 0 THEN v.option1 WHEN 1 THEN v.option2 WHEN 2 THEN v.option3 END)) FROM public.product_options o WHERE o.product_id=p.id AND o.position BETWEEN 0 AND 2),'{}') AS options
   FROM public.product_variants v WHERE v.product_id=p.id
   UNION ALL SELECT NULL::uuid,p.stock,p.price,'{}'::jsonb,'{}'::jsonb WHERE NOT EXISTS(SELECT 1 FROM public.product_variants v WHERE v.product_id=p.id)
  ) v
 ), matched_candidates AS MATERIALIZED (
  SELECT * FROM candidates c WHERE(c.quantity>0 OR NOT require_available)
   AND(NOT query?'search' OR position(lower(query->>'search') IN lower(concat_ws(' ',c.name,c.description,c.tags::text,c.facts->'books_author'::text,
    -- Only the canonical validated common electronics namespace contributes.
    -- Electronics variant overrides are unsupported. Never search raw JSON or
    -- invent an available variant witness for a supplied model/connector term.
    CASE WHEN public.storefront_discovery_facts_valid_v1(c.product#>'{metadata,electronics}','electronics',false)
     THEN concat_ws(' ',c.product#>>'{metadata,electronics,model}',
      (SELECT string_agg(connector->>'kind',' ' ORDER BY ordinal)
       FROM jsonb_array_elements(coalesce(c.product#>'{metadata,electronics,connectors}','[]'::jsonb))
        WITH ORDINALITY AS supplied(connector,ordinal)))
     ELSE NULL END)))>0)
   AND public.storefront_discovery_match_v1(query,c.facts,c.candidate_price)
 ), matched AS MATERIALIZED (
  SELECT id,min(name) AS name,min(created_at) AS created_at,min(display_order) AS display_order,
   coalesce(min(candidate_price) FILTER(WHERE quantity>0),min(candidate_price)) AS matching_price,
   coalesce(jsonb_agg(variant_id ORDER BY variant_id) FILTER(WHERE variant_id IS NOT NULL AND quantity>0),'[]') AS variant_ids,
   (array_agg(product))[1] AS product
  FROM matched_candidates GROUP BY id
 ), ordered AS MATERIALIZED (
  SELECT *,row_number() OVER(ORDER BY
   CASE WHEN query->>'sort'='price-asc' THEN matching_price END ASC,
   CASE WHEN query->>'sort'='price-desc' THEN matching_price END DESC,
   CASE WHEN query->>'sort'='newest' THEN created_at END DESC,
   CASE WHEN query->>'sort'='name' THEN name END ASC,
   CASE WHEN query->>'sort'='display_order' THEN display_order END ASC NULLS LAST,id ASC) AS ordinal
  FROM matched
 ), page AS MATERIALIZED (SELECT * FROM ordered WHERE ordinal>(page_number-1)*page_size AND ordinal<=page_number*page_size),
 facet_values AS (
  SELECT DISTINCT c.id,pair.key,CASE WHEN pair.key IN('power_input_w','power_output_w','power_capacity_w','pass_through_output_w','data_rate_mbps','length_mm') THEN trim_scale(value::numeric)::text WHEN pair.key='category' THEN public.storefront_discovery_trim_v1(value) ELSE lower(public.storefront_discovery_trim_v1(value)) END AS value,
   public.storefront_discovery_trim_v1(value) AS label FROM matched_candidates c
   CROSS JOIN LATERAL jsonb_each(c.facts||jsonb_build_object('category',jsonb_build_array(c.category),'country_of_origin',jsonb_build_array(c.country_of_origin))) pair(key,items)
   CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(pair.items)='array' THEN pair.items ELSE '[]' END) entries(value)
  WHERE c.quantity>0 AND pair.key NOT LIKE '\_%' ESCAPE '\' AND pair.key<>'books_author' AND nullif(public.storefront_discovery_trim_v1(value),'') IS NOT NULL
 ), facet_counts AS(SELECT key,value,min(label) AS label,count(DISTINCT id) AS count,row_number() OVER(PARTITION BY key ORDER BY count(DISTINCT id) DESC,value ASC) AS rank FROM facet_values GROUP BY key,value),
 -- Capability only: input units convertible from actual available witnesses.
 -- The candidate already satisfied EVERY current predicate on the SAME variant.
 -- No unit facet/product count and no relaxed-query or separate catalog scan.
 measurement_units AS (
  SELECT u.unit,u.ordinal FROM (VALUES
   ('mm'::text,1::numeric,1),('cm'::text,10::numeric,2),
   ('m'::text,1000::numeric,3),('in'::text,25.4::numeric,4)
  ) AS u(unit,mm_per_unit,ordinal)
  WHERE EXISTS(SELECT 1 FROM matched_candidates c WHERE c.quantity>0
   AND CASE WHEN jsonb_typeof(c.facts->'_equipment_length_mm')='number'
    THEN (c.facts->>'_equipment_length_mm')::numeric>0
     AND (c.facts->>'_equipment_length_mm')::numeric/u.mm_per_unit<=100000
    ELSE false END)
 ),
 -- Independent supported thresholds; never a combined-fit claim. Reuse only
 -- resolved assembled-axis witnesses from the SAME fully matched candidates.
 measurement_axes AS (
  SELECT
   coalesce(bool_or(CASE WHEN jsonb_typeof(c.facts->'_width_mm')='number'
    THEN (c.facts->>'_width_mm')::numeric>0
     AND (c.facts->>'_width_mm')::numeric/10<=1000000
    ELSE false END),false) AS width_available,
   coalesce(bool_or(CASE WHEN jsonb_typeof(c.facts->'_depth_mm')='number'
    THEN (c.facts->>'_depth_mm')::numeric>0
     AND (c.facts->>'_depth_mm')::numeric/10<=1000000
    ELSE false END),false) AS depth_available
  FROM matched_candidates c WHERE c.quantity>0
 )
 SELECT jsonb_build_object(
  'data',coalesce((SELECT jsonb_agg(product ORDER BY ordinal) FROM page),'[]'),
  'count',(SELECT count(*) FROM matched),
  'matches',coalesce((SELECT jsonb_agg(jsonb_build_object('product_id',id,'price',matching_price,'variant_ids',variant_ids) ORDER BY ordinal) FROM page),'[]'),
  'facets',coalesce((SELECT jsonb_agg(jsonb_build_object('key',key,'value',value,'label',CASE WHEN key='pack_size' THEN split_part(value,':',2)||' '||split_part(value,':',1) ELSE label END,'count',count) ORDER BY key,value) FROM facet_counts WHERE rank<=40),'[]'),
  'measurement_capabilities',jsonb_build_object('equipment_length',jsonb_build_object(
   'available',EXISTS(SELECT 1 FROM measurement_units),
   'allowed_units',coalesce((SELECT jsonb_agg(unit ORDER BY ordinal) FROM measurement_units),'[]'::jsonb)
  ),
   'max_width_cm',jsonb_build_object('available',(SELECT width_available FROM measurement_axes)),
   'max_depth_cm',jsonb_build_object('available',(SELECT depth_available FROM measurement_axes))
  )
 ) INTO result;
 RETURN result;
END $fn$;
CREATE OR REPLACE FUNCTION public.apply_collection_membership_v1(p_store_id uuid,p_collection_id uuid,p_actor_id uuid,p_expected_version integer,p_idempotency_key uuid,p_product_ids jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE parent public.collections%ROWTYPE; receipt public.collection_membership_receipts%ROWTYPE; ids uuid[]; product public.products%ROWTYPE; validated integer:=0; previous jsonb; response jsonb; request_id text;
BEGIN
 IF EXISTS(SELECT 1 FROM public.collections WHERE id=p_collection_id AND store_id=p_store_id AND collection_type<>'manual')THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_MANUAL_ONLY' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('letbuyy:migration:361:collection-membership',0));
 PERFORM public.assert_collection_membership_owner_v1(p_store_id,p_actor_id);
 IF p_collection_id IS NULL OR p_expected_version IS NULL OR p_expected_version<=0 OR p_idempotency_key IS NULL OR jsonb_typeof(p_product_ids) IS DISTINCT FROM 'array' OR jsonb_array_length(p_product_ids)>500 THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_product_ids) AS j(value) WHERE jsonb_typeof(value)<>'string' OR value#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 SELECT coalesce(array_agg((value#>>'{}')::uuid ORDER BY ordinal),'{}'::uuid[]) INTO ids FROM jsonb_array_elements(p_product_ids) WITH ORDINALITY AS j(value,ordinal);
 IF cardinality(ids)<>(SELECT count(DISTINCT id)FROM unnest(ids)AS t(id))THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:collection.membership.v1:'||p_idempotency_key::text,0));
 SELECT * INTO receipt FROM public.collection_membership_receipts WHERE idempotency_key=p_idempotency_key;
 IF FOUND THEN
  IF receipt.operation<>'collection.membership.v1' OR receipt.store_id IS DISTINCT FROM p_store_id OR receipt.collection_id IS DISTINCT FROM p_collection_id OR receipt.actor_id IS DISTINCT FROM p_actor_id OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.product_ids IS DISTINCT FROM p_product_ids THEN
   RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_KEY_CONFLICT';END IF;RETURN receipt.response;
 END IF;
 IF EXISTS(SELECT 1 FROM public.idempotency_keys WHERE site_id=p_store_id AND scope='http:PUT:/products/collections/'||p_collection_id::text||'/products' AND key=p_idempotency_key::text) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_LEGACY_KEY';END IF;
 -- Current authority and exact original identity are checked above. A later
 -- soft deletion must not hide an immutable committed acknowledgement; only
 -- a new effect requires a live parent. Legacy keys remain uncertain.
 SELECT * INTO parent FROM public.collections WHERE id=p_collection_id AND store_id=p_store_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_NOT_FOUND';END IF;
 IF parent.membership_version<>p_expected_version THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_VERSION_CONFLICT';END IF;
 FOR product IN SELECT p.* FROM public.products p WHERE p.id=ANY(ids) AND p.store_id=p_store_id AND p.deleted_at IS NULL ORDER BY p.id FOR SHARE LOOP validated:=validated+1;END LOOP;
 IF validated<>cardinality(ids)THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 previous:=public.collection_membership_snapshot_v1(p_store_id,p_collection_id);
 DELETE FROM public.collection_products WHERE collection_id=p_collection_id AND NOT(product_id=ANY(ids));
 INSERT INTO public.collection_products(collection_id,product_id,position)
 SELECT p_collection_id,id,ordinal-1 FROM unnest(ids)WITH ORDINALITY AS t(id,ordinal)
 ON CONFLICT(collection_id,product_id)DO UPDATE SET position=EXCLUDED.position;
 UPDATE public.collections SET updated_by=p_actor_id,updated_at=clock_timestamp()WHERE id=p_collection_id AND store_id=p_store_id;
 response:=public.collection_membership_snapshot_v1(p_store_id,p_collection_id);request_id:=current_setting('app.request_id');
 IF jsonb_array_length(response->'unavailable_product_ids')<>0 THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 INSERT INTO public.audit_activity_events(store_id,actor_id,actor_type,action,resource_type,resource_id,request_id,before_state,after_state,metadata)
 VALUES(p_store_id,p_actor_id,'user','collection.membership.updated','collection',p_collection_id::text,request_id,previous,response,jsonb_build_object('idempotency_key',p_idempotency_key,'expected_version',p_expected_version,'membership_version',response->'membership_version'));
 INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,request_id,actor_id,schema_version)
 VALUES(p_store_id,p_store_id,'collection',p_collection_id::text,'collection.membership.updated',jsonb_build_object('site_id',p_store_id,'collection_id',p_collection_id,'membership_version',response->'membership_version'),'collection.membership.updated:'||p_idempotency_key::text,request_id,p_actor_id,1);
 INSERT INTO public.collection_membership_receipts(idempotency_key,operation,store_id,collection_id,actor_id,expected_version,product_ids,response)
 VALUES(p_idempotency_key,'collection.membership.v1',p_store_id,p_collection_id,p_actor_id,p_expected_version,p_product_ids,response);
 RETURN response;
END
$fn$;
CREATE OR REPLACE FUNCTION public.guard_collection_membership_junction_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE parent public.collections%ROWTYPE; product_store uuid; product_deleted timestamptz;
BEGIN
 IF TG_OP IN('INSERT','UPDATE','DELETE')THEN IF EXISTS(SELECT 1 FROM public.collections WHERE id=CASE WHEN TG_OP='DELETE'THEN OLD.collection_id ELSE NEW.collection_id END AND collection_type<>'manual')THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_MANUAL_ONLY' USING ERRCODE='42501';END IF;END IF;
 IF TG_OP='TRUNCATE' OR current_user::regrole::oid IS DISTINCT FROM (SELECT relowner FROM pg_class WHERE oid='public.collections'::regclass) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_RAW_WRITE_FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('letbuyy:migration:361:collection-membership',0));
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 SELECT * INTO parent FROM public.collections WHERE id=NEW.collection_id FOR UPDATE;
 IF NOT FOUND OR parent.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 SELECT store_id,deleted_at INTO product_store,product_deleted FROM public.products WHERE id=NEW.product_id FOR SHARE;
 IF NOT FOUND OR product_store IS DISTINCT FROM parent.store_id OR product_deleted IS NOT NULL THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 RETURN NEW;
END
$fn$;
CREATE TRIGGER collections_metadata_updated_at435 BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
REVOKE ALL ON FUNCTION public.collection_rules_shape_v1(jsonb) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.guard_collection_metadata_receipt_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.seal_legacy_smart_collections_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.assert_collection_metadata_actor_v1(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.collection_metadata_snapshot_v1(uuid) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.apply_collection_metadata_v1(uuid,uuid,text,uuid,integer,uuid,jsonb) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.collection_rule_text_v1(text) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.collection_rule_number_v1(text) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.collection_rule_matches_v1(jsonb,jsonb) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.collection_rules_match_v1(jsonb,jsonb,text) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.collection_contains_product_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.preview_collection_rules_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.read_collection_metadata_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.read_collection_metadata_page_v1(uuid,uuid,text,integer,integer,text) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.protect_collection_metadata_audit_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.apply_collection_metadata_v1(uuid,uuid,text,uuid,integer,uuid,jsonb) TO app_tenant;
GRANT EXECUTE ON FUNCTION public.read_collection_metadata_v1(uuid,uuid,uuid) TO app_tenant;
GRANT EXECUTE ON FUNCTION public.read_collection_metadata_page_v1(uuid,uuid,text,integer,integer,text) TO app_tenant;
GRANT EXECUTE ON FUNCTION public.preview_collection_rules_v1(uuid,uuid,uuid) TO app_tenant;
GRANT EXECUTE ON FUNCTION public.collection_rules_shape_v1(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.collection_rule_text_v1(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.collection_rule_number_v1(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.collection_rule_matches_v1(jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.collection_rules_match_v1(jsonb,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.collection_contains_product_v1(uuid,uuid,jsonb) TO service_role;
DO $profiles435$ DECLARE signature text;f record;shape text;BEGIN FOREACH signature IN ARRAY ARRAY['public.collection_rules_shape_v1(jsonb)','public.guard_collection_metadata_receipt_v1()','public.seal_legacy_smart_collections_v1()','public.assert_collection_metadata_actor_v1(uuid,uuid,boolean)','public.collection_metadata_snapshot_v1(uuid)','public.apply_collection_metadata_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)','public.collection_rule_text_v1(text)','public.collection_rule_number_v1(text)','public.collection_rule_matches_v1(jsonb,jsonb)','public.collection_rules_match_v1(jsonb,jsonb,text)','public.collection_contains_product_v1(uuid,uuid,jsonb)','public.preview_collection_rules_v1(uuid,uuid,uuid)','public.read_collection_metadata_v1(uuid,uuid,uuid)','public.read_collection_metadata_page_v1(uuid,uuid,text,integer,integer,text)','public.protect_collection_metadata_audit_v1()','public.browse_storefront_products_v1(uuid,jsonb,uuid[])','public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb)','public.guard_collection_membership_junction_v1()']LOOP
 SELECT * INTO STRICT f FROM pg_proc WHERE oid=to_regprocedure(signature);shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'owner',f.proowner,'acl',
 (SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a),
 'language',f.prolang,'kind',f.prokind,'config',f.proconfig,'strict',f.proisstrict,'leakproof',f.proleakproof,
 'parallel',f.proparallel,'volatility',f.provolatile,'security',f.prosecdef,'support',f.prosupport,'cost',f.procost,'rows',f.prorows)::text;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)VALUES('435',signature,current_user,'COLLECTION CURRENT FUNCTION','granted',f.oid,f.proowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));
 END LOOP;END $profiles435$;
DO $table_profiles435$DECLARE signature text;t record;shape text;BEGIN FOREACH signature IN ARRAY ARRAY['public.collections','public.smart_collections','public.collection_metadata_receipts']LOOP SELECT * INTO STRICT t FROM pg_class WHERE oid=to_regclass(signature);
 shape:=jsonb_build_object(
 'relation',jsonb_build_array(t.relkind,t.relpersistence,t.relrowsecurity,t.relforcerowsecurity,t.reloptions,t.relreplident),
 'acl',(SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner)))a),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum)FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred)ORDER BY c.conname)FROM pg_constraint c WHERE c.conrelid=t.oid),
 'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid)ORDER BY i.indexrelid::regclass::text)FROM pg_index i WHERE i.indrelid=t.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(x.tgname,pg_get_triggerdef(x.oid),x.tgenabled)ORDER BY x.tgname)FROM pg_trigger x WHERE x.tgrelid=t.oid AND NOT x.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(x.polname,x.polcmd,x.polpermissive,x.polroles,pg_get_expr(x.polqual,x.polrelid),pg_get_expr(x.polwithcheck,x.polrelid))ORDER BY x.polname)FROM pg_policy x WHERE x.polrelid=t.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(x.oid)ORDER BY x.rulename)FROM pg_rewrite x WHERE x.ev_class=t.oid)
 )::text;INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)VALUES('435',signature,current_user,'COLLECTION CURRENT TABLE','granted',t.oid,t.relowner,encode(sha256(convert_to(shape,'UTF8')),'hex'));END LOOP;END $table_profiles435$;
DO $audit_profile435$DECLARE name text;t record;shape text;BEGIN FOREACH name IN ARRAY ARRAY['audit_collection_metadata_immutable','audit_collection_metadata_no_truncate']LOOP
 SELECT * INTO STRICT t FROM pg_trigger WHERE tgrelid='public.audit_activity_events'::regclass AND tgname=name;
 shape:=jsonb_build_array(pg_get_triggerdef(t.oid),t.tgenabled)::text;
 INSERT INTO public.migration_privilege_journal(migration,object_signature,grantee,privilege,action,object_oid,object_owner,object_definition_hash)
 VALUES('435','public.audit_activity_events:'||name,current_user,'COLLECTION AUDIT TRIGGER','granted',t.oid,current_user::regrole::oid,encode(sha256(convert_to(shape,'UTF8')),'hex'));
 END LOOP;END $audit_profile435$;
NOTIFY pgrst,'reload schema';
COMMIT;
