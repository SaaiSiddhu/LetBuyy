import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { collectThemeTemplateValidationIssues, type ThemeTemplateValidationRuntime } from '@letbuyy/theme-engine';
import { requireOwnedDatabase } from './owned-db-support';
import { buildProposal, canonicalJson, readAdmittedV200Artifacts, renderPromotionPair, sha256, SLUGS } from '../../../../../docs/implementation/niche-theme-programme/release-v210/generate-release';

const owned = requireOwnedDatabase();
const root = new URL('../../../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sqlSlugs = SLUGS.map(quote).join(',');
const proposal = buildProposal();
const pair = renderPromotionPair(proposal);

const catalogFingerprint = () => owned.psql(`SELECT md5(coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'slug',slug,'name',name,'category',category,'version',version,
  'default_template',default_template,'section_schemas',section_schemas,'block_schemas',block_schemas,
  'settings_schema',settings_schema,'renderer_manifest',renderer_manifest,'schema_version',schema_version,
  'renderer_version',renderer_version,'config',config) ORDER BY slug)::text,'[]'))
  FROM public.themes WHERE slug IN (${sqlSlugs}) AND owned_by_site_id IS NULL;`);
const v200CaptureFingerprint = () => owned.psql(`SELECT md5(coalesce(jsonb_agg(jsonb_build_object(
  'slug',p.slug,'version',v.version,'package',v.package_manifest,'schema',s.schema_manifest,
  'renderer',r.renderer_manifest) ORDER BY p.slug)::text,'[]'))
  FROM public.theme_packages p JOIN public.theme_package_versions v ON v.theme_package_id=p.id
  JOIN public.theme_schema_manifests s ON s.theme_package_version_id=v.id
  JOIN public.theme_renderer_manifests r ON r.theme_package_version_id=v.id
  WHERE p.slug IN (${sqlSlugs}) AND v.version='2.0.0';`);
const versionCount = (version: string) => Number(owned.psql(`SELECT count(*) FROM public.theme_packages p
  JOIN public.theme_package_versions v ON v.theme_package_id=p.id
  WHERE p.slug IN (${sqlSlugs}) AND v.version=${quote(version)};`));
const catalogVersions = () => JSON.parse(owned.psql(`SELECT jsonb_object_agg(slug,version)::text FROM public.themes
  WHERE slug IN (${sqlSlugs}) AND owned_by_site_id IS NULL;`)) as Record<string, string>;

test('428 promotes editor-valid 2.1.0 packages without changing admitted 2.0.0 captures; rollback and replay preserve history', () => {
  assert.equal(read('database/supabase/migrations/428_niche_theme_catalog_v210.sql'), pair.up);
  assert.equal(read('database/supabase/rollback/428_niche_theme_catalog_v210.rollback.sql'), pair.down);
  assert.equal(sha256(pair.up), 'a2622ffa92adae84caa247fddc01b5ead57b882bade97fe564fe3044ba0b5149');
  assert.equal(sha256(pair.down), 'eb32fb29346132d8c0a7a331fd8ddd2ba8cf45e2325d2cd2714fa871643f1648');
  const entryVersions = new Set(Object.values(catalogVersions()));
  assert.equal(Object.keys(catalogVersions()).length, 9);
  assert(entryVersions.size === 1 && (entryVersions.has('2.0.0') || entryVersions.has('2.1.0')),
    'owned entry must have one complete admitted catalog version');
  assert.equal(versionCount('2.0.0'), 9);
  assert.equal(versionCount('2.1.0'), entryVersions.has('2.1.0') ? 9 : 0);
  if (entryVersions.has('2.1.0')) owned.script(pair.down);
  assert.deepEqual(new Set(Object.values(catalogVersions())), new Set(['2.0.0']));
  const admitted = readAdmittedV200Artifacts();
  for (const slug of SLUGS) {
    const marker = owned.psql(`SELECT config#>>'{nicheV2Promotion389,artifactSha256}' FROM public.themes WHERE slug=${quote(slug)} AND owned_by_site_id IS NULL;`);
    assert.equal(marker, admitted.payloadSha256[slug]);
  }
  const beforeCatalog = catalogFingerprint();
  const beforeV200 = v200CaptureFingerprint();
  const first = proposal.artifacts[0];
  owned.psql(`UPDATE public.themes SET config=jsonb_set(config,'{nicheV2Promotion389,artifactSha256}',
    '"synthetic-unadmitted"'::jsonb) WHERE slug=${quote(first.slug)} AND owned_by_site_id IS NULL;`);
  const unadmittedState = catalogFingerprint();
  assert.match(owned.psqlScriptExpectError(pair.up), /Unadmitted predecessor catalog/);
  assert.equal(catalogFingerprint(), unadmittedState, 'failed promotion must be atomic');
  owned.psql(`UPDATE public.themes SET config=jsonb_set(config,'{nicheV2Promotion389,artifactSha256}',
    to_jsonb(${quote(first.previousArtifactSha256)}::text)) WHERE slug=${quote(first.slug)} AND owned_by_site_id IS NULL;`);
  assert.equal(catalogFingerprint(), beforeCatalog);

  owned.scriptLarge(pair.up);
  assert.deepEqual(new Set(Object.values(catalogVersions())), new Set(['2.1.0']));
  assert.equal(versionCount('2.0.0'), 9);
  assert.equal(versionCount('2.1.0'), 9);
  assert.equal(v200CaptureFingerprint(), beforeV200);
  for (const artifact of proposal.artifacts) {
    const row = JSON.parse(owned.scriptLarge(`SELECT jsonb_build_object('document',t.default_template,
      'sections',s.section_schemas,'settings',s.settings_schema,'version_id',v.id)::text
      FROM public.themes t JOIN public.theme_packages p ON p.slug=t.slug
      JOIN public.theme_package_versions v ON v.theme_package_id=p.id AND v.version=t.version
      JOIN public.theme_schema_manifests s ON s.theme_package_version_id=v.id
      WHERE t.slug=${quote(artifact.slug)} AND t.owned_by_site_id IS NULL;`)) as {
      document: Record<string, unknown>; sections: ThemeTemplateValidationRuntime['sectionSchemas'];
      settings: ThemeTemplateValidationRuntime['settingsSchema']; version_id: string;
    };
    assert.equal(canonicalJson(row.document), canonicalJson(artifact.document));
    assert.deepEqual(collectThemeTemplateValidationIssues({ templateConfig: row.document,
      runtime: { sectionSchemas: row.sections, settingsSchema: row.settings }, themeSlug: artifact.slug }), []);
    assert.ok(row.version_id);
  }
  const promotedCatalog = catalogFingerprint();
  owned.scriptLarge(pair.up);
  assert.equal(catalogFingerprint(), promotedCatalog, 'UP replay must be a no-op');
  assert.equal(v200CaptureFingerprint(), beforeV200);
  owned.psql(`UPDATE public.themes SET config=jsonb_set(config,'{nicheV210Promotion428,artifactSha256}',
    '"synthetic-stale"'::jsonb) WHERE slug=${quote(first.slug)} AND owned_by_site_id IS NULL;`);
  const staleState = catalogFingerprint();
  assert.match(owned.psqlScriptExpectError(pair.down), /refusing stale rollback/);
  assert.equal(catalogFingerprint(), staleState, 'failed rollback must be atomic');
  owned.psql(`UPDATE public.themes SET config=jsonb_set(config,'{nicheV210Promotion428,artifactSha256}',
    to_jsonb(${quote(first.payloadSha256)}::text)) WHERE slug=${quote(first.slug)} AND owned_by_site_id IS NULL;`);
  assert.equal(catalogFingerprint(), promotedCatalog);

  owned.script(pair.down);
  assert.deepEqual(new Set(Object.values(catalogVersions())), new Set(['2.0.0']));
  assert.equal(catalogFingerprint(), beforeCatalog, 'DOWN restores exact catalog fields');
  assert.equal(versionCount('2.1.0'), 9, 'rollback retains immutable captured successor versions');
  assert.equal(v200CaptureFingerprint(), beforeV200);

  owned.scriptLarge(pair.up);
  assert.equal(catalogFingerprint(), promotedCatalog);
  assert.equal(versionCount('2.1.0'), 9);
  assert.equal(v200CaptureFingerprint(), beforeV200);
  console.info('NICHE428_OWNED', JSON.stringify({ runId: owned.runId, manifestSha256: proposal.manifestSha256,
    migrated: proposal.artifacts.length, beforeV200, promotedCatalog, rollbackVerified: true, replayVerified: true }));
});
