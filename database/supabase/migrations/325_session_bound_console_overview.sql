-- Private, bounded platform aggregates. Existing live Console session and
-- canonical permission resolver remain the authority; no tenant row enumeration.
BEGIN;
CREATE OR REPLACE FUNCTION public.read_console_overview_v1(p_session_id uuid,p_cookie_sha256 text,p_permission_hash text,p_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_permission jsonb;v_state jsonb;v_overview jsonb;v_since timestamptz:=clock_timestamp()-interval '30 days';
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN('summary','analytics') THEN
  RETURN jsonb_build_object('accepted',false,'code','CONSOLE_OVERVIEW_QUERY_INVALID');
 END IF;
 v_permission:=public.console_permission_snapshot_v1(p_session_id,p_cookie_sha256,false);
 IF NOT coalesce((v_permission->>'accepted')::boolean,false) THEN RETURN v_permission; END IF;
 IF p_permission_hash IS NULL OR v_permission->>'evidence_hash' IS DISTINCT FROM p_permission_hash THEN
  RETURN jsonb_build_object('accepted',false,'code','PERMISSION_CHANGED');
 END IF;
 v_state:=v_permission->'session';
 -- The Gateway requires exec:view through the canonical resolver, then supplies
 -- this snapshot witness. Recheck under the existing session lock before reads.
 IF p_kind='summary' THEN
  SELECT jsonb_build_object(
   'total_users',(SELECT count(*) FROM public.users_custom),
   'total_stores',(SELECT count(*) FROM public.sites),
   'active_stores',(SELECT count(*) FROM public.sites WHERE status='published'),
   'total_subscriptions',(SELECT count(*) FROM public.subscriptions),
   'active_subscriptions',(SELECT count(*) FROM public.subscriptions WHERE status='active'),
   'total_employees',(SELECT count(*) FROM public.employees WHERE store_id IS NULL AND deleted_at IS NULL),
   'total_audit_logs',(SELECT count(*) FROM public.audit_logs),
   'monthly_revenue_paise',(SELECT coalesce(sum(amount_paid),0) FROM public.subscriptions WHERE status='active')) INTO v_overview;
 ELSE
  WITH counts AS(SELECT
   (SELECT count(*) FROM public.users_custom WHERE created_at>=v_since) AS users,
   (SELECT count(*) FROM public.sites WHERE created_at>=v_since) AS stores,
   (SELECT count(*) FROM public.subscriptions WHERE created_at>=v_since) AS subscriptions,
   (SELECT count(*) FROM public.audit_logs WHERE created_at>=v_since) AS audits)
  SELECT jsonb_build_object('period_days',30,'new_signups',users,'stores_created',stores,
   'subscriptions_created',subscriptions,'audit_events',audits,
   'signup_to_store_conversion_percent',CASE WHEN users>0 THEN round(stores::numeric/users*100,1) ELSE 0 END)
   INTO v_overview FROM counts;
 END IF;
 INSERT INTO public.audit_logs(actor_id,actor_type,actor_email,action,resource_type,resource_id,metadata)
 VALUES((v_state->>'actor_id')::uuid,'employee',v_state->>'email','console.'||p_kind||'.read','platform_overview',NULL,
  jsonb_build_object('permission_scope','exec:view','session_id',p_session_id,'aggregate_only',true));
 RETURN jsonb_build_object('accepted',true,'overview',v_overview);
END $function$;
REVOKE ALL ON FUNCTION public.read_console_overview_v1(uuid,text,text,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.read_console_overview_v1(uuid,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
