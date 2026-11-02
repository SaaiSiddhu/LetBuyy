-- Restore prior catalog pointers/approved metadata only. Captures and installations remain recoverable.
-- Paired with manifest SHA-256: dc38dedf132efb1d57adb40855982fc6e3f5d5f8fcb2c513920da40ad5a5b018.
BEGIN;
DO $rollback$
DECLARE item jsonb; t public.themes; prior public.themes; saved jsonb;
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements($liquidbundle$[{"id":"7b669c70-0000-4000-8000-000000000003","payloadSha256":"0c0bda09ddb0e6bc50abe171d76d0016b2f908ad10d5ad65d8daed396f96a56a","slug":"letbuyy-aura"},{"id":"7b669c70-0000-4000-8000-000000000008","payloadSha256":"66303099bb1b732cb553f8de022dc64efc2899038f8c99f6df8ce3aa41cdd3d9","slug":"letbuyy-bloom"},{"id":"7b669c70-0000-4000-8000-000000000004","payloadSha256":"6fee78e3f655410cd012a583292f984295db653c8910786e5f19f05c7fb1e449","slug":"letbuyy-craft"},{"id":"7b669c70-0000-4000-8000-000000000007","payloadSha256":"326d1bc14fdb597d9d07abe9f6fe58b257cfd723aa3dc08e720440b515063e8d","slug":"letbuyy-dawn"},{"id":"7b669c70-0000-4000-8000-000000000001","payloadSha256":"d89f3e59914f88d8979c26e5aa73132e48ba0dead0200cbe37a3371dc89c10db","slug":"letbuyy-forge"},{"id":"7b669c70-0000-4000-8000-000000000009","payloadSha256":"1ea3f6843cec493db7d6979c26462a0dd7db384f00e902dcf74de61c79711127","slug":"letbuyy-nova"},{"id":"7b669c70-0000-4000-8000-000000000005","payloadSha256":"ee77c067e237df4567ca01fce5ab86e501418e3d3ae31efb577e1d12c4db9226","slug":"letbuyy-refresh"},{"id":"7b669c70-0000-4000-8000-000000000006","payloadSha256":"d287de3cb99ba1f775f914d5da4874ba75352f5a49d6d998d15c919f605df3f1","slug":"letbuyy-ride"},{"id":"7b669c70-0000-4000-8000-000000000010","payloadSha256":"9b342da438f8672a5ee16b3859d49f141d2169071b9355ec23997ec4d6c528e4","slug":"letbuyy-summit"}]$liquidbundle$::jsonb) LOOP
  SELECT * INTO STRICT t FROM public.themes WHERE id=(item->>'id')::uuid AND slug=item->>'slug'
   AND owned_by_site_id IS NULL AND NOT is_site_private FOR UPDATE;
  saved:=t.config#>'{nicheV210Promotion432,previous}'; IF saved IS NULL THEN CONTINUE; END IF;
  IF t.version<>'2.1.0' OR t.config#>>'{nicheV210Promotion432,artifactSha256}' IS DISTINCT FROM item->>'payloadSha256' THEN
   RAISE EXCEPTION 'Catalog changed after promotion; refusing stale rollback: %',t.slug; END IF;
  prior:=jsonb_populate_record(NULL::public.themes,saved);
  UPDATE public.themes SET name=prior.name,category=prior.category,version=prior.version,default_template=prior.default_template,section_schemas=prior.section_schemas,block_schemas=prior.block_schemas,settings_schema=prior.settings_schema,renderer_manifest=prior.renderer_manifest,schema_version=prior.schema_version,renderer_version=prior.renderer_version,config=prior.config,updated_at=now() WHERE id=t.id;
 END LOOP;
END;
$rollback$;
COMMIT;
