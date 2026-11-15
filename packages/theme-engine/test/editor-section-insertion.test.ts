import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLiquidThemePackagePersistencePayload,
  parseLiquidThemePackageBundle,
} from '../src/theme-bundle';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { collectThemeTemplateValidationIssues, getThemeSettingsSchema } from '../src/index';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '../src/first-party-theme-catalog';
import {
  insertEditorSection,
  listEditorSectionCandidates,
  sectionDefinitionAllowsGroup,
  sectionInsertionRefusal,
  type EditorSectionGroups,
  type EditorSectionInsertionTarget,
} from '../src/editor-section-insertion';

const section = (id: string, type: string, order: number) => ({ id, type, order });
const fixture = () => {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  for (const [type, file] of Object.entries(bundle.sections)) {
    file.schema.enabled_on.groups = type === 'header' || type === 'announcement-bar' ? ['header']
      : type === 'footer' ? ['footer'] : type === 'newsletter-signup' ? ['template', 'footer'] : ['template'];
    file.schema.disabled_on.groups = [];
    if (type === 'header' || type === 'footer') file.schema.limit = 1;
    file.source = file.source.replace(/{% schema %}[\s\S]*?{% endschema %}/,
      '{% schema %}\n' + JSON.stringify(file.schema, null, 2) + '\n{% endschema %}');
  }
  return bundle;
};
const groups = (): EditorSectionGroups<ReturnType<typeof section>> => ({
  header: [section('announcement', 'announcement-bar', 10), section('header', 'header', 20)],
  template: [section('first', 'hero-banner', 10), section('second', 'product-grid', 20)],
  footer: [section('footer', 'footer', 10)],
});
const target = (group: EditorSectionInsertionTarget['group'], position: EditorSectionInsertionTarget['position'], adjacentSectionId?: string): EditorSectionInsertionTarget =>
  ({ group, templateKey: 'index', position, ...(adjacentSectionId ? { adjacentSectionId } : {}) });

test('installed schema gates shared groups, template wildcard, disabled templates and app-block seam', () => {
  const bundle = fixture();
  assert.equal(sectionInsertionRefusal(bundle, groups(), 'index', target('header', 'before', 'header'), 'announcement-bar'), null);
  assert.match(sectionInsertionRefusal(bundle, groups(), 'index', target('header', 'before', 'header'), 'product-grid')!, /not enabled/);
  assert.match(sectionInsertionRefusal(bundle, groups(), 'index', target('template', 'end'), 'app-block-slot')!, /not available/);
  assert.match(sectionInsertionRefusal(bundle, groups(), 'index', target('header', 'end'), 'header')!, /Only 1/);
  assert.equal(sectionDefinitionAllowsGroup(bundle.sections['newsletter-signup'].schema, 'footer', 'index'), true);
  assert.equal(sectionDefinitionAllowsGroup(bundle.sections['newsletter-signup'].schema, 'template', 'index'), true);
  bundle.sections['product-grid'].schema.disabled_on.templates = ['index'];
  assert.match(sectionInsertionRefusal(bundle, groups(), 'index', target('template', 'end'), 'product-grid')!, /not enabled/);
  const candidates = listEditorSectionCandidates(bundle, groups(), 'index', target('header', 'end'));
  assert.equal(candidates.some(item => item.type === 'app-block-slot'), false);
  assert.equal(candidates.find(item => item.type === 'product-grid')?.available, false);
  assert.equal(candidates.find(item => item.type === 'announcement-bar')?.available, true);
});

test('exact insertion preserves IDs, rejects stale/cross-group anchors, and supports empty groups', () => {
  const bundle = fixture(), original = groups(), snapshot = structuredClone(original);
  const before = insertEditorSection(bundle, original, 'index', target('header', 'before', 'header'), section('new', 'announcement-bar', 0));
  assert.equal(before.inserted, true);
  assert.deepEqual(before.sections.header.map(row => [row.id, row.order]), [['announcement', 10], ['new', 20], ['header', 30]]);
  assert.deepEqual(original, snapshot);
  const after = insertEditorSection(bundle, original, 'index', target('template', 'after', 'first'), section('new', 'hero-banner', 0));
  assert.deepEqual(after.sections.template.map(row => row.id), ['first', 'new', 'second']);
  assert.equal(insertEditorSection(bundle, original, 'index', target('footer', 'before', 'first'), section('bad', 'newsletter-signup', 0)).inserted, false);
  assert.equal(insertEditorSection(bundle, original, 'index', target('template', 'after', 'removed'), section('bad', 'hero-banner', 0)).inserted, false);
  assert.equal(insertEditorSection(bundle, original, 'product', target('template', 'end'), section('bad', 'hero-banner', 0)).inserted, false);
  assert.equal(insertEditorSection(bundle, original, 'index', target('template', 'end'), section('first', 'hero-banner', 0)).inserted, false);
  const empty = { ...original, footer: [] };
  assert.deepEqual(insertEditorSection(bundle, empty, 'index', target('footer', 'end'), section('signup', 'newsletter-signup', 0)).sections.footer.map(row => row.order), [10]);
});

