-- Phase I3 (IRT-4): jti consumption for the identity-issued ES256 merchant_session
-- JWT. Closes SKIP-IDN-MERCHANT-SESSION-JTI-CONSUMPTION. Additive only.
--
-- services/api-gateway/src/lib/identity-session-verifier.ts validates the jti
-- claim's FORMAT only (typeof string, length >= 16) -- nothing consumes or
-- stores it, so a valid token (TTL: 30 days, see
-- apps/identity-platform/src/lib/auth/identity-issued-session.ts) can be
-- replayed indefinitely at its one call site (POST /custom/sessions/create).
--
-- Shape mirrors 161_foundation_session_security.sql's
-- session_token_rotation_events precedent: an atomic INSERT ... ON CONFLICT
-- DO NOTHING against a UNIQUE constraint, not a read-then-write (which would
-- race). Not tenant-scoped, same as that precedent -- a merchant_session JWT
-- identifies a user, not a site, so there is no site_id to isolate by; RLS
-- here is ENABLE + a service_role-only policy, no FORCE, no tenant GUC,
-- matching session_token_rotation_events exactly.

CREATE TABLE IF NOT EXISTS public.merchant_session_jti_consumptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jti text NOT NULL,
    user_id uuid REFERENCES public.users_custom(id) ON DELETE CASCADE,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT merchant_session_jti_consumptions_pkey PRIMARY KEY (id),
    CONSTRAINT merchant_session_jti_consumptions_jti_key UNIQUE (jti)
);

CREATE INDEX IF NOT EXISTS idx_merchant_session_jti_consumptions_expires
    ON public.merchant_session_jti_consumptions USING btree (expires_at);

ALTER TABLE public.merchant_session_jti_consumptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS merchant_session_jti_consumptions_service_all ON public.merchant_session_jti_consumptions;
CREATE POLICY merchant_session_jti_consumptions_service_all
    ON public.merchant_session_jti_consumptions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Atomic check-and-mark: returns true the first time a jti is seen (proceed),
-- false on every subsequent presentation (reject as replay). The UNIQUE
-- constraint on jti, not a preceding SELECT, is what makes this race-free
-- under concurrent requests presenting the same token.
CREATE OR REPLACE FUNCTION public.consume_merchant_session_jti(
    p_jti text,
    p_user_id uuid,
    p_expires_at timestamp with time zone
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_inserted_id uuid;
BEGIN
    IF p_jti IS NULL OR length(btrim(p_jti)) < 16 THEN
        RETURN false;
    END IF;

    INSERT INTO public.merchant_session_jti_consumptions (jti, user_id, expires_at)
    VALUES (btrim(p_jti), p_user_id, p_expires_at)
    ON CONFLICT (jti) DO NOTHING
    RETURNING id INTO v_inserted_id;

    RETURN v_inserted_id IS NOT NULL;
END;
$$;

-- Cleanup sweeper, mirroring expire_inventory_reservations's exact shape
-- (141_executable_inventory_reservations.sql) -- called by
-- services/queue-workers' existing scheduled() cron dispatcher, not a new
-- cron mechanism. Only ever deletes rows already past their own recorded
-- expiry (the token's own exp claim, copied verbatim at consume time), so it
-- can never delete a still-valid consumption record.
CREATE OR REPLACE FUNCTION public.expire_merchant_session_jti_consumptions(
    p_limit integer DEFAULT 500
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_count integer;
BEGIN
    WITH expired AS (
        SELECT id
          FROM public.merchant_session_jti_consumptions
         WHERE expires_at <= now()
         ORDER BY expires_at ASC
         LIMIT LEAST(GREATEST(COALESCE(p_limit, 500), 1), 5000)
         FOR UPDATE SKIP LOCKED
    )
    DELETE FROM public.merchant_session_jti_consumptions
     WHERE id IN (SELECT id FROM expired);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;
