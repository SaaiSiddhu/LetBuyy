-- 367 — Honest Core starter announcement (rollback).
-- Only the unowned first-party catalog bundle is updated. Existing sites,
-- drafts and immutable theme_releases snapshots are deliberately untouched.
-- The exact starter sentence is replaced in header data and both schema forms.
-- Migration200 remains immutable; full replay applies this correction afterward.
-- Rollback restores the historical catalog default for future installations;
-- it does not undo already-created stores or published releases.
UPDATE public.themes
SET default_template = jsonb_set(
      default_template,
      '{liquidBundle}',
      replace((default_template -> 'liquidBundle')::text,
        'Discover our latest products.', 'Free shipping on fresh drops this week.')::jsonb),
    updated_at = NOW()
WHERE slug = 'letbuyy-core'
  AND owned_by_site_id IS NULL
  AND NOT COALESCE(is_site_private, false)
  AND default_template #>> '{liquidBundle,package,slug}' = 'letbuyy-core-liquid'
  AND strpos((default_template -> 'liquidBundle')::text,
      'Discover our latest products.') > 0;
