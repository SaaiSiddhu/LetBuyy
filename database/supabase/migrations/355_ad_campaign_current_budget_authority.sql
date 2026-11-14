--355: current canonical merchant budget authority before effects and replays.
-- Only allocate/release change. Financial tails, six-input ABI/defaults, owner,
-- existing role grants, dedicated prepaid liability and funding families stay.
-- This release transition requires a quiescent read-committed writer boundary.
-- Serialize function DDL and relevant money/owner relations BEFORE catalog checks.
BEGIN;
LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.ad_credit_ledger_entries, public.ad_campaigns, public.ad_credit_accounts, public.sites, public.users_custom IN ACCESS EXCLUSIVE MODE;
DO $forward_precondition$
DECLARE v_expected record; v_live pg_catalog.pg_proc%ROWTYPE; v_count integer;
BEGIN
  IF pg_catalog.current_setting('transaction_isolation')<>'read committed'
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted AND (l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))
     OR EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN
    RAISE EXCEPTION 'forward355 refuses concurrent/prepared writes or non-read-committed state';
  END IF;
  FOR v_expected IN SELECT * FROM (VALUES
    ('allocate_ad_campaign_budget','public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)',ARRAY['p_site_id','p_campaign_id','p_amount_minor','p_idempotency_key','p_request_id','p_actor_id']::text[],'jsonb',false,1),
    ('release_ad_campaign_budget','public.release_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)',ARRAY['p_site_id','p_campaign_id','p_amount_minor','p_idempotency_key','p_request_id','p_actor_id']::text[],'jsonb',false,1)
  ) AS expected(name,signature,input_names,result_type,returns_set,overloads) LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=v_expected.name;
    IF v_count <> v_expected.overloads OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN
      RAISE EXCEPTION 'forward355 refuses to run: typed identity or full overload family changed';
    END IF;
    SELECT * INTO v_live FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);
    IF COALESCE(v_live.proargnames[1:v_live.pronargs],ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names
       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype
       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set
       OR v_live.prokind<>'f' THEN
      RAISE EXCEPTION 'forward355 refuses to run: input names or result ABI changed';
    END IF;
  END LOOP;
END;
$forward_precondition$;
DO $budget_definition_precondition$
BEGIN
  IF EXISTS(
    SELECT 1 FROM (VALUES
      ('public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)',2,'NULL::text, NULL::uuid','ac770e6839cde7baafb974da21b73155','2bda47bf30f064d1c794427f7cf9dd44'),
      ('public.release_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)',4,'NULL::bigint, NULL::text, NULL::text, NULL::uuid','4c8248128ea36c54a9261cad6546c4e9','3bc84ad4f90fa9a04c14574cbc7e51e2')
    ) AS expected(signature,default_count,default_source,first_md5,second_md5)
    LEFT JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(expected.signature)
    WHERE p.oid IS NULL
       OR p.pronamespace IS DISTINCT FROM 'public'::regnamespace
       OR p.pronargs<>6 OR p.provariadic<>0
       OR p.proargmodes IS NOT NULL OR p.proallargtypes IS NOT NULL
       OR p.pronargdefaults IS DISTINCT FROM expected.default_count
       OR pg_catalog.pg_get_expr(p.proargdefaults,0) IS DISTINCT FROM expected.default_source
       OR p.proowner IS DISTINCT FROM pg_catalog.to_regrole(current_user)
       OR p.prolang IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
       OR NOT p.prosecdef OR p.provolatile<>'v' OR p.proisstrict OR p.proleakproof OR p.proparallel<>'u'
       OR p.procost IS DISTINCT FROM 100::real OR p.prorows IS DISTINCT FROM 0::real
       OR p.prosupport<>0 OR p.probin IS NOT NULL OR p.prosqlbody IS NOT NULL OR p.protrftypes IS NOT NULL
       OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp']::text[]
       OR pg_catalog.md5(p.prosrc) NOT IN(expected.first_md5,expected.second_md5)
       OR pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
       OR NOT pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE')
       OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
       OR pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE WITH GRANT OPTION')
       OR pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE WITH GRANT OPTION')
       OR (SELECT count(*) FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))))<>3
       OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
         WHERE NOT(a.grantor=p.proowner AND a.privilege_type='EXECUTE' AND
           ((a.grantee=p.proowner AND a.is_grantable IS NOT DISTINCT FROM
              (SELECT b.is_grantable FROM pg_catalog.aclexplode(pg_catalog.acldefault('f',p.proowner)) b WHERE b.grantee=p.proowner))
            OR (a.grantee IN('app_tenant'::regrole::oid,'service_role'::regrole::oid) AND NOT a.is_grantable))))
  ) THEN
    RAISE EXCEPTION 'forward355 refuses unknown defaults/body/profile/owner/privileges';
  END IF;
