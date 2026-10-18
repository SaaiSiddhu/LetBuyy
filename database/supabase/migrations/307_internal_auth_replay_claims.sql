-- Persist single-use internal-auth JTIs across gateway isolates.
-- The signed assertion is verified by the gateway first; this narrow RPC then
-- atomically claims its random replay identifier for the short freshness window.

BEGIN;

CREATE TABLE IF NOT EXISTS public.internal_auth_replay_claims (
    auth_kind text NOT NULL CHECK (auth_kind ~ '^(identity|session|app:[A-Za-z0-9_-]{1,64})$'),
    jti text NOT NULL CHECK (jti ~ '^[A-Za-z0-9._~-]{16,128}$'),
    claimed_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    PRIMARY KEY (auth_kind, jti),
    CHECK (expires_at > claimed_at)
);

CREATE INDEX IF NOT EXISTS internal_auth_replay_claims_expiry_idx
    ON public.internal_auth_replay_claims (expires_at);

ALTER TABLE public.internal_auth_replay_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.internal_auth_replay_claims FROM PUBLIC, anon, authenticated, app_tenant, service_role;

CREATE OR REPLACE FUNCTION public.consume_internal_auth_replay_jti(
    p_auth_kind text,
    p_jti text,
    p_ttl_seconds integer DEFAULT 300
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
    v_claimed boolean := false;
    v_rows integer;
    v_now timestamptz := clock_timestamp();
BEGIN
    IF p_auth_kind IS NULL OR p_auth_kind !~ '^(identity|session|app:[A-Za-z0-9_-]{1,64})$'
       OR p_jti IS NULL OR p_jti !~ '^[A-Za-z0-9._~-]{16,128}$'
       OR p_ttl_seconds IS NULL OR p_ttl_seconds < 1 OR p_ttl_seconds > 600 THEN
        RAISE EXCEPTION 'invalid internal auth replay claim' USING ERRCODE = '22023';
    END IF;

    -- The unique key arbitrates simultaneous claims across every PostgREST and
    -- worker instance. An expired key may be atomically renewed by one caller.
    INSERT INTO public.internal_auth_replay_claims AS current_claim (auth_kind, jti, claimed_at, expires_at)
    VALUES (p_auth_kind, p_jti, v_now, v_now + make_interval(secs => p_ttl_seconds))
    ON CONFLICT (auth_kind, jti) DO UPDATE
       SET claimed_at = EXCLUDED.claimed_at,
           expires_at = EXCLUDED.expires_at
     WHERE current_claim.expires_at <= v_now;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_claimed := v_rows = 1;

    -- Bound cleanup work on each request while eventually removing expired JTIs.
    DELETE FROM public.internal_auth_replay_claims AS stale
     WHERE (stale.auth_kind, stale.jti) IN (
        SELECT expired.auth_kind, expired.jti
          FROM public.internal_auth_replay_claims AS expired
         WHERE expired.expires_at <= v_now
         ORDER BY expired.expires_at
         LIMIT 100
     );

    RETURN v_claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_internal_auth_replay_jti(text, text, integer)
    FROM PUBLIC, anon, authenticated, app_tenant;
GRANT EXECUTE ON FUNCTION public.consume_internal_auth_replay_jti(text, text, integer) TO service_role;

COMMENT ON TABLE public.internal_auth_replay_claims IS
    'Short-lived single-use claims for signed internal gateway credentials; direct role access is revoked and cleanup is bounded in the claim RPC.';
COMMENT ON FUNCTION public.consume_internal_auth_replay_jti(text, text, integer) IS
    'Atomically consume one internal auth JTI across gateway isolates; returns false for an active prior claim.';

COMMIT;
