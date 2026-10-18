-- Remove only 314's executable adapters. Canonical identity/session/audit rows
-- remain intact, including revocations; rollback must not resurrect a cookie.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:314:console-sessions',0));
DROP TRIGGER IF EXISTS console_allowlist_session_revocation_v1 ON public.super_admin_allowlist;
DROP TRIGGER IF EXISTS console_staff_session_revocation_v1 ON public.employees;
DROP TRIGGER IF EXISTS console_principal_session_revocation_v1 ON public.principals;
DROP TRIGGER IF EXISTS console_identity_session_revocation_v1 ON public.users_custom;
DROP FUNCTION IF EXISTS public.revoke_console_identity_sessions_v1();
DROP FUNCTION IF EXISTS public.revoke_console_membership_sessions_v1();
DROP FUNCTION IF EXISTS public.transition_console_session_v1(text,uuid,text,text,uuid,timestamptz,timestamptz,timestamptz,uuid,text);
DROP FUNCTION IF EXISTS public.console_session_state_v1(uuid,text);
DROP FUNCTION IF EXISTS public.resolve_console_operator_v1(text,uuid);
NOTIFY pgrst,'reload schema';
COMMIT;
