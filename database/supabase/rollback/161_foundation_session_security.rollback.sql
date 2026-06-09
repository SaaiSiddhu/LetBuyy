DROP FUNCTION IF EXISTS public.validate_and_rotate_merchant_session(text, boolean, integer, integer);

DROP POLICY IF EXISTS session_token_rotation_events_service_all ON public.session_token_rotation_events;
DROP INDEX IF EXISTS public.idx_session_token_rotation_events_reuse;
DROP INDEX IF EXISTS public.idx_session_token_rotation_events_session;
DROP TABLE IF EXISTS public.session_token_rotation_events;

DROP INDEX IF EXISTS public.idx_sessions_user_active;
DROP INDEX IF EXISTS public.idx_sessions_active_token;

ALTER TABLE public.sessions
    DROP COLUMN IF EXISTS rotation_count,
    DROP COLUMN IF EXISTS last_rotated_at,
    DROP COLUMN IF EXISTS revoked_reason,
    DROP COLUMN IF EXISTS revoked_at;
