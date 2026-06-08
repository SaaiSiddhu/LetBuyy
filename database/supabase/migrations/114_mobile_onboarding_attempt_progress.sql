-- Mobile merchant onboarding progress support.
-- Forward-only, additive migration for the existing onboarding_attempts writer.

ALTER TABLE public.onboarding_attempts
  ADD COLUMN IF NOT EXISTS current_step integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS completed_steps integer[] DEFAULT '{}'::integer[] NOT NULL,
  ADD COLUMN IF NOT EXISTS survey_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.onboarding_attempts
  DROP CONSTRAINT IF EXISTS onboarding_attempts_status_check;

ALTER TABLE public.onboarding_attempts
  ADD CONSTRAINT onboarding_attempts_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'in_progress'::text,
    'completed'::text,
    'success'::text,
    'failed'::text
  ]));

CREATE INDEX IF NOT EXISTS idx_onboarding_attempts_user_status
  ON public.onboarding_attempts(user_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_attempts_store
  ON public.onboarding_attempts(store_id)
  WHERE store_id IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS onboarding_attempts_updated_at ON public.onboarding_attempts;
CREATE TRIGGER onboarding_attempts_updated_at
  BEFORE UPDATE ON public.onboarding_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
