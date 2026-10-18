-- Persist the Identity web wizard's resumable draft through the canonical Gateway.
-- Keep it on the existing onboarding_attempts aggregate; no second draft store is introduced.
BEGIN;

CREATE OR REPLACE FUNCTION public.save_storefront_web_onboarding_draft(
  p_user_id uuid,
  p_step integer,
  p_store_name text,
  p_subdomain text,
  p_industry text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_attempt public.onboarding_attempts%ROWTYPE;
  v_name text := nullif(btrim(p_store_name), '');
  v_subdomain text := nullif(lower(btrim(p_subdomain)), '');
  v_industry text := coalesce(nullif(btrim(p_industry), ''), 'general');
  v_draft jsonb;
BEGIN
  IF p_user_id IS NULL OR p_step NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'Invalid onboarding draft scope or step' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(v_name, '')) > 100 THEN
    RAISE EXCEPTION 'Store name exceeds limit' USING ERRCODE = '22023';
  END IF;
  IF v_subdomain IS NOT NULL AND (length(v_subdomain) > 63 OR v_subdomain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$') THEN
    RAISE EXCEPTION 'Invalid store subdomain' USING ERRCODE = '22023';
  END IF;
  IF v_industry NOT IN ('electronics', 'fashion', 'beauty', 'furniture', 'food', 'sports', 'books', 'pet', 'general') THEN
    RAISE EXCEPTION 'Invalid store industry' USING ERRCODE = '22023';
  END IF;

  -- Advisory lock prevents duplicate active web attempts when autosaves race.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':storefront-web-onboarding-draft', 0));

  SELECT * INTO v_attempt
  FROM public.onboarding_attempts
  WHERE user_id = p_user_id
    AND site_type = 'store'
    AND status = 'in_progress'
    AND deleted_at IS NULL
    AND survey_data ? 'web_draft'
  ORDER BY updated_at DESC NULLS LAST, created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  v_draft := jsonb_build_object(
    'version', 1,
    'store_name', coalesce(v_name, ''),
    'subdomain', coalesce(v_subdomain, ''),
    'industry', v_industry
  );

  IF v_attempt.id IS NULL THEN
    INSERT INTO public.onboarding_attempts (
      user_id,
      requested_name,
      requested_subdomain,
      site_type,
      status,
      current_step,
      completed_steps,
      survey_data,
      last_activity_at
    ) VALUES (
      p_user_id,
      coalesce(v_name, 'store-setup'),
      coalesce(v_subdomain, 'draft-' || left(p_user_id::text, 8)),
      'store',
      'in_progress',
      p_step,
      CASE WHEN p_step > 1 THEN ARRAY(SELECT generate_series(1, p_step - 1)) ELSE ARRAY[]::integer[] END,
      jsonb_build_object('web_draft', v_draft),
      now()
    )
    RETURNING * INTO v_attempt;
  ELSE
    UPDATE public.onboarding_attempts
    SET requested_name = coalesce(v_name, 'store-setup'),
        requested_subdomain = coalesce(v_subdomain, 'draft-' || left(p_user_id::text, 8)),
        current_step = p_step,
        completed_steps = CASE WHEN p_step > 1 THEN ARRAY(SELECT generate_series(1, p_step - 1)) ELSE ARRAY[]::integer[] END,
        survey_data = coalesce(survey_data, '{}'::jsonb) || jsonb_build_object('web_draft', v_draft),
        last_activity_at = now()
    WHERE id = v_attempt.id
    RETURNING * INTO v_attempt;
  END IF;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt.id,
    'current_step', v_attempt.current_step,
    'site_type', v_attempt.site_type,
    'draft', v_draft,
    'updated_at', v_attempt.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_storefront_web_onboarding_draft(uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_storefront_web_onboarding_draft(uuid, integer, text, text, text) TO service_role;

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
