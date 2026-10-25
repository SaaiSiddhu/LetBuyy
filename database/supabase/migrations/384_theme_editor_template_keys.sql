-- Align the existing draft CAS key guard with the canonical template registry.
-- No data, draft, receipt, authorization or publication behavior is rewritten.
BEGIN;
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
DO $template_key_contract$
DECLARE p pg_catalog.pg_proc%ROWTYPE;
BEGIN
 SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb)');
 IF p.oid IS NULL OR p.prokind<>'f' OR p.prosecdef OR p.proretset
 OR p.prorettype<>'jsonb'::regtype OR p.pronargdefaults<>5 OR p.provariadic<>0
 OR p.provolatile<>'v' OR p.proisstrict OR p.proleakproof OR p.proparallel<>'u'
 OR p.procost<>100 OR p.prorows<>0 OR p.prosupport<>0 OR p.probin IS NOT NULL OR p.prosqlbody IS NOT NULL
 OR p.proallargtypes IS NOT NULL OR p.proargmodes IS NOT NULL OR p.protrftypes IS NOT NULL
 OR p.proargnames IS DISTINCT FROM ARRAY['p_actor_id','p_store_id','p_theme_slug','p_template_key','p_base_version','p_key','p_operation','p_config','p_runtime','p_bound_site_id','p_request_id','p_publish_options']::text[]
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
 OR pg_catalog.pg_get_expr(p.proargdefaults,0) IS DISTINCT FROM 'NULL::jsonb, ''{}''::jsonb, NULL::uuid, NULL::text, ''{}''::jsonb'
 OR p.proowner<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.sites'::regclass)
 OR p.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
 OR (SELECT count(*) FROM pg_catalog.pg_proc q WHERE q.pronamespace=p.pronamespace AND q.proname=p.proname)<>1
 OR pg_catalog.md5(p.prosrc) NOT IN('b770c5c649eee8eca3b5cc8f5e488c69','2a6e74135720d0557ba921d517e88a13')
 OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
 OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
  WHERE a.grantee NOT IN(p.proowner,'service_role'::regrole::oid) OR (a.grantee<>p.proowner AND a.is_grantable)) THEN
  RAISE EXCEPTION 'Migration384 refuses changed draft definition, owner or privileges';
 END IF;
