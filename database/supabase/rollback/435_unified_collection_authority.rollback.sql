-- Empty/unused-only retirement. Retained source, metadata history and receipts recover forward.
BEGIN;SET LOCAL search_path=pg_catalog,public;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:435:collections',0));
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
-- Bind the complete restoration family before any object can be changed.
-- Existing birth/profile and retained-data proofs below remain mandatory.
DO $typed_family_guard$
DECLARE expected record; live pg_catalog.pg_proc%ROWTYPE;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('public.browse_storefront_products_v1(uuid,jsonb,uuid[])',ARRAY['p_store_id','p_query','p_product_ids']::text[],'jsonb',false),
    ('public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb)',ARRAY['p_store_id','p_collection_id','p_actor_id','p_expected_version','p_idempotency_key','p_product_ids']::text[],'jsonb',true),
    ('public.guard_collection_membership_junction_v1()',ARRAY[]::text[],'trigger',false)
  ) AS proof(signature,input_names,result_type,definer)
  LOOP
    SELECT * INTO live FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(expected.signature);
    IF live.oid IS NULL OR live.prokind<>'f'
      OR live.prosecdef IS DISTINCT FROM expected.definer OR live.proretset
      OR live.prorettype IS DISTINCT FROM expected.result_type::regtype OR live.provariadic<>0
      OR coalesce(live.proargnames[1:live.pronargs],ARRAY[]::text[]) IS DISTINCT FROM expected.input_names
      OR live.proargmodes IS NOT NULL OR live.proallargtypes IS NOT NULL
      OR (SELECT count(*) FROM pg_catalog.pg_proc other WHERE other.pronamespace=live.pronamespace AND other.proname=live.proname)<>1
      OR (expected.definer AND (pg_catalog.has_function_privilege('anon',live.oid,'EXECUTE') OR pg_catalog.has_function_privilege('authenticated',live.oid,'EXECUTE'))) THEN
      RAISE EXCEPTION 'rollback 435 refuses to run: input names or typed ABI changed';
    END IF;
  END LOOP;
END $typed_family_guard$;

DO $quiescent$ BEGIN
 IF current_setting('transaction_isolation')<>'read committed'
  OR EXISTS(SELECT 1 FROM pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted
   AND (l.pid IS NULL OR l.pid<>pg_backend_pid())) OR EXISTS(SELECT 1 FROM pg_prepared_xacts) THEN
  RAISE EXCEPTION 'rollback435 refuses concurrent/prepared writes or non-read-committed state';END IF;
END $quiescent$;


LOCK TABLE public.collections,public.smart_collections,public.collection_products,public.collection_metadata_receipts,public.audit_activity_events IN ACCESS EXCLUSIVE MODE;
DO $retention435$BEGIN
 IF EXISTS(SELECT 1 FROM public.smart_collections)OR EXISTS(SELECT 1 FROM public.collection_metadata_receipts)
 OR EXISTS(SELECT 1 FROM public.collections WHERE collection_type<>'manual'OR version<>1 OR slug IS NOT NULL)
 OR EXISTS(SELECT 1 FROM public.audit_activity_events WHERE resource_type='collection_metadata')
 OR EXISTS(SELECT 1 FROM public.outbox_events WHERE event_type='collection.metadata.updated')THEN
  RAISE EXCEPTION 'rollback435 refuses retained collection metadata history; recover forward';END IF;
END $retention435$;
DO $table_profiles435$DECLARE signature text;t record;j record;shape text;BEGIN FOREACH signature IN ARRAY ARRAY['public.collections','public.smart_collections','public.collection_metadata_receipts']LOOP SELECT * INTO t FROM pg_class WHERE oid=to_regclass(signature);SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='435'AND object_signature=signature AND privilege='COLLECTION CURRENT TABLE';
 shape:=jsonb_build_object(
 'relation',jsonb_build_array(t.relkind,t.relpersistence,t.relrowsecurity,t.relforcerowsecurity,t.reloptions,t.relreplident),
 'acl',(SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner)))a),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum)FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred)ORDER BY c.conname)FROM pg_constraint c WHERE c.conrelid=t.oid),
 'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid)ORDER BY i.indexrelid::regclass::text)FROM pg_index i WHERE i.indrelid=t.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(x.tgname,pg_get_triggerdef(x.oid),x.tgenabled)ORDER BY x.tgname)FROM pg_trigger x WHERE x.tgrelid=t.oid AND NOT x.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(x.polname,x.polcmd,x.polpermissive,x.polroles,pg_get_expr(x.polqual,x.polrelid),pg_get_expr(x.polwithcheck,x.polrelid))ORDER BY x.polname)FROM pg_policy x WHERE x.polrelid=t.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(x.oid)ORDER BY x.rulename)FROM pg_rewrite x WHERE x.ev_class=t.oid)
 )::text;IF j.object_oid IS DISTINCT FROM t.oid OR j.object_owner IS DISTINCT FROM t.relowner OR t.relowner IS DISTINCT FROM current_user::regrole::oid OR j.grantee IS DISTINCT FROM current_user OR j.action IS DISTINCT FROM 'granted'OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex')THEN RAISE EXCEPTION 'rollback435 refuses changed table profile: %',signature;END IF;END LOOP;END $table_profiles435$;
