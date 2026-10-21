-- 367 — Honest Core starter announcement (forward).
-- Only the unowned first-party catalog template is updated. Existing sites,
-- drafts and immutable theme_releases snapshots are deliberately untouched.
-- The exact starter sentence is replaced in the portable editor defaults,
-- captured header data and both Liquid schema forms.
-- Migration200 remains immutable; full replay applies this correction afterward.
-- Rollback restores the historical catalog default for future installations;
-- it does not undo already-created stores or published releases.
UPDATE public.themes
SET default_template = replace(default_template::text,
        'Free shipping on fresh drops this week.', 'Discover our latest products.')::jsonb,
    updated_at = NOW()
WHERE slug = 'letbuyy-core'
  AND owned_by_site_id IS NULL
  AND NOT COALESCE(is_site_private, false)
  AND default_template #>> '{liquidBundle,package,slug}' = 'letbuyy-core-liquid'
  AND strpos(default_template::text,
      'Free shipping on fresh drops this week.') > 0;
