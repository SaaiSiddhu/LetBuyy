-- ============================================================
-- Migration: Deactivate non-Urban Kicks themes
-- Date: 2026-02-17
-- Purpose: Focus on Urban Kicks as the only active theme
--          while we build out the isolated theme architecture.
-- ============================================================

-- Pre-flight: Show current theme status
SELECT id, name, slug, is_active, site_type, category
FROM themes
ORDER BY sort_order;

-- ============================================================
-- 1. Deactivate all themes EXCEPT Urban Kicks
-- ============================================================
UPDATE themes
SET is_active = false,
    updated_at = NOW()
WHERE slug != 'urban-kicks'
  AND is_active = true;

-- ============================================================
-- 2. Ensure Urban Kicks is active
-- ============================================================
UPDATE themes
SET is_active = true,
    updated_at = NOW()
WHERE slug = 'urban-kicks';

-- ============================================================
-- 3. Deactivate store_themes entries for non-Urban Kicks themes
--    (these are per-store installations)
-- ============================================================
UPDATE store_themes
SET is_active = false,
    updated_at = NOW()
WHERE theme_id NOT IN (
    SELECT id FROM themes WHERE slug = 'urban-kicks'
)
AND is_active = true;

-- ============================================================
-- 4. Verify final state
-- ============================================================
SELECT 
    t.name,
    t.slug,
    t.is_active,
    t.category,
    (SELECT COUNT(*) FROM store_themes st WHERE st.theme_id = t.id AND st.is_active = true) AS active_installs
FROM themes t
ORDER BY t.sort_order;

-- Expected result:
-- | name         | slug         | is_active | category | active_installs |
-- |------------- |------------- |-----------|----------|-----------------|
-- | Urban Kicks  | urban-kicks  | true      | modern   | (varies)        |
-- | Aurora       | aurora       | false     | modern   | 0               |
-- | Zenith       | zenith       | false     | minimal  | 0               |
-- | Ember        | ember        | false     | luxury   | 0               |
-- | Blossom      | blossom      | false     | organic  | 0               |
-- | Nova         | nova         | false     | vibrant  | 0               |
