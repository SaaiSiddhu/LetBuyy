-- Rollback for 181_urban_kicks_settings_schema_complete.sql
-- Undeclares the two appearance fields 181 added to the urban-kicks settings schema:
-- `surfaceColor` and `isDark`.
--
-- Note: reverting reinstates the failure 181 fixed — the theme editor sends the full ThemeSettings
-- object on every draft save, so collectThemeTemplateValidationIssues() again rejects these two keys
-- as "not defined by the theme settings schema" and PUT /v1/themes/urban-kicks/editor/draft returns 400.
-- Non-destructive: jsonb key removal only. No table, column, index, policy, or row is dropped. Re-runnable.

UPDATE public.themes
SET settings_schema = settings_schema
        #- '{settings,appearance,fields,surfaceColor}'
        #- '{settings,appearance,fields,isDark}',
    updated_at = NOW()
WHERE slug = 'urban-kicks'
  AND settings_schema #> '{settings,appearance,fields}' IS NOT NULL;
