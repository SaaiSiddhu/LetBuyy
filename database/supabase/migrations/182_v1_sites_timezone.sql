-- Store-level IANA timezone for orders/analytics timestamps and admin display.
-- Aligns the sites table with StoreSchema.timezone (shared-types) which already
-- declares timezone with default 'Asia/Kolkata'. Additive + replayable.
-- Writer:
--   services/api-gateway/src/routes/stores.ts -> sites

ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sites_timezone_nonempty_check'
  ) THEN
    ALTER TABLE public.sites
      ADD CONSTRAINT sites_timezone_nonempty_check
      CHECK (length(btrim(timezone)) > 0);
  END IF;
END $$;
