-- Restore the five-argument draft writer. Existing web channel intent remains in
-- onboarding_attempts.survey_data.channels and survives later saves by this function.
BEGIN;

-- Refuse unknown function families before retiring the six-input writer. The target
-- must be absent; a second rollback refuses rather than overwriting a five-input body.
-- Reject pre-existing write transactions before a fresh catalog read; the catalog
-- lock then holds new function DDL behind this atomic transition.
LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
DO $rollback_precondition$
DECLARE v_expected record;v_source pg_catalog.pg_proc%ROWTYPE;
BEGIN
 IF pg_catalog.current_setting('transaction_isolation')<>'read committed'
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted AND (l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
  RAISE EXCEPTION 'rollback284 refuses concurrent/prepared writes or non-read-committed state';
 END IF;
 FOR v_expected IN SELECT * FROM(VALUES
 ('public.save_storefront_web_onboarding_draft(uuid,integer,text,text,text,text[])',ARRAY['p_user_id','p_step','p_store_name','p_subdomain','p_industry','p_channels']::text[],
  'public.save_storefront_web_onboarding_draft(uuid,integer,text,text,text)',ARRAY['p_user_id','p_step','p_store_name','p_subdomain','p_industry']::text[],'jsonb','5852cfb891f54b3f3ee04d05389c9ed9'))
 expected(source_signature,source_input_names,target_signature,target_input_names,result_type,source_md5) LOOP
  SELECT * INTO v_source FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(v_expected.source_signature);
  IF v_source.oid IS NULL
   OR v_source.pronamespace IS DISTINCT FROM 'public'::regnamespace
   OR v_source.proargnames[1:v_source.pronargs] IS DISTINCT FROM v_expected.source_input_names
   OR v_source.prorettype IS DISTINCT FROM pg_catalog.to_regtype(v_expected.result_type)
   OR v_source.proretset
   OR v_source.prokind<>'f'
   OR v_source.pronargdefaults<>0
   OR (SELECT count(*) FROM pg_catalog.pg_proc q WHERE q.pronamespace=v_source.pronamespace AND q.proname=v_source.proname)<>1
   OR pg_catalog.to_regprocedure(v_expected.target_signature) IS NOT NULL
   OR v_source.proowner IS DISTINCT FROM pg_catalog.to_regrole(current_user)
   OR v_source.prolang IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
   OR NOT v_source.prosecdef
   OR v_source.provolatile<>'v'
   OR v_source.proisstrict
   OR v_source.proleakproof
   OR v_source.proparallel<>'u'
   OR v_source.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
   OR pg_catalog.md5(v_source.prosrc) IS DISTINCT FROM v_expected.source_md5
   OR pg_catalog.has_function_privilege('anon',v_source.oid,'EXECUTE')
   OR pg_catalog.has_function_privilege('authenticated',v_source.oid,'EXECUTE')
   OR pg_catalog.has_function_privilege('app_tenant',v_source.oid,'EXECUTE')
   OR NOT pg_catalog.has_function_privilege('service_role',v_source.oid,'EXECUTE')
   OR pg_catalog.has_function_privilege('service_role',v_source.oid,'EXECUTE WITH GRANT OPTION')
   OR (SELECT count(*) FROM pg_catalog.aclexplode(coalesce(v_source.proacl,pg_catalog.acldefault('f',v_source.proowner))))<>2
   OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(v_source.proacl,pg_catalog.acldefault('f',v_source.proowner))) a WHERE NOT (a.grantor=v_source.proowner AND a.privilege_type='EXECUTE' AND ((a.grantee=v_source.proowner AND a.is_grantable IS NOT DISTINCT FROM (SELECT b.is_grantable FROM pg_catalog.aclexplode(pg_catalog.acldefault('f',v_source.proowner)) b WHERE b.grantee=v_source.proowner)) OR (a.grantee='service_role'::regrole::oid AND NOT a.is_grantable)))) THEN
   RAISE EXCEPTION 'rollback284 refuses unknown draft writer family, ABI, body, owner or privileges; use a reviewed forward repair';
  END IF;
 END LOOP;
END $rollback_precondition$;


DROP FUNCTION IF EXISTS public.save_storefront_web_onboarding_draft(uuid, integer, text, text, text, text[]);

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
      user_id, requested_name, requested_subdomain, site_type, status,
      current_step, completed_steps, survey_data, last_activity_at
    ) VALUES (
      p_user_id,
      coalesce(v_name, 'store-setup'),
      coalesce(v_subdomain, 'draft-' || left(p_user_id::text, 8)),
      'store', 'in_progress', p_step,
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

COMMIT;
