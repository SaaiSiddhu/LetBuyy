-- Customer password reset intents are stored as one-time hashed tokens.
-- The password_hash relaxation allows reset-only credential rows without
-- creating an unusable password that would look like a real order credential.

ALTER TABLE public.customer_credentials
    ADD COLUMN IF NOT EXISTS reset_token_hash text,
    ADD COLUMN IF NOT EXISTS reset_expires_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS reset_used_at timestamp with time zone;

ALTER TABLE public.customer_credentials
    ALTER COLUMN password_hash DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_credentials_reset_token
    ON public.customer_credentials (store_id, email_or_phone, reset_token_hash)
    WHERE reset_token_hash IS NOT NULL
      AND reset_used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_credentials_reset_expiry
    ON public.customer_credentials (reset_expires_at)
    WHERE reset_token_hash IS NOT NULL
      AND reset_used_at IS NULL;