test('generated schema source and persistence catalog keep group metadata and limits together', () => {
  const bundle = fixture();
  const header = bundle.sections.header;
  assert.match(header.source, /"groups": \[/);
  assert.match(header.source, /"limit": 1/);
  const parsed = parseLiquidThemePackageBundle(bundle);
  assert.deepEqual(parsed.sections.header.schema.enabled_on.groups, ['header']);
  const projection = buildLiquidThemePackagePersistencePayload(parsed).schemaManifest.section_schemas.header as {
    enabled_on: { groups: string[] }; limit: number;
  };
  assert.deepEqual(projection.enabled_on.groups, ['header']);
  assert.equal(projection.limit, 1);
});

test('server template validation rejects forged placement while preserving old installed shared instances', () => {
  const bundle = fixture();
  const runtime = {
    sectionSchemas: buildLiquidThemePackagePersistencePayload(bundle).schemaManifest.section_schemas as Parameters<typeof collectThemeTemplateValidationIssues>[0]['runtime']['sectionSchemas'],
    settingsSchema: getThemeSettingsSchema('letbuyy-core'),
  };
  const issues = (candidate: typeof bundle, runtimeOverride = runtime, previous = bundle) => collectThemeTemplateValidationIssues({
    templateConfig: { themeId: 'letbuyy-core', templates: candidate.templates, liquidBundle: candidate },
    runtime: runtimeOverride, themeSlug: 'letbuyy-core', trustedPreviousConfig: { templates: previous.templates },
  });
  assert.deepEqual(issues(bundle), []);
  const forged = structuredClone(bundle);
  forged.templates.header.sections['forged-grid'] = { type: 'product-grid', settings: {} } as typeof forged.templates.header.sections[string];
  forged.templates.header.order.push('forged-grid');
  assert.ok(issues(forged).some(issue => issue.includes('forged-grid is not enabled in the header')));
  const disabledRuntime = structuredClone(runtime);
  disabledRuntime.sectionSchemas['product-grid'].disabled_on.templates = ['index'];
  assert.ok(issues(bundle, disabledRuntime).some(issue => issue.includes('product-grid-default is not enabled in the template')));

  const legacy = structuredClone(bundle);
  delete (legacy.sections.header.schema.enabled_on as { groups?: string[] }).groups;
  delete (legacy.sections['announcement-bar'].schema.enabled_on as { groups?: string[] }).groups;
  const legacyRuntime = structuredClone(runtime);
  delete (legacyRuntime.sectionSchemas.header.enabled_on as { groups?: string[] }).groups;
  delete (legacyRuntime.sectionSchemas['announcement-bar'].enabled_on as { groups?: string[] }).groups;
  assert.deepEqual(issues(legacy, legacyRuntime), [], 'old exact header instances remain editable');
  legacy.templates.header.sections['new-header'] = { type: 'header', settings: {} } as typeof legacy.templates.header.sections[string];
  legacy.templates.header.order.push('new-header');
  assert.ok(issues(legacy, legacyRuntime, bundle).some(issue => issue.includes('new-header is not enabled in the header')));
});

test('all ten generated 2.1.0 designs expose the same bounded group contract without enabling app blocks', () => {
  const listings = firstPartyThemeListings();
  assert.equal(listings.length, 10);
  for (const listing of listings) {
    const bundle = createFirstPartyCatalogBundle(listing.slug, { customizationVersion: '2.1.0' });
    const empty = { header: [], template: [], footer: [] };
    assert.equal(bundle.package.version, '2.1.0', listing.slug);
    assert.equal(sectionInsertionRefusal(bundle, empty, 'index', target('header', 'end'), 'announcement-bar'), null, listing.slug);
    assert.equal(sectionInsertionRefusal(bundle, empty, 'index', target('footer', 'end'), 'newsletter-signup'), null, listing.slug);
    assert.match(sectionInsertionRefusal(bundle, empty, 'index', target('header', 'end'), 'product-grid')!, /not enabled/, listing.slug);
    assert.match(sectionInsertionRefusal(bundle, empty, 'index', target('template', 'end'), 'app-block-slot')!, /not available/, listing.slug);
    const manifest = buildLiquidThemePackagePersistencePayload(bundle).schemaManifest.section_schemas as Record<string, { enabled_on: { groups: string[] } }>;
    for (const type of ['announcement-bar', 'newsletter-signup']) {
      const embedded = JSON.parse(bundle.sections[type].source.match(/\{% schema %\}\s*([\s\S]*?)\s*\{% endschema %\}/)![1]);
      assert.deepEqual(embedded.enabled_on.groups, bundle.sections[type].schema.enabled_on.groups, `${listing.slug}:${type}:source`);
      assert.deepEqual(manifest[type].enabled_on.groups, bundle.sections[type].schema.enabled_on.groups, `${listing.slug}:${type}:manifest`);
    }
  }
});

test('legacy and mixed document projections cannot forge shared section placement', () => {
  const bundle = fixture();
  const runtime = {
    sectionSchemas: buildLiquidThemePackagePersistencePayload(bundle).schemaManifest.section_schemas as Parameters<typeof collectThemeTemplateValidationIssues>[0]['runtime']['sectionSchemas'],
    settingsSchema: getThemeSettingsSchema('letbuyy-core'),
  };
  const baseline = { themeId: 'letbuyy-core', templates: bundle.templates, liquidBundle: bundle };
  const check = (templateConfig: Record<string, unknown>) => collectThemeTemplateValidationIssues({
    templateConfig, runtime, themeSlug: 'letbuyy-core', trustedPreviousConfig: baseline,
  });
  assert.deepEqual(check(baseline), []);
  const sections = { header: { id: 'forged-grid', type: 'product-grid', settings: {}, blocks: [] }, template: [] };
  assert.ok(check({ themeId: 'letbuyy-core', liquidBundle: bundle, sections }).some(issue => /not enabled.*header/.test(issue)));
  assert.ok(check({ ...baseline, sections }).some(issue => /not enabled.*header/.test(issue)));
});

test('insertion shares the server legacy projection limit at 49, 50, 51 and 80', () => {
  const bundle = fixture();
  const rows = (count: number) => Array.from({ length: count }, (_, i) => section(`hero-${i}`, 'hero-banner', i * 10));
  assert.equal(sectionInsertionRefusal(bundle, { header: [], footer: [], template: rows(49) }, 'index', target('template', 'end'), 'hero-banner'), null);
  for (const count of [50, 51, 80]) {
    assert.match(sectionInsertionRefusal(bundle, { header: [], footer: [], template: rows(count) }, 'index', target('template', 'end'), 'hero-banner')!, /50 section limit/);
  }
});

test('identity is unique within a rendered page, while distinct page templates may reuse IDs', () => {
  const bundle = fixture();
  const runtime = {
    sectionSchemas: buildLiquidThemePackagePersistencePayload(bundle).schemaManifest.section_schemas as Parameters<typeof collectThemeTemplateValidationIssues>[0]['runtime']['sectionSchemas'],
    settingsSchema: getThemeSettingsSchema('letbuyy-core'),
  };
  const check = (templates: typeof bundle.templates) => collectThemeTemplateValidationIssues({
    templateConfig: { themeId: 'letbuyy-core', templates }, runtime, themeSlug: 'letbuyy-core',
  });
  assert.deepEqual(check(bundle.templates), []);
  const forged = structuredClone(bundle.templates), duplicateId = forged.index.order[0];
  forged.header.sections[duplicateId] = { type: 'announcement-bar', settings: {} } as typeof forged.header.sections[string];
  forged.header.order.push(duplicateId);
  assert.ok(check(forged).some(issue => /duplicate.*section|section.*duplicate/i.test(issue)));
  const distinct = structuredClone(bundle.templates);
  distinct['page.other'] = structuredClone(distinct.index);
  assert.deepEqual(check(distinct), [], 'separate nonshared page contexts are not the same composition');
});
