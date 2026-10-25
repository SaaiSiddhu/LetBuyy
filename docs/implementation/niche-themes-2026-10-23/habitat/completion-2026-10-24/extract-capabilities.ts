/** Source-only canonical factory enumeration. No renderer, server, database or browser. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const out = resolve(root, 'docs/implementation/niche-themes-2026-10-23/habitat/completion-2026-10-24');
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const closure = new Map<string, string>();
function visit(rel: string) {
  if (closure.has(rel)) return;
  const s = readFileSync(resolve(root, rel), 'utf8');
  closure.set(rel, sha(s));
  for (const m of s.matchAll(/import\s+(?!type\b)[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (!spec.startsWith('.')) {
      if (spec !== 'zod') throw new Error(`Unexpected factory dependency ${spec} in ${rel}`);
      continue;
    }
    const absolute = resolve(dirname(resolve(root, rel)), spec);
    const file = [absolute + '.ts', absolute + '.tsx', absolute + '/index.ts'].find(existsSync);
    if (!file) throw new Error(`Missing source import ${spec}`);
    visit(relative(root, file));
  }
}
async function main() {
visit('packages/theme-engine/src/habitat-theme.ts');
visit('packages/theme-engine/src/theme-bundle-core.ts');
const { createHabitatTheme } = await import('../../../../../packages/theme-engine/src/habitat-theme');
const { createLetbuyyCoreLiquidThemeBundleFixture } = await import('../../../../../packages/theme-engine/src/theme-bundle-core');
const { buildLiquidThemePackagePersistencePayload } = await import('../../../../../packages/theme-engine/src/theme-bundle');
const bundle = createHabitatTheme(createLetbuyyCoreLiquidThemeBundleFixture());
const persistence = buildLiquidThemePackagePersistencePayload(bundle);
const settings: Record<string, unknown>[] = [];
function fields(owner: string, schema: Record<string, unknown>) {
  const fs = (schema.settings ?? []) as Record<string, unknown>[];
  for (const f of fs) settings.push({ key: `${owner}/setting:${f.id}`, owner, ...f, runtimeStatus: 'NOT_RUN' });
  return fs;
}
function nodes(list: Record<string, unknown>, order: string[], parent: string): unknown[] {
  return order.map(id => {
    const n = list[id] as Record<string, unknown>;
    return { id, path: `${parent}/${id}`, ...n, blocks: nodes((n.blocks ?? {}) as Record<string, unknown>, (n.block_order ?? []) as string[], `${parent}/${id}`) };
  });
}
function localeLeaves(value: unknown, path = ''): string[] {
  if (!value || typeof value !== 'object') return [path];
  return Object.entries(value).flatMap(([key, child]) => localeLeaves(child, path ? `${path}.${key}` : key));
}
const templates = Object.entries(bundle.templates).map(([key, t]) => ({ key, name: t.name, layout: t.layout, order: t.order, instances: nodes(t.sections, t.order, `template:${key}`), runtimeStatus: 'NOT_RUN' }));
const sectionTypes = Object.entries(bundle.sections).map(([type, file]) => {
  fields(`section:${type}`, file.schema as Record<string, unknown>);
  for (const block of file.schema.blocks ?? []) if ('settings' in block) fields(`section:${type}/inline-block:${block.type}`, block as Record<string, unknown>);
  return { type, path: file.path, sourceSha256: sha(file.source), schema: file.schema, referencedBy: templates.filter(t => (t.instances as { type: string }[]).some(n => n.type === type)).map(t => t.key), declaredAddablePresets: file.schema.presets ?? [], runtimeStatus: 'NOT_RUN' };
});
const reusableBlockTypes = Object.entries(bundle.blocks).map(([type, file]) => { fields(`block:${type}`, file.schema as Record<string, unknown>); return { type, path: file.path, sourceSha256: sha(file.source), schema: file.schema, runtimeStatus: 'NOT_RUN' }; });
const groups = Object.entries(bundle.config.settings_schema.settings);
for (const [groupId, group] of groups) for (const [id, field] of Object.entries(group.fields)) {
  settings.push({ key: `global:${groupId}/setting:${id}`, owner: `global:${groupId}`, id, ...field, runtimeStatus: 'NOT_RUN' });
}
const schemaRenderer = 'apps/merchant/web/src/components/theme-editor/SchemaFormRenderer.tsx';
const rendererSource = readFileSync(resolve(root, schemaRenderer), 'utf8');
const knownControls = [...rendererSource.matchAll(/case '([^']+)'/g)].map(m => m[1]);
const settingTypes = [...new Set(settings.map(f => String(f.type)))].sort();
const inventory = {
  schemaVersion: 1, classification: 'SOURCE_DERIVED_ENUMERATION_NOT_RUNTIME_ACCEPTANCE', theme: 'Habitat', preset: 'craft', recordedAt: new Date().toISOString(),
  authority: { humanMandateThread: '01a16ce5-e5ba-7191-ab2c-a1b76947d2b5', humanMessageId: '01a16cf8-9a07-7cc3-ada1-739b7457b14f', verifiedViaReadThread: true, goal: 'active', immediateScope: 'Phase0 owned evidence and private proposals only; no active runtime/browser/shared-source grant' },
  checkout: { branch: 'letbuyy/theme-release-performance-resume', head: '85aac99043d8dc10469e12cbb810609a3b6f1b0d', observedDirtyEntries: 535, note: 'HEAD is a locator; actual input hashes below bind uncommitted source. No Git state changed.' },
  package: bundle.package, bundleSchemaVersion: bundle.schema_version, renderer: bundle.renderer, canonicalFactoryBundleSha256: sha(JSON.stringify(bundle)),
  sourceManifest: Object.fromEntries(closure), controlSource: { path: schemaRenderer, sha256: sha(rendererSource), implementedTypeBranches: knownControls },
  templates, sectionTypes, reusableBlockTypes, globalSettings: bundle.config.settings_schema, globalCurrentDefaults: bundle.config.settings_data.current, globalPresets: bundle.config.settings_data.presets,
  effectiveEditorSchemas: { sections: persistence.schemaManifest.section_schemas, blocks: persistence.schemaManifest.block_schemas, settings: persistence.schemaManifest.settings_schema },
  effectiveSchemaNote: 'Canonical persistence adapter resolves empty inline badge references to reusable badge label fields. No independent schema reimplementation.',
  settingDescriptors: settings, fieldTypes: settingTypes, declaredTypesWithoutRendererBranch: settingTypes.filter(t => !knownControls.includes(t)),
  resourceDescriptors: settings.filter(f => ['image','video','video_url','product','collection','page','blog','menu','url','font_picker'].includes(String(f.type))),
  assets: bundle.renderer.assets, layouts: Object.entries(bundle.layout).map(([key, f]) => ({ key, path: f.path, sourceSha256: sha(f.source) })),
  locales: Object.fromEntries(Object.entries(bundle.locales).map(([key, data]) => [key, { keys: Object.keys(data), leafPaths: localeLeaves(data), sha256: sha(JSON.stringify(data)) }])),
  counts: { templates: templates.length, sectionTypes: sectionTypes.length, reusableBlockTypes: reusableBlockTypes.length, settingDescriptors: settings.length, globalGroups: groups.length },
  evidenceLimits: ['Only the existing canonical pure factory was evaluated in memory. No rendered UI or installed capability is certified.', 'Schema declarations and switch branches establish an inventory, not successful save/reload/publish or usability.', 'Every descriptor remains NOT_RUN for the completion candidate; earlier runtime cases retain separate original identities.', 'Product price, stock and furniture facts remain in canonical catalogue editors; no new theme authority introduced.']
};
writeFileSync(resolve(out, 'CAPABILITY_INVENTORY.json'), JSON.stringify(inventory, null, 2) + '\n');
console.log(JSON.stringify({ counts: inventory.counts, fieldTypes: settingTypes, missingControlBranches: inventory.declaredTypesWithoutRendererBranch, closureFiles: closure.size, bundleSha256: inventory.canonicalFactoryBundleSha256 }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
