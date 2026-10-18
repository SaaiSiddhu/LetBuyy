-- 359 private-original intake. Default-off server profile; no provider, processing,
-- inspection, publication or deletion activation. Static literal DDL only.
BEGIN;
SET LOCAL search_path=pg_catalog,public,pg_temp;
SET LOCAL lock_timeout='5s';
LOCK TABLE pg_catalog.pg_proc,pg_catalog.pg_class,pg_catalog.pg_type,pg_catalog.pg_namespace IN SHARE ROW EXCLUSIVE MODE NOWAIT;
DO $prerequisites$
DECLARE prerequisite jsonb;
BEGIN
 IF current_user<>'postgres' OR current_setting('transaction_isolation')<>'read committed'
  OR current_setting('session_replication_role')<>'origin'
  OR EXISTS(SELECT 1 FROM pg_locks WHERE locktype='transactionid' AND mode='ExclusiveLock' AND granted AND(pid IS NULL OR pid<>pg_backend_pid()))
  OR EXISTS(SELECT 1 FROM pg_prepared_xacts) THEN RAISE EXCEPTION 'REEL_UPLOAD_MIGRATION_UNSAFE_WRITER';END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE proname~'(^|_)reel_upload_|^protect_reel_upload_')
  OR EXISTS(SELECT 1 FROM pg_class WHERE relname~'^_?reel_upload_')
  OR EXISTS(SELECT 1 FROM pg_type WHERE typname~'^_?reel_upload_') THEN RAISE EXCEPTION 'REEL_UPLOAD_MIGRATION_EXISTING_OR_NEWER_FAMILY';END IF;
 IF to_regprocedure('public.reel_actor_v1(uuid,uuid,jsonb,boolean)') IS NULL
  OR to_regprocedure('public.validate_and_rotate_merchant_session(text,boolean,integer,integer)') IS NULL
  OR to_regclass('public.reel_asset_provenance') IS NULL THEN RAISE EXCEPTION 'REEL_UPLOAD_MIGRATION_PREREQUISITE';END IF;

 FOR prerequisite IN SELECT value FROM jsonb_array_elements($frozen_helpers$[{"acl":["postgres=X/postgres","service_role=X/postgres"],"kind":"f","owner":"postgres","config":["search_path=pg_catalog, public"],"result":"jsonb","strict":false,"body_md5":"b2c5009020c5993bc443250ea314e457","defaults":"NULL::jsonb","language":"plpgsql","parallel":"u","leakproof":false,"signature":"mutate_reel_review_v1(uuid,uuid,uuid,jsonb,jsonb)","volatility":"v","input_names":["p_actor","p_site","p_reel","p_command","p_console"],"returns_set":false,"security_definer":true,"definition_md5":"9e443d58433ade19e2efac97557d3993"},{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","config":null,"result":"trigger","strict":false,"body_md5":"6164422dd7400ef9681e3ac058f9ed9b","defaults":null,"language":"plpgsql","parallel":"u","leakproof":false,"signature":"protect_reel_record_v1()","volatility":"v","input_names":[],"returns_set":false,"security_definer":false,"definition_md5":"36a0735f3cf4a4309551e6340e05841c"},{"acl":["postgres=X/postgres","service_role=X/postgres"],"kind":"f","owner":"postgres","config":["search_path=pg_catalog, public"],"result":"jsonb","strict":false,"body_md5":"385edefbc18555e10b669430c3aaac02","defaults":"NULL::uuid, NULL::jsonb, 1","language":"plpgsql","parallel":"u","leakproof":false,"signature":"read_reel_reviews_v1(uuid,uuid,uuid,jsonb,integer)","volatility":"v","input_names":["p_actor","p_site","p_reel","p_console","p_page"],"returns_set":false,"security_definer":true,"definition_md5":"606eb4e368c8270fad0ad6c5828cd201"},{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","config":["search_path=pg_catalog, public"],"result":"uuid","strict":false,"body_md5":"d99d69c697e36990561e8cfbb600d511","defaults":null,"language":"plpgsql","parallel":"u","leakproof":false,"signature":"reel_actor_v1(uuid,uuid,jsonb,boolean)","volatility":"v","input_names":["p_actor","p_site","p_console","p_write"],"returns_set":false,"security_definer":true,"definition_md5":"f6dcb9321e8c66866659c53d2d5e3d26"},{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","config":["search_path=pg_catalog, public"],"result":"text","strict":false,"body_md5":"0010259af51e8762637125afceb690a3","defaults":null,"language":"sql","parallel":"u","leakproof":false,"signature":"reel_json_compact_v1(json)","volatility":"i","input_names":["p_value"],"returns_set":false,"security_definer":false,"definition_md5":"a4f01cc2da87dd6bfe9a7bff28dbda4b"},{"acl":["postgres=X/postgres"],"kind":"f","owner":"postgres","config":["search_path=pg_catalog, public"],"result":"text","strict":false,"body_md5":"a0391dd81ec416922ce8c016c2b6460c","defaults":null,"language":"plpgsql","parallel":"u","leakproof":false,"signature":"reel_payload_v1(uuid,jsonb)","volatility":"v","input_names":["p_site","p_selection"],"returns_set":false,"security_definer":true,"definition_md5":"904696528e249aa246588666da541238"}]$frozen_helpers$::jsonb) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.'||(prerequisite->>'signature'))
   AND p.proowner='postgres'::regrole AND md5(pg_get_functiondef(p.oid))=prerequisite->>'definition_md5'
   AND to_jsonb(p.proacl)=prerequisite->'acl') THEN RAISE EXCEPTION 'REEL_UPLOAD_MIGRATION_FROZEN_HELPER_DRIFT';END IF;
 END LOOP;
END $prerequisites$;
CREATE FUNCTION public.reel_upload_row_valid_v1(p_state text,p_version integer,p_bytes bigint,p_sha text,p_mime text,p_key text,p_filename text,p_digest text,p_charge bigint,p_lease text,p_until timestamp with time zone,p_media uuid,p_provenance uuid,p_object_version text,p_completion text,p_error text) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $intake$
 SELECT coalesce(
 p_state IN('reserved','receiving','transfer_unknown','received_unprocessed','expired')
 AND p_version BETWEEN 1 AND 999999999 AND p_bytes BETWEEN 16 AND 9007199254740991 AND p_charge=p_bytes
 AND p_sha~'^[a-f0-9]{64}$' AND p_digest~'^[a-f0-9]{64}$' AND p_mime IN('video/mp4','video/webm')
 AND length(p_key) BETWEEN 8 AND 200 AND p_key=btrim(p_key) AND p_key!~'[[:space:][:cntrl:]]'
 AND length(p_filename) BETWEEN 1 AND 180 AND p_filename=btrim(p_filename) AND p_filename!~'[[:cntrl:]]'
 AND ((p_lease IS NULL)=(p_until IS NULL)) AND(p_lease IS NULL OR p_lease~'^[a-f0-9]{64}$')
 AND(p_state<>'receiving' OR p_lease IS NOT NULL)
 AND((p_state='received_unprocessed')=(p_media IS NOT NULL AND p_provenance IS NOT NULL AND p_object_version IS NOT NULL AND p_completion IS NOT NULL))
 AND(p_state='received_unprocessed' OR(p_media IS NULL AND p_provenance IS NULL AND p_object_version IS NULL AND p_completion IS NULL))
 AND(p_object_version IS NULL OR p_object_version~'^[A-Za-z0-9._:-]{1,196}$')
 AND(p_completion IS NULL OR p_completion~'^[a-f0-9]{64}$')
 AND(p_error IS NULL OR p_error='REEL_UPLOAD_TRANSFER_UNCERTAIN'),false);
$intake$;
CREATE TABLE public.reel_upload_intents (
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 site_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 session_id uuid NOT NULL,
 idempotency_key text NOT NULL,
 request_sha256 text NOT NULL,
 filename text NOT NULL,
 content_type text NOT NULL,
 size_bytes bigint NOT NULL,
 checksum_sha256 text NOT NULL,
 profile_ref text NOT NULL,
 profile_digest text NOT NULL,
 admission jsonb NOT NULL,
 object_nonce uuid NOT NULL DEFAULT gen_random_uuid(),
 state text NOT NULL DEFAULT 'reserved'::text,
 version integer NOT NULL DEFAULT 1,
 charged_bytes bigint NOT NULL,
 expires_at timestamp with time zone NOT NULL,
 lease_sha256 text,
 lease_expires_at timestamp with time zone,
 media_asset_id uuid,
 provenance_id uuid,
 object_version text,
 completion_sha256 text,
 last_error_code text,
 created_by uuid NOT NULL,
 updated_by uuid NOT NULL,
 created_at timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
 deleted_at timestamp with time zone,
 CONSTRAINT reel_upload_intents_pkey PRIMARY KEY(id),
 CONSTRAINT reel_upload_intents_request_key UNIQUE(site_id,actor_id,idempotency_key),
 CONSTRAINT reel_upload_intents_site_fkey FOREIGN KEY(site_id) REFERENCES public.sites(id) ON DELETE RESTRICT,
 CONSTRAINT reel_upload_intents_actor_fkey FOREIGN KEY(actor_id) REFERENCES public.users_custom(id) ON DELETE RESTRICT,
 CONSTRAINT reel_upload_intents_session_fkey FOREIGN KEY(session_id) REFERENCES public.sessions(id) ON DELETE RESTRICT,
 CONSTRAINT reel_upload_intents_media_fkey FOREIGN KEY(media_asset_id) REFERENCES public.media_assets(id) ON DELETE RESTRICT,
 CONSTRAINT reel_upload_intents_provenance_fkey FOREIGN KEY(provenance_id) REFERENCES public.reel_asset_provenance(id) ON DELETE RESTRICT,
 CONSTRAINT reel_upload_intents_valid CHECK(public.reel_upload_row_valid_v1(state,version,size_bytes,checksum_sha256,content_type,idempotency_key,filename,profile_digest,charged_bytes,lease_sha256,lease_expires_at,media_asset_id,provenance_id,object_version,completion_sha256,last_error_code))
);
ALTER TABLE public.reel_upload_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reel_upload_intents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON public.reel_upload_intents FOR SELECT TO app_tenant USING(site_id=public.current_site_id());
REVOKE ALL ON TABLE public.reel_upload_intents FROM PUBLIC,anon,authenticated,app_tenant,service_role;
CREATE INDEX reel_upload_intents_site_page_idx ON public.reel_upload_intents(site_id,created_at,id);
CREATE FUNCTION public.protect_reel_upload_intent_v1() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $intake$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'REEL_UPLOAD_RETAINED_RECORD';END IF;
 IF ROW(NEW.id,NEW.site_id,NEW.actor_id,NEW.session_id,NEW.idempotency_key,NEW.request_sha256,NEW.filename,NEW.content_type,NEW.size_bytes,NEW.checksum_sha256,NEW.profile_ref,NEW.profile_digest,NEW.admission,NEW.object_nonce,NEW.charged_bytes,NEW.expires_at,NEW.created_at,NEW.created_by,NEW.deleted_at)
  IS DISTINCT FROM ROW(OLD.id,OLD.site_id,OLD.actor_id,OLD.session_id,OLD.idempotency_key,OLD.request_sha256,OLD.filename,OLD.content_type,OLD.size_bytes,OLD.checksum_sha256,OLD.profile_ref,OLD.profile_digest,OLD.admission,OLD.object_nonce,OLD.charged_bytes,OLD.expires_at,OLD.created_at,OLD.created_by,OLD.deleted_at)
  OR OLD.state='received_unprocessed' OR NEW.version<>OLD.version+1 OR NEW.updated_at<OLD.updated_at
  OR NOT((OLD.state='reserved' AND NEW.state IN('receiving','expired'))
    OR(OLD.state='receiving' AND NEW.state IN('receiving','transfer_unknown','received_unprocessed'))
    OR(OLD.state='transfer_unknown' AND NEW.state='receiving')) THEN
  RAISE EXCEPTION 'REEL_UPLOAD_IMMUTABLE_OR_INVALID_TRANSITION';END IF;
 RETURN NEW;
END
$intake$;
CREATE TRIGGER protect_reel_upload_intent BEFORE UPDATE OR DELETE ON public.reel_upload_intents FOR EACH ROW EXECUTE FUNCTION public.protect_reel_upload_intent_v1();
CREATE FUNCTION public.reel_upload_public_v1(p_row jsonb,p_replayed boolean) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $intake$
 SELECT jsonb_build_object('id',p_row->'id','site_id',p_row->'site_id','state',p_row->'state','version',p_row->'version',
  'filename',p_row->'filename','content_type',p_row->'content_type','size_bytes',p_row->'size_bytes','checksum_sha256',p_row->'checksum_sha256',
  'idempotency_key',p_row->'idempotency_key','expires_at',p_row->'expires_at','created_at',p_row->'created_at','updated_at',p_row->'updated_at',
  'media_asset_id',p_row->'media_asset_id','provenance_id',p_row->'provenance_id','processing_available',false,'inspection_available',false,'replayed',p_replayed);
$intake$;
CREATE FUNCTION public.reel_upload_event_v1(p_row jsonb,p_action text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $intake$
BEGIN
 INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
 VALUES((p_row->>'updated_by')::uuid,'user','reel.upload.'||p_action,'reel_upload',(p_row->>'id')::uuid,jsonb_build_object('site_id',(p_row->>'site_id')::uuid,'state',(p_row->'state'),'version',(p_row->'version')));
 INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,actor_id)
 VALUES((p_row->>'site_id')::uuid,(p_row->>'site_id')::uuid,'media',(p_row->>'id')::uuid::text,'reel.upload.changed',
  jsonb_build_object('site_id',(p_row->>'site_id')::uuid,'intent_id',(p_row->>'id')::uuid,'state',(p_row->'state'),'version',(p_row->'version')),
  'reel-upload:'||(p_row->>'id')::uuid::text||':'||(p_row->'version')::text,(p_row->>'updated_by')::uuid);
END
$intake$;
CREATE FUNCTION public.reel_upload_backend_v1(p_session text,p_actor uuid,p_site uuid,p_action text,p_intent uuid,p_command jsonb,p_admission jsonb,p_evidence jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $intake$
DECLARE
 v_auth record;v_actor uuid;v_row public.reel_upload_intents;v_replayed boolean:=false;
 v_hash text;v_proof_hash text;v_key text;v_now timestamptz;v_bytes bigint;v_count bigint;v_charged numeric;
 v_media uuid;v_provenance uuid;v_internal jsonb;
BEGIN
 -- Preserve the canonical session helper's protective reuse revocations: a
 -- rejected session returns an error result instead of aborting its updates.
 SELECT * INTO v_auth FROM public.validate_and_rotate_merchant_session(p_session,false);
 IF NOT coalesce(v_auth.accepted,false) OR v_auth.user_id IS DISTINCT FROM p_actor THEN RETURN jsonb_build_object('status',401,'error','REEL_UPLOAD_SESSION_REQUIRED');END IF;
 v_actor:=public.reel_actor_v1(v_auth.user_id,p_site,NULL,p_action NOT IN('read','list'));
 PERFORM set_config('app.site_id',p_site::text,true);
 IF p_action NOT IN('begin','read','list','claim_transfer','claim_reconcile','finish','unknown') OR p_site IS NULL THEN RAISE EXCEPTION 'REEL_UPLOAD_REQUEST_INVALID';END IF;
 IF p_action='list' THEN
  RETURN jsonb_build_object('data',jsonb_build_object('items',(SELECT coalesce(jsonb_agg(public.reel_upload_public_v1(to_jsonb(x),false) ORDER BY x.created_at DESC,x.id),'[]'::jsonb)
   FROM(SELECT * FROM public.reel_upload_intents WHERE site_id=p_site AND actor_id=v_actor ORDER BY created_at DESC,id LIMIT 50)x)));
 END IF;
 IF p_action='read' THEN
  SELECT * INTO v_row FROM public.reel_upload_intents WHERE id=p_intent AND site_id=p_site AND actor_id=v_actor;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'REEL_UPLOAD_NOT_FOUND';END IF;
  RETURN jsonb_build_object('data',public.reel_upload_public_v1(to_jsonb(v_row),false));
 END IF;
 IF p_command IS NULL OR jsonb_typeof(p_command) IS DISTINCT FROM 'object'
  OR jsonb_typeof(p_command->'idempotency_key') IS DISTINCT FROM 'string'
  OR length(p_command->>'idempotency_key') NOT BETWEEN 8 AND 200
  OR p_command->>'idempotency_key'<>btrim(p_command->>'idempotency_key')
  OR(p_command->>'idempotency_key')~'[[:space:][:cntrl:]]' THEN RAISE EXCEPTION 'REEL_UPLOAD_REQUEST_INVALID';END IF;
 v_key:=p_command->>'idempotency_key';
 -- Admission is supplied only by the trusted Gateway profile resolver. It is
 -- never accepted in client JSON. It contains no invented fallback budgets.
 IF p_admission IS NULL OR jsonb_typeof(p_admission) IS DISTINCT FROM 'object'
  OR p_admission-ARRAY['profile_ref','profile_digest','max_bytes','max_intents','max_charged_bytes','reservation_ttl_seconds','lease_seconds','max_wall_ms']<>'{}'::jsonb
  OR jsonb_typeof(p_admission->'profile_ref') IS DISTINCT FROM 'string' OR length(p_admission->>'profile_ref') NOT BETWEEN 1 AND 200
  OR coalesce(p_admission->>'profile_digest','')!~'^[a-f0-9]{64}$'
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['max_bytes','max_intents','max_charged_bytes','reservation_ttl_seconds','lease_seconds','max_wall_ms']) AS limits(name)
    WHERE jsonb_typeof(p_admission->limits.name) IS DISTINCT FROM 'number' OR coalesce(p_admission->>limits.name,'')!~'^[1-9][0-9]{0,15}$')
 THEN RAISE EXCEPTION 'REEL_UPLOAD_PROFILE_UNAVAILABLE';END IF;
 IF(p_admission->>'max_bytes')::numeric>9007199254740991 OR(p_admission->>'max_charged_bytes')::numeric>9007199254740991
  OR(p_admission->>'max_intents')::numeric>2147483647 OR(p_admission->>'reservation_ttl_seconds')::numeric>2147483647
  OR(p_admission->>'lease_seconds')::numeric>2147483647 OR(p_admission->>'max_wall_ms')::numeric>2147483647
  OR(p_admission->>'lease_seconds')::numeric*1000<=(p_admission->>'max_wall_ms')::numeric THEN RAISE EXCEPTION 'REEL_UPLOAD_PROFILE_UNAVAILABLE';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:private-reel-intake:'||p_site::text,0));
 v_now:=clock_timestamp();
 IF p_action='begin' THEN
  IF p_command-ARRAY['idempotency_key','filename','content_type','size_bytes','checksum_sha256']<>'{}'::jsonb
   OR jsonb_typeof(p_command->'filename') IS DISTINCT FROM 'string' OR length(p_command->>'filename') NOT BETWEEN 1 AND 180
   OR p_command->>'filename'<>btrim(p_command->>'filename') OR(p_command->>'filename')~'[[:cntrl:]]'
   OR jsonb_typeof(p_command->'content_type') IS DISTINCT FROM 'string' OR jsonb_typeof(p_command->'checksum_sha256') IS DISTINCT FROM 'string'
   OR coalesce(p_command->>'content_type','') NOT IN('video/mp4','video/webm')
   OR coalesce(p_command->>'checksum_sha256','')!~'^[a-f0-9]{64}$'
   OR jsonb_typeof(p_command->'size_bytes') IS DISTINCT FROM 'number' OR coalesce(p_command->>'size_bytes','')!~'^[1-9][0-9]{0,15}$'
  THEN RAISE EXCEPTION 'REEL_UPLOAD_REQUEST_INVALID';END IF;
  v_bytes:=(p_command->>'size_bytes')::bigint;
  IF v_bytes<16 OR v_bytes>(p_admission->>'max_bytes')::bigint OR v_bytes>9007199254740991 THEN RAISE EXCEPTION 'REEL_UPLOAD_LIMIT';END IF;
  v_hash:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
  SELECT * INTO v_row FROM public.reel_upload_intents WHERE site_id=p_site AND actor_id=v_actor AND idempotency_key=v_key FOR UPDATE;
  IF FOUND THEN
   IF v_row.request_sha256<>v_hash THEN RAISE EXCEPTION 'REEL_UPLOAD_IDEMPOTENCY_CONFLICT';END IF;
   IF v_row.admission IS DISTINCT FROM p_admission THEN RAISE EXCEPTION 'REEL_UPLOAD_PROFILE_CHANGED';END IF;
   RETURN jsonb_build_object('data',public.reel_upload_public_v1(to_jsonb(v_row),true));
  END IF;
  -- Every retained/uncertain intent remains charged; expiry is not authority to
  -- delete an original or free physical-storage capacity under an unknown PUT.
  SELECT count(*),coalesce(sum(charged_bytes),0) INTO v_count,v_charged FROM public.reel_upload_intents WHERE site_id=p_site;
  IF v_count>=(p_admission->>'max_intents')::bigint OR v_charged+v_bytes>(p_admission->>'max_charged_bytes')::bigint THEN RAISE EXCEPTION 'REEL_UPLOAD_QUOTA';END IF;
  INSERT INTO public.reel_upload_intents(site_id,actor_id,session_id,idempotency_key,request_sha256,filename,content_type,size_bytes,checksum_sha256,
   profile_ref,profile_digest,admission,charged_bytes,expires_at,created_by,updated_by)
  VALUES(p_site,v_actor,v_auth.session_id,v_key,v_hash,p_command->>'filename',p_command->>'content_type',v_bytes,p_command->>'checksum_sha256',
   p_admission->>'profile_ref',p_admission->>'profile_digest',p_admission,v_bytes,v_now+make_interval(secs=>(p_admission->>'reservation_ttl_seconds')::integer),v_actor,v_actor)
  RETURNING * INTO v_row;
  PERFORM public.reel_upload_event_v1(to_jsonb(v_row),'reserve');
  RETURN jsonb_build_object('data',public.reel_upload_public_v1(to_jsonb(v_row),false));
 END IF;
 IF p_command-ARRAY['idempotency_key','expected_version']<>'{}'::jsonb OR jsonb_typeof(p_command->'expected_version') IS DISTINCT FROM 'number' OR coalesce(p_command->>'expected_version','')!~'^[1-9][0-9]{0,8}$' THEN RAISE EXCEPTION 'REEL_UPLOAD_REQUEST_INVALID';END IF;
 SELECT * INTO v_row FROM public.reel_upload_intents WHERE id=p_intent AND site_id=p_site AND actor_id=v_actor FOR UPDATE;
 IF v_row.id IS NULL THEN RAISE EXCEPTION 'REEL_UPLOAD_NOT_FOUND';END IF;
 IF v_row.idempotency_key<>v_key THEN RAISE EXCEPTION 'REEL_UPLOAD_IDEMPOTENCY_CONFLICT';END IF;
 IF v_row.admission IS DISTINCT FROM p_admission THEN RAISE EXCEPTION 'REEL_UPLOAD_PROFILE_CHANGED';END IF;
 v_internal:=jsonb_build_object('object_nonce',v_row.object_nonce,'object_version',v_row.object_version,'profile_digest',v_row.profile_digest,
  'checksum_sha256',v_row.checksum_sha256,'size_bytes',v_row.size_bytes,'content_type',v_row.content_type);
 IF p_action IN('claim_transfer','claim_reconcile') THEN
  IF p_evidence IS NULL OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object' OR jsonb_typeof(p_evidence->'lease_token') IS DISTINCT FROM 'string' OR p_evidence-ARRAY['lease_token']<>'{}'::jsonb OR coalesce(p_evidence->>'lease_token','')!~'^[a-f0-9-]{36}$' THEN RAISE EXCEPTION 'REEL_UPLOAD_REQUEST_INVALID';END IF;
  IF v_row.state='received_unprocessed' THEN RETURN jsonb_build_object('data',public.reel_upload_public_v1(to_jsonb(v_row),true),'internal',v_internal);END IF;
  IF v_row.version<>(p_command->>'expected_version')::integer THEN RAISE EXCEPTION 'REEL_UPLOAD_VERSION_CONFLICT';END IF;
  IF v_row.state='expired' OR(p_action='claim_transfer' AND v_row.expires_at<=v_now) THEN
   IF v_row.state='reserved' THEN UPDATE public.reel_upload_intents SET state='expired',version=version+1,updated_at=v_now,updated_by=v_actor WHERE id=v_row.id RETURNING * INTO v_row;PERFORM public.reel_upload_event_v1(to_jsonb(v_row),'expire');END IF;
   RETURN jsonb_build_object('status',409,'error','REEL_UPLOAD_EXPIRED','data',public.reel_upload_public_v1(to_jsonb(v_row),false));
  END IF;
  IF v_row.state='receiving' AND v_row.lease_expires_at>v_now THEN RAISE EXCEPTION 'REEL_UPLOAD_BUSY';END IF;
  IF p_action='claim_reconcile' AND v_row.state='reserved' THEN RAISE EXCEPTION 'REEL_UPLOAD_OBJECT_UNCONFIRMED';END IF;
  UPDATE public.reel_upload_intents SET state='receiving',version=version+1,
   lease_sha256=encode(sha256(convert_to(p_evidence->>'lease_token','UTF8')),'hex'),
   lease_expires_at=v_now+make_interval(secs=>(p_admission->>'lease_seconds')::integer),last_error_code=NULL,
   updated_at=v_now,updated_by=v_actor WHERE id=v_row.id RETURNING * INTO v_row;
  PERFORM public.reel_upload_event_v1(to_jsonb(v_row),'claim');
  RETURN jsonb_build_object('data',public.reel_upload_public_v1(to_jsonb(v_row),false),'internal',v_internal);
 END IF;
 IF p_action='finish' THEN
  IF p_evidence IS NULL OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object'
   OR p_evidence-ARRAY['lease_token','object_key','object_version','actual_bytes','actual_sha256','content_type','profile_digest','verification_scope']<>'{}'::jsonb
   OR jsonb_typeof(p_evidence->'lease_token') IS DISTINCT FROM 'string'
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['object_key','object_version','actual_sha256','content_type','profile_digest','verification_scope']) fields(name) WHERE jsonb_typeof(p_evidence->fields.name) IS DISTINCT FROM 'string')
   OR p_evidence->>'verification_scope' IS DISTINCT FROM 'r2-private-original-bytes-v1'
   OR p_evidence->>'object_key' IS DISTINCT FROM 'private-reel-originals/'||p_site::text||'/'||v_row.id::text||'/'||v_row.object_nonce::text
   OR p_evidence->>'profile_digest' IS DISTINCT FROM v_row.profile_digest
   OR p_evidence->>'actual_sha256' IS DISTINCT FROM v_row.checksum_sha256
   OR p_evidence->>'content_type' IS DISTINCT FROM v_row.content_type
   OR jsonb_typeof(p_evidence->'actual_bytes') IS DISTINCT FROM 'number' OR coalesce(p_evidence->>'actual_bytes','')!~'^[1-9][0-9]{0,15}$'
   OR(p_evidence->>'actual_bytes')::numeric IS DISTINCT FROM v_row.size_bytes::numeric
   OR coalesce(p_evidence->>'object_version','')!~'^[A-Za-z0-9._:-]{1,196}$' THEN RAISE EXCEPTION 'REEL_UPLOAD_CUSTODY_PROOF_INVALID';END IF;
  v_proof_hash:=encode(sha256(convert_to((p_evidence-'lease_token')::text,'UTF8')),'hex');
  IF v_row.state='received_unprocessed' THEN
   IF v_row.completion_sha256 IS DISTINCT FROM v_proof_hash OR v_row.object_version IS DISTINCT FROM p_evidence->>'object_version' THEN RAISE EXCEPTION 'REEL_UPLOAD_COMPLETION_CONFLICT';END IF;
   -- Replay must still have the exact private canonical record pair; the live
   -- session/actor/site/staff checks above always precede this receipt path.
   IF NOT EXISTS(SELECT 1 FROM public.media_assets m JOIN public.reel_asset_provenance p ON p.media_asset_id=m.id
    WHERE m.id=v_row.media_asset_id AND p.id=v_row.provenance_id AND m.site_id=p_site AND p.site_id=p_site
     AND m.public_url IS NULL AND m.deleted_at IS NULL AND p.deleted_at IS NULL AND m.processing_status='pending'
     AND m.checksum_sha256=v_row.checksum_sha256 AND p.checksum_sha256=v_row.checksum_sha256
     AND m.asset_type='video' AND m.storage_provider='r2' AND m.object_key=p_evidence->>'object_key' AND m.storage_path=p_evidence->>'object_key'
     AND m.filename=v_row.filename AND m.content_type=v_row.content_type AND m.size_bytes=v_row.size_bytes AND m.source_channel='web'
     AND m.created_by=v_row.actor_id AND p.created_by=v_row.actor_id AND p.updated_by=v_row.actor_id AND p.kind='video'
     AND m.metadata=jsonb_build_object('source','private-reel-intake','object_version',v_row.object_version,'profile_digest',v_row.profile_digest)
     AND p.custody_verified_at<=clock_timestamp() AND p.asset_version='r2:'||v_row.object_version AND p.provider_asset_id IS NULL) THEN RAISE EXCEPTION 'REEL_UPLOAD_RECEIPT_UNAVAILABLE';END IF;
   RETURN jsonb_build_object('data',public.reel_upload_public_v1(to_jsonb(v_row),true));
  END IF;
  IF v_row.state<>'receiving' OR v_row.version<>(p_command->>'expected_version')::integer OR v_row.lease_expires_at<=v_now
   OR v_row.lease_sha256 IS DISTINCT FROM encode(sha256(convert_to(coalesce(p_evidence->>'lease_token',''),'UTF8')),'hex') THEN RAISE EXCEPTION 'REEL_UPLOAD_LEASE_CONFLICT';END IF;
  INSERT INTO public.media_assets(store_id,site_id,asset_type,storage_provider,storage_path,object_key,public_url,filename,content_type,size_bytes,
   checksum_sha256,processing_status,source_channel,metadata,created_by)
  VALUES(p_site,p_site,'video','r2',p_evidence->>'object_key',p_evidence->>'object_key',NULL,v_row.filename,v_row.content_type,v_row.size_bytes,
   v_row.checksum_sha256,'pending','web',jsonb_build_object('source','private-reel-intake','object_version',p_evidence->>'object_version','profile_digest',v_row.profile_digest),v_actor)
  RETURNING id INTO v_media;
  INSERT INTO public.reel_asset_provenance(site_id,media_asset_id,asset_version,checksum_sha256,kind,provider_asset_id,custody_verified_at,created_by,updated_by)
  VALUES(p_site,v_media,'r2:'||(p_evidence->>'object_version'),v_row.checksum_sha256,'video',NULL,v_now,v_actor,v_actor) RETURNING id INTO v_provenance;
  UPDATE public.reel_upload_intents SET state='received_unprocessed',version=version+1,media_asset_id=v_media,provenance_id=v_provenance,
   object_version=p_evidence->>'object_version',completion_sha256=v_proof_hash,lease_sha256=NULL,lease_expires_at=NULL,last_error_code=NULL,
   updated_at=v_now,updated_by=v_actor WHERE id=v_row.id RETURNING * INTO v_row;
  PERFORM public.reel_upload_event_v1(to_jsonb(v_row),'receive');
  RETURN jsonb_build_object('data',public.reel_upload_public_v1(to_jsonb(v_row),false));
 END IF;
 IF p_action='unknown' THEN
  IF p_evidence IS NULL OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object' OR jsonb_typeof(p_evidence->'lease_token') IS DISTINCT FROM 'string' OR p_evidence-ARRAY['lease_token']<>'{}'::jsonb THEN RAISE EXCEPTION 'REEL_UPLOAD_REQUEST_INVALID';END IF;
  IF v_row.state='received_unprocessed' THEN RETURN jsonb_build_object('data',public.reel_upload_public_v1(to_jsonb(v_row),true));END IF;
  IF v_row.state<>'receiving' OR v_row.version<>(p_command->>'expected_version')::integer
   OR v_row.lease_sha256 IS DISTINCT FROM encode(sha256(convert_to(coalesce(p_evidence->>'lease_token',''),'UTF8')),'hex') THEN RAISE EXCEPTION 'REEL_UPLOAD_LEASE_CONFLICT';END IF;
  UPDATE public.reel_upload_intents SET state='transfer_unknown',version=version+1,lease_sha256=NULL,lease_expires_at=NULL,
   last_error_code='REEL_UPLOAD_TRANSFER_UNCERTAIN',updated_at=v_now,updated_by=v_actor WHERE id=v_row.id RETURNING * INTO v_row;
  PERFORM public.reel_upload_event_v1(to_jsonb(v_row),'uncertain');
  RETURN jsonb_build_object('data',public.reel_upload_public_v1(to_jsonb(v_row),false));
 END IF;
 RAISE EXCEPTION 'REEL_UPLOAD_REQUEST_INVALID';
