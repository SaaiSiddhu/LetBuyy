-- Restore migration 284's function body when rolling back migration 285.
BEGIN;

-- Refuse ABI drift before restoring historical bodies or changing schema objects.
DO $rollback_precondition$
DECLARE
  v_expected record;
  v_live pg_catalog.pg_proc%ROWTYPE;
  v_count integer;
BEGIN
  FOR v_expected IN SELECT * FROM (VALUES
    ('complete_storefront_web_onboarding_draft', 'public.complete_storefront_web_onboarding_draft(uuid,uuid,uuid)', ARRAY['p_user_id','p_attempt_id','p_store_id']::text[], 'jsonb', false)
  ) AS expected(name, signature, input_names, result_type, returns_set)
  LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count <> 1 OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'rollback 285 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name;
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p
     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind <> 'f' THEN
      RAISE EXCEPTION 'rollback 285 refuses to run: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;
    END IF;
  END LOOP;
END;
$rollback_precondition$;


CREATE OR REPLACE FUNCTION public.complete_storefront_web_onboarding_draft(
  p_user_id uuid,
  p_attempt_id uuid,
  p_store_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_attempt public.onboarding_attempts%ROWTYPE;
  v_owned_store_id uuid;
  v_owned_store_subdomain text;
BEGIN
  IF p_user_id IS NULL OR p_attempt_id IS NULL OR p_store_id IS NULL THEN
    RAISE EXCEPTION 'Invalid onboarding completion scope' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':storefront-web-onboarding-draft', 0));

  SELECT id, subdomain INTO v_owned_store_id, v_owned_store_subdomain
  FROM public.sites
  WHERE id = p_store_id
    AND (custom_user_id = p_user_id OR user_id = p_user_id)
    AND deleted_at IS NULL
  FOR UPDATE;
  IF v_owned_store_id IS NULL THEN
    RAISE EXCEPTION 'Onboarding store is not owned by this user' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_attempt
  FROM public.onboarding_attempts
  WHERE id = p_attempt_id AND user_id = p_user_id AND site_type = 'store'
    AND survey_data ? 'web_draft'
  FOR UPDATE;
  IF v_attempt.id IS NULL THEN
    RAISE EXCEPTION 'Onboarding draft not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_attempt.requested_subdomain <> v_owned_store_subdomain THEN
    RAISE EXCEPTION 'Onboarding draft handle does not match store' USING ERRCODE = '22023';
  END IF;

  IF v_attempt.status = 'completed' AND v_attempt.store_id = p_store_id THEN
    RETURN jsonb_build_object('completed', true, 'attempt_id', v_attempt.id, 'store_id', p_store_id);
  END IF;
  IF v_attempt.status <> 'in_progress' OR v_attempt.store_id IS NOT NULL THEN
    RAISE EXCEPTION 'Onboarding draft is already finalized' USING ERRCODE = '55000';
  END IF;

  UPDATE public.onboarding_attempts
  SET status = 'completed',
      store_id = p_store_id,
      current_step = 4,
      completed_steps = ARRAY[1, 2, 3]::integer[],
      completed_at = now(),
      last_activity_at = now()
  WHERE id = v_attempt.id;

  UPDATE public.user_profiles
  SET onboarding_completed = true
  WHERE id = p_user_id;

  RETURN jsonb_build_object('completed', true, 'attempt_id', v_attempt.id, 'store_id', p_store_id);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_storefront_web_onboarding_draft(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_storefront_web_onboarding_draft(uuid, uuid, uuid) TO service_role;

COMMIT;
