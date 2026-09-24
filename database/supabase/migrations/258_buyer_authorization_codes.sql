-- 258 — first-party authorization codes for buyer sign-in at a storefront (APPID-P4b, D-ONE-IDENTITY,
-- D-ONE-BUYER, OWNER_DECISION 2026-09-24).
--
-- ============================================================================
-- WHY A NEW TABLE, NOT 159'S authorization_codes
-- ============================================================================
-- 159's authorization_codes belongs to the general OIDC provider, which the founder deferred (ART-07):
-- it is keyed by principals, not buyer_accounts, and nothing writes it. Filling it for buyers would
-- give the buyer a second identity root beside buyer_accounts, which D-ONE-BUYER forbids. This table
-- serves one thing, the first-party code-plus-PKCE sign-in the founder chose for LetBuyy's own clients.
--
-- ============================================================================
-- THE FLOW THIS BACKS
-- ============================================================================
-- A storefront sends the buyer to identity-platform with a PKCE S256 challenge and its callback URL.
-- The buyer signs in there and chooses to continue to that store. The gateway resolves the callback's
-- host to a site with the storefront's own host resolver, and only then asks this migration's
-- issue_buyer_authorization_code for a code. The storefront's server exchanges the code and its PKCE
-- verifier at identity-platform, which redeems the code here and mints a session bound to that site.
--
-- A code is 32 random bytes, generated here, returned once and stored only as its SHA-256. It lives
-- 60 seconds and works once, under a row lock. Redemption must present the same client and exact
-- redirect URI, and a verifier whose S256 digest is the challenge. A code for an account whose
-- session epoch has moved since issue (a password reset, or sign-out-everywhere, in between) is
-- refused. Any failed redemption of a real code burns it, so a stolen code cannot be retried against
-- guessed verifiers. Every refusal has the same outcome, 'invalid_grant'; audit_logs records why.
--
-- Platform-only like 255 and 257: FORCE RLS, service_role only, every function revoked from PUBLIC,
-- anon, authenticated and app_tenant by name.
--
-- Rollback: database/supabase/rollback/258_buyer_authorization_codes.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.buyer_authorization_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  buyer_account_id uuid NOT NULL REFERENCES public.buyer_accounts(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  code_challenge text NOT NULL,
  session_epoch integer NOT NULL,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One first-party client today. The marketplace app joins in APPID-P4d, with its own redirect rule.
  CONSTRAINT buyer_authorization_codes_client_check CHECK (client_id IN ('letbuyy-storefront')),
  CONSTRAINT buyer_authorization_codes_storefront_site_check CHECK (client_id <> 'letbuyy-storefront' OR site_id IS NOT NULL),
  CONSTRAINT buyer_authorization_codes_challenge_check CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$')
);

CREATE INDEX IF NOT EXISTS buyer_authorization_codes_buyer_idx
  ON public.buyer_authorization_codes (buyer_account_id, created_at DESC);

ALTER TABLE public.buyer_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_authorization_codes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages buyer authorization codes" ON public.buyer_authorization_codes;
CREATE POLICY "Service role manages buyer authorization codes" ON public.buyer_authorization_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.buyer_authorization_codes FROM PUBLIC, anon, authenticated, app_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_authorization_codes TO service_role;

-- ---------------------------------------------------------------------------------------------------
-- Issue a code. The gateway has already resolved p_redirect_uri's host to p_site_id; this checks what
-- the database can: an active buyer, a known client, a live site, a well-formed challenge.
-- Outcomes: issued | buyer_unavailable | invalid_request.
-- ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_buyer_authorization_code(
  p_buyer_account_id uuid,
  p_client_id text,
  p_redirect_uri text,
  p_site_id uuid,
  p_code_challenge text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_buyer  public.buyer_accounts%ROWTYPE;
  v_code   text;
  v_expiry timestamptz := now() + interval '60 seconds';
BEGIN
  IF p_client_id IS DISTINCT FROM 'letbuyy-storefront'
     OR p_redirect_uri IS NULL OR p_redirect_uri = ''
     OR p_site_id IS NULL
     OR p_code_challenge IS NULL OR p_code_challenge !~ '^[A-Za-z0-9_-]{43}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_request');
  END IF;

  SELECT * INTO v_buyer FROM public.buyer_accounts WHERE id = p_buyer_account_id FOR SHARE;
  IF NOT FOUND OR v_buyer.status <> 'active' THEN
    RETURN jsonb_build_object('outcome', 'buyer_unavailable');
  END IF;

  PERFORM 1 FROM public.sites s WHERE s.id = p_site_id AND s.deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'invalid_request');
  END IF;

  -- base64url, unpadded: 43 characters from 32 random bytes.
  v_code := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

  INSERT INTO public.buyer_authorization_codes
    (code_hash, buyer_account_id, client_id, redirect_uri, site_id, code_challenge, session_epoch, expires_at)
  VALUES
    (encode(extensions.digest(v_code, 'sha256'), 'hex'), v_buyer.id, p_client_id, p_redirect_uri, p_site_id,
     p_code_challenge, v_buyer.session_epoch, v_expiry);

  INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
  VALUES (v_buyer.id, 'buyer', 'buyer_authorization_code.issued', 'buyer_account', v_buyer.id,
          jsonb_build_object('client_id', p_client_id, 'site_id', p_site_id));

  RETURN jsonb_build_object('outcome', 'issued', 'code', v_code, 'expires_at', v_expiry);
