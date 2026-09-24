-- 259 — the marketplace app signs buyers in through identity-platform, and a narrow bridge records which
-- Firebase user is which buyer (APPID-P4d, D-ONE-IDENTITY / D-ONE-BUYER, OWNER_DECISION 2026-09-24).
--
-- ============================================================================
-- 1. THE MARKETPLACE APP AS A SECOND FIRST-PARTY CLIENT
-- ============================================================================
-- 258's codes serve one client, the storefront, whose codes are bound to a site. The marketplace app is
-- platform-wide: a buyer there spans sellers, so its code carries NO site, and it may return to exactly
-- one address, the app's private-scheme callback `com.letbuyy.letbuyy:/oauth/callback` (RFC 8252 §7.1).
-- The app is a public client with no secret; PKCE is what stops another app that registers the same
-- scheme from redeeming an intercepted code (RFC 8252 §8.1).
--
-- issue_buyer_authorization_code is replaced below as a copy of 258's with the client branch added. Every
-- 258 check is kept: CREATE OR REPLACE silently drops whatever the new body omits (see memory note
-- letbuyy-create-or-replace-drops-fixes). redeem_buyer_authorization_code is unchanged and already
-- returns a null site for this client.
--
-- ============================================================================
-- 2. buyer_firebase_links — A TEMPORARY BRIDGE, WITH ITS LIMITS
-- ============================================================================
-- The app still authenticates with Firebase, and 17 of the 24 screens that read the Firebase uid use it to
-- key Firestore (FB-3), so Firebase stays the live provider until each screen's data moves (FB-4). Moving
-- that data needs to know which buyer a Firebase uid belongs to. This table records it, and nothing else:
--   * Narrow purpose: a mapping for FB-4's data moves. It grants no access, no session and no token.
--   * Authority boundaries: written only by link_buyer_firebase_uid, called by the gateway after it has
--     verified a Firebase ID token and a LetBuyy buyer session for the same person. It links only when
--     the buyer's address is verified AND equals the Firebase account's verified address.
--   * No second canonical account: buyer_accounts stays the one buyer principal; a uid maps to at most
--     one buyer and never creates or merges one.
--   * Retirement gate: dropped with the Firebase project at FB-5, after FB-4 has moved every screen's data.
--   * Security tests: tests/executable/marketplace-app-client-postgres.test.mjs.
--
-- Platform-only like 255, 257 and 258: FORCE RLS, service_role only, every function revoked from PUBLIC,
-- anon, authenticated and app_tenant by name.
--
-- Rollback: database/supabase/rollback/259_marketplace_app_client_and_firebase_links.rollback.sql

BEGIN;

ALTER TABLE public.buyer_authorization_codes DROP CONSTRAINT IF EXISTS buyer_authorization_codes_client_check;
ALTER TABLE public.buyer_authorization_codes ADD CONSTRAINT buyer_authorization_codes_client_check
  CHECK (client_id IN ('letbuyy-storefront', 'letbuyy-marketplace-app'));
-- A storefront code always names its site; an app code never does.
ALTER TABLE public.buyer_authorization_codes DROP CONSTRAINT IF EXISTS buyer_authorization_codes_storefront_site_check;
ALTER TABLE public.buyer_authorization_codes DROP CONSTRAINT IF EXISTS buyer_authorization_codes_site_check;
ALTER TABLE public.buyer_authorization_codes ADD CONSTRAINT buyer_authorization_codes_site_check
  CHECK ((client_id = 'letbuyy-storefront') = (site_id IS NOT NULL));

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
  IF p_redirect_uri IS NULL OR p_redirect_uri = ''
     OR p_code_challenge IS NULL OR p_code_challenge !~ '^[A-Za-z0-9_-]{43}$' THEN
    RETURN jsonb_build_object('outcome', 'invalid_request');
  END IF;

  IF p_client_id = 'letbuyy-storefront' THEN
    -- 258's rule: a storefront code names a live site; the gateway resolved it from the callback's host.
    IF p_site_id IS NULL THEN
      RETURN jsonb_build_object('outcome', 'invalid_request');
    END IF;
  ELSIF p_client_id = 'letbuyy-marketplace-app' THEN
    -- The app is platform-wide and has exactly one callback.
    IF p_site_id IS NOT NULL OR p_redirect_uri <> 'com.letbuyy.letbuyy:/oauth/callback' THEN
      RETURN jsonb_build_object('outcome', 'invalid_request');
    END IF;
  ELSE
    RETURN jsonb_build_object('outcome', 'invalid_request');
  END IF;

  SELECT * INTO v_buyer FROM public.buyer_accounts WHERE id = p_buyer_account_id FOR SHARE;
  IF NOT FOUND OR v_buyer.status <> 'active' THEN
    RETURN jsonb_build_object('outcome', 'buyer_unavailable');
  END IF;

  IF p_site_id IS NOT NULL THEN
    PERFORM 1 FROM public.sites s WHERE s.id = p_site_id AND s.deleted_at IS NULL;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('outcome', 'invalid_request');
    END IF;
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

