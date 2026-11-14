-- Platform authoring extends the canonical account notifications inbox. No external sends.
BEGIN;
CREATE TABLE public.merchant_announcements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,body text NOT NULL,
 category text NOT NULL CHECK(category IN('ad_campaigns','offers','regulations','platform_updates')),
 action_url text,expires_at timestamptz,audience_mode text NOT NULL CHECK(audience_mode IN('all','selected')),
 target_user_ids uuid[] NOT NULL DEFAULT '{}',status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),published_at timestamptz,published_count integer NOT NULL DEFAULT 0 CHECK(published_count>=0),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz,
 created_by uuid NOT NULL,updated_by uuid,deleted_by uuid,
 CHECK(length(btrim(title)) BETWEEN 3 AND 160 AND length(btrim(body)) BETWEEN 3 AND 8000),
 CHECK((audience_mode='all' AND cardinality(target_user_ids)=0) OR(audience_mode='selected' AND cardinality(target_user_ids) BETWEEN 1 AND 500)),
 CHECK((status='draft' AND published_at IS NULL AND published_count=0) OR(status='published' AND published_at IS NOT NULL))
);
CREATE INDEX merchant_announcements_queue_idx ON public.merchant_announcements(status,created_at DESC,id DESC) WHERE deleted_at IS NULL;
CREATE TABLE public.merchant_announcement_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL,operation text NOT NULL CHECK(operation IN('save','publish')),
 announcement_id uuid NOT NULL REFERENCES public.merchant_announcements(id) ON DELETE RESTRICT,request_key uuid NOT NULL,request_hash text NOT NULL,response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),deleted_at timestamptz,created_by uuid,updated_by uuid,deleted_by uuid,
 UNIQUE(actor_id,announcement_id,request_key)
);
ALTER TABLE public.merchant_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_announcements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_announcement_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_announcement_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_message_custody ON public.merchant_announcements TO postgres USING(true) WITH CHECK(true);
CREATE POLICY platform_message_receipt_custody ON public.merchant_announcement_receipts TO postgres USING(true) WITH CHECK(true);
REVOKE ALL ON public.merchant_announcements,public.merchant_announcement_receipts FROM PUBLIC,anon,authenticated,app_tenant,service_role;
CREATE UNIQUE INDEX notifications_platform_message_recipient_uidx ON public.notifications(user_id,(data->>'merchant_announcement_id')) WHERE data->>'source'='letbuyy_platform';
CREATE INDEX notifications_platform_inbox_idx ON public.notifications(user_id,created_at DESC,id DESC) WHERE deleted_at IS NULL AND data->>'source'='letbuyy_platform';
CREATE FUNCTION public.guard_platform_message_notification_v1() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.data->>'source'='letbuyy_platform' THEN RAISE EXCEPTION 'Platform inbox evidence is retained; dismiss instead' USING ERRCODE='42501';END IF;RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND OLD.data->>'source'='letbuyy_platform' THEN
  IF (to_jsonb(NEW)-'is_read'-'deleted_at') IS DISTINCT FROM(to_jsonb(OLD)-'is_read'-'deleted_at') THEN RAISE EXCEPTION 'Published inbox content is immutable' USING ERRCODE='42501';END IF;RETURN NEW;
 END IF;
 IF NEW.data->>'source'='letbuyy_platform' THEN
  IF current_user NOT IN('postgres','service_role') OR NOT EXISTS(SELECT 1 FROM public.merchant_announcements a WHERE a.id=(NEW.data->>'merchant_announcement_id')::uuid AND a.status='published'
   AND NEW.title=a.title AND NEW.message=a.body AND NEW.action_url IS NOT DISTINCT FROM a.action_url) THEN
   RAISE EXCEPTION 'Platform inbox author required' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER guard_platform_message_notification_v1 BEFORE INSERT OR UPDATE OR DELETE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.guard_platform_message_notification_v1();
