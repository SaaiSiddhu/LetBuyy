-- Rollback for 171_liquid_bundle_persistence.sql
-- L1 — Bundle Persistence (Full Liquid V1).
-- Removes the additive `liquidBundle` key from the urban-kicks theme default_template.
-- After this, resolveLiquidBundle returns undefined and the store renders React unconditionally.
-- Non-destructive: only the added key is removed; the React sections/templates are untouched.

UPDATE public.themes
SET default_template = default_template - 'liquidBundle',
    updated_at = NOW()
WHERE slug = 'urban-kicks';
