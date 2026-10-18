-- Canonical merchant staff invitation, explicit verified-account consent and durable delivery.
-- Ordinary worker control is fenced by323. Legacy platform invite rows remain separate.
BEGIN;
ALTER TABLE public.employee_invites
 ADD COLUMN store_id uuid REFERENCES public.sites(id) ON DELETE RESTRICT,
 ADD COLUMN employee_id uuid REFERENCES public.employees(id) ON DELETE RESTRICT,
 ADD COLUMN member_updated_at timestamptz,
 ADD COLUMN permissions_snapshot jsonb,
 ADD COLUMN store_name_snapshot text,
 ADD COLUMN accept_origin text,
 ADD COLUMN sender_snapshot text,
 ADD COLUMN revoked_at timestamptz,
 ADD COLUMN accepted_by uuid REFERENCES public.users_custom(id) ON DELETE RESTRICT;
ALTER TABLE public.employee_invites DROP CONSTRAINT employee_invites_role_check;
ALTER TABLE public.employee_invites ADD CONSTRAINT employee_invites_role_check CHECK(
 (store_id IS NULL AND role IN('support','sales','marketing','operations','manager','admin')) OR
 (store_id IS NOT NULL AND role IN('manager','editor','fulfillment','marketing','support','viewer','staff')));
ALTER TABLE public.employee_invites ADD CONSTRAINT employee_invites_merchant_context_check CHECK(store_id IS NULL OR(
 employee_id IS NOT NULL AND member_updated_at IS NOT NULL AND permissions_snapshot IS NOT NULL
 AND store_name_snapshot IS NOT NULL AND accept_origin IS NOT NULL AND sender_snapshot IS NOT NULL AND invited_by IS NOT NULL
 AND token ~ '^[a-f0-9]{64}$' AND((accepted_at IS NULL AND accepted_by IS NULL) OR(accepted_at IS NOT NULL AND accepted_by IS NOT NULL))));
CREATE INDEX employee_invites_member_pending_idx ON public.employee_invites(store_id,employee_id) WHERE accepted_at IS NULL AND revoked_at IS NULL;
ALTER TABLE public.platform_queue_jobs DROP CONSTRAINT platform_queue_jobs_queue_name_check;
ALTER TABLE public.platform_queue_jobs ADD CONSTRAINT platform_queue_jobs_queue_name_check CHECK(queue_name IN(
 'payment-events','inventory-jobs','webhook-deliveries','analytics-events','search-indexing','fulfillment-jobs','bulk-admin-jobs','notification-jobs'));
-- Existing hot-table mirroring is active. Keep its retained shadow compatible;
-- this changes no cutover, dispatch or source ownership.
ALTER TABLE public.platform_queue_jobs_partitioned DROP CONSTRAINT platform_queue_jobs_partitioned_queue_name_check;
ALTER TABLE public.platform_queue_jobs_partitioned ADD CONSTRAINT platform_queue_jobs_partitioned_queue_name_check CHECK(queue_name IN(
 'payment-events','inventory-jobs','webhook-deliveries','analytics-events','search-indexing','fulfillment-jobs','bulk-admin-jobs','notification-jobs'));


CREATE FUNCTION public.guard_merchant_staff_invitation_intent_v1() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
BEGIN
 IF OLD.store_id IS NULL AND NEW.store_id IS NOT NULL THEN RAISE EXCEPTION 'Legacy platform invitation cannot become a merchant invitation'; END IF;
 IF OLD.store_id IS NOT NULL THEN
  IF ROW(NEW.store_id,NEW.employee_id,NEW.email,NEW.role,NEW.token,NEW.invited_by,NEW.expires_at,NEW.member_updated_at,
    NEW.permissions_snapshot,NEW.store_name_snapshot,NEW.accept_origin,NEW.sender_snapshot)
    IS DISTINCT FROM ROW(OLD.store_id,OLD.employee_id,OLD.email,OLD.role,OLD.token,OLD.invited_by,OLD.expires_at,OLD.member_updated_at,
    OLD.permissions_snapshot,OLD.store_name_snapshot,OLD.accept_origin,OLD.sender_snapshot) THEN
   RAISE EXCEPTION 'Merchant invitation intent is immutable; reissue through the canonical owner'; END IF;
  IF OLD.accepted_at IS NOT NULL AND ROW(NEW.accepted_at,NEW.accepted_by) IS DISTINCT FROM ROW(OLD.accepted_at,OLD.accepted_by) THEN
   RAISE EXCEPTION 'Accepted merchant invitation cannot be rewritten'; END IF;
  IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN RAISE EXCEPTION 'Revoked merchant invitation cannot be reopened'; END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.guard_merchant_staff_invitation_intent_v1() FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.guard_merchant_staff_invitation_intent_v1() TO service_role;
