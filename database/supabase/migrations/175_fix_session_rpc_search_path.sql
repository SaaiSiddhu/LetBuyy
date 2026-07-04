-- Fix validate_and_rotate_merchant_session: pgcrypto's digest() lives in the
-- extensions schema, which is not in the function's search_path. Add extensions
-- to the path so digest/gen_random_bytes resolve without schema-qualification.

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
SET search_path = public, extensions
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