DO $audit_profile435$DECLARE name text;t record;j record;shape text;BEGIN FOREACH name IN ARRAY ARRAY['audit_collection_metadata_immutable','audit_collection_metadata_no_truncate']LOOP
 SELECT * INTO t FROM pg_trigger WHERE tgrelid='public.audit_activity_events'::regclass AND tgname=name;
 SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='435'AND object_signature='public.audit_activity_events:'||name AND privilege='COLLECTION AUDIT TRIGGER';
 shape:=jsonb_build_array(pg_get_triggerdef(t.oid),t.tgenabled)::text;
 IF j.object_oid IS DISTINCT FROM t.oid OR j.object_owner IS DISTINCT FROM current_user::regrole::oid OR j.grantee IS DISTINCT FROM current_user OR j.action IS DISTINCT FROM 'granted'OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex')THEN RAISE EXCEPTION 'rollback435 refuses changed audit trigger';END IF;
 END LOOP;END $audit_profile435$;
DO $profiles435$DECLARE f record;j record;shape text;signature text;BEGIN
 FOREACH signature IN ARRAY ARRAY['public.collection_rules_shape_v1(jsonb)','public.guard_collection_metadata_receipt_v1()','public.seal_legacy_smart_collections_v1()','public.assert_collection_metadata_actor_v1(uuid,uuid,boolean)','public.collection_metadata_snapshot_v1(uuid)','public.apply_collection_metadata_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)','public.collection_rule_text_v1(text)','public.collection_rule_number_v1(text)','public.collection_rule_matches_v1(jsonb,jsonb)','public.collection_rules_match_v1(jsonb,jsonb,text)','public.collection_contains_product_v1(uuid,uuid,jsonb)','public.preview_collection_rules_v1(uuid,uuid,uuid)','public.read_collection_metadata_v1(uuid,uuid,uuid)','public.read_collection_metadata_page_v1(uuid,uuid,text,integer,integer,text)','public.protect_collection_metadata_audit_v1()','public.browse_storefront_products_v1(uuid,jsonb,uuid[])','public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb)','public.guard_collection_membership_junction_v1()']LOOP
 SELECT * INTO f FROM pg_proc WHERE oid=to_regprocedure(signature);SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='435'AND object_signature=signature AND privilege='COLLECTION CURRENT FUNCTION';shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'owner',f.proowner,'acl',
 (SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a),
 'language',f.prolang,'kind',f.prokind,'config',f.proconfig,'strict',f.proisstrict,'leakproof',f.proleakproof,
 'parallel',f.proparallel,'volatility',f.provolatile,'security',f.prosecdef,'support',f.prosupport,'cost',f.procost,'rows',f.prorows)::text;
 IF j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner OR f.proowner IS DISTINCT FROM current_user::regrole::oid OR j.grantee IS DISTINCT FROM current_user OR j.action IS DISTINCT FROM 'granted'OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex')THEN RAISE EXCEPTION 'rollback435 refuses changed function profile: %',signature;END IF;END LOOP;END $profiles435$;

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
   AND(NOT query?'collection_id' OR EXISTS(SELECT 1 FROM public.collection_products cp JOIN public.collections c ON c.id=cp.collection_id WHERE cp.product_id=p.id AND c.id=(query->>'collection_id')::uuid AND c.store_id=p_store_id AND c.is_active=true AND c.deleted_at IS NULL))
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
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('letbuyy:migration:361:collection-membership',0));
 PERFORM public.assert_collection_membership_owner_v1(p_store_id,p_actor_id);
 IF p_collection_id IS NULL OR p_expected_version IS NULL OR p_expected_version<=0 OR p_idempotency_key IS NULL OR jsonb_typeof(p_product_ids) IS DISTINCT FROM 'array' OR jsonb_array_length(p_product_ids)>500 THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_product_ids) AS j(value) WHERE jsonb_typeof(value)<>'string' OR value#>>'{}' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 SELECT coalesce(array_agg((value#>>'{}')::uuid ORDER BY ordinal),'{}'::uuid[]) INTO ids FROM jsonb_array_elements(p_product_ids) WITH ORDINALITY AS j(value,ordinal);
 IF cardinality(ids)<>(SELECT count(DISTINCT id)FROM unnest(ids)AS t(id))THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_INVALID';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:collection.membership.v1:'||p_idempotency_key::text,0));
 SELECT * INTO parent FROM public.collections WHERE id=p_collection_id AND store_id=p_store_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_NOT_FOUND';END IF;
 SELECT * INTO receipt FROM public.collection_membership_receipts WHERE idempotency_key=p_idempotency_key;
 IF FOUND THEN
  IF receipt.operation<>'collection.membership.v1' OR receipt.store_id IS DISTINCT FROM p_store_id OR receipt.collection_id IS DISTINCT FROM p_collection_id OR receipt.actor_id IS DISTINCT FROM p_actor_id OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.product_ids IS DISTINCT FROM p_product_ids THEN
   RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_KEY_CONFLICT';END IF;RETURN receipt.response;
 END IF;
 IF EXISTS(SELECT 1 FROM public.idempotency_keys WHERE site_id=p_store_id AND scope='http:PUT:/products/collections/'||p_collection_id::text||'/products' AND key=p_idempotency_key::text) THEN
  RAISE EXCEPTION 'COLLECTION_MEMBERSHIP_LEGACY_KEY';END IF;
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
DROP TRIGGER collections_version435 ON public.collections;
DROP TRIGGER collections_metadata_updated_at435 ON public.collections;
DROP TRIGGER smart_collections_sealed435 ON public.smart_collections;
DROP TRIGGER smart_collections_no_truncate435 ON public.smart_collections;
DROP TRIGGER audit_collection_metadata_immutable ON public.audit_activity_events;
DROP TRIGGER audit_collection_metadata_no_truncate ON public.audit_activity_events;
DROP TABLE public.collection_metadata_receipts;
ALTER TABLE public.collections DROP CONSTRAINT collections_smart_rules435;
ALTER TABLE public.collections DROP CONSTRAINT collections_smart_slug435;
ALTER TABLE public.collections DROP CONSTRAINT collections_type435;
ALTER TABLE public.collections DROP CONSTRAINT collections_match435;
ALTER TABLE public.collections DROP CONSTRAINT collections_version435;
ALTER TABLE public.collections DROP CONSTRAINT collections_slug435;
DROP INDEX public.collections_store_slug435;DROP INDEX public.collections_kind_page435;
ALTER TABLE public.collections DROP COLUMN collection_type;
ALTER TABLE public.collections DROP COLUMN match_type;
ALTER TABLE public.collections DROP COLUMN slug;
ALTER TABLE public.collections DROP COLUMN version;
DROP FUNCTION public.protect_collection_metadata_audit_v1();
DROP FUNCTION public.read_collection_metadata_page_v1(uuid,uuid,text,integer,integer,text);
DROP FUNCTION public.read_collection_metadata_v1(uuid,uuid,uuid);
DROP FUNCTION public.preview_collection_rules_v1(uuid,uuid,uuid);
DROP FUNCTION public.collection_contains_product_v1(uuid,uuid,jsonb);
DROP FUNCTION public.collection_rules_match_v1(jsonb,jsonb,text);
DROP FUNCTION public.collection_rule_matches_v1(jsonb,jsonb);
DROP FUNCTION public.collection_rule_number_v1(text);
DROP FUNCTION public.collection_rule_text_v1(text);
DROP FUNCTION public.apply_collection_metadata_v1(uuid,uuid,text,uuid,integer,uuid,jsonb);
DROP FUNCTION public.collection_metadata_snapshot_v1(uuid);
DROP FUNCTION public.assert_collection_metadata_actor_v1(uuid,uuid,boolean);
DROP FUNCTION public.seal_legacy_smart_collections_v1();
DROP FUNCTION public.guard_collection_metadata_receipt_v1();
DROP FUNCTION public.collection_rules_shape_v1(jsonb);
DO $restore_acl435$DECLARE j record;privilege text;role_sql text;BEGIN
 FOR j IN SELECT * FROM public.migration_privilege_journal WHERE migration='435'AND action='revoked'LOOP
  IF j.object_signature NOT IN('collections','smart_collections','public.collections','public.smart_collections')
   OR j.object_oid IS DISTINCT FROM to_regclass(j.object_signature)::oid
   OR j.object_owner IS DISTINCT FROM current_user::regrole::oid
   OR j.privilege!~'^(INSERT|UPDATE|DELETE|TRUNCATE)( WITH GRANT OPTION)?$'THEN RAISE EXCEPTION 'rollback435 refuses changed original table grant';END IF;
  role_sql:=CASE WHEN j.grantee='PUBLIC'THEN 'PUBLIC'ELSE quote_ident(j.grantee)END;
  privilege:=replace(j.privilege,' WITH GRANT OPTION','');
  EXECUTE format('GRANT %s ON TABLE %s TO %s%s',privilege,j.object_oid::regclass,role_sql,CASE WHEN j.privilege LIKE '% WITH GRANT OPTION'THEN ' WITH GRANT OPTION'ELSE ''END);
 END LOOP;END $restore_acl435$;
