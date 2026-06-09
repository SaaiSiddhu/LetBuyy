-- Foundation Step-Up Wave 4: live merchant session idle timeout, rotation,
-- reuse detection, and revocation around the existing opaque sessions table.
-- Additive only: the current sessions table remains authoritative.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.sessions
    ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS revoked_reason text,
    ADD COLUMN IF NOT EXISTS last_rotated_at timestamp with time zone DEFAULT now(),
    ADD COLUMN IF NOT EXISTS rotation_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sessions_active_token
    ON public.sessions USING btree (token)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_user_active
    ON public.sessions USING btree (user_id, last_active DESC)
    WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.session_token_rotation_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users_custom(id) ON DELETE CASCADE,
    old_token_hash text NOT NULL,
    new_token_hash text NOT NULL,
    rotated_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    reuse_detected_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT session_token_rotation_events_pkey PRIMARY KEY (id),
    CONSTRAINT session_token_rotation_events_old_hash_key UNIQUE (old_token_hash)
);

CREATE INDEX IF NOT EXISTS idx_session_token_rotation_events_session
    ON public.session_token_rotation_events USING btree (session_id, rotated_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_token_rotation_events_reuse
    ON public.session_token_rotation_events USING btree (old_token_hash, expires_at)
    WHERE reuse_detected_at IS NULL;

ALTER TABLE public.session_token_rotation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_token_rotation_events_service_all ON public.session_token_rotation_events;
CREATE POLICY session_token_rotation_events_service_all
    ON public.session_token_rotation_events
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.validate_and_rotate_merchant_session(
    p_token text,
    p_rotate boolean DEFAULT true,
    p_idle_timeout_seconds integer DEFAULT 28800,
    p_rotation_interval_seconds integer DEFAULT 600
)
RETURNS TABLE (
    accepted boolean,
    status text,
    session_id uuid,
    user_id uuid,
    token text,
    rotated boolean,
    expires_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now timestamp with time zone := now();
    v_token_hash text := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
    v_reuse public.session_token_rotation_events%ROWTYPE;
    v_session public.sessions%ROWTYPE;
    v_new_token text := p_token;
    v_rotated boolean := false;
BEGIN
    IF p_token IS NULL OR length(btrim(p_token)) < 32 THEN
        RETURN QUERY SELECT false, 'malformed', NULL::uuid, NULL::uuid, NULL::text, false, NULL::timestamp with time zone;
        RETURN;
    END IF;

    SELECT *
      INTO v_reuse
      FROM public.session_token_rotation_events
     WHERE session_token_rotation_events.old_token_hash = v_token_hash
       AND session_token_rotation_events.expires_at > v_now
     LIMIT 1;

    IF FOUND THEN
        UPDATE public.sessions
           SET revoked_at = coalesce(revoked_at, v_now),
               revoked_reason = coalesce(revoked_reason, 'token_reuse_detected')
         WHERE id = v_reuse.session_id;

        UPDATE public.session_token_rotation_events
           SET reuse_detected_at = coalesce(reuse_detected_at, v_now)
         WHERE id = v_reuse.id;

        RETURN QUERY SELECT false, 'reuse_detected', v_reuse.session_id, v_reuse.user_id, NULL::text, false, NULL::timestamp with time zone;
        RETURN;
    END IF;

    SELECT *
      INTO v_session
      FROM public.sessions
     WHERE sessions.token = p_token
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'missing', NULL::uuid, NULL::uuid, NULL::text, false, NULL::timestamp with time zone;
        RETURN;
    END IF;

    IF v_session.revoked_at IS NOT NULL THEN
        RETURN QUERY SELECT false, 'revoked', v_session.id, v_session.user_id, NULL::text, false, v_session.expires_at;
        RETURN;
    END IF;

    IF v_session.expires_at <= v_now THEN
        UPDATE public.sessions
           SET revoked_at = coalesce(revoked_at, v_now),
               revoked_reason = coalesce(revoked_reason, 'expired')
         WHERE id = v_session.id;

        RETURN QUERY SELECT false, 'expired', v_session.id, v_session.user_id, NULL::text, false, v_session.expires_at;
        RETURN;
    END IF;

    IF v_session.last_active IS NOT NULL
       AND v_session.last_active < v_now - make_interval(secs => greatest(p_idle_timeout_seconds, 60)) THEN
        UPDATE public.sessions
           SET revoked_at = coalesce(revoked_at, v_now),
               revoked_reason = coalesce(revoked_reason, 'idle_timeout')
         WHERE id = v_session.id;

        RETURN QUERY SELECT false, 'idle_timeout', v_session.id, v_session.user_id, NULL::text, false, v_session.expires_at;
        RETURN;
    END IF;

    IF p_rotate
       AND coalesce(v_session.last_rotated_at, v_session.created_at, v_now)
           <= v_now - make_interval(secs => greatest(p_rotation_interval_seconds, 60)) THEN
        v_new_token := encode(gen_random_bytes(32), 'hex');
        v_rotated := true;

        INSERT INTO public.session_token_rotation_events (
            session_id,
            user_id,
            old_token_hash,
            new_token_hash,
            rotated_at,
            expires_at
        ) VALUES (
            v_session.id,
            v_session.user_id,
            v_token_hash,
            encode(digest(v_new_token, 'sha256'), 'hex'),
            v_now,
            v_session.expires_at
        )
        ON CONFLICT (old_token_hash) DO NOTHING;
    END IF;

    UPDATE public.sessions
       SET token = v_new_token,
           last_active = v_now,
           last_rotated_at = CASE WHEN v_rotated THEN v_now ELSE coalesce(last_rotated_at, v_now) END,
           rotation_count = CASE WHEN v_rotated THEN rotation_count + 1 ELSE rotation_count END
     WHERE id = v_session.id;

    RETURN QUERY SELECT true, 'accepted', v_session.id, v_session.user_id, v_new_token, v_rotated, v_session.expires_at;
END;
$$;