END
$intake$;
CREATE FUNCTION public.reel_upload_v1(p_session text,p_actor uuid,p_site uuid,p_action text,p_intent uuid,p_command jsonb,p_admission jsonb,p_evidence jsonb) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $intake$
 SELECT public.reel_upload_backend_v1(p_session,p_actor,p_site,p_action,p_intent,p_command,p_admission,p_evidence);
$intake$;
REVOKE ALL ON FUNCTION public.reel_upload_row_valid_v1(text,integer,bigint,text,text,text,text,text,bigint,text,timestamp with time zone,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.protect_reel_upload_intent_v1() FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.reel_upload_public_v1(jsonb,boolean) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.reel_upload_event_v1(jsonb,text) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.reel_upload_backend_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
REVOKE ALL ON FUNCTION public.reel_upload_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.reel_upload_backend_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.reel_upload_v1(text,uuid,uuid,text,uuid,jsonb,jsonb,jsonb) TO service_role;
-- Refuse custom default-ACL surprises before making any new definer/raw table
-- visible. The owner-only helpers and the two backend entrypoints are exact.
DO $intake_final_acl$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
  AND p.proname IN('reel_upload_row_valid_v1','protect_reel_upload_intent_v1','reel_upload_public_v1','reel_upload_event_v1','reel_upload_backend_v1','reel_upload_v1')
  AND (p.proowner<>'postgres'::regrole OR p.proacl IS DISTINCT FROM
   CASE WHEN p.proname IN('reel_upload_backend_v1','reel_upload_v1')
    THEN ARRAY['postgres=X/postgres','service_role=X/postgres']::aclitem[]
    ELSE ARRAY['postgres=X/postgres']::aclitem[] END))
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.reel_upload_intents'::regclass AND relowner='postgres'::regrole
  AND relrowsecurity AND relforcerowsecurity AND relacl=ARRAY['postgres=arwdDxt/postgres']::aclitem[]) THEN
 RAISE EXCEPTION 'REEL_UPLOAD_MIGRATION_UNEXPECTED_EFFECTIVE_ACL';END IF;
END $intake_final_acl$;
NOTIFY pgrst,'reload schema';
COMMIT;
