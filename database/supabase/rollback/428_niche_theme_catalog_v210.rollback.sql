-- Restore prior catalog pointers/approved metadata only. Captures and installations remain recoverable.
-- Paired with manifest SHA-256: 6e8408ba3449a0feb08d131e7d46764e64d686271f4c72998205ba17c49fbdb2.
BEGIN;
DO $rollback$
DECLARE item jsonb; t public.themes; prior public.themes; saved jsonb;
BEGIN
 FOR item IN SELECT value FROM jsonb_array_elements($liquidbundle$[{"id":"7b669c70-0000-4000-8000-000000000003","payloadSha256":"2a6b639464732a2160bcdb96b5562e5d3303360cfb999e3d0cabf65dbdf55692","slug":"letbuyy-aura"},{"id":"7b669c70-0000-4000-8000-000000000008","payloadSha256":"7301dd2e0032b63320978f020128696701adac369f03c7b61bc8b024dafc9510","slug":"letbuyy-bloom"},{"id":"7b669c70-0000-4000-8000-000000000004","payloadSha256":"443974149ad229af254ea8998062c745e2cc4443a73ef3a423c68b37bbda193b","slug":"letbuyy-craft"},{"id":"7b669c70-0000-4000-8000-000000000007","payloadSha256":"48e3d8120729f6bf0f648059822e0374e902eb849b3ae7f6ecb68bbf4fe9eb6c","slug":"letbuyy-dawn"},{"id":"7b669c70-0000-4000-8000-000000000001","payloadSha256":"ec58541439660eae1d3fe2bc580fa9b1d7cb8f5e5055c1c4345a193415dd320d","slug":"letbuyy-forge"},{"id":"7b669c70-0000-4000-8000-000000000009","payloadSha256":"78efada2957a2ff116a113e9aae08a1d11f368d3643a1ea0446cbdd77fb28db4","slug":"letbuyy-nova"},{"id":"7b669c70-0000-4000-8000-000000000005","payloadSha256":"57a7bd256e46caf75ae5dc4323102b609d031cb87a6d65aee90152dce2cfc5d6","slug":"letbuyy-refresh"},{"id":"7b669c70-0000-4000-8000-000000000006","payloadSha256":"330bc7908c95f4956eea7eb4a263cb5028de198cfc70267721b87fa4dc403b32","slug":"letbuyy-ride"},{"id":"7b669c70-0000-4000-8000-000000000010","payloadSha256":"2cda42238fa8966cbb9cf1fab637f0aa7bef160488f721169668037b57aeaa82","slug":"letbuyy-summit"}]$liquidbundle$::jsonb) LOOP
  SELECT * INTO STRICT t FROM public.themes WHERE id=(item->>'id')::uuid AND slug=item->>'slug'
   AND owned_by_site_id IS NULL AND NOT is_site_private FOR UPDATE;
  saved:=t.config#>'{nicheV210Promotion428,previous}'; IF saved IS NULL THEN CONTINUE; END IF;
  IF t.version<>'2.1.0' OR t.config#>>'{nicheV210Promotion428,artifactSha256}' IS DISTINCT FROM item->>'payloadSha256' THEN
   RAISE EXCEPTION 'Catalog changed after promotion; refusing stale rollback: %',t.slug; END IF;
  prior:=jsonb_populate_record(NULL::public.themes,saved);
  UPDATE public.themes SET name=prior.name,category=prior.category,version=prior.version,default_template=prior.default_template,section_schemas=prior.section_schemas,block_schemas=prior.block_schemas,settings_schema=prior.settings_schema,renderer_manifest=prior.renderer_manifest,schema_version=prior.schema_version,renderer_version=prior.renderer_version,config=prior.config,updated_at=now() WHERE id=t.id;
 END LOOP;
END;
$rollback$;
COMMIT;
