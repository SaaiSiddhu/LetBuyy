-- 257 — buyers can prove their email address, recover their password and end every session
-- (APPID-P4a, D-ONE-IDENTITY / D-ONE-BUYER, OWNER_DECISION 2026-09-24).
--
-- ============================================================================
-- WHAT IS MISSING (measured)
-- ============================================================================
-- buyer_accounts are created with email_verified = false and nothing can ever set it. Since 255, an
-- unverified buyer cannot link a store record or claim an order, so today no buyer can. There is no
-- buyer password recovery, and a buyer session token lives for 30 days with no way to end it early.
-- The founder, 2026-09-24: "Route login, recovery and verification through identity." and "Define
-- application logout versus account-wide sign-out. Invalidate the correct sessions."
--
-- ============================================================================
-- WHAT THIS ADDS
-- ============================================================================
-- 1. buyer_email_challenges: one-time codes sent to the account's address, for 'verify_email' and
--    'reset_password'. The code is generated here, returned once to the gateway, which emails it and
--    never returns it to any caller, and stored only as sha256(salt || code). A challenge
--    lives 10 minutes, allows 5 wrong attempts, and is consumed atomically under a row lock, so a code
--    works once. Starting a new challenge supersedes the buyer's open ones for that purpose, and at
--    most 5 may be started per buyer per purpose per hour.
-- 2. buyer_accounts.session_epoch. Every buyer token identity-platform issues carries the epoch it was
--    issued in, and the gateway refuses a token from an older epoch. A password reset and "sign out
--    everywhere" increment it, which ends every session on every device at once. Application logout
--    (clearing one client's cookie or token) does not touch it.
-- 3. The functions that do all of this, each writing its outcome to audit_logs. A verify or reset
--    succeeds only if the account's address is still the one the code was sent to.
--
-- Codes are 6 digits. What bounds guessing is the attempt limit and the lifetime, not the hash; the
-- hash keeps a code that is still valid out of a database dump or a log of this table.
--
-- Platform-only like 223 and 255: FORCE RLS, service_role only, and every function revoked from
-- PUBLIC, anon, authenticated and app_tenant by name (tests/governance/definer-function-api-roles.test.mjs).
--
-- Rollback: database/supabase/rollback/257_buyer_email_challenges.rollback.sql

BEGIN;

ALTER TABLE public.buyer_accounts
  ADD COLUMN IF NOT EXISTS session_epoch integer NOT NULL DEFAULT 1;
ALTER TABLE public.buyer_accounts DROP CONSTRAINT IF EXISTS buyer_accounts_session_epoch_check;
ALTER TABLE public.buyer_accounts ADD CONSTRAINT buyer_accounts_session_epoch_check CHECK (session_epoch >= 1);

CREATE TABLE IF NOT EXISTS public.buyer_email_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_account_id uuid NOT NULL REFERENCES public.buyer_accounts(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  email text NOT NULL,
  code_salt text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_email_challenges_purpose_check CHECK (purpose IN ('verify_email', 'reset_password')),
  CONSTRAINT buyer_email_challenges_outcome_check
    CHECK (outcome IS NULL OR outcome IN ('verified', 'password_reset', 'superseded', 'locked', 'address_changed')),
  CONSTRAINT buyer_email_challenges_attempts_check CHECK (attempts >= 0 AND attempts <= max_attempts)
);

CREATE INDEX IF NOT EXISTS buyer_email_challenges_buyer_idx
  ON public.buyer_email_challenges (buyer_account_id, purpose, created_at DESC);

ALTER TABLE public.buyer_email_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_email_challenges FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages buyer email challenges" ON public.buyer_email_challenges;
CREATE POLICY "Service role manages buyer email challenges" ON public.buyer_email_challenges
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.buyer_email_challenges FROM PUBLIC, anon, authenticated, app_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_email_challenges TO service_role;

-- ---------------------------------------------------------------------------------------------------
-- Start a challenge. Returns the code exactly once. Outcomes: started | buyer_unavailable | rate_limited.
-- ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_buyer_email_challenge(
  p_buyer_account_id uuid,
  p_purpose text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_buyer  public.buyer_accounts%ROWTYPE;
  v_recent integer;
  v_code   text;
  v_salt   text;
  v_id     uuid;
  v_expiry timestamptz := now() + interval '10 minutes';
BEGIN
  IF p_buyer_account_id IS NULL OR p_purpose NOT IN ('verify_email', 'reset_password') THEN
    RAISE EXCEPTION 'buyer account and a known purpose are required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('buyer_email_challenge:' || p_buyer_account_id::text || ':' || p_purpose, 0));

  SELECT * INTO v_buyer FROM public.buyer_accounts WHERE id = p_buyer_account_id FOR SHARE;
  IF NOT FOUND OR v_buyer.status <> 'active' THEN
    RETURN jsonb_build_object('outcome', 'buyer_unavailable');
  END IF;

  SELECT count(*) INTO v_recent
    FROM public.buyer_email_challenges
   WHERE buyer_account_id = p_buyer_account_id AND purpose = p_purpose
     AND created_at > now() - interval '1 hour';
  IF v_recent >= 5 THEN
    RETURN jsonb_build_object('outcome', 'rate_limited');
  END IF;

  UPDATE public.buyer_email_challenges
     SET consumed_at = now(), outcome = 'superseded'
   WHERE buyer_account_id = p_buyer_account_id AND purpose = p_purpose AND consumed_at IS NULL;

  -- Six uniform digits: 4 random bytes reduced modulo 10^6 (a bias below 0.03%, immaterial for a
  -- code limited to 5 guesses).
  v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint & 4294967295) % 1000000)::text, 6, '0');
  v_salt := encode(extensions.gen_random_bytes(16), 'hex');

  INSERT INTO public.buyer_email_challenges (buyer_account_id, purpose, email, code_salt, code_hash, expires_at)
  VALUES (p_buyer_account_id, p_purpose, v_buyer.email, v_salt,
          encode(extensions.digest(v_salt || v_code, 'sha256'), 'hex'), v_expiry)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
  VALUES (p_buyer_account_id, 'buyer', 'buyer_email_challenge.started', 'buyer_account', p_buyer_account_id,
          jsonb_build_object('purpose', p_purpose, 'challenge_id', v_id));

  RETURN jsonb_build_object('outcome', 'started', 'challenge_id', v_id, 'code', v_code,
                            'email', v_buyer.email, 'expires_at', v_expiry);
