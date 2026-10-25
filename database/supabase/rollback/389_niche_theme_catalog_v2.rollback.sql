-- Restore prior catalog pointers/approved metadata only. Captures and installations remain recoverable.
-- Paired with manifest SHA-256: 81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f.
BEGIN;
DO $rollback$
DECLARE item jsonb; t public.themes; prior public.themes; saved jsonb;
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements($liquidbundle$[{"id":"7b669c70-0000-4000-8000-000000000003","payloadSha256":"6d1e80b05d7d234bec27961776bc0ea5610cd18249cf6e2631a8222757883e7d","slug":"letbuyy-aura"},{"id":"7b669c70-0000-4000-8000-000000000008","payloadSha256":"4430bda97938b60b6725cf441db06c7820b5fa5c47f4e193333cc99870bec3a9","slug":"letbuyy-bloom"},{"id":"7b669c70-0000-4000-8000-000000000004","payloadSha256":"3009388914e11ae955ba370f68da70d078da6e3129fc8a1baad2d33313d3aeee","slug":"letbuyy-craft"},{"id":"7b669c70-0000-4000-8000-000000000007","payloadSha256":"8c0eee170f703b1b3f3b4903b5313a755e78ce7ae7555ed46f599b102f292f2d","slug":"letbuyy-dawn"},{"id":"7b669c70-0000-4000-8000-000000000001","payloadSha256":"a5dad69e0b632b810e15ad4cb925ffc77dbda4d4a9eb54eeb4ee4b5b9b4af174","slug":"letbuyy-forge"},{"id":"7b669c70-0000-4000-8000-000000000009","payloadSha256":"ab5344b3340a2912205d71219d8c7f9de1bf99d9c18ea83a2dd017d0543fb3d5","slug":"letbuyy-nova"},{"id":"7b669c70-0000-4000-8000-000000000005","payloadSha256":"7f9f2cd2abd44077728ce9c3b8552f27d34bebe35e47903124240ce269d61fc0","slug":"letbuyy-refresh"},{"id":"7b669c70-0000-4000-8000-000000000006","payloadSha256":"16b6e1642269ee43531923d4ca1d7585e842789f2b79eb2e256e2d2f0d777612","slug":"letbuyy-ride"},{"id":"7b669c70-0000-4000-8000-000000000010","payloadSha256":"56d8b92957d4259466e6bdf659c927fea2f5220916d5887fde779439c1f7e961","slug":"letbuyy-summit"}]$liquidbundle$::jsonb) LOOP
  SELECT * INTO STRICT t FROM public.themes WHERE id=(item->>'id')::uuid AND slug=item->>'slug'
   AND owned_by_site_id IS NULL AND NOT is_site_private FOR UPDATE;
  saved:=t.config#>'{nicheV2Promotion389,previous}'; IF saved IS NULL THEN CONTINUE; END IF;
  IF t.version<>'2.0.0' OR t.config#>>'{nicheV2Promotion389,artifactSha256}' IS DISTINCT FROM item->>'payloadSha256' THEN
   RAISE EXCEPTION 'Catalog changed after promotion; refusing stale rollback: %',t.slug; END IF;
  prior:=jsonb_populate_record(NULL::public.themes,saved);
  UPDATE public.themes SET name=prior.name,category=prior.category,version=prior.version,default_template=prior.default_template,section_schemas=prior.section_schemas,block_schemas=prior.block_schemas,settings_schema=prior.settings_schema,renderer_manifest=prior.renderer_manifest,schema_version=prior.schema_version,renderer_version=prior.renderer_version,config=prior.config,updated_at=now() WHERE id=t.id;
 END LOOP;
END;
$rollback$;
COMMIT;
