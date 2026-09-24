-- Rollback of 259: the marketplace app client and the Firebase link bridge.
--
-- Destructive where 259 created data: buyer_firebase_links is dropped (the mappings FB-4 would use are
-- lost and would have to be re-established by buyers signing in again), and any code issued to the app
-- is deleted so 258's constraints can return. issue_buyer_authorization_code is restored to 258's
-- storefront-only body. identity-platform and the gateway must be rolled back first, or the app's
-- sign-in fails at issue.

BEGIN;

DROP FUNCTION IF EXISTS public.link_buyer_firebase_uid(uuid, text, text, text);
DROP TABLE IF EXISTS public.buyer_firebase_links;

DELETE FROM public.buyer_authorization_codes WHERE client_id <> 'letbuyy-storefront';

ALTER TABLE public.buyer_authorization_codes DROP CONSTRAINT IF EXISTS buyer_authorization_codes_site_check;
ALTER TABLE public.buyer_authorization_codes DROP CONSTRAINT IF EXISTS buyer_authorization_codes_client_check;
ALTER TABLE public.buyer_authorization_codes ADD CONSTRAINT buyer_authorization_codes_client_check
  CHECK (client_id IN ('letbuyy-storefront'));
ALTER TABLE public.buyer_authorization_codes ADD CONSTRAINT buyer_authorization_codes_storefront_site_check
  CHECK (client_id <> 'letbuyy-storefront' OR site_id IS NOT NULL);

-- 258's body, verbatim. Dropped first, so a live function with some other parameter list can never
-- survive beside it as an overload (tests/governance/rollback-signature-precondition.test.mjs); the
-- grants below are restored with it.
DROP FUNCTION IF EXISTS public.issue_buyer_authorization_code(uuid, text, text, uuid, text);
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

REVOKE ALL ON FUNCTION public.issue_buyer_authorization_code(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.issue_buyer_authorization_code(uuid, text, text, uuid, text) TO service_role;

COMMIT;
