-- Restore the original inline policy; this reopens the tenant-role dependency
-- error. Prefer a reviewed forward repair. Employee/allowlist rows are retained.
BEGIN;
DO $rollback_precondition$
DECLARE v_policy pg_catalog.pg_policy%ROWTYPE;
BEGIN
  SELECT * INTO v_policy FROM pg_catalog.pg_policy
   WHERE polrelid='public.employees'::regclass AND polname='super_admin_manage_employees';
  IF NOT FOUND OR NOT v_policy.polpermissive OR v_policy.polcmd <> '*'
     OR v_policy.polroles IS DISTINCT FROM ARRAY[0::oid] OR v_policy.polwithcheck IS NOT NULL
     OR pg_catalog.pg_get_expr(v_policy.polqual,v_policy.polrelid) IS DISTINCT FROM 'is_super_admin()' THEN
    RAISE EXCEPTION 'rollback 311 refuses to run: employee admin policy changed or is missing';
  END IF;
END;
$rollback_precondition$;
ALTER POLICY super_admin_manage_employees ON public.employees USING (
  EXISTS (SELECT 1 FROM public.super_admin_allowlist
    WHERE super_admin_allowlist.user_id=auth.uid() AND super_admin_allowlist.is_active=true)
);
COMMIT;