END;
$budget_definition_precondition$;

CREATE OR REPLACE FUNCTION public.allocate_ad_campaign_budget(
  p_site_id uuid,
  p_campaign_id uuid,
  p_amount_minor bigint,
  p_idempotency_key text,
  p_request_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_guc text;
  v_actor_guc text;
  v_site public.sites%ROWTYPE;
  v_account public.ad_credit_accounts%ROWTYPE;
  v_campaign public.ad_campaigns%ROWTYPE;
  v_balance bigint;
  v_existing public.ad_credit_ledger_entries%ROWTYPE;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'allocation must be greater than zero';
  END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency key is required';
  END IF;

  -- Merchant budget authority is captured in this same tenant transaction.
  v_tenant_guc := NULLIF(current_setting('app.site_id', true), '');
  v_actor_guc := NULLIF(current_setting('app.user_id', true), '');
  BEGIN
    IF v_tenant_guc IS NULL OR v_tenant_guc::uuid IS DISTINCT FROM p_site_id THEN
      RAISE EXCEPTION 'Current tenant site context is required for campaign budget' USING ERRCODE = '42501';
    END IF;
    IF p_actor_id IS NULL OR v_actor_guc IS NULL OR v_actor_guc::uuid IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION 'Current captured actor context is required for campaign budget' USING ERRCODE = '42501';
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid current tenant or actor context for campaign budget' USING ERRCODE = '42501';
  END;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 3));

  -- Lock identity and current ownership before either a new effect or a replay.
  PERFORM 1 FROM public.users_custom WHERE id = p_actor_id FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current campaign budget actor is not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_site FROM public.sites WHERE id = p_site_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR (v_site.user_id IS DISTINCT FROM p_actor_id AND v_site.custom_user_id IS DISTINCT FROM p_actor_id) THEN
    RAISE EXCEPTION 'Current campaign budget owner is not authorized' USING ERRCODE = '42501';
  END IF;


  -- The campaign must belong to THIS site. Allocating one merchant's prepaid credits to another's
  -- campaign is the transfer D-5 forbids.
  SELECT * INTO v_campaign
    FROM public.ad_campaigns WHERE id = p_campaign_id AND site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign % does not belong to site %', p_campaign_id, p_site_id;
  END IF;

  SELECT * INTO v_account FROM public.ad_credit_accounts WHERE site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no prepaid ad credit account for site %', p_site_id;
  END IF;
  IF v_account.status <> 'active' THEN
    RAISE EXCEPTION 'ad credit account is %', v_account.status;
  END IF;

  -- Current owner/campaign/account authority is established before cached success.
  SELECT * INTO v_existing
    FROM public.ad_credit_ledger_entries
   WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key
   LIMIT 1;
  IF FOUND THEN
    IF v_existing.entry_type <> 'allocated'
       OR v_existing.campaign_id IS DISTINCT FROM p_campaign_id
       OR v_existing.amount_minor IS DISTINCT FROM p_amount_minor THEN
      RAISE EXCEPTION 'ad credit idempotency key conflicts with a different request payload';
    END IF;
    RETURN jsonb_build_object('entry_id', v_existing.id, 'amount_minor', v_existing.amount_minor,
                              'balance_minor', v_existing.balance_after_minor, 'replayed', true);
  END IF;

  v_balance := public.ad_credit_balance_minor(v_account.id);
  IF p_amount_minor > v_balance THEN
    -- Prepaid: there is no overdraft, because an overdraft is credit extended.
    RAISE EXCEPTION 'insufficient ad credits: % requested, % available', p_amount_minor, v_balance;
  END IF;

  INSERT INTO public.ad_credit_ledger_entries (
    site_id, ad_credit_account_id, campaign_id, entry_type, amount_minor, balance_after_minor,
    idempotency_key, request_id, created_by
  ) VALUES (
    p_site_id, v_account.id, p_campaign_id, 'allocated', p_amount_minor, v_balance - p_amount_minor,
    p_idempotency_key, p_request_id, p_actor_id
  );

  UPDATE public.ad_campaigns
     SET allocated_minor = allocated_minor + p_amount_minor, updated_at = now()
   WHERE id = p_campaign_id;

  RETURN jsonb_build_object('amount_minor', p_amount_minor, 'balance_minor', v_balance - p_amount_minor,
                            'campaign_allocated_minor', v_campaign.allocated_minor + p_amount_minor, 'allocated', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_ad_campaign_budget(
  p_site_id uuid,
  p_campaign_id uuid,
  -- NULL means "everything still unspent", which is the case that matters when ending a campaign
  -- and the one a merchant would otherwise have to compute themselves from two projections.
  p_amount_minor bigint DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_guc text;
  v_actor_guc text;
  v_site public.sites%ROWTYPE;
  v_campaign public.ad_campaigns%ROWTYPE;
  v_account public.ad_credit_accounts%ROWTYPE;
  v_existing public.ad_credit_ledger_entries%ROWTYPE;
  v_releasable bigint;
  v_amount bigint;
BEGIN
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency key is required';
  END IF;

  -- Merchant budget authority is captured in this same tenant transaction.
  v_tenant_guc := NULLIF(current_setting('app.site_id', true), '');
  v_actor_guc := NULLIF(current_setting('app.user_id', true), '');
  BEGIN
    IF v_tenant_guc IS NULL OR v_tenant_guc::uuid IS DISTINCT FROM p_site_id THEN
      RAISE EXCEPTION 'Current tenant site context is required for campaign budget' USING ERRCODE = '42501';
    END IF;
    IF p_actor_id IS NULL OR v_actor_guc IS NULL OR v_actor_guc::uuid IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION 'Current captured actor context is required for campaign budget' USING ERRCODE = '42501';
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid current tenant or actor context for campaign budget' USING ERRCODE = '42501';
  END;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_site_id::text || ':' || p_idempotency_key, 3));

  -- Lock identity and current ownership before either a new effect or a replay.
  PERFORM 1 FROM public.users_custom WHERE id = p_actor_id FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current campaign budget actor is not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_site FROM public.sites WHERE id = p_site_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR (v_site.user_id IS DISTINCT FROM p_actor_id AND v_site.custom_user_id IS DISTINCT FROM p_actor_id) THEN
    RAISE EXCEPTION 'Current campaign budget owner is not authorized' USING ERRCODE = '42501';
  END IF;


  -- Campaign first, then account: the same lock order allocation uses, so the two cannot deadlock
  -- against each other under concurrency.
  SELECT * INTO v_campaign
    FROM public.ad_campaigns WHERE id = p_campaign_id AND site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'campaign % does not belong to site %', p_campaign_id, p_site_id;
  END IF;

  SELECT * INTO v_account FROM public.ad_credit_accounts WHERE site_id = p_site_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no prepaid ad credit account for site %', p_site_id;
  END IF;
  IF v_account.status <> 'active' THEN
    RAISE EXCEPTION 'ad credit account is %', v_account.status;
  END IF;

  -- Current owner/campaign/account authority is established before cached success.
  SELECT * INTO v_existing
    FROM public.ad_credit_ledger_entries
   WHERE site_id = p_site_id AND idempotency_key = p_idempotency_key
   LIMIT 1;
  IF FOUND THEN
    IF v_existing.entry_type <> 'released'
       OR v_existing.campaign_id IS DISTINCT FROM p_campaign_id
       OR (v_existing.metadata ? 'requested_amount_minor'
           AND v_existing.metadata->>'requested_amount_minor' IS DISTINCT FROM p_amount_minor::text)
       OR (NOT (v_existing.metadata ? 'requested_amount_minor')
           AND ((p_amount_minor IS NULL
                 AND v_existing.metadata->>'releasable_minor' IS DISTINCT FROM v_existing.amount_minor::text)
             OR (p_amount_minor IS NOT NULL
                 AND p_amount_minor IS DISTINCT FROM v_existing.amount_minor))) THEN
      RAISE EXCEPTION 'ad credit idempotency key conflicts with a different request payload';
    END IF;
    RETURN jsonb_build_object('entry_id', v_existing.id, 'amount_minor', v_existing.amount_minor,
                              'balance_minor', v_existing.balance_after_minor, 'replayed', true);
  END IF;

  -- What is left after everything already spent. Reuses the projection rather than re-deriving it,
  -- so "remaining" means one thing across serving, spending and releasing.
  v_releasable := public.ad_campaign_remaining_minor(p_campaign_id);
  v_amount := COALESCE(p_amount_minor, v_releasable);

  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('released', false, 'amount_minor', 0, 'reason', 'nothing_to_release');
  END IF;
  IF v_amount > v_releasable THEN
    -- Releasing more than remains would credit the account with money the campaign already spent,
    -- inventing credit out of a ledger that is supposed to conserve it.
    RAISE EXCEPTION 'cannot release % from a campaign with % remaining', v_amount, v_releasable;
  END IF;

  INSERT INTO public.ad_credit_ledger_entries (
    site_id, ad_credit_account_id, campaign_id, entry_type, amount_minor, balance_after_minor,
    idempotency_key, request_id, metadata, created_by
  ) VALUES (
    p_site_id, v_account.id, p_campaign_id, 'released', v_amount,
    -- 'released' is a credit, so the account balance rises by exactly this amount.
    public.ad_credit_balance_minor(v_account.id) + v_amount,
    p_idempotency_key, p_request_id,
    jsonb_build_object('campaign_allocated_before', v_campaign.allocated_minor, 'releasable_minor', v_releasable,
                       'requested_amount_minor', p_amount_minor),
    p_actor_id
  );

  -- Together with the entry above, in one transaction. A credit without this decrement would leave
  -- the campaign believing it holds budget the account has already been given back.
  UPDATE public.ad_campaigns
     SET allocated_minor = allocated_minor - v_amount, updated_at = now()
   WHERE id = p_campaign_id;

  RETURN jsonb_build_object(
    'released', true,
    'amount_minor', v_amount,
    'balance_minor', public.ad_credit_balance_minor(v_account.id),
    'campaign_allocated_minor', v_campaign.allocated_minor - v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid) FROM PUBLIC, anon, authenticated;
