-- Read-only, all-time completed usage, preserving the existing credit contract.
-- Aggregate beside the authoritative rows so PostgREST max_rows cannot truncate
-- the total. This does not debit credits, schedule resets or create a balance.
BEGIN;
CREATE FUNCTION public.read_merchant_ai_usage_total(p_store_id uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT coalesce(sum(u.credits_used), 0)::bigint
  FROM public.ai_usage AS u
  WHERE u.store_id = p_store_id AND u.status = 'completed'
$function$;
REVOKE ALL ON FUNCTION public.read_merchant_ai_usage_total(uuid) FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.read_merchant_ai_usage_total(uuid) TO service_role;
COMMENT ON FUNCTION public.read_merchant_ai_usage_total(uuid) IS
  'Backend-only read under existing caller privileges; gateway verifies live store access before invocation. Complete all-time completed usage; no reset or credit mutation.';
NOTIFY pgrst, 'reload schema';
COMMIT;
