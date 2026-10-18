-- N1.3: the sole Identity issuer exchanges a verified, purpose-bound operator
-- magic link into the existing durable Console session in ONE transaction.
-- No new identity owner or generic grant/token authority is introduced.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:332:operator-exchange',0));
ALTER TABLE public.console_magic_link_consumptions ADD COLUMN IF NOT EXISTS exchange_session_id uuid;
CREATE OR REPLACE FUNCTION public.exchange_identity_console_magic_v1(
 p_magic_jti uuid,p_email text,p_actor_id uuid,p_magic_issued_at timestamptz,p_magic_expires_at timestamptz,
 p_session_id uuid,p_cookie_sha256 text,p_issued_at timestamptz,p_expires_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
DECLARE v_identity jsonb; v_state jsonb; v_consumed public.console_magic_link_consumptions%ROWTYPE;
BEGIN
 IF p_magic_jti IS NULL OR p_actor_id IS NULL OR p_email IS NULL OR p_email<>lower(trim(p_email))
  OR p_magic_issued_at IS NULL OR p_magic_expires_at IS NULL OR p_magic_expires_at<=clock_timestamp()
  OR p_magic_issued_at>clock_timestamp()+interval '30 seconds'
  OR p_magic_expires_at<=p_magic_issued_at OR p_magic_expires_at>p_magic_issued_at+interval '15 minutes'
  OR p_session_id IS NULL OR p_cookie_sha256 IS NULL OR p_cookie_sha256 !~ '^[0-9a-f]{64}$'
  OR p_issued_at IS NULL OR p_issued_at<clock_timestamp()-interval '60 seconds'
  OR p_issued_at>clock_timestamp()+interval '30 seconds' OR p_expires_at IS NULL
  OR p_expires_at<=clock_timestamp() OR p_expires_at<=p_issued_at OR p_expires_at>p_issued_at+interval '8 hours' THEN
  RETURN jsonb_build_object('accepted',false,'code','CONSOLE_MAGIC_INVALID');
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:console-actor:'||p_actor_id::text,0));
 v_identity:=public.resolve_console_operator_v1(p_email,p_actor_id);
 IF NOT coalesce((v_identity->>'accepted')::boolean,false) THEN RETURN v_identity; END IF;
 SELECT * INTO v_consumed FROM public.console_magic_link_consumptions WHERE jti=p_magic_jti::text FOR UPDATE;
 IF FOUND THEN
  -- Only an exact prepared exchange may recover a committed lost response.
  -- A different signed candidate cannot redeem the same magic proof twice.
  IF v_consumed.email=p_email AND v_consumed.exchange_session_id=p_session_id
   AND v_consumed.expires_at=p_magic_expires_at THEN
   RETURN public.console_session_state_v1(p_session_id,p_cookie_sha256);
  END IF;
  RETURN jsonb_build_object('accepted',false,'code','CONSOLE_MAGIC_REPLAYED');
 END IF;
 BEGIN
  INSERT INTO public.console_magic_link_consumptions(jti,email,expires_at,exchange_session_id)
   VALUES(p_magic_jti::text,p_email,p_magic_expires_at,p_session_id);
  v_state:=public.transition_console_session_v1('register',p_session_id,p_cookie_sha256,p_email,p_actor_id,p_issued_at,p_expires_at,NULL,NULL,NULL);
  IF NOT coalesce((v_state->>'accepted')::boolean,false) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='CONSOLE_EXCHANGE_REFUSED';
  END IF;
 EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('accepted',false,'code','CONSOLE_MAGIC_REPLAYED');
 WHEN SQLSTATE 'P0001' THEN
  IF SQLERRM<>'CONSOLE_EXCHANGE_REFUSED' THEN RAISE; END IF;
  RETURN coalesce(v_state,jsonb_build_object('accepted',false,'code','CONSOLE_MAGIC_INVALID'));
 END;
 RETURN v_state;
END $function$;
REVOKE ALL ON FUNCTION public.exchange_identity_console_magic_v1(uuid,text,uuid,timestamptz,timestamptz,uuid,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.exchange_identity_console_magic_v1(uuid,text,uuid,timestamptz,timestamptz,uuid,text,timestamptz,timestamptz) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