END $template_key_contract$;
CREATE OR REPLACE FUNCTION public.mutate_owned_theme_draft_v1(
 p_actor_id uuid,p_store_id uuid,p_theme_slug text,p_template_key text,p_base_version integer,p_key text,p_operation text,
 p_config jsonb DEFAULT NULL,p_runtime jsonb DEFAULT '{}',p_bound_site_id uuid DEFAULT NULL,p_request_id text DEFAULT NULL,p_publish_options jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE s public.sites;t public.themes;i public.theme_instances;d public.theme_instance_drafts;e public.theme_editor_drafts;
 receipt public.idempotency_keys;v_hash text;v_scope text;v_current integer;v_next integer;v_now timestamptz:=now();
 v_config jsonb;v_templates jsonb;v_item record;v_response jsonb;v_release record;v_manifest jsonb;v_patch uuid;
 v_package uuid;v_package_version uuid;v_schema text;v_instance_draft uuid;
 v_input jsonb;v_order jsonb;v_existing_order jsonb;v_sections jsonb;v_ids text[];
BEGIN
 IF p_operation IS NULL OR p_operation NOT IN('save','reorder','discard','publish') OR p_base_version IS NULL OR p_base_version<0 OR p_base_version>=2147483647
  OR p_key IS NULL OR char_length(p_key) NOT BETWEEN 8 AND 200 OR p_key<>btrim(p_key) OR p_key~'[[:cntrl:]]'
  OR p_template_key IS NULL OR char_length(p_template_key) NOT BETWEEN 1 AND 120
  OR p_template_key IN('__proto__','constructor','prototype')
  OR p_template_key!~'^[a-z0-9][a-z0-9_./-]*$' OR position('..' IN p_template_key)>0 OR position('//' IN p_template_key)>0
  OR (position('.' IN p_template_key)>0 AND split_part(p_template_key,'.',2)<>''
      AND substring(p_template_key FROM position('.' IN p_template_key)+1)!~'^[a-z0-9][a-z0-9_-]*$') THEN
  RAISE EXCEPTION 'Invalid theme draft intent' USING ERRCODE='PT400'; END IF;
 s:=public.theme_draft_actor_site_v1(p_actor_id,p_store_id,p_bound_site_id);
 SELECT * INTO t FROM public.themes WHERE slug=p_theme_slug AND is_active=true;
 IF t.id IS NULL OR(t.is_site_private AND t.owned_by_site_id IS DISTINCT FROM p_store_id) THEN
  RAISE EXCEPTION 'Theme not available' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM public.theme_instances WHERE store_id=p_store_id AND theme_slug=p_theme_slug AND deleted_at IS NULL
  ORDER BY updated_at DESC,id DESC LIMIT 1 FOR UPDATE;
 v_current:=greatest(coalesce(i.draft_revision,0),coalesce((SELECT max(version) FROM public.theme_editor_drafts WHERE store_id=p_store_id AND theme_id=p_theme_slug),0));
 v_scope:='theme-draft-v1:'||p_actor_id::text||':'||p_theme_slug;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('actor',p_actor_id,'store',p_store_id,'theme',p_theme_slug,
  'template',p_template_key,'base_version',p_base_version,'operation',p_operation,'config',p_config,'publish',p_publish_options)::text,'UTF8')),'hex');
 SELECT * INTO receipt FROM public.idempotency_keys WHERE site_id=p_store_id AND scope=v_scope AND key=p_key FOR UPDATE;
 IF FOUND THEN
  IF receipt.request_hash IS DISTINCT FROM v_hash THEN RAISE EXCEPTION 'Theme intent key has different content' USING ERRCODE='PT409'; END IF;
  IF receipt.status<>'completed' OR receipt.response_body IS NULL OR receipt.deleted_at IS NOT NULL THEN
   RAISE EXCEPTION 'Theme receipt unavailable' USING ERRCODE='PT503'; END IF;
  RETURN receipt.response_body||jsonb_build_object('replayed',true,'current_version',v_current);
 END IF;
 IF v_current<>p_base_version THEN
  RAISE EXCEPTION 'Theme draft has changed in another session' USING ERRCODE='PT409',DETAIL=jsonb_build_object('current_version',v_current)::text; END IF;
 v_next:=v_current+1;
 SELECT * INTO d FROM public.theme_instance_drafts WHERE theme_instance_id=i.id AND store_id=p_store_id
  AND draft_status='active' AND deleted_at IS NULL ORDER BY updated_at DESC,id DESC LIMIT 1 FOR UPDATE;
 SELECT * INTO e FROM public.theme_editor_drafts WHERE store_id=p_store_id AND theme_id=p_theme_slug AND template_key=p_template_key FOR UPDATE;

 IF p_operation='reorder' THEN
  v_order:=p_config->'section_order';
  IF jsonb_typeof(v_order) IS DISTINCT FROM 'array' OR jsonb_array_length(v_order)>500 THEN
   RAISE EXCEPTION 'Section order required' USING ERRCODE='PT400'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_order) x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}') NOT BETWEEN 1 AND 200)
   OR (SELECT count(*) FROM jsonb_array_elements(v_order))<>(SELECT count(DISTINCT x) FROM jsonb_array_elements(v_order) x) THEN
   RAISE EXCEPTION 'Distinct section IDs required' USING ERRCODE='PT400'; END IF;
  v_input:=coalesce(d.working_manifest,CASE WHEN e.deleted_at IS NULL THEN e.draft_config END,p_runtime->'initial_config');
  IF jsonb_typeof(v_input) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Theme document unavailable' USING ERRCODE='PT503'; END IF;
  v_sections:=v_input->'templates'->p_template_key->'sections';
  v_existing_order:=v_input->'templates'->p_template_key->'order';
  IF jsonb_typeof(v_sections)='object' AND jsonb_typeof(v_existing_order)='array' THEN
   SELECT array_agg(x) INTO v_ids FROM jsonb_object_keys(v_sections) x;
  ELSIF jsonb_typeof(v_input->'sections'->'template')='array' THEN
   SELECT array_agg(x->>'id'),coalesce(jsonb_agg(x->'id'),'[]') INTO v_ids,v_existing_order FROM jsonb_array_elements(v_input->'sections'->'template') x;
  ELSE RAISE EXCEPTION 'Template sections unavailable' USING ERRCODE='PT409'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_order) x WHERE NOT(x=ANY(coalesce(v_ids,ARRAY[]::text[])))) THEN
   RAISE EXCEPTION 'Section order changed' USING ERRCODE='PT409'; END IF;
  SELECT v_order||coalesce(jsonb_agg(x ORDER BY n) FILTER(WHERE NOT(v_order ? (x#>>'{}'))),'[]') INTO v_order
   FROM jsonb_array_elements(v_existing_order) WITH ORDINALITY a(x,n);
  IF jsonb_typeof(v_sections)='object' THEN
   v_input:=jsonb_set(v_input,ARRAY['templates',p_template_key,'order'],v_order);
  END IF;
  IF jsonb_typeof(v_input->'sections'->'template')='array' THEN
   SELECT coalesce(jsonb_agg(x ORDER BY array_position(ARRAY(SELECT jsonb_array_elements_text(v_order)),x->>'id')),'[]') INTO v_sections
    FROM jsonb_array_elements(v_input->'sections'->'template') x;
   v_input:=jsonb_set(v_input,'{sections,template}',v_sections);
  END IF;
 ELSE v_input:=p_config;
 END IF;
 IF p_operation IN('save','reorder') THEN
  IF v_input IS NULL OR jsonb_typeof(v_input)<>'object' THEN RAISE EXCEPTION 'Theme document required' USING ERRCODE='PT400'; END IF;
  v_package:=(p_runtime->>'theme_package_id')::uuid;v_package_version:=(p_runtime->>'theme_package_version_id')::uuid;
  SELECT schema_version INTO v_schema FROM public.theme_package_versions WHERE id=v_package_version AND theme_package_id=v_package;
  IF v_schema IS NULL OR NOT EXISTS(SELECT 1 FROM public.theme_packages WHERE id=v_package AND slug=p_theme_slug) THEN
   RAISE EXCEPTION 'Canonical theme runtime unavailable' USING ERRCODE='PT503'; END IF;
  IF i.id IS NULL THEN
   INSERT INTO public.theme_instances(store_id,theme_package_id,theme_package_version_id,theme_slug,installed_config,settings,created_by,updated_by,draft_revision)
    VALUES(p_store_id,v_package,v_package_version,p_theme_slug,v_input,coalesce(v_input->'themeSettings','{}'),p_actor_id,p_actor_id,v_current) RETURNING * INTO i;
  ELSIF i.theme_package_id<>v_package THEN RAISE EXCEPTION 'Theme package changed' USING ERRCODE='PT409'; END IF;
  v_templates:=coalesce(v_input->'templates','{}');
  -- Preserve every saved template while the selected template and shared settings
  -- are changed under one global instance revision.
  IF d.id IS NOT NULL THEN v_templates:=v_templates||coalesce(d.working_manifest->'templates','{}'); END IF;
  FOR v_item IN SELECT template_key,draft_config FROM public.theme_editor_drafts WHERE store_id=p_store_id AND theme_id=p_theme_slug AND deleted_at IS NULL LOOP
   IF v_item.template_key<>p_template_key AND jsonb_typeof(v_item.draft_config->'templates'->v_item.template_key)='object' THEN
    v_templates:=jsonb_set(v_templates,ARRAY[v_item.template_key],v_item.draft_config->'templates'->v_item.template_key,true); END IF;
  END LOOP;
  IF jsonb_typeof(v_input->'templates'->p_template_key)='object' THEN
   v_templates:=jsonb_set(v_templates,ARRAY[p_template_key],v_input->'templates'->p_template_key,true); END IF;
  v_config:=v_input||jsonb_build_object('templates',v_templates);
  IF d.id IS NULL THEN
   INSERT INTO public.theme_instance_drafts(theme_instance_id,store_id,base_release_id,draft_version,working_manifest,schema_manifest_version,created_by,updated_by)
    VALUES(i.id,p_store_id,i.active_release_id,v_next,v_config,v_schema,p_actor_id,p_actor_id) RETURNING * INTO d;
  ELSE
   UPDATE public.theme_instance_drafts SET draft_version=v_next,working_manifest=v_config,schema_manifest_version=v_schema,
    auto_saved_at=v_now,updated_at=v_now,updated_by=p_actor_id WHERE id=d.id AND store_id=p_store_id RETURNING * INTO d;
  END IF;
  INSERT INTO public.theme_editor_drafts(store_id,theme_id,template_key,draft_config,version,created_by,updated_by)
   VALUES(p_store_id,p_theme_slug,p_template_key,v_config,v_next,p_actor_id,p_actor_id)
   ON CONFLICT(store_id,theme_id,template_key) DO UPDATE SET draft_config=excluded.draft_config,version=v_next,
    deleted_at=NULL,auto_saved_at=v_now,updated_at=v_now,updated_by=p_actor_id RETURNING * INTO e;
  INSERT INTO public.theme_draft_patches(draft_id,store_id,patch_sequence,patch_type,operation,path,value,previous_value,actor_id,request_id,client_revision,server_revision,metadata)
   VALUES(d.id,p_store_id,v_next,'set',jsonb_build_object('op','replace','path','/','source','theme-editor-v1'), '/',v_config,NULL,p_actor_id,p_request_id,p_base_version,v_next,
    jsonb_build_object('template_key',p_template_key,'idempotency_key',p_key)) RETURNING id INTO v_patch;
  UPDATE public.theme_instances SET draft_revision=v_next,current_draft_id=d.id,theme_package_version_id=v_package_version,
   updated_at=v_now,updated_by=p_actor_id WHERE id=i.id AND store_id=p_store_id;
  INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,request_id,actor_id,schema_version)
   VALUES(p_store_id,p_store_id,'theme_draft',e.id::text,'theme.draft.saved',jsonb_build_object('store_id',p_store_id,'theme_id',p_theme_slug,'template_key',p_template_key,
    'theme_instance_id',i.id,'theme_package_version_id',v_package_version,'theme_instance_draft_id',d.id,'draft_id',e.id,'version',v_next,'client',p_runtime->>'client'),
    'theme.draft.saved:'||i.id::text||':'||v_next,p_request_id,p_actor_id,1);
  v_response:=jsonb_build_object('saved_at',to_char(v_now AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'version',v_next,'template_key',p_template_key,'draft',jsonb_build_object('id',e.id,'version',v_next,'auto_saved_at',to_char(v_now AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')));
  IF p_operation='reorder' THEN v_response:=v_response||jsonb_build_object('section_order',v_order); END IF;
 ELSE
  IF d.id IS NULL THEN RAISE EXCEPTION 'No saved theme draft exists' USING ERRCODE='PT409'; END IF;
  v_config:=d.working_manifest;
  IF p_operation='publish' THEN
   IF p_base_version=0 OR(p_config IS NOT NULL AND p_config IS DISTINCT FROM v_config) THEN
    RAISE EXCEPTION 'Save the exact theme draft before publishing' USING ERRCODE='PT409'; END IF;
   SELECT * INTO v_release FROM public.publish_theme_release(p_store_id,p_theme_slug,v_config,e.id,p_base_version,p_actor_id,
    p_publish_options->>'publish_message',coalesce((p_publish_options->>'make_store_live')::boolean,true),p_request_id,NULL);
   UPDATE public.theme_instance_drafts SET draft_status='published',updated_at=v_now,updated_by=p_actor_id
    WHERE id=d.id AND store_id=p_store_id;
   -- Keep the existing renderer artifacts inside this transaction rather than a
   -- post-commit enrichment that can return false failure after switching release.
   v_manifest:=coalesce(p_runtime->'release_manifest','{}')||jsonb_build_object('store_id',p_store_id,'theme_id',p_theme_slug,
    'release_id',v_release.release_id,'release_version',v_release.release_version,'theme_instance_id',i.id,'theme_package_version_id',i.theme_package_version_id);
   UPDATE public.theme_releases SET release_manifest=v_manifest,asset_manifest=coalesce(p_runtime->'asset_manifest','{}'),
    settings_snapshot=coalesce(v_config->'themeSettings','{}'),template_snapshot=v_config,
    idempotency_key=p_key WHERE id=v_release.release_id AND store_id=p_store_id;
   v_response:=jsonb_build_object('version',v_next,'template_key',p_template_key,'release',jsonb_build_object('release_id',v_release.release_id,'release_version',v_release.release_version,'published_at',to_char(v_release.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),'published_at',to_char(v_release.published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'theme',jsonb_build_object('id',t.id,'slug',t.slug,'name',t.name),'store',(SELECT jsonb_build_object('id',x.id,'status',x.status,'theme_id',x.theme_id,
     'current_theme_release_id',x.current_theme_release_id,'storefront_release_version',x.storefront_release_version,'updated_at',to_char(x.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) FROM public.sites x WHERE id=p_store_id));
  ELSE
   UPDATE public.theme_instance_drafts SET draft_status='discarded',deleted_at=v_now,updated_at=v_now,updated_by=p_actor_id WHERE id=d.id AND store_id=p_store_id;
   v_response:=jsonb_build_object('deleted',true,'version',v_next,'template_key',p_template_key);
   INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,request_id,actor_id,schema_version)
    VALUES(p_store_id,p_store_id,'theme_draft',d.id::text,'theme.draft.discarded',jsonb_build_object('store_id',p_store_id,'theme_id',p_theme_slug,'template_key',p_template_key,
     'draft_id',d.id,'version',v_next),'theme.draft.discarded:'||i.id::text||':'||v_next,p_request_id,p_actor_id,1);
  END IF;
  INSERT INTO public.theme_draft_patches(draft_id,store_id,patch_sequence,patch_type,operation,path,value,previous_value,actor_id,request_id,client_revision,server_revision,metadata)
   VALUES(d.id,p_store_id,v_next,CASE WHEN p_operation='discard' THEN 'delete' ELSE 'set' END,
    jsonb_build_object('op',p_operation,'path','/'), '/',CASE WHEN p_operation='publish' THEN v_config ELSE NULL END,v_config,
    p_actor_id,p_request_id,p_base_version,v_next,jsonb_build_object('template_key',p_template_key,'idempotency_key',p_key,'disposition',p_operation));
  UPDATE public.theme_instance_drafts SET draft_version=v_next WHERE id=d.id AND store_id=p_store_id;
  -- End the whole canonical document; retaining revision and tombstones prevents
  -- an old editor from reviving a previously used version after discard/publish.
  UPDATE public.theme_editor_drafts SET deleted_at=v_now,version=v_next,updated_at=v_now,updated_by=p_actor_id
   WHERE store_id=p_store_id AND theme_id=p_theme_slug;
  UPDATE public.theme_instances SET draft_revision=v_next,current_draft_id=NULL,updated_at=v_now,updated_by=p_actor_id WHERE id=i.id AND store_id=p_store_id;
 END IF;
 INSERT INTO public.audit_activity_events(store_id,actor_id,actor_type,action,resource_type,resource_id,request_id,before_state,after_state,metadata)
  VALUES(p_store_id,p_actor_id,CASE WHEN s.custom_user_id=p_actor_id OR s.user_id=p_actor_id THEN 'user' ELSE 'employee' END,
   'theme.draft.'||p_operation,'theme_draft',coalesce(d.id,e.id)::text,p_request_id,jsonb_build_object('version',v_current),jsonb_build_object('version',v_next),
   jsonb_build_object('theme_id',p_theme_slug,'template_key',p_template_key,'idempotency_key',p_key));
 INSERT INTO public.idempotency_keys(site_id,key,scope,request_hash,response_hash,response_body,status,status_code,resource_type,resource_id,request_id,expires_at)
  VALUES(p_store_id,p_key,v_scope,v_hash,encode(sha256(convert_to(v_response::text,'UTF8')),'hex'),v_response,'completed',200,'theme_draft',d.id,p_request_id,'infinity');
 RETURN v_response||jsonb_build_object('replayed',false,'current_version',v_next);
END $fn$;
-- Compare the live CHECK with PostgreSQL-normalized reviewed expressions.
-- A native table lock fences both inspection and replacement. No data is rewritten.
LOCK TABLE public.theme_editor_drafts IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE letbuyy_template_key_contract_384(template_key text,
 CONSTRAINT expected_old CHECK (template_key ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
 CONSTRAINT expected_canonical CHECK (char_length(template_key) BETWEEN 1 AND 120
 AND template_key NOT IN('__proto__','constructor','prototype')
 AND template_key ~ '^[a-z0-9][a-z0-9_./-]*$'
 AND position('..' IN template_key)=0 AND position('//' IN template_key)=0
 AND (position('.' IN template_key)=0 OR split_part(template_key,'.',2)=''
      OR substring(template_key FROM position('.' IN template_key)+1) ~ '^[a-z0-9][a-z0-9_-]*$'))) ON COMMIT DROP;
DO $template_check_profile$
DECLARE current_check pg_catalog.pg_constraint%ROWTYPE;
BEGIN
 SELECT * INTO current_check FROM pg_catalog.pg_constraint
  WHERE conrelid='public.theme_editor_drafts'::regclass AND conname='theme_editor_drafts_template_key_check';
 IF current_check.oid IS NULL OR current_check.contype<>'c' OR NOT current_check.convalidated OR current_check.connoinherit
 OR pg_catalog.pg_get_expr(current_check.conbin,current_check.conrelid) NOT IN
  (SELECT pg_catalog.pg_get_expr(c.conbin,c.conrelid) FROM pg_catalog.pg_constraint c
   WHERE c.conrelid='pg_temp.letbuyy_template_key_contract_384'::regclass) THEN
  RAISE EXCEPTION 'Migration384 refuses unknown template key CHECK';
 END IF;
END $template_check_profile$;
ALTER TABLE public.theme_editor_drafts DROP CONSTRAINT theme_editor_drafts_template_key_check;
ALTER TABLE public.theme_editor_drafts ADD CONSTRAINT theme_editor_drafts_template_key_check CHECK (char_length(template_key) BETWEEN 1 AND 120
 AND template_key NOT IN('__proto__','constructor','prototype')
 AND template_key ~ '^[a-z0-9][a-z0-9_./-]*$'
 AND position('..' IN template_key)=0 AND position('//' IN template_key)=0
 AND (position('.' IN template_key)=0 OR split_part(template_key,'.',2)=''
      OR substring(template_key FROM position('.' IN template_key)+1) ~ '^[a-z0-9][a-z0-9_-]*$'));
NOTIFY pgrst,'reload schema';
COMMIT;
