-- Rollback for 200_letbuyy_core_liquid_bundle_attach.sql
--
-- Removes the liquidBundle key this migration added. rendererEngine was never set by 200, so there is
-- nothing to revert on that axis — the row already renders React before and after this rollback.
-- Non-destructive: a single jsonb key removal. No table, column, index, policy, or row is dropped.
-- Safe when the row does not exist, or the key is already absent (both are no-ops). Re-runnable.
UPDATE public.themes
SET default_template = default_template - 'liquidBundle',
    updated_at = NOW()
WHERE slug = 'letbuyy-core'
  AND default_template ? 'liquidBundle';
