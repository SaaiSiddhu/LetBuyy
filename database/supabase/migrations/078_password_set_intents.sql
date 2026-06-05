-- Server-side password-set intents bind identity password creation to a
-- freshly verified OTP/email verification event. Body user_id/email values are
-- no longer accepted as authority by the identity app.

CREATE TABLE IF NOT EXISTS public.auth_password_set_intents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL REFERENCES public.users_custom(id) ON DELETE CASCADE,
    email text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT auth_password_set_intents_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_auth_password_set_intents_user_email
    ON public.auth_password_set_intents (user_id, email);

CREATE INDEX IF NOT EXISTS idx_auth_password_set_intents_active
    ON public.auth_password_set_intents (id, user_id, expires_at)
    WHERE used_at IS NULL
      AND deleted_at IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trg_auth_password_set_intents_updated_at'
    ) THEN
        CREATE TRIGGER trg_auth_password_set_intents_updated_at
            BEFORE UPDATE ON public.auth_password_set_intents
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at();
    END IF;
END $$;

ALTER TABLE public.auth_password_set_intents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'auth_password_set_intents'
          AND policyname = 'Service role manages auth password set intents'
    ) THEN
        CREATE POLICY "Service role manages auth password set intents"
            ON public.auth_password_set_intents
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