END;
$$;

-- ---------------------------------------------------------------------------------------------------
-- Redeem a code. Outcomes: redeemed | invalid_grant. Every refusal looks the same to the caller.
-- ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_buyer_authorization_code(
  p_code text,
  p_code_verifier text,
  p_client_id text,
  p_redirect_uri text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_row    public.buyer_authorization_codes%ROWTYPE;
  v_buyer  public.buyer_accounts%ROWTYPE;
  v_reason text;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[A-Za-z0-9_-]{43}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_grant');
  END IF;

  SELECT * INTO v_row
    FROM public.buyer_authorization_codes
   WHERE code_hash = encode(extensions.digest(p_code, 'sha256'), 'hex')
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'invalid_grant');
  END IF;

  IF v_row.redeemed_at IS NOT NULL THEN
    v_reason := 'already_redeemed';
  ELSIF v_row.expires_at <= now() THEN
    v_reason := 'expired';
  ELSIF p_client_id IS DISTINCT FROM v_row.client_id OR p_redirect_uri IS DISTINCT FROM v_row.redirect_uri THEN
    v_reason := 'client_or_redirect_mismatch';
  ELSIF p_code_verifier IS NULL OR p_code_verifier !~ '^[A-Za-z0-9._~-]{43,128}$'
     OR rtrim(translate(encode(extensions.digest(p_code_verifier, 'sha256'), 'base64'), '+/', '-_'), '=')
        <> v_row.code_challenge THEN
    v_reason := 'pkce_mismatch';
  END IF;

  IF v_reason IS NULL THEN
    SELECT * INTO v_buyer FROM public.buyer_accounts WHERE id = v_row.buyer_account_id FOR SHARE;
    IF NOT FOUND OR v_buyer.status <> 'active' THEN
      v_reason := 'buyer_unavailable';
    ELSIF v_buyer.session_epoch <> v_row.session_epoch THEN
      v_reason := 'session_ended';
    END IF;
  END IF;

  -- A real code is used up by any attempt: a refused one cannot be retried.
  UPDATE public.buyer_authorization_codes
     SET redeemed_at = COALESCE(redeemed_at, now())
   WHERE id = v_row.id;

  IF v_reason IS NOT NULL THEN
    INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
    VALUES (v_row.buyer_account_id, 'buyer', 'buyer_authorization_code.refused', 'buyer_account', v_row.buyer_account_id,
            jsonb_build_object('reason', v_reason, 'client_id', v_row.client_id, 'site_id', v_row.site_id));
    RETURN jsonb_build_object('outcome', 'invalid_grant');
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
  VALUES (v_row.buyer_account_id, 'buyer', 'buyer_authorization_code.redeemed', 'buyer_account', v_row.buyer_account_id,
          jsonb_build_object('client_id', v_row.client_id, 'site_id', v_row.site_id));

  RETURN jsonb_build_object('outcome', 'redeemed', 'buyer_account_id', v_row.buyer_account_id,
                            'site_id', v_row.site_id, 'client_id', v_row.client_id,
                            'session_epoch', v_row.session_epoch);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_buyer_authorization_code(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated, app_tenant;
REVOKE ALL ON FUNCTION public.redeem_buyer_authorization_code(text, text, text, text) FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.issue_buyer_authorization_code(uuid, text, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_buyer_authorization_code(text, text, text, text) TO service_role;

COMMIT;