DO $restored435$DECLARE signature text;f record;j record;shape text;BEGIN FOREACH signature IN ARRAY ARRAY['public.browse_storefront_products_v1(uuid,jsonb,uuid[])','public.apply_collection_membership_v1(uuid,uuid,uuid,integer,uuid,jsonb)','public.guard_collection_membership_junction_v1()']LOOP
 SELECT * INTO STRICT f FROM pg_proc WHERE oid=to_regprocedure(signature);SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='435'AND object_signature=signature AND privilege='COLLECTION ORIGINAL FUNCTION';shape:=jsonb_build_object('definition',pg_get_functiondef(f.oid),'owner',f.proowner,'acl',
 (SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)
 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner)))a),
 'language',f.prolang,'kind',f.prokind,'config',f.proconfig,'strict',f.proisstrict,'leakproof',f.proleakproof,
 'parallel',f.proparallel,'volatility',f.provolatile,'security',f.prosecdef,'support',f.prosupport,'cost',f.procost,'rows',f.prorows)::text;IF j.object_oid IS DISTINCT FROM f.oid OR j.object_owner IS DISTINCT FROM f.proowner OR j.grantee IS DISTINCT FROM current_user OR j.action IS DISTINCT FROM 'granted'OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex')THEN RAISE EXCEPTION 'rollback435 refuses changed original function profile';END IF;END LOOP;END $restored435$;