CREATE FUNCTION public.merchant_message_audience_v1(p_mode text,p_ids uuid[]) RETURNS uuid[] LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT coalesce(array_agg(u.id ORDER BY u.id),'{}'::uuid[]) FROM public.users_custom u WHERE
  (EXISTS(SELECT 1 FROM public.principals p WHERE p.legacy_user_id=u.id AND p.realm='merchant' AND p.actor_type='merchant' AND p.status='active' AND p.deleted_at IS NULL)
   OR EXISTS(SELECT 1 FROM public.sites s WHERE s.deleted_at IS NULL AND(u.id=s.custom_user_id OR u.id=s.user_id)))
  AND NOT EXISTS(SELECT 1 FROM public.principals p WHERE p.legacy_user_id=u.id AND p.realm='merchant' AND(p.status IN('locked','disabled') OR p.deleted_at IS NOT NULL))
  AND(p_mode='all' OR u.id=ANY(p_ids));
$$;
CREATE FUNCTION public.console_merchant_messages_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,p_operation text,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE permission jsonb;state jsonb;actor uuid;item public.merchant_announcements;receipt public.merchant_announcement_receipts;
 ident uuid;req uuid;payload jsonb;fingerprint text;result jsonb;ids uuid[];target_ids uuid[];audience_hash text;total bigint;rows jsonb;
 page_no integer;page_size integer;term text;source jsonb;count_read bigint;reason text;observed timestamptz:=clock_timestamp();
