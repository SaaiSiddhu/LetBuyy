-- Rollback for 172_liquid_bundle_refresh.sql
-- L14 convergence — removes the `liquidBundle` key from the urban-kicks theme default_template
-- (reverts to React render). To restore the prior L1 bundle instead, re-run migration 171.
-- Non-destructive: key removal only; React sections/templates untouched.

UPDATE public.themes
SET default_template = default_template - 'liquidBundle',
    updated_at = NOW()
WHERE slug = 'urban-kicks';