DO $table_profiles435$DECLARE signature text;t record;j record;shape text;BEGIN FOREACH signature IN ARRAY ARRAY['public.collections','public.smart_collections']LOOP SELECT * INTO t FROM pg_class WHERE oid=to_regclass(signature);SELECT * INTO j FROM public.migration_privilege_journal WHERE migration='435'AND object_signature=signature AND privilege='COLLECTION ORIGINAL TABLE';
 shape:=jsonb_build_object(
 'relation',jsonb_build_array(t.relkind,t.relpersistence,t.relrowsecurity,t.relforcerowsecurity,t.reloptions,t.relreplident),
 'acl',(SELECT jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable)FROM aclexplode(coalesce(t.relacl,acldefault('r',t.relowner)))a),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,a.attcollation,a.attacl,pg_get_expr(d.adbin,d.adrelid))ORDER BY a.attnum)FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=t.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.conname,pg_get_constraintdef(c.oid),c.convalidated,c.condeferrable,c.condeferred)ORDER BY c.conname)FROM pg_constraint c WHERE c.conrelid=t.oid),
 'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid)ORDER BY i.indexrelid::regclass::text)FROM pg_index i WHERE i.indrelid=t.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(x.tgname,pg_get_triggerdef(x.oid),x.tgenabled)ORDER BY x.tgname)FROM pg_trigger x WHERE x.tgrelid=t.oid AND NOT x.tgisinternal),
 'policies',(SELECT jsonb_agg(jsonb_build_array(x.polname,x.polcmd,x.polpermissive,x.polroles,pg_get_expr(x.polqual,x.polrelid),pg_get_expr(x.polwithcheck,x.polrelid))ORDER BY x.polname)FROM pg_policy x WHERE x.polrelid=t.oid),
 'rules',(SELECT jsonb_agg(pg_get_ruledef(x.oid)ORDER BY x.rulename)FROM pg_rewrite x WHERE x.ev_class=t.oid)
 )::text;IF j.object_oid IS DISTINCT FROM t.oid OR j.object_owner IS DISTINCT FROM t.relowner OR t.relowner IS DISTINCT FROM current_user::regrole::oid OR j.grantee IS DISTINCT FROM current_user OR j.action IS DISTINCT FROM 'granted'OR j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(shape,'UTF8')),'hex')THEN RAISE EXCEPTION 'rollback435 refuses changed table profile: %',signature;END IF;END LOOP;END $table_profiles435$;
DELETE FROM public.migration_privilege_journal WHERE migration='435';NOTIFY pgrst,'reload schema';COMMIT;
