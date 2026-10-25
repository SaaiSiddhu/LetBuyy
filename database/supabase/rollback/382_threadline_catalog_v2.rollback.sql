-- Restores the exact prior public catalog metadata/document. No merchant data is rewritten.
BEGIN;
DO $rollback$
DECLARE saved jsonb; prior public.themes;
BEGIN
 SELECT config->'threadlineCatalogRollback' INTO saved FROM public.themes WHERE id='7b669c70-0000-4000-8000-000000000002' AND owned_by_site_id IS NULL AND NOT is_site_private FOR UPDATE;
 IF saved IS NULL THEN RETURN; END IF;
 prior := jsonb_populate_record(NULL::public.themes,saved);
 UPDATE public.themes SET name=prior.name,description=prior.description,long_description=prior.long_description,version=prior.version,sort_order=prior.sort_order,category=prior.category,thumbnail_url=prior.thumbnail_url,preview_url=prior.preview_url,default_template=prior.default_template,section_schemas=prior.section_schemas,settings_schema=prior.settings_schema,renderer_manifest=prior.renderer_manifest,config=prior.config,updated_at=now() WHERE id=prior.id AND owned_by_site_id IS NULL AND NOT is_site_private;
END;
$rollback$;
COMMIT;
