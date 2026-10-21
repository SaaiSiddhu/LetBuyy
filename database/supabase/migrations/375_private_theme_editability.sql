-- Older blank/duplicate themes used is_active=false as a catalog visibility flag.
-- Private ownership now controls discovery; only retained usable instances reopen.
BEGIN;
UPDATE public.themes t SET is_active=true,catalog_visible=false,updated_at=now()
WHERE t.is_site_private AND t.owned_by_site_id IS NOT NULL AND NOT t.is_active
 AND EXISTS(SELECT 1 FROM public.theme_instances i WHERE i.store_id=t.owned_by_site_id
  AND i.theme_slug=t.slug AND i.deleted_at IS NULL AND i.instance_status<>'archived');

-- The earlier duplicate command retained its snapshot on the instance but omitted
-- the theme definition. Recover only that owner's retained snapshot and its
-- public/owned parent schema. Empty historical blank themes start with Core's
-- editable header/footer and an empty home-page body.
WITH retained AS (
 SELECT t.id,t.slug,i.installed_config,
  coalesce(nullif(parent.config,'{}'::jsonb),core.config) AS config,
  coalesce(nullif(parent.section_schemas,'{}'::jsonb),core.section_schemas) AS section_schemas,
  coalesce(nullif(parent.block_schemas,'{}'::jsonb),core.block_schemas) AS block_schemas,
  coalesce(nullif(parent.settings_schema,'{}'::jsonb),core.settings_schema) AS settings_schema,
  coalesce(nullif(parent.renderer_manifest,'{}'::jsonb),core.renderer_manifest) AS renderer_manifest,
  coalesce(parent.schema_version,core.schema_version) AS schema_version,
  coalesce(parent.renderer_version,core.renderer_version) AS renderer_version,
  coalesce(parent.thumbnail_url,core.thumbnail_url) AS thumbnail_url,
  core.default_template AS core_template
 FROM public.themes t JOIN public.theme_instances i
  ON i.store_id=t.owned_by_site_id AND i.theme_slug=t.slug
   AND i.deleted_at IS NULL AND i.instance_status<>'archived'
 JOIN public.themes core ON core.slug='letbuyy-core' AND NOT core.is_site_private
 LEFT JOIN public.themes parent ON parent.slug=i.installed_config->>'themeId'
  AND parent.id<>t.id AND (NOT parent.is_site_private OR parent.owned_by_site_id=t.owned_by_site_id)
 WHERE t.is_site_private AND t.owned_by_site_id IS NOT NULL
  AND coalesce(t.default_template,'{}'::jsonb)='{}'::jsonb
), definitions AS (
 SELECT r.*,jsonb_set(CASE WHEN coalesce(installed_config,'{}'::jsonb)<>'{}'::jsonb THEN installed_config
  ELSE jsonb_set(jsonb_set(jsonb_set(core_template,'{sections,template}','[]'::jsonb),
   '{templates,index}','{"sections":{},"order":[]}'::jsonb),
   '{liquidBundle,templates,index}','{"sections":{},"order":[]}'::jsonb) END,
  '{themeId}',to_jsonb(slug)) AS document FROM retained r
)
UPDATE public.themes t SET default_template=d.document,config=d.config,
 section_schemas=d.section_schemas,block_schemas=d.block_schemas,settings_schema=d.settings_schema,
 renderer_manifest=d.renderer_manifest,schema_version=d.schema_version,renderer_version=d.renderer_version,
 thumbnail_url=d.thumbnail_url,catalog_visible=false,updated_at=now()
FROM definitions d WHERE t.id=d.id;
COMMIT;
