-- Rollback for 283_storefront_web_onboarding_draft.sql.
-- Draft rows remain inert in onboarding_attempts; rollback removes only the new entry point.
BEGIN;

REVOKE ALL ON FUNCTION public.complete_storefront_web_onboarding_draft(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.complete_storefront_web_onboarding_draft(uuid, uuid, uuid);
REVOKE ALL ON FUNCTION public.save_storefront_web_onboarding_draft(uuid, integer, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.save_storefront_web_onboarding_draft(uuid, integer, text, text, text);

COMMIT;
