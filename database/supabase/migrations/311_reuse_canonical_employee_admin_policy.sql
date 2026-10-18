-- The duplicate inline admin policy reads an allowlist that tenant roles cannot
-- access. Reuse the existing policy helper with the same active-user predicate.
-- No allowlist privilege or new identity authority is introduced.
BEGIN;
DO $guard$
DECLARE v_policy pg_catalog.pg_policy%ROWTYPE; v_expression text;
BEGIN
  SELECT * INTO v_policy FROM pg_catalog.pg_policy
   WHERE polrelid='public.employees'::regclass AND polname='super_admin_manage_employees';
  v_expression := regexp_replace(pg_catalog.pg_get_expr(v_policy.polqual,v_policy.polrelid),'\s+','','g');
  IF NOT FOUND OR NOT v_policy.polpermissive OR v_policy.polcmd <> '*'
     OR v_policy.polroles IS DISTINCT FROM ARRAY[0::oid] OR v_policy.polwithcheck IS NOT NULL
     OR v_expression NOT IN ('is_super_admin()',
       '(EXISTS(SELECT1FROMsuper_admin_allowlistWHERE((super_admin_allowlist.user_id=auth.uid())AND(super_admin_allowlist.is_active=true))))') THEN
    RAISE EXCEPTION 'migration 311 refuses a changed employee admin policy';
  END IF;
  ALTER POLICY super_admin_manage_employees ON public.employees USING (public.is_super_admin());
END;
$guard$;
COMMIT;