BEGIN
 IF p_operation IS NULL OR p_operation NOT IN('list','accounts','get','review','save','publish','recover') OR p_input IS NULL OR jsonb_typeof(p_input)<>'object' THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_INVALID');END IF;
 permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,p_operation='publish');
 IF NOT coalesce((permission->>'accepted')::boolean,false) THEN RETURN permission;END IF;
 IF permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED');END IF;
 state:=permission->'session';actor:=(state->>'actor_id')::uuid;
 IF NOT coalesce((state->>'is_super_admin')::boolean,false) THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_ADMIN_REQUIRED');END IF;
 IF p_operation IN('list','accounts') THEN
  page_no:=coalesce((p_input->>'page')::integer,1);page_size:=coalesce((p_input->>'limit')::integer,25);term:=coalesce(p_input->>'q','');
  IF page_no NOT BETWEEN 1 AND 10000 OR page_size NOT BETWEEN 1 AND 50 OR length(term)>120 OR coalesce(p_input->>'status','draft') NOT IN('draft','published') THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_INVALID');END IF;
  term:='%'||replace(replace(replace(term,'\','\\'),'%','\%'),'_','\_')||'%';
  IF p_operation='accounts' THEN
   ids:=public.merchant_message_audience_v1('all','{}');
   SELECT count(*) INTO total FROM public.users_custom u WHERE u.id=ANY(ids) AND(u.email ILIKE term OR u.full_name ILIKE term);
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM(SELECT u.id,u.email,u.full_name FROM public.users_custom u WHERE u.id=ANY(ids) AND(u.email ILIKE term OR u.full_name ILIKE term) ORDER BY u.created_at DESC,u.id DESC LIMIT page_size OFFSET((page_no-1)*page_size))x;
  ELSE
   SELECT count(*) INTO total FROM public.merchant_announcements a WHERE a.deleted_at IS NULL AND(a.title ILIKE term) AND(p_input->>'status' IS NULL OR a.status=p_input->>'status');
   SELECT coalesce(jsonb_agg(to_jsonb(x)-'deleted_at'-'deleted_by'-'created_by'-'updated_by'),'[]') INTO rows FROM(SELECT a.* FROM public.merchant_announcements a WHERE a.deleted_at IS NULL AND(a.title ILIKE term) AND(p_input->>'status' IS NULL OR a.status=p_input->>'status') ORDER BY a.created_at DESC,a.id DESC LIMIT page_size OFFSET((page_no-1)*page_size))x;
  END IF;
  result:=jsonb_build_object('items',rows,'total',total,'page',page_no,'limit',page_size,'has_next',page_no::bigint*page_size<total);
 ELSE
  ident:=(p_input->>'id')::uuid;
  IF ident IS NULL THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_INVALID');END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(ident::text,0));
  SELECT * INTO item FROM public.merchant_announcements WHERE id=ident AND deleted_at IS NULL FOR UPDATE;
  IF p_operation IN('save','publish','recover') THEN
   req:=(p_input->>'request_key')::uuid;
   IF req IS NULL THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_INVALID');END IF;
   -- One message lock serializes creates/updates/publish/recovery for this ID.
   SELECT * INTO receipt FROM public.merchant_announcement_receipts WHERE actor_id=actor AND announcement_id=ident AND request_key=req;
   IF p_operation='recover' THEN
    INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata) VALUES(actor,'employee','merchant.message.recover','merchant_announcement',ident,jsonb_build_object('request_key',req));
    RETURN jsonb_build_object('accepted',true,'data',jsonb_build_object('state',CASE WHEN receipt.id IS NULL THEN 'not_recorded' ELSE 'completed' END,'result',receipt.response));
   END IF;
   fingerprint:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex');
   IF receipt.id IS NOT NULL THEN
    IF receipt.request_hash<>fingerprint OR receipt.operation<>p_operation THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_KEY_CONFLICT');END IF;
    RETURN jsonb_build_object('accepted',true,'data',receipt.response,'replayed',true);
   END IF;
   reason:=btrim(coalesce(p_input->>'reason',''));
   IF length(reason) NOT BETWEEN 8 AND 1000 THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_INVALID');END IF;
  END IF;
  IF p_operation='save' THEN
   payload:=p_input->'content';SELECT coalesce(array_agg(value::uuid),'{}') INTO target_ids FROM jsonb_array_elements_text(payload->'target_user_ids');
   IF payload IS NULL OR jsonb_typeof(payload)<>'object' OR payload->>'title' IS NULL OR payload->>'body' IS NULL OR length(btrim(payload->>'title')) NOT BETWEEN 3 AND 160 OR length(btrim(payload->>'body')) NOT BETWEEN 3 AND 8000
    OR coalesce(payload->>'category','') NOT IN('ad_campaigns','offers','regulations','platform_updates') OR coalesce(payload->>'audience_mode','') NOT IN('all','selected')
    OR jsonb_typeof(payload->'target_user_ids') IS DISTINCT FROM 'array' OR cardinality(target_ids)>500
    OR(payload->>'audience_mode'='all' AND cardinality(target_ids)<>0) OR(payload->>'audience_mode'='selected' AND cardinality(target_ids)=0)
    OR(payload->>'action_url' IS NOT NULL AND(payload->>'action_url'!~'^https://[^[:space:]]+$' OR payload->>'action_url'~'^https://[^/]*@' OR length(payload->>'action_url')>2048)) THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_INVALID');END IF;
   IF item.id IS NULL THEN
    IF coalesce((p_input->>'expected_revision')::integer,-1)<>0 THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_CHANGED');END IF;
    INSERT INTO public.merchant_announcements(id,title,body,category,action_url,expires_at,audience_mode,target_user_ids,created_by,updated_by)
     VALUES(ident,btrim(payload->>'title'),btrim(payload->>'body'),payload->>'category',payload->>'action_url',(payload->>'expires_at')::timestamptz,payload->>'audience_mode',target_ids,actor,actor) RETURNING * INTO item;
   ELSE
    IF item.status<>'draft' OR item.revision IS DISTINCT FROM (p_input->>'expected_revision')::integer THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_CHANGED');END IF;
    UPDATE public.merchant_announcements SET title=btrim(payload->>'title'),body=btrim(payload->>'body'),category=payload->>'category',action_url=payload->>'action_url',expires_at=(payload->>'expires_at')::timestamptz,audience_mode=payload->>'audience_mode',target_user_ids=target_ids,revision=revision+1,updated_at=observed,updated_by=actor WHERE id=ident RETURNING * INTO item;
   END IF;
  ELSE
   IF item.id IS NULL THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_NOT_FOUND');END IF;
  END IF;
  IF p_operation IN('review','publish') THEN
   IF p_operation='publish' THEN
    IF item.status<>'draft' OR item.revision IS DISTINCT FROM(p_input->>'expected_revision')::integer THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_CHANGED');END IF;
    -- Hold existing eligible identities through commit; the immutable ID array is the actual fanout population.
    PERFORM u.id FROM public.users_custom u WHERE u.id=ANY(public.merchant_message_audience_v1(item.audience_mode,item.target_user_ids)) FOR SHARE;
    PERFORM s.id FROM public.sites s WHERE s.deleted_at IS NULL AND(item.audience_mode='all' OR s.custom_user_id=ANY(item.target_user_ids) OR s.user_id=ANY(item.target_user_ids)) FOR SHARE;
    PERFORM p.id FROM public.principals p WHERE p.realm='merchant' AND p.status='active' AND p.deleted_at IS NULL AND(item.audience_mode='all' OR p.legacy_user_id=ANY(item.target_user_ids)) FOR SHARE;
   END IF;
   IF item.status='published' THEN
    SELECT coalesce(array_agg(DISTINCT n.user_id ORDER BY n.user_id),'{}'::uuid[]) INTO ids FROM public.notifications n WHERE n.data->>'source'='letbuyy_platform' AND n.data->>'merchant_announcement_id'=ident::text;
   ELSE ids:=public.merchant_message_audience_v1(item.audience_mode,item.target_user_ids);END IF;
   audience_hash:=encode(sha256(convert_to(array_to_string(ids,','),'UTF8')),'hex');
   IF p_operation='publish' THEN
    IF cardinality(ids)=0 OR cardinality(ids)>10000 OR(item.audience_mode='selected' AND cardinality(ids)<>(SELECT count(DISTINCT id) FROM unnest(item.target_user_ids)id)) THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_AUDIENCE_INVALID');END IF;
    IF audience_hash IS DISTINCT FROM p_input->>'audience_hash' THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_AUDIENCE_CHANGED');END IF;
    IF item.expires_at IS NOT NULL AND item.expires_at<=observed THEN RETURN jsonb_build_object('accepted',false,'code','MESSAGE_EXPIRED');END IF;
    UPDATE public.merchant_announcements SET status='published',published_at=observed,published_count=cardinality(ids),revision=revision+1,updated_at=observed,updated_by=actor WHERE id=ident RETURNING * INTO item;
    INSERT INTO public.notifications(user_id,type,title,message,action_url,data)
     SELECT id,'system',item.title,item.body,item.action_url,jsonb_build_object('source','letbuyy_platform','merchant_announcement_id',item.id,'category',item.category,'expires_at',item.expires_at,'published_at',item.published_at) FROM unnest(ids)id;
   END IF;
   SELECT count(*) INTO count_read FROM public.notifications n WHERE n.data->>'merchant_announcement_id'=ident::text AND n.data->>'source'='letbuyy_platform' AND n.is_read;
   SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO rows FROM(SELECT u.id,u.email,u.full_name FROM public.users_custom u WHERE u.id=ANY(ids) ORDER BY u.id LIMIT 5)x;
   result:=jsonb_build_object('message',to_jsonb(item)-'deleted_at'-'deleted_by'-'created_by'-'updated_by','recipient_count',cardinality(ids),'audience_hash',audience_hash,'sample',rows,'marked_read',count_read,'observed_at',observed);
  ELSE
   result:=jsonb_build_object('message',to_jsonb(item)-'deleted_at'-'deleted_by'-'created_by'-'updated_by');
  END IF;
 END IF;
 permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,p_operation='publish');
 IF NOT coalesce((permission->>'accepted')::boolean,false) OR permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN RAISE EXCEPTION 'Message authority changed during operation' USING ERRCODE='42501';END IF;
 INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
 VALUES(actor,'employee','merchant.message.'||p_operation,'merchant_announcement',ident,jsonb_build_object('reason',reason,'request_key',req,'recipient_count',cardinality(ids),'revision',item.revision,'page',page_no));
 IF p_operation IN('save','publish') THEN INSERT INTO public.merchant_announcement_receipts(actor_id,operation,announcement_id,request_key,request_hash,response,created_by) VALUES(actor,p_operation,ident,req,fingerprint,result,actor);END IF;
 RETURN jsonb_build_object('accepted',true,'data',result,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.guard_platform_message_notification_v1(),public.merchant_message_audience_v1(text,uuid[]),public.console_merchant_messages_v1(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated,app_tenant,service_role;
GRANT EXECUTE ON FUNCTION public.console_merchant_messages_v1(uuid,text,text,text,jsonb) TO service_role;
COMMIT;
