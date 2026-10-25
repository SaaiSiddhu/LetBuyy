-- Paired DOWN restores prior catalog metadata, retaining immutable captures and installed work.
BEGIN;
DO $rollback$
DECLARE item jsonb; t public.themes; prior public.themes; saved jsonb;
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements($customization210$[{"id":"7b669c70-0000-4000-8000-000000000001","slug":"letbuyy-forge"},{"id":"7b669c70-0000-4000-8000-000000000002","slug":"letbuyy-sense"},{"id":"7b669c70-0000-4000-8000-000000000003","slug":"letbuyy-aura"},{"id":"7b669c70-0000-4000-8000-000000000004","slug":"letbuyy-craft"},{"id":"7b669c70-0000-4000-8000-000000000005","slug":"letbuyy-refresh"},{"id":"7b669c70-0000-4000-8000-000000000006","slug":"letbuyy-ride"},{"id":"7b669c70-0000-4000-8000-000000000007","slug":"letbuyy-dawn"},{"id":"7b669c70-0000-4000-8000-000000000008","slug":"letbuyy-bloom"},{"id":"7b669c70-0000-4000-8000-000000000009","slug":"letbuyy-nova"},{"id":"7b669c70-0000-4000-8000-000000000010","slug":"letbuyy-summit"}]$customization210$::jsonb) LOOP
  SELECT * INTO STRICT t FROM public.themes WHERE id=(item->>'id')::uuid AND slug=item->>'slug' AND owned_by_site_id IS NULL AND NOT is_site_private FOR UPDATE;
  saved:=t.config#>'{firstPartyCustomization210,previous}'; IF saved IS NULL THEN CONTINUE; END IF;
  IF t.version<>'2.1.0' OR t.config#>>'{firstPartyCustomization210,payloadSha256}' IS DISTINCT FROM 'f08d126aa02b65c4d26b5d01b4dc040497207d92ef68e7b801cd65d30188c462' THEN RAISE EXCEPTION 'Customization stale rollback conflict'; END IF;
  prior:=jsonb_populate_record(NULL::public.themes,saved);
  UPDATE public.themes SET name=prior.name,category=prior.category,version=prior.version,default_template=prior.default_template,section_schemas=prior.section_schemas,block_schemas=prior.block_schemas,settings_schema=prior.settings_schema,renderer_manifest=prior.renderer_manifest,schema_version=prior.schema_version,renderer_version=prior.renderer_version,config=prior.config,updated_at=now() WHERE id=t.id;
 END LOOP;
END;
$rollback$;
COMMIT;