CREATE TRIGGER guard_merchant_staff_invitation_intent_v1 BEFORE UPDATE ON public.employee_invites
 FOR EACH ROW EXECUTE FUNCTION public.guard_merchant_staff_invitation_intent_v1();

CREATE FUNCTION public.create_merchant_staff_invitation_v1(
 p_actor_id uuid,p_store_id uuid,p_intent jsonb,p_key text,p_invite_id uuid,p_token_hash text,p_expires_at timestamptz,
 p_accept_origin text,p_sender text,p_policy_hash text,p_seat_limit integer,
 p_employee_id uuid DEFAULT NULL,p_expected_updated_at timestamptz DEFAULT NULL,p_bound_site_id uuid DEFAULT NULL,p_request_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE v_site public.sites;v_actor public.users_custom;v_employee public.employees;v_before jsonb;v_policy jsonb;
 v_receipt public.idempotency_keys;v_hash text;v_scope text;v_used integer;v_invite public.employee_invites;v_response jsonb;v_constraint text;
BEGIN
 SELECT * INTO v_site FROM public.sites WHERE id=p_store_id AND deleted_at IS NULL FOR UPDATE;
 SELECT * INTO v_actor FROM public.users_custom WHERE id=p_actor_id;
 IF v_site.id IS NULL OR v_actor.id IS NULL OR NOT(coalesce(v_site.custom_user_id=p_actor_id,false) OR coalesce(v_site.user_id=p_actor_id,false))
  OR(p_bound_site_id IS NOT NULL AND p_bound_site_id<>p_store_id) THEN RETURN jsonb_build_object('error','FORBIDDEN','status',403); END IF;
 IF p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 200 OR p_intent IS NULL OR jsonb_typeof(p_intent)<>'object' THEN
  RETURN jsonb_build_object('error','VALIDATION','status',400); END IF;
 v_scope:='merchant-staff-invite-v1:'||p_actor_id::text||':issue';
 v_hash:=encode(sha256(convert_to(jsonb_build_object('actor',p_actor_id,'store',p_store_id,'intent',p_intent,
  'employee',p_employee_id,'expected',p_expected_updated_at)::text,'UTF8')),'hex');
 SELECT * INTO v_receipt FROM public.idempotency_keys WHERE site_id=p_store_id AND scope=v_scope AND key=p_key FOR UPDATE;
 IF FOUND THEN
  IF v_receipt.request_hash<>v_hash THEN RETURN jsonb_build_object('error','IDEMPOTENCY_CONFLICT','status',409); END IF;
  IF v_receipt.status<>'completed' OR v_receipt.response_body IS NULL OR v_receipt.deleted_at IS NOT NULL THEN
   RETURN jsonb_build_object('error','STAFF_STATE_UNAVAILABLE','status',503); END IF;
  RETURN jsonb_build_object('data',v_receipt.response_body,'status',201,'replayed',true);
 END IF;
 IF p_invite_id IS NULL OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
  OR p_expires_at IS NULL OR p_expires_at<=clock_timestamp() OR p_expires_at>clock_timestamp()+interval '24 hours 5 minutes'
  OR nullif(p_accept_origin,'') IS NULL OR nullif(p_sender,'') IS NULL
  OR p_intent->>'role' IS NULL OR p_intent->>'role' NOT IN('manager','editor','fulfillment','marketing','support','viewer','staff')
  OR jsonb_typeof(p_intent->'permissions') IS DISTINCT FROM 'object' OR(p_intent->'permissions')-'granted'<>'{}'::jsonb
  OR jsonb_typeof(p_intent->'permissions'->'granted') IS DISTINCT FROM 'array'
  OR nullif(p_intent->>'email','') IS NULL OR p_intent->>'email'<>lower(trim(p_intent->>'email')) THEN
  RETURN jsonb_build_object('error','VALIDATION','status',400); END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_intent->'permissions'->'granted') g WHERE jsonb_typeof(g)<>'string'
  OR g#>>'{}' NOT IN('products:read','products:write','orders:read','orders:write','customers:read','customers:write',
   'content:write','marketing:write','shipping:write','returns:write','reports:read','settings:write')) THEN
  RETURN jsonb_build_object('error','VALIDATION','status',400); END IF;
 IF p_employee_id IS NULL THEN
  v_policy:=public.merchant_staff_policy_snapshot_v1(p_actor_id,p_store_id,p_bound_site_id);
  IF p_policy_hash IS NULL OR v_policy->>'source_hash' IS DISTINCT FROM p_policy_hash OR p_seat_limit<0 THEN
   RETURN jsonb_build_object('error','STAFF_POLICY_CHANGED','status',409); END IF;
  SELECT count(*) INTO v_used FROM public.employees WHERE store_id=p_store_id AND status<>'removed' AND deleted_at IS NULL;
  IF p_seat_limit IS NOT NULL AND v_used>=p_seat_limit THEN RETURN jsonb_build_object('error','STAFF_LIMIT_REACHED','status',409); END IF;
  INSERT INTO public.employees(store_id,email,full_name,role,permissions,created_by,status,is_active)
   VALUES(p_store_id,p_intent->>'email',p_intent->>'full_name',p_intent->>'role',p_intent->'permissions',p_actor_id,'invited',true) RETURNING * INTO v_employee;
 ELSE
  SELECT * INTO v_employee FROM public.employees WHERE id=p_employee_id AND store_id=p_store_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','FORBIDDEN','status',403); END IF;
  IF p_expected_updated_at IS NULL OR v_employee.updated_at IS DISTINCT FROM p_expected_updated_at
   OR v_employee.email IS DISTINCT FROM p_intent->>'email' OR v_employee.status<>'invited' OR v_employee.user_id IS NOT NULL
   OR v_employee.deleted_at IS NOT NULL OR v_employee.is_active IS DISTINCT FROM true THEN
   RETURN jsonb_build_object('error','STAFF_VERSION_CONFLICT','status',409); END IF;
  v_before:=to_jsonb(v_employee);
  UPDATE public.employee_invites SET revoked_at=clock_timestamp() WHERE store_id=p_store_id AND employee_id=p_employee_id AND accepted_at IS NULL AND revoked_at IS NULL;
  UPDATE public.employees SET full_name=p_intent->>'full_name',role=p_intent->>'role',permissions=p_intent->'permissions',updated_at=clock_timestamp()
   WHERE id=p_employee_id AND store_id=p_store_id RETURNING * INTO v_employee;
 END IF;
 INSERT INTO public.employee_invites(id,store_id,employee_id,email,role,token,invited_by,expires_at,member_updated_at,permissions_snapshot,
  store_name_snapshot,accept_origin,sender_snapshot)
 VALUES(p_invite_id,p_store_id,v_employee.id,v_employee.email,v_employee.role,p_token_hash,p_actor_id,p_expires_at,v_employee.updated_at,v_employee.permissions,
  coalesce(v_site.name,v_site.store_name,'your store'),p_accept_origin,p_sender) RETURNING * INTO v_invite;
 INSERT INTO public.platform_queue_jobs(site_id,event_id,queue_name,job_type,payload,idempotency_key,request_id,max_attempts,created_by,updated_by)
 VALUES(p_store_id,p_invite_id,'notification-jobs','email.employee_invite',jsonb_build_object('invitation_id',p_invite_id),
  'staff-invite-email:'||p_invite_id::text,p_request_id,10,p_actor_id,p_actor_id);
 INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,old_values,new_values,metadata)
 VALUES(p_actor_id,'user',v_actor.email,'employee.invited','employee',v_employee.id,v_before,to_jsonb(v_employee),jsonb_build_object('store_id',p_store_id,'invitation_id',p_invite_id,'request_id',p_request_id));
 v_response:=jsonb_build_object('employee',to_jsonb(v_employee),'invitation',jsonb_build_object('id',p_invite_id,'store_id',p_store_id,
  'expires_at',p_expires_at,'accept_origin',p_accept_origin,'token_hash',p_token_hash,'delivery_status','queued','status','pending'));
 INSERT INTO public.idempotency_keys(site_id,key,scope,request_hash,response_hash,response_body,status,status_code,resource_type,resource_id,request_id,expires_at)
 VALUES(p_store_id,p_key,v_scope,v_hash,encode(sha256(convert_to(v_response::text,'UTF8')),'hex'),v_response,'completed',201,'employee_invite',p_invite_id,p_request_id,now()+interval '24 hours');
 RETURN jsonb_build_object('data',v_response,'status',201,'replayed',false);
