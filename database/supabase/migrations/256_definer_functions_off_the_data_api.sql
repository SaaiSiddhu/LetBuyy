-- 256 — SECURITY DEFINER functions are not callable by the Data API roles (APPID-SEC1, 2026-09-24).
--
-- ============================================================================
-- WHAT IS WRONG (measured on a database, not inferred)
-- ============================================================================
-- On a database built from 000..255 under Supabase's default privileges
-- (tests/executable/supabase-faithful-bootstrap.mjs), 158 of the 163 SECURITY DEFINER functions in
-- public are executable by anon and authenticated, through two routes:
--   * PUBLIC. About 145 of them never revoke EXECUTE from PUBLIC, PostgreSQL's default for a new
--     function, so every role can call them.
--   * Named grants. Supabase's default privileges GRANT ALL ON FUNCTIONS in public to anon and
--     authenticated by name when a function is created, and REVOKE ... FROM PUBLIC leaves those.
-- A SECURITY DEFINER function runs as its owner. These take site, order, buyer and actor ids as
-- parameters and trust the caller to have authorised them, which the gateway does as service_role.
-- Called as anon, issue_gift_card created an active gift card worth 5,000 rupees at an arbitrary store
-- with a code of the caller's choosing. Refunds, ledger postings, payment confirmation, loyalty,
-- inventory and queue functions are in the same state. On a project whose Data API exposes public
-- (PostgREST's default), the anon key, which every client ships, reaches any of them at
-- /rest/v1/rpc/<name>.
--
-- ============================================================================
-- WHAT THIS DOES
-- ============================================================================
-- For every SECURITY DEFINER function in public, except those an RLS policy calls:
--   1. Where PUBLIC holds EXECUTE, EXECUTE is granted explicitly to app_tenant and service_role, the
--      only roles the backend uses, and then revoked from PUBLIC. Their effective access does not
--      change; everyone else's goes.
--   2. EXECUTE is revoked from anon and authenticated by name.
-- A policy evaluates its functions as the querying role, so revoking one would turn "no rows" into a
-- permission error for whoever the policy serves. Those are skipped: at the time of writing only
-- is_super_admin(), which 19 policies call. The list is computed from pg_policy, not typed.
-- Then the default privilege that granted EXECUTE on future functions to anon and authenticated is
-- removed, and the result is verified: the migration fails if any definer function outside the policy
-- set is still executable by either role. Every change is first written to
-- public.migration_privilege_journal, so the rollback restores exactly what this environment had.
--
-- ============================================================================
-- WHAT IT DOES NOT DO
-- ============================================================================
--   * No application path is affected. The gateway, queue workers and webhook service call RPCs as
--     service_role, and nothing calls an RPC with the anon key or a user token
--     (getSupabaseUser in services/api-gateway/src/lib/supabase.ts has no caller).
--   * app_tenant keeps exactly the access it had. Whether app_tenant should be able to execute money
--     functions it inherited through PUBLIC is a per-function question this migration does not decide.
--   * No function body changes.
--   * It does not establish whether the live project was exposed. That depends on the live default
--     privileges and Data API settings; the check is external action E-11 in
--     docs/evidence/appid-2026-09-24/EXTERNAL_ACTIONS.md.
--
-- Rollback: database/supabase/rollback/256_definer_functions_off_the_data_api.rollback.sql

BEGIN;

-- Signatures are journaled as regprocedure text; pinning the path makes them resolve the same way when
-- the rollback replays them.
SET LOCAL search_path = public, pg_catalog;

-- What this migration changes, recorded before it changes it, so the rollback restores exactly this
-- environment's prior state (whether the Data API roles held named grants depends on the project's
-- default privileges, which differ between Supabase images). Readable by no API or tenant role.
CREATE TABLE IF NOT EXISTS public.migration_privilege_journal (
  migration text NOT NULL,
  object_signature text NOT NULL,
  grantee text NOT NULL,
  privilege text NOT NULL,
  action text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (migration, object_signature, grantee, privilege, action),
  CONSTRAINT migration_privilege_journal_action_check CHECK (action IN ('revoked', 'granted'))
);
ALTER TABLE public.migration_privilege_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_privilege_journal FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.migration_privilege_journal FROM PUBLIC, anon, authenticated, app_tenant;
-- Read-only for the backend role, because every public relation must be readable by service_role on a
-- database built from these migrations (254's invariant, enforced by service-role-fresh-db-grants).
GRANT SELECT ON public.migration_privilege_journal TO service_role;

DO $sec1$
DECLARE
  v_policy_text text;
  v_fn          record;
  v_role        text;
  v_moved       integer := 0;
  v_revoked     integer := 0;
  v_kept        text[] := ARRAY[]::text[];
BEGIN
  SELECT coalesce(string_agg(
           coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' ||
           coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), ''), ' '), '')
    INTO v_policy_text
    FROM pg_catalog.pg_policy pol;

  FOR v_fn IN
    SELECT p.oid, p.proname, p.oid::regprocedure::text AS signature,
           coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner)) AS acl
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef
     ORDER BY p.proname, p.oid
  LOOP
    IF v_policy_text ~ ('\m' || v_fn.proname || '\s*\(') THEN
      v_kept := v_kept || v_fn.proname::text;
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_catalog.aclexplode(v_fn.acl) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
      -- Keep the backend's access, explicitly, before PUBLIC goes. Journal only the grants added here.
      FOREACH v_role IN ARRAY ARRAY['app_tenant', 'service_role'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_catalog.aclexplode(v_fn.acl) a
                        WHERE a.grantee = v_role::regrole::oid AND a.privilege_type = 'EXECUTE') THEN
          EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', v_fn.signature, v_role);
          INSERT INTO public.migration_privilege_journal (migration, object_signature, grantee, privilege, action)
          VALUES ('256', v_fn.signature, v_role, 'EXECUTE', 'granted');
        END IF;
      END LOOP;
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_fn.signature);
      INSERT INTO public.migration_privilege_journal (migration, object_signature, grantee, privilege, action)
      VALUES ('256', v_fn.signature, 'PUBLIC', 'EXECUTE', 'revoked');
      v_moved := v_moved + 1;
    END IF;

    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_catalog.aclexplode(v_fn.acl) a
                  WHERE a.grantee = v_role::regrole::oid AND a.privilege_type = 'EXECUTE') THEN
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM %I', v_fn.signature, v_role);
        INSERT INTO public.migration_privilege_journal (migration, object_signature, grantee, privilege, action)
        VALUES ('256', v_fn.signature, v_role, 'EXECUTE', 'revoked');
      END IF;
    END LOOP;
    v_revoked := v_revoked + 1;
  END LOOP;

  -- The default privilege, journaled per role only where it was actually granted.
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_default_acl d, pg_catalog.aclexplode(d.defaclacl) a
       WHERE d.defaclrole = current_user::regrole::oid
         AND d.defaclnamespace = 'public'::regnamespace::oid
         AND d.defaclobjtype = 'f'
         AND a.grantee = v_role::regrole::oid AND a.privilege_type = 'EXECUTE'
    ) THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I', v_role);
      INSERT INTO public.migration_privilege_journal (migration, object_signature, grantee, privilege, action)
      VALUES ('256', 'DEFAULT PRIVILEGES IN SCHEMA public ON FUNCTIONS', v_role, 'EXECUTE', 'revoked');
    END IF;
  END LOOP;

  RAISE NOTICE '256: % definer functions closed to anon and authenticated (% had EXECUTE through PUBLIC, now granted to app_tenant and service_role explicitly); kept for RLS policies: %',
    v_revoked, v_moved, v_kept;
END;
$sec1$;

DO $sec1_verify$
DECLARE
  v_open text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.oid::regprocedure::text)
    INTO v_open
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.prosecdef
     AND (pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
          OR pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE'))
     AND NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_policy pol
        WHERE (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' ||
               coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')) ~ ('\m' || p.proname || '\s*\('));
  IF v_open IS NOT NULL THEN
    RAISE EXCEPTION '256: still executable by anon or authenticated: %', v_open;
  END IF;
END;
$sec1_verify$;

COMMIT;