REVOKE ALL ON FUNCTION public.issue_buyer_authorization_code(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.issue_buyer_authorization_code(uuid, text, text, uuid, text) TO service_role;

CREATE TABLE IF NOT EXISTS public.buyer_firebase_links (
  firebase_uid text PRIMARY KEY,
  buyer_account_id uuid NOT NULL REFERENCES public.buyer_accounts(id) ON DELETE CASCADE,
  firebase_project text NOT NULL,
  email_at_link text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_firebase_links_uid_check CHECK (char_length(firebase_uid) BETWEEN 1 AND 128),
  CONSTRAINT buyer_firebase_links_project_check CHECK (firebase_project ~ '^[a-z0-9-]{4,64}$')
);

CREATE INDEX IF NOT EXISTS buyer_firebase_links_buyer_idx ON public.buyer_firebase_links (buyer_account_id);

ALTER TABLE public.buyer_firebase_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyer_firebase_links FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages buyer Firebase links" ON public.buyer_firebase_links;
CREATE POLICY "Service role manages buyer Firebase links" ON public.buyer_firebase_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.buyer_firebase_links FROM PUBLIC, anon, authenticated, app_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_firebase_links TO service_role;

-- ---------------------------------------------------------------------------------------------------
-- Link a Firebase user to the buyer, once both have proven the same address. The gateway calls this only
-- after verifying the Firebase ID token (signature, project, email_verified) and the buyer's session.
-- Outcomes: linked | already_linked | conflict | unverified | email_mismatch | buyer_unavailable.
-- ---------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_buyer_firebase_uid(
  p_buyer_account_id uuid,
  p_firebase_uid text,
  p_firebase_project text,
  p_firebase_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_buyer public.buyer_accounts%ROWTYPE;
  v_link  public.buyer_firebase_links%ROWTYPE;
  v_email text := lower(btrim(coalesce(p_firebase_email, '')));
BEGIN
  IF p_buyer_account_id IS NULL OR coalesce(p_firebase_uid, '') = '' OR coalesce(p_firebase_project, '') = '' OR v_email = '' THEN
    RAISE EXCEPTION 'buyer, Firebase uid, project and email are required';
  END IF;

  SELECT * INTO v_buyer FROM public.buyer_accounts WHERE id = p_buyer_account_id FOR UPDATE;
  IF NOT FOUND OR v_buyer.status <> 'active' THEN
    RETURN jsonb_build_object('outcome', 'buyer_unavailable');
  END IF;
  -- The buyer's own address must be proven, not merely typed: linking on an unverified address would
  -- let whoever registered it first claim someone's Firebase-era data.
  IF NOT v_buyer.email_verified THEN
    RETURN jsonb_build_object('outcome', 'unverified');
  END IF;
  IF v_buyer.email <> v_email THEN
    INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
    VALUES (v_buyer.id, 'buyer', 'buyer_firebase_link.email_mismatch', 'buyer_account', v_buyer.id,
            jsonb_build_object('firebase_project', p_firebase_project));
    RETURN jsonb_build_object('outcome', 'email_mismatch');
  END IF;

  SELECT * INTO v_link FROM public.buyer_firebase_links WHERE firebase_uid = p_firebase_uid FOR UPDATE;
  IF FOUND THEN
    IF v_link.buyer_account_id = v_buyer.id THEN
      RETURN jsonb_build_object('outcome', 'already_linked');
    END IF;
    -- Never re-point a uid: the first verified owner keeps it, and the conflict is left for a person.
    INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
    VALUES (v_buyer.id, 'buyer', 'buyer_firebase_link.conflict', 'buyer_account', v_buyer.id,
            jsonb_build_object('firebase_project', p_firebase_project, 'linked_buyer_account_id', v_link.buyer_account_id));
    RETURN jsonb_build_object('outcome', 'conflict');
  END IF;

  INSERT INTO public.buyer_firebase_links (firebase_uid, buyer_account_id, firebase_project, email_at_link)
  VALUES (p_firebase_uid, v_buyer.id, p_firebase_project, v_email);
  INSERT INTO public.audit_logs (actor_id, actor_type, action, resource_type, resource_id, metadata)
  VALUES (v_buyer.id, 'buyer', 'buyer_firebase_link.linked', 'buyer_account', v_buyer.id,
          jsonb_build_object('firebase_project', p_firebase_project));
  RETURN jsonb_build_object('outcome', 'linked');
END;
$$;

REVOKE ALL ON FUNCTION public.link_buyer_firebase_uid(uuid, text, text, text) FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.link_buyer_firebase_uid(uuid, text, text, text) TO service_role;

COMMIT;
