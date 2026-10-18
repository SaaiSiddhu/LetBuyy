-- Never restore plaintext receipts or the direct authenticated factor writer.
-- Once a command exists its replay/credential history requires forward repair.
BEGIN;
LOCK TABLE public.merchant_totp_commands_v1 IN ACCESS EXCLUSIVE MODE;
DO $guard$DECLARE p pg_catalog.pg_proc;BEGIN
 IF EXISTS(SELECT 1 FROM public.merchant_totp_commands_v1) THEN RAISE EXCEPTION 'rollback338 refuses merchant credential command history; use forward repair';END IF;
 IF (SELECT count(*)FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('execute_merchant_totp_command_v1','retire_merchant_totp_http_credentials_v1'))<>2
  OR to_regprocedure('public.execute_merchant_totp_command_v1(uuid,text,text,jsonb)')IS NULL
  OR to_regprocedure('public.retire_merchant_totp_http_credentials_v1()')IS NULL THEN RAISE EXCEPTION 'rollback338 refuses changed command ABI';END IF;
 SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.execute_merchant_totp_command_v1(uuid,text,text,jsonb)');
 IF p.oid IS NULL OR p.prokind<>'f' OR p.prorettype<>'jsonb'::regtype OR p.proretset OR array_to_string(p.proargnames,',')IS DISTINCT FROM 'p_actor_id,p_command,p_key,p_input' THEN
  RAISE EXCEPTION 'rollback338 refuses changed command ABI';END IF;
 SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=to_regprocedure('public.retire_merchant_totp_http_credentials_v1()');
 IF p.oid IS NULL OR p.prokind<>'f' OR p.prorettype<>'integer'::regtype OR p.proretset OR p.pronargs<>0 THEN
  RAISE EXCEPTION 'rollback338 refuses changed retirement ABI';END IF;
END $guard$;
DROP FUNCTION public.execute_merchant_totp_command_v1(uuid,text,text,jsonb);
DROP FUNCTION public.retire_merchant_totp_http_credentials_v1();
DROP TABLE public.merchant_totp_commands_v1;
-- Stronger table privileges intentionally retained. Old unsafe writers must not
-- be re-enabled by a schema rollback; a reviewed forward release is required.
COMMIT;