DO $budget_definition_precondition$
BEGIN
  IF EXISTS(
    SELECT 1 FROM (VALUES
      ('public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)',2,'NULL::text, NULL::uuid','2bda47bf30f064d1c794427f7cf9dd44','2bda47bf30f064d1c794427f7cf9dd44'),
      ('public.release_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)',4,'NULL::bigint, NULL::text, NULL::text, NULL::uuid','3bc84ad4f90fa9a04c14574cbc7e51e2','3bc84ad4f90fa9a04c14574cbc7e51e2')
    ) AS expected(signature,default_count,default_source,first_md5,second_md5)
    LEFT JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(expected.signature)
    WHERE p.oid IS NULL
       OR p.pronamespace IS DISTINCT FROM 'public'::regnamespace
       OR p.pronargs<>6 OR p.provariadic<>0
       OR p.proargmodes IS NOT NULL OR p.proallargtypes IS NOT NULL
       OR p.pronargdefaults IS DISTINCT FROM expected.default_count
       OR pg_catalog.pg_get_expr(p.proargdefaults,0) IS DISTINCT FROM expected.default_source
       OR p.proowner IS DISTINCT FROM pg_catalog.to_regrole(current_user)
       OR p.prolang IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')
       OR NOT p.prosecdef OR p.provolatile<>'v' OR p.proisstrict OR p.proleakproof OR p.proparallel<>'u'
       OR p.procost IS DISTINCT FROM 100::real OR p.prorows IS DISTINCT FROM 0::real
       OR p.prosupport<>0 OR p.probin IS NOT NULL OR p.prosqlbody IS NOT NULL OR p.protrftypes IS NOT NULL
       OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp']::text[]
       OR pg_catalog.md5(p.prosrc) NOT IN(expected.first_md5,expected.second_md5)
       OR pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
       OR NOT pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE')
       OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
       OR pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE WITH GRANT OPTION')
       OR pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE WITH GRANT OPTION')
       OR (SELECT count(*) FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))))<>3
       OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
         WHERE NOT(a.grantor=p.proowner AND a.privilege_type='EXECUTE' AND
           ((a.grantee=p.proowner AND a.is_grantable IS NOT DISTINCT FROM
              (SELECT b.is_grantable FROM pg_catalog.aclexplode(pg_catalog.acldefault('f',p.proowner)) b WHERE b.grantee=p.proowner))
            OR (a.grantee IN('app_tenant'::regrole::oid,'service_role'::regrole::oid) AND NOT a.is_grantable))))
  ) THEN
    RAISE EXCEPTION 'forward355 refuses unknown defaults/body/profile/owner/privileges';
  END IF;
END;
$budget_definition_precondition$;
COMMIT;
