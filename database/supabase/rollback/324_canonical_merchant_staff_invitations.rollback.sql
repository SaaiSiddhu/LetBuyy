-- Refuse to discard retained invitations or queued delivery provenance.
BEGIN;

-- Refuse ABI drift before restoring historical bodies or changing schema objects.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('mutate_merchant_staff_v1', 'public.mutate_merchant_staff_v1(uuid,uuid,text,jsonb,text,uuid,timestamptz,text,integer,uuid,text)', ARRAY['p_actor_id','p_store_id','p_operation','p_intent','p_key','p_employee_id','p_expected_updated_at','p_policy_hash','p_seat_limit','p_bound_site_id','p_request_id']::text[], 'jsonb', false, 1)
  ) AS expected(name, signature, input_names, result_type, returns_set, overloads)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count <> v_expected.overloads OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 324 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 324 refuses to run: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.employee_invites WHERE store_id IS NOT NULL)
  OR EXISTS(SELECT 1 FROM public.platform_queue_jobs WHERE queue_name='notification-jobs')
  OR EXISTS(SELECT 1 FROM public.platform_queue_jobs_partitioned WHERE queue_name='notification-jobs') THEN
  RAISE EXCEPTION 'rollback324 refuses retained merchant invitations or delivery jobs; forward recovery required';
 END IF;
END $$;
DROP FUNCTION public.recover_expired_staff_invitation_jobs_v1(integer);
DROP FUNCTION public.merchant_staff_invitation_delivery_v1(uuid);
DROP FUNCTION public.accept_merchant_staff_invitation_v1(uuid,uuid,text,text,uuid,text);
DROP FUNCTION public.preview_merchant_staff_invitation_v1(uuid,uuid,text,uuid);
DROP FUNCTION public.create_merchant_staff_invitation_v1(uuid,uuid,jsonb,text,uuid,text,timestamptz,text,text,text,integer,uuid,timestamptz,uuid,text);
DROP TRIGGER guard_merchant_staff_invitation_intent_v1 ON public.employee_invites;
DROP FUNCTION public.guard_merchant_staff_invitation_intent_v1();
DROP INDEX public.employee_invites_member_pending_idx;
ALTER TABLE public.employee_invites DROP CONSTRAINT employee_invites_merchant_context_check;
ALTER TABLE public.employee_invites DROP CONSTRAINT employee_invites_role_check;
ALTER TABLE public.employee_invites ADD CONSTRAINT employee_invites_role_check CHECK(role IN('support','sales','marketing','operations','manager','admin'));
ALTER TABLE public.employee_invites DROP COLUMN store_id,DROP COLUMN employee_id,DROP COLUMN member_updated_at,
 DROP COLUMN permissions_snapshot,DROP COLUMN store_name_snapshot,DROP COLUMN accept_origin,DROP COLUMN sender_snapshot,
 DROP COLUMN revoked_at,DROP COLUMN accepted_by;
ALTER TABLE public.platform_queue_jobs DROP CONSTRAINT platform_queue_jobs_queue_name_check;
ALTER TABLE public.platform_queue_jobs ADD CONSTRAINT platform_queue_jobs_queue_name_check CHECK(queue_name IN(
 'payment-events','inventory-jobs','webhook-deliveries','analytics-events','search-indexing','fulfillment-jobs','bulk-admin-jobs'));
ALTER TABLE public.platform_queue_jobs_partitioned DROP CONSTRAINT platform_queue_jobs_partitioned_queue_name_check;
ALTER TABLE public.platform_queue_jobs_partitioned ADD CONSTRAINT platform_queue_jobs_partitioned_queue_name_check CHECK(queue_name IN(
 'payment-events','inventory-jobs','webhook-deliveries','analytics-events','search-indexing','fulfillment-jobs','bulk-admin-jobs'));
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
