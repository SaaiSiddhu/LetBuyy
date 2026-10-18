-- Keep onboarding completion on its canonical onboarding_attempts record.
-- user_profiles has no onboarding_completed column; writing it aborts finalization.
BEGIN;

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

  RETURN jsonb_build_object('completed', true, 'attempt_id', v_attempt.id, 'store_id', p_store_id);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_storefront_web_onboarding_draft(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_storefront_web_onboarding_draft(uuid, uuid, uuid) TO service_role;

COMMIT;