EXCEPTION WHEN unique_violation THEN
 GET STACKED DIAGNOSTICS v_constraint=CONSTRAINT_NAME;
 IF v_constraint='employees_email_key' THEN RETURN jsonb_build_object('error','EMPLOYEE_ALREADY_EXISTS','status',409); END IF;
 RAISE;
END $fn$;

CREATE FUNCTION public.preview_merchant_staff_invitation_v1(p_actor_id uuid,p_invite_id uuid,p_token_hash text,p_bound_site_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 SELECT jsonb_build_object('id',i.id,'store_id',i.store_id,'store_name',i.store_name_snapshot,'role',CASE WHEN i.accepted_by=u.id THEN e.role ELSE i.role END,
  'permissions',CASE WHEN i.accepted_by=u.id THEN e.permissions ELSE i.permissions_snapshot END,
  'expires_at',i.expires_at,'status',CASE WHEN i.accepted_by=u.id AND e.user_id=u.id AND e.status='active' THEN 'accepted' ELSE 'pending' END)
 FROM public.employee_invites i JOIN public.employees e ON e.id=i.employee_id AND e.store_id=i.store_id
 JOIN public.sites s ON s.id=i.store_id JOIN public.users_custom u ON u.id=p_actor_id
 WHERE i.id=p_invite_id AND i.token=p_token_hash AND u.email=i.email AND u.email_verified=true
  AND i.store_id IS NOT NULL AND(s.custom_user_id=i.invited_by OR s.user_id=i.invited_by) AND s.deleted_at IS NULL
  AND(p_bound_site_id IS NULL OR p_bound_site_id=i.store_id) AND i.revoked_at IS NULL AND i.expires_at>statement_timestamp()
  AND e.deleted_at IS NULL AND e.is_active=true
  AND((i.accepted_at IS NULL AND e.status='invited' AND e.user_id IS NULL AND e.updated_at=i.member_updated_at)
   OR(i.accepted_by=u.id AND e.status='active' AND e.user_id=u.id));
$fn$;

CREATE FUNCTION public.accept_merchant_staff_invitation_v1(p_actor_id uuid,p_invite_id uuid,p_token_hash text,p_key text,p_bound_site_id uuid DEFAULT NULL,p_request_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE v_invite public.employee_invites;v_site public.sites;v_actor public.users_custom;v_employee public.employees;
 v_receipt public.idempotency_keys;v_hash text;v_scope text;v_before jsonb;v_response jsonb;
BEGIN
 SELECT * INTO v_invite FROM public.employee_invites WHERE id=p_invite_id AND store_id IS NOT NULL;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','STAFF_INVITATION_UNAVAILABLE','status',403); END IF;
 SELECT * INTO v_site FROM public.sites WHERE id=v_invite.store_id AND deleted_at IS NULL FOR UPDATE;
 SELECT * INTO v_invite FROM public.employee_invites WHERE id=p_invite_id FOR UPDATE;
 SELECT * INTO v_actor FROM public.users_custom WHERE id=p_actor_id;
 SELECT * INTO v_employee FROM public.employees WHERE id=v_invite.employee_id AND store_id=v_invite.store_id FOR UPDATE;
 IF v_actor.id IS NULL OR v_actor.email_verified IS DISTINCT FROM true OR v_actor.email IS DISTINCT FROM v_invite.email
  OR v_site.id IS NULL OR NOT(coalesce(v_site.custom_user_id=v_invite.invited_by,false) OR coalesce(v_site.user_id=v_invite.invited_by,false))
  OR v_invite.token IS DISTINCT FROM p_token_hash OR v_invite.revoked_at IS NOT NULL OR v_invite.expires_at<=clock_timestamp()
  OR(p_bound_site_id IS NOT NULL AND p_bound_site_id<>v_invite.store_id)
  OR v_employee.id IS NULL OR v_employee.deleted_at IS NOT NULL OR v_employee.is_active IS DISTINCT FROM true THEN
  RETURN jsonb_build_object('error','STAFF_INVITATION_UNAVAILABLE','status',403); END IF;
 IF p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 200 THEN RETURN jsonb_build_object('error','VALIDATION','status',400); END IF;
 v_scope:='merchant-staff-invite-v1:'||p_actor_id::text||':accept';
 v_hash:=encode(sha256(convert_to(jsonb_build_object('actor',p_actor_id,'store',v_invite.store_id,'invite',p_invite_id,'token_hash',p_token_hash)::text,'UTF8')),'hex');
 SELECT * INTO v_receipt FROM public.idempotency_keys WHERE site_id=v_invite.store_id AND scope=v_scope AND key=p_key FOR UPDATE;
 IF FOUND THEN
  IF v_receipt.request_hash<>v_hash THEN RETURN jsonb_build_object('error','IDEMPOTENCY_CONFLICT','status',409); END IF;
  IF v_employee.status<>'active' OR v_employee.user_id IS DISTINCT FROM p_actor_id THEN RETURN jsonb_build_object('error','STAFF_INVITATION_UNAVAILABLE','status',403); END IF;
  IF v_receipt.status<>'completed' OR v_receipt.response_body IS NULL OR v_receipt.deleted_at IS NOT NULL THEN RETURN jsonb_build_object('error','STAFF_STATE_UNAVAILABLE','status',503); END IF;
  RETURN jsonb_build_object('data',v_receipt.response_body,'status',200,'replayed',true);
 END IF;
 IF v_invite.accepted_at IS NULL THEN
  IF v_employee.status<>'invited' OR v_employee.user_id IS NOT NULL OR v_employee.updated_at IS DISTINCT FROM v_invite.member_updated_at
   OR v_employee.role IS DISTINCT FROM v_invite.role OR v_employee.permissions IS DISTINCT FROM v_invite.permissions_snapshot THEN
   RETURN jsonb_build_object('error','STAFF_VERSION_CONFLICT','status',409); END IF;
  v_before:=to_jsonb(v_employee);
  UPDATE public.employees SET user_id=p_actor_id,status='active',updated_at=clock_timestamp()
   WHERE id=v_employee.id AND store_id=v_invite.store_id RETURNING * INTO v_employee;
  UPDATE public.employee_invites SET accepted_at=clock_timestamp(),accepted_by=p_actor_id WHERE id=p_invite_id;
  INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,old_values,new_values,metadata)
  VALUES(p_actor_id,'user',v_actor.email,'employee.invite.accepted','employee',v_employee.id,v_before,to_jsonb(v_employee),
   jsonb_build_object('store_id',v_invite.store_id,'invitation_id',p_invite_id,'request_id',p_request_id));
 ELSIF v_invite.accepted_by IS DISTINCT FROM p_actor_id OR v_employee.user_id IS DISTINCT FROM p_actor_id OR v_employee.status<>'active' THEN
  RETURN jsonb_build_object('error','STAFF_INVITATION_UNAVAILABLE','status',403);
 END IF;
 v_response:=jsonb_build_object('employee',to_jsonb(v_employee),'store_handle',v_site.subdomain,'accepted',true);
 INSERT INTO public.idempotency_keys(site_id,key,scope,request_hash,response_hash,response_body,status,status_code,resource_type,resource_id,request_id,expires_at)
 VALUES(v_invite.store_id,p_key,v_scope,v_hash,encode(sha256(convert_to(v_response::text,'UTF8')),'hex'),v_response,'completed',200,'employee_invite',p_invite_id,p_request_id,now()+interval '24 hours');
 RETURN jsonb_build_object('data',v_response,'status',200,'replayed',false);
END $fn$;

CREATE FUNCTION public.merchant_staff_invitation_delivery_v1(p_invite_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 SELECT jsonb_build_object('id',i.id,'store_id',i.store_id,'email',i.email,'role',i.role,'token_hash',i.token,
  'store_name',i.store_name_snapshot,'accept_origin',i.accept_origin,'sender',i.sender_snapshot,'expires_at',i.expires_at)
 FROM public.employee_invites i JOIN public.employees e ON e.id=i.employee_id AND e.store_id=i.store_id JOIN public.sites s ON s.id=i.store_id
 WHERE i.id=p_invite_id AND i.store_id IS NOT NULL AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>statement_timestamp()
  AND(s.custom_user_id=i.invited_by OR s.user_id=i.invited_by) AND s.deleted_at IS NULL
  AND e.deleted_at IS NULL AND e.is_active=true AND e.status='invited' AND e.user_id IS NULL AND e.updated_at=i.member_updated_at
  AND e.role=i.role AND e.permissions=i.permissions_snapshot;
$fn$;
-- Recover only the new invitation family's declared120-second leases. Use the
-- existing canonical failure transition, including bounded retry/dead-letter.
CREATE FUNCTION public.recover_expired_staff_invitation_jobs_v1(p_limit integer DEFAULT 25)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE r record;v_count integer:=0;
BEGIN
 FOR r IN SELECT id,locked_by FROM public.platform_queue_jobs
  WHERE queue_name='notification-jobs' AND job_type='email.employee_invite' AND status='running'
   AND deleted_at IS NULL AND locked_by IS NOT NULL AND locked_at<clock_timestamp()-interval '120 seconds'
  ORDER BY locked_at,id LIMIT least(greatest(coalesce(p_limit,25),1),100) FOR UPDATE SKIP LOCKED LOOP
  PERFORM public.fail_platform_queue_job(r.id,r.locked_by,'Staff invitation worker lease expired',30,
   jsonb_build_object('consumer_runtime','services/queue-workers','lease_recovered',true));
  v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END $fn$;
DO $acl$ DECLARE s text; BEGIN
 FOREACH s IN ARRAY ARRAY[
 'public.create_merchant_staff_invitation_v1(uuid,uuid,jsonb,text,uuid,text,timestamptz,text,text,text,integer,uuid,timestamptz,uuid,text)',
 'public.preview_merchant_staff_invitation_v1(uuid,uuid,text,uuid)',
 'public.accept_merchant_staff_invitation_v1(uuid,uuid,text,text,uuid,text)',
 'public.merchant_staff_invitation_delivery_v1(uuid)',
 'public.recover_expired_staff_invitation_jobs_v1(integer)'] LOOP
 EXECUTE 'REVOKE ALL ON FUNCTION '||s||' FROM PUBLIC,anon,authenticated,app_tenant';
 EXECUTE 'GRANT EXECUTE ON FUNCTION '||s||' TO service_role';
 END LOOP;
END $acl$;
-- Direct provisioning remains available for already verified accounts. New or
-- unverified accounts use the complete invitation/consent path.
CREATE OR REPLACE FUNCTION public.mutate_merchant_staff_v1(
 p_actor_id uuid,p_store_id uuid,p_operation text,p_intent jsonb,p_key text,
 p_employee_id uuid DEFAULT NULL,p_expected_updated_at timestamptz DEFAULT NULL,
 p_policy_hash text DEFAULT NULL,p_seat_limit integer DEFAULT NULL,
 p_bound_site_id uuid DEFAULT NULL,p_request_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE v_actor public.users_custom; v_site public.sites; v_employee public.employees;
 v_before jsonb; v_response jsonb; v_scope text; v_hash text; v_receipt public.idempotency_keys;
 v_policy jsonb; v_used integer; v_staff_id uuid; v_constraint text; v_status integer; v_action text;
BEGIN
 IF p_operation NOT IN('create','update','remove') OR p_operation IS NULL OR p_key IS NULL OR length(p_key) NOT BETWEEN 8 AND 200 THEN
  RETURN jsonb_build_object('error','VALIDATION','status',400); END IF;
 -- Serialize the last available seat and all lifecycle changes for this store.
 -- A replay is still authorized against current ownership before exposing its receipt.
 SELECT * INTO v_site FROM public.sites WHERE id=p_store_id AND deleted_at IS NULL FOR UPDATE;
 SELECT * INTO v_actor FROM public.users_custom WHERE id=p_actor_id;
 IF v_site.id IS NULL OR v_actor.id IS NULL OR NOT(coalesce(v_site.custom_user_id=p_actor_id,false) OR coalesce(v_site.user_id=p_actor_id,false))
  OR(p_bound_site_id IS NOT NULL AND p_bound_site_id<>p_store_id) THEN
  RETURN jsonb_build_object('error','FORBIDDEN','status',403); END IF;
 v_scope:='merchant-staff-v1:'||p_actor_id::text||':'||p_operation;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('actor',p_actor_id,'store',p_store_id,'operation',p_operation,
  'intent',p_intent,'employee',p_employee_id,'expected_updated_at',p_expected_updated_at)::text,'UTF8')),'hex');
 SELECT * INTO v_receipt FROM public.idempotency_keys WHERE site_id=p_store_id AND scope=v_scope AND key=p_key FOR UPDATE;
 IF FOUND THEN
  IF v_receipt.request_hash<>v_hash THEN RETURN jsonb_build_object('error','IDEMPOTENCY_CONFLICT','status',409); END IF;
  IF v_receipt.status<>'completed' OR v_receipt.response_body IS NULL OR v_receipt.deleted_at IS NOT NULL THEN
   RETURN jsonb_build_object('error','STAFF_STATE_UNAVAILABLE','status',503); END IF;
  RETURN jsonb_build_object('data',v_receipt.response_body,'status',v_receipt.status_code,'replayed',true);
 END IF;
 IF p_operation IN('create','update') THEN
  IF p_intent IS NULL OR jsonb_typeof(p_intent)<>'object' OR(p_operation='create' AND NOT(p_intent ? 'role'))
   OR(p_intent ? 'role' AND (p_intent->>'role' IS NULL OR p_intent->>'role' NOT IN('manager','editor','fulfillment','marketing','support','viewer','staff')))
   OR NOT(p_intent ? 'permissions') OR jsonb_typeof(p_intent->'permissions') IS DISTINCT FROM 'object'
   OR (p_intent->'permissions')-'granted'<>'{}'::jsonb OR jsonb_typeof(p_intent->'permissions'->'granted') IS DISTINCT FROM 'array' THEN
   RETURN jsonb_build_object('error','VALIDATION','status',400); END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_intent->'permissions'->'granted') g WHERE jsonb_typeof(g)<>'string'
   OR g#>>'{}' NOT IN('products:read','products:write','orders:read','orders:write','customers:read','customers:write',
    'content:write','marketing:write','shipping:write','returns:write','reports:read','settings:write')) THEN
   RETURN jsonb_build_object('error','VALIDATION','status',400); END IF;
 END IF;
 IF p_operation='create' THEN
  IF nullif(p_intent->>'email','') IS NULL OR p_intent->>'email'<>lower(trim(p_intent->>'email')) THEN
   RETURN jsonb_build_object('error','VALIDATION','status',400); END IF;
  v_policy:=public.merchant_staff_policy_snapshot_v1(p_actor_id,p_store_id,p_bound_site_id);
  IF p_policy_hash IS NULL OR v_policy->>'source_hash' IS DISTINCT FROM p_policy_hash OR p_seat_limit<0 THEN
   RETURN jsonb_build_object('error','STAFF_POLICY_CHANGED','status',409); END IF;
  SELECT count(*) INTO v_used FROM public.employees WHERE store_id=p_store_id AND status<>'removed' AND deleted_at IS NULL;
  IF p_seat_limit IS NOT NULL AND v_used>=p_seat_limit THEN
   RETURN jsonb_build_object('error','STAFF_LIMIT_REACHED','status',409,'staff_limit',p_seat_limit,'staff_used',v_used); END IF;
  SELECT id INTO v_staff_id FROM public.users_custom WHERE email=p_intent->>'email' AND email_verified=true;
  IF v_staff_id IS NULL THEN RETURN jsonb_build_object('error','STAFF_ACCOUNT_VERIFICATION_REQUIRED','status',409); END IF;
  INSERT INTO public.employees(store_id,email,full_name,role,permissions,created_by,user_id,status,is_active)
   VALUES(p_store_id,p_intent->>'email',p_intent->>'full_name',p_intent->>'role',p_intent->'permissions',p_actor_id,v_staff_id,
    CASE WHEN v_staff_id IS NULL THEN 'invited' ELSE 'active' END,true) RETURNING * INTO v_employee;
  v_status:=201; v_action:='employee.created';
 ELSE
  SELECT * INTO v_employee FROM public.employees WHERE id=p_employee_id AND store_id=p_store_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','FORBIDDEN','status',403); END IF;
  IF p_expected_updated_at IS NULL THEN RETURN jsonb_build_object('error','STAFF_VERSION_REQUIRED','status',400); END IF;
  IF v_employee.updated_at IS DISTINCT FROM p_expected_updated_at OR v_employee.deleted_at IS NOT NULL OR v_employee.status='removed' THEN
   RETURN jsonb_build_object('error','STAFF_VERSION_CONFLICT','status',409); END IF;
  v_before:=to_jsonb(v_employee);
  IF p_operation='update' THEN
   UPDATE public.employees SET role=coalesce(p_intent->>'role',role),permissions=p_intent->'permissions',updated_at=clock_timestamp()
    WHERE id=p_employee_id AND store_id=p_store_id RETURNING * INTO v_employee;
   v_action:='employee.updated';
  ELSE
   UPDATE public.employees SET status='removed',is_active=false,deleted_at=clock_timestamp(),updated_at=clock_timestamp()
    WHERE id=p_employee_id AND store_id=p_store_id RETURNING * INTO v_employee;
   v_action:='employee.removed';
  END IF;
  v_status:=200;
 END IF;
 v_response:=CASE WHEN p_operation='remove' THEN jsonb_build_object('deleted',true) ELSE to_jsonb(v_employee) END;
 INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,old_values,new_values,metadata)
 VALUES(p_actor_id,'user',v_actor.email,v_action,'employee',v_employee.id,v_before,to_jsonb(v_employee),
  jsonb_build_object('store_id',p_store_id,'request_id',p_request_id));
 INSERT INTO public.idempotency_keys(site_id,key,scope,request_hash,response_hash,response_body,status,status_code,resource_type,resource_id,request_id,expires_at)
 VALUES(p_store_id,p_key,v_scope,v_hash,encode(sha256(convert_to(v_response::text,'UTF8')),'hex'),v_response,'completed',v_status,'employee',v_employee.id,p_request_id,now()+interval '24 hours');
 RETURN jsonb_build_object('data',v_response,'status',v_status,'replayed',false);
EXCEPTION WHEN unique_violation THEN
 GET STACKED DIAGNOSTICS v_constraint=CONSTRAINT_NAME;
 IF v_constraint='employees_email_key' THEN
  RETURN jsonb_build_object('error','EMPLOYEE_ALREADY_EXISTS','status',409);
 END IF;
 RAISE;
END $fn$;
NOTIFY pgrst,'reload schema';
COMMIT;
