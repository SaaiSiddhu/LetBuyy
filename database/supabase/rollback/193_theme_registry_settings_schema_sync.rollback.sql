-- Rollback for 193_theme_registry_settings_schema_sync.sql
--
-- Reverts both changes:
--   (1) removes the bodyFontFamily field from the first-party Liquid themes' appearance schema;
--   (2) restores the legacy bare-group-map manifest shape by re-deriving it from the catalog's
--       appearance fields, i.e. undoing the { "settings": { ... } } wrapper this migration introduced.
--
-- Note: reverting (1) or (2) reinstates the install/draft/publish validation failure this migration fixed.
-- Non-destructive: jsonb key edits only. No table, column, index, policy, or row is dropped. Re-runnable.

-- (1) Undeclare bodyFontFamily.
UPDATE public.themes
SET settings_schema = settings_schema #- '{settings,appearance,fields,bodyFontFamily}',
    updated_at = NOW()
WHERE slug IN ('urban-kicks', 'letbuyy-core')
  AND settings_schema #> '{settings,appearance,fields,bodyFontFamily}' IS NOT NULL;

-- (2) Unwrap the registry manifest back to the bare group map the seed originally shipped.
UPDATE public.theme_schema_manifests m
SET settings_schema = COALESCE(m.settings_schema -> 'settings', m.settings_schema),
    updated_at = NOW()
FROM public.theme_package_versions v
JOIN public.theme_packages p ON p.id = v.theme_package_id
JOIN public.themes t ON t.slug = p.slug
WHERE m.theme_package_version_id = v.id
  AND t.slug IN ('urban-kicks', 'letbuyy-core')
  AND m.settings_schema ? 'settings';