END;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Consume the buyer's open challenge for a purpose. Starting a challenge supersedes the others, so there
-- is at most one. It is found by buyer and purpose rather than by an id the client holds, because a
-- recovering buyer knows only their address: an id handed out only when the account exists would tell
-- whoever asked that it does. For 'reset_password', p_new_password_hash (bcrypt, computed by the
-- gateway) is required and the account's session epoch advances, ending every existing session.
-- Outcomes: verified | password_reset | invalid | expired | locked | address_changed | buyer_unavailable.
-- ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_buyer_email_challenge(
  p_buyer_account_id uuid,
  p_purpose text,
  p_code text,
  p_new_password_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_ch     public.buyer_email_challenges%ROWTYPE;
  v_buyer  public.buyer_accounts%ROWTYPE;
  v_epoch  integer;
BEGIN
  IF p_buyer_account_id IS NULL OR p_purpose IS NULL OR p_code IS NULL THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;
  IF p_purpose = 'reset_password' AND nullif(p_new_password_hash, '') IS NULL THEN
    RAISE EXCEPTION 'a new password hash is required to reset a password';
  END IF;

  -- Row-locked, so two requests carrying the right code cannot both succeed: the second re-reads the
  -- row after the first commits, finds it consumed, and gets 'invalid'.
  SELECT * INTO v_ch
    FROM public.buyer_email_challenges
   WHERE buyer_account_id = p_buyer_account_id AND purpose = p_purpose AND consumed_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;
  IF v_ch.expires_at <= now() THEN
    RETURN jsonb_build_object('outcome', 'expired');
  END IF;

  IF encode(extensions.digest(v_ch.code_salt || p_code, 'sha256'), 'hex') <> v_ch.code_hash THEN
    UPDATE public.buyer_email_challenges
       SET attempts = attempts + 1,
           consumed_at = CASE WHEN attempts + 1 >= max_attempts THEN now() END,
           outcome = CASE WHEN attempts + 1 >= max_attempts THEN 'locked' END
     WHERE id = v_ch.id;
    RETURN jsonb_build_object('outcome', CASE WHEN v_ch.attempts + 1 >= v_ch.max_attempts THEN 'locked' ELSE 'invalid' END);
  END IF;

  SELECT * INTO v_buyer FROM public.buyer_accounts WHERE id = v_ch.buyer_account_id FOR UPDATE;
  IF NOT FOUND OR v_buyer.status <> 'active' THEN
    UPDATE public.buyer_email_challenges SET consumed_at = now() WHERE id = v_ch.id;
    RETURN jsonb_build_object('outcome', 'buyer_unavailable');
  END IF;
  -- The code proves control of the address it was sent to, and nothing else.
  IF v_buyer.email <> v_ch.email THEN
    UPDATE public.buyer_email_challenges SET consumed_at = now(), outcome = 'address_changed' WHERE id = v_ch.id;
    RETURN jsonb_build_object('outcome', 'address_changed');
  END IF;

  IF v_ch.purpose = 'verify_email' THEN
    UPDATE public.buyer_accounts SET email_verified = true, updated_at = now() WHERE id = v_buyer.id;
    UPDATE public.buyer_email_challenges SET consumed_at = now(), outcome = 'verified' WHERE id = v_ch.id;
    INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
    VALUES (v_buyer.id, 'buyer', 'buyer_email.verified', 'buyer_account', v_buyer.id,
            jsonb_build_object('challenge_id', v_ch.id));
    RETURN jsonb_build_object('outcome', 'verified', 'buyer_account_id', v_buyer.id, 'session_epoch', v_buyer.session_epoch);
  END IF;

  -- reset_password: proving the address also verifies it, and every existing session ends.
  UPDATE public.buyer_accounts
     SET password_hash = p_new_password_hash,
         email_verified = true,
         session_epoch = session_epoch + 1,
         updated_at = now()
   WHERE id = v_buyer.id
  RETURNING session_epoch INTO v_epoch;
  UPDATE public.buyer_email_challenges SET consumed_at = now(), outcome = 'password_reset' WHERE id = v_ch.id;
  INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
  VALUES (v_buyer.id, 'buyer', 'buyer_password.reset', 'buyer_account', v_buyer.id,
          jsonb_build_object('challenge_id', v_ch.id, 'session_epoch', v_epoch));
  RETURN jsonb_build_object('outcome', 'password_reset', 'buyer_account_id', v_buyer.id, 'session_epoch', v_epoch);
END;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Sign out everywhere: every token issued before this call stops working.
-- ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_buyer_sessions(p_buyer_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_epoch integer;
BEGIN
  IF p_buyer_account_id IS NULL THEN
    RAISE EXCEPTION 'buyer account is required';
  END IF;
  UPDATE public.buyer_accounts
     SET session_epoch = session_epoch + 1, updated_at = now()
   WHERE id = p_buyer_account_id
  RETURNING session_epoch INTO v_epoch;
  IF v_epoch IS NULL THEN
    RETURN jsonb_build_object('outcome', 'buyer_unavailable');
  END IF;
  INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
  VALUES (p_buyer_account_id, 'buyer', 'buyer_sessions.revoked', 'buyer_account', p_buyer_account_id,
          jsonb_build_object('session_epoch', v_epoch));
  RETURN jsonb_build_object('outcome', 'revoked', 'session_epoch', v_epoch);
END;
$$;

REVOKE ALL ON FUNCTION public.start_buyer_email_challenge(uuid, text) FROM PUBLIC, anon, authenticated, app_tenant;
REVOKE ALL ON FUNCTION public.consume_buyer_email_challenge(uuid, text, text, text) FROM PUBLIC, anon, authenticated, app_tenant;
REVOKE ALL ON FUNCTION public.revoke_buyer_sessions(uuid) FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.start_buyer_email_challenge(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_buyer_email_challenge(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_buyer_sessions(uuid) TO service_role;

COMMIT;
