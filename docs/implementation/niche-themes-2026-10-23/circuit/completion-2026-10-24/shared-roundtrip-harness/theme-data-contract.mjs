/** Shared source-data contract only. No app, UI action, network, DB or provider execution. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const sha256 = value => createHash('sha256').update(typeof value === 'string' || ArrayBuffer.isView(value) ? value : JSON.stringify(value)).digest('hex');

export function assertBundleIdentity(bundle, expected) {
  assert.ok(expected && typeof expected.slug === 'string' && typeof expected.version === 'string', 'caller must supply expected slug AND version independently of factory output');
  assert.match(expected.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.match(expected.version, /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/);
  assert.equal(bundle?.package?.slug, expected.slug, 'actual bundle slug does not match admitted input');
  assert.equal(bundle?.package?.version, expected.version, 'actual bundle version mismatch: an ignored successor option must never fall back silently');
  if (expected.bundleSha256) assert.equal(sha256(bundle), expected.bundleSha256, 'actual package bytes differ from the caller-pinned bundle');
}

/** Callers may override specific values using canonical, source-backed fixtures. */
export function sampleFieldValue(field, { key, previous, resourceFixture }) {
  switch (field.type) {
    case 'toggle': case 'checkbox': return false;
    case 'text': case 'textarea': case 'richtext': return `Source fixture ${key}`.slice(0, field.maxLength ?? 80);
    case 'url': case 'image': return `https://example.invalid/theme-source/${encodeURIComponent(key)}.webp`;
    case 'product': case 'collection': case 'page': case 'blog': case 'menu':
      assert.ok(resourceFixture?.value && resourceFixture?.provenance, `${key}: supply an explicit resource value and its authority/provenance`);
      return resourceFixture.value;
    case 'select': case 'radio': {
      const values = (field.options ?? []).map(option => typeof option === 'object' ? option.value : option);
      assert.ok(values.length, `${key}: actual descriptor must supply choices`);
      return values.find(value => value !== (previous ?? field.default)) ?? values[0];
    }
    case 'range': case 'number': return field.min ?? 0;
    case 'color': return '#1E4060';
    default: throw new Error(`${key}:${field.type} requires a source-backed fixture value; unsupported fields are not silently skipped`);
  }
}

/**
 * Parameterized core. Adapters must be actual canonical functions; see README.
 * It uses fixture state mutations, never the shared editor action helper suite.
 * Child permission metadata is opaque: absence is NOT interpreted as unsupported.
 */
