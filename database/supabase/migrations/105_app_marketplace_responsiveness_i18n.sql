-- Wave 9 marketplace UX/i18n additions.

ALTER TABLE public.marketplace_apps
    ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR'::text,
    ADD COLUMN IF NOT EXISTS video_captions_url text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'marketplace_apps_currency_check'
           AND conrelid = 'public.marketplace_apps'::regclass
    ) THEN
        ALTER TABLE public.marketplace_apps
            ADD CONSTRAINT marketplace_apps_currency_check
            CHECK ((currency IS NULL) OR (currency ~ '^[A-Z]{3}$'));
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_marketplace_apps_currency
    ON public.marketplace_apps USING btree (currency)
    WHERE ((status = 'published'::text) AND (deleted_at IS NULL));

COMMENT ON COLUMN public.marketplace_apps.currency IS
    'Marketplace listing display currency scaffold. Pricing plans remain the authoritative per-plan currency source.';

COMMENT ON COLUMN public.marketplace_apps.video_captions_url IS
    'Caption source for marketplace demo videos. UI hides demo videos without captions for accessibility.';