export function runThemeDataContract({ bundle, expectedIdentity, templateKey, adapters: a, fixtures = {}, emit = () => {} }) {
  // Identity runs before any adapter so an unrecognized selector cannot fake a pass.
  assertBundleIdentity(bundle, expectedIdentity);
  assert.ok(typeof templateKey === 'string' && bundle.templates?.[templateKey], 'caller must choose an actual existing template; no template fallback');
  const before = JSON.stringify(bundle);
  for (const key of ['parseBundle', 'describeBundle', 'buildEditorConfig', 'normalizeSettingsSchema', 'normalizeEditorState', 'buildDraftConfig', 'createSectionFromSchema', 'createBlockFromSchema', 'collectValidationIssues', 'compile', 'toDocument', 'fromDocument', 'isAppBlockType']) assert.equal(typeof a?.[key], 'function', `actual canonical adapter required: ${key}`);
  const source = a.parseBundle(structuredClone(bundle));
  assertBundleIdentity(source, { slug: expectedIdentity.slug, version: expectedIdentity.version });
  const appInstance = blocks => Object.values(blocks ?? {}).some(block => a.isAppBlockType(block.type) || appInstance(block.blocks));
  assert.ok(Object.values(source.templates).every(template => Object.values(template.sections).every(section => !appInstance(section.blocks))), 'existing app-block instances are refused, never erased or executed');
  const manifest = a.describeBundle(source);
  const schemas = manifest.sectionSchemas;
  assert.deepEqual(Object.keys(schemas).sort(), Object.keys(source.sections).sort(), 'use the supplied bundle\'s exact section definitions, not a fallback schema catalogue');
  const settings = a.normalizeSettingsSchema(manifest.settingsSchema);
  const runtime = { sectionSchemas: schemas, settingsSchema: settings };
  const base = a.buildEditorConfig(source);
  const protectedSections = new Set(['app-block-slot', ...(fixtures.protectedSectionTypes ?? [])]);
  const cases = [], fields = { edited: new Set(), retainedReadOnly: new Set(), informational: new Set() };
  const choose = (descriptors, previous, location) => {
    const values = { ...previous };
    for (const [key, field] of Object.entries(descriptors)) {
      const id = `${location}/${key}`;
      if (field.readOnlyReason) { fields.retainedReadOnly.add(id); continue; }
      if (['header', 'paragraph'].includes(field.type)) { fields.informational.add(id); continue; }
      const context = { key, previous: previous[key], location, resourceFixture: fixtures.resourceFixture };
      const overrideKey = `${location}/${key}`;
      values[key] = Object.hasOwn(fixtures.fieldValues ?? {}, overrideKey) ? structuredClone(fixtures.fieldValues[overrideKey]) : (fixtures.fieldValue ?? sampleFieldValue)(field, context);
      fields.edited.add(id);
    }
    return values;
  };
  const makeBlocks = type => {
    const blocks = [];
    for (const declared of source.sections[type].schema.blocks) {
      if (a.isAppBlockType(declared.type)) continue;
      const schema = schemas[type].blocks_schema?.[declared.type];
      assert.ok(schema, `${type}/${declared.type}: exact declared block schema required`);
      // Honor actual declared per-type limits. No invented child restriction.
      const count = Math.min(2, declared.limit ?? 2);
      for (let i = 0; i < count; i++) {
        const block = a.createBlockFromSchema(declared.type, schema, blocks.length * 10);
        assert.ok(!a.isAppBlockType(block.type));
        block.settings = choose(schema.fields ?? {}, block.settings, `block/${type}/${declared.type}`);
        blocks.push(block);
      }
    }
    return blocks;
  };
  const save = (state, label, retainWire = false) => {
    const wire = JSON.parse(JSON.stringify(a.buildDraftConfig(base, expectedIdentity.slug, state, templateKey)));
    if (retainWire) emit(`${label}.wire.json`, wire); // before assertions; preserve failures
    const issues = a.collectValidationIssues({ templateConfig: wire, runtime, themeSlug: expectedIdentity.slug });
    if (issues.length) emit(`${label}.FAILED-wire.json`, { issues, wire });
    assert.deepEqual(issues, [], `${label}: matching canonical schema validation`);
    const result = a.compile(wire, { baseBundle: source });
    assert.deepEqual(result.warnings, [], `${label}: no silent skipped data`);
    assertBundleIdentity(result.bundle, expectedIdentity.bundleSha256 ? { slug: expectedIdentity.slug, version: expectedIdentity.version } : expectedIdentity);
    assert.deepEqual(a.fromDocument(JSON.parse(JSON.stringify(a.toDocument(result.bundle)))), result.bundle, `${label}: canonical document JSON roundtrip`);
    return { wire, bundle: result.bundle, reloaded: a.normalizeEditorState(wire, expectedIdentity.slug, templateKey, schemas, settings) };
  };
  const get = (result, section, group) => result.bundle.templates[group === 'template' ? templateKey : group].sections[section.id];
  const preserved = (result, section, group) => {
    const actual = get(result, section, group);
    assert.ok(actual);
    assert.deepEqual(actual.settings, section.settings);
    assert.equal(actual.disabled, !section.visible);
    assert.deepEqual(actual.block_order, section.blocks.map(block => block.id));
    for (const block of section.blocks) {
      assert.equal(actual.blocks[block.id].type, block.type);
      assert.deepEqual(actual.blocks[block.id].settings, block.settings);
      assert.equal(actual.blocks[block.id].disabled, !block.visible);
    }
    for (const key of Object.keys(source.templates).filter(key => ![templateKey, 'header', 'footer'].includes(key))) assert.deepEqual(result.bundle.templates[key], source.templates[key], `unrelated template ${key}`);
    for (const group of ['header', 'footer']) if (source.templates[group]) assert.deepEqual(result.bundle.templates[group].order, source.templates[group].order, `pinned ${group} identities`);
    return structuredClone(actual);
  };
  const runCase = (id, fn) => {
    try { const observed = fn(); const row = { id, status: 'PASS_SOURCE_DATA_CONTRACT', observed }; cases.push(row); emit(`${id}.observed.json`, row); }
    catch (error) { const row = { id, status: 'FAIL_SOURCE_DATA_CONTRACT', error: error instanceof Error ? error.message : String(error) }; cases.push(row); emit(`${id}.failure.json`, row); }
  };
  try {
    for (const type of Object.keys(schemas).filter(type => !protectedSections.has(type))) runCase(`section-${type}`, () => {
      const state = a.normalizeEditorState(base, expectedIdentity.slug, templateKey, schemas, settings);
      const group = ['header', 'footer'].includes(type) ? type : 'template';
      let section = group === 'template' ? a.createSectionFromSchema(type, schemas, 1000) : state.sections[group].find(section => section.type === type);
      assert.ok(section, `actual pinned ${type} instance must exist`);
      if (group === 'template') state.sections.template.push(section);
      const firstId = section.id;
      section.settings = choose(schemas[type].settings_schema ?? {}, section.settings, `section/${type}`);
      section.blocks = makeBlocks(type);
      const phases = [{ phase: 'edited', data: preserved(save(state, `${type}-edited`, true), section, group) }];
      section.visible = false; section.blocks.reverse();
      for (const block of section.blocks) block.visible = false;
      phases.push({ phase: 'hidden-reordered', data: preserved(save(state, `${type}-hidden`), section, group) });
      section.visible = true;
      for (const block of section.blocks) block.visible = true;
      phases.push({ phase: 'shown', data: preserved(save(state, `${type}-shown`), section, group) });
      const oldBlockIds = section.blocks.map(block => block.id);
      if (group === 'template') state.sections.template = state.sections.template.filter(row => row.id !== firstId);
      else section.blocks = [];
      const removed = save(state, `${type}-removed`);
      if (group === 'template') assert.ok(!removed.bundle.templates[templateKey].sections[firstId]);
      else assert.deepEqual(get(removed, section, group).blocks, {});
      phases.push({ phase: 'removed', pinnedGroupSectionRetained: group !== 'template' });
      if (group === 'template') {
        section = a.createSectionFromSchema(type, schemas, 1000);
        assert.notEqual(section.id, firstId);
        section.settings = choose(schemas[type].settings_schema ?? {}, section.settings, `section/${type}`);
        state.sections.template.push(section);
      }
      section.blocks = makeBlocks(type);
      assert.ok(section.blocks.every(block => !oldBlockIds.includes(block.id)));
      phases.push({ phase: 'readded', data: preserved(save(state, `${type}-readded`), section, group) });
      return { type, group, firstId, finalId: section.id, phases, actualUICallbacksExecuted: false, resourceAuthorityProved: false };
    });
    runCase('protected-seams', () => {
      assert.ok(Object.values(source.templates).every(template => Object.values(template.sections).every(section => !protectedSections.has(section.type) && !appInstance(section.blocks))), 'protected extension seam must remain uninstantiated');
      return { protectedSectionTypes: [...protectedSections], appInstancesGenerated: 0, nestedPermissionInferenceMade: false };
    });
    runCase('theme-settings', () => {
      const state = a.normalizeEditorState(base, expectedIdentity.slug, templateKey, schemas, settings);
      const descriptors = Object.assign({}, ...Object.values(settings.settings).map(group => group.fields));
      state.themeSettings = choose(descriptors, state.themeSettings, 'theme');
      const result = save(state, 'theme-settings', true);
      for (const key of Object.keys(descriptors).filter(key => !['header', 'paragraph'].includes(descriptors[key].type))) {
        assert.deepEqual(result.wire.themeSettings[key], state.themeSettings[key]);
        assert.deepEqual(result.reloaded.themeSettings[key], state.themeSettings[key]);
        assert.deepEqual(result.bundle.config.settings_data.current[key], state.themeSettings[key]);
      }
      return { fields: state.themeSettings, renderedFontOrControlAcceptance: false };
    });
  } finally {
    assert.equal(JSON.stringify(bundle), before, 'never mutate the caller\'s actual/promoted bundle');
  }
  return { classification: 'SOURCE_DATA_CONTRACT_ONLY_NOT_UI_RESOURCE_OR_INSTALLED_ACCEPTANCE', identity: expectedIdentity, inputBundleSha256: sha256(bundle), normalizedSourceBundleSha256: sha256(source), templateKey, pass: cases.filter(row => row.status === 'PASS_SOURCE_DATA_CONTRACT').length, fail: cases.filter(row => row.status === 'FAIL_SOURCE_DATA_CONTRACT').length, cases, fieldCoverage: Object.fromEntries(Object.entries(fields).map(([key, values]) => [key, [...values].sort()])), inputUnchanged: true, nestedPermissionInferenceMade: false, actualUICallbacksExecuted: 0, resourceOwnershipProved: false };
}
