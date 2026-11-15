import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLiquidThemePackagePersistencePayload, createLetbuyyCoreLiquidThemeBundleFixture, getThemeSettingsSchema } from '@letbuyy/theme-engine';
import { ThemeExecutionAdapter } from '../execution/theme-execution.adapter';
import { ValidationError } from '../lib/errors';
import type { ThemeRuntimeSchema } from '../execution/schema-registry-execution.adapter';

const storeId = '10000000-0000-4000-8000-000000000001';
const draftId = '10000000-0000-4000-8000-000000000002';
const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
// This synthetic editor-capable fixture declares placement explicitly; historical
// frozen package factories keep their original bytes without added group defaults.
for (const [type, file] of Object.entries(bundle.sections)) {
  file.schema.enabled_on.groups = type === 'header' || type === 'announcement-bar' ? ['header']
    : type === 'footer' ? ['footer'] : type === 'newsletter-signup' ? ['template', 'footer'] : ['template'];
  file.schema.disabled_on.groups = [];
  file.source = file.source.replace(/{% schema %}[\s\S]*?{% endschema %}/,
    '{% schema %}\n' + JSON.stringify(file.schema, null, 2) + '\n{% endschema %}');
}

const baseline = { themeId: 'letbuyy-core', templates: structuredClone(bundle.templates), liquidBundle: structuredClone(bundle) };
const projection = buildLiquidThemePackagePersistencePayload(bundle).schemaManifest;
const runtime = {
  source: 'database', themePackageId: '10000000-0000-4000-8000-000000000003',
  themePackageVersionId: '10000000-0000-4000-8000-000000000004',
  sectionSchemas: projection.section_schemas, settingsSchema: getThemeSettingsSchema('letbuyy-core'),
} as unknown as ThemeRuntimeSchema;

function harness(previous = baseline, version = 1, runtimeOverride = runtime) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const theme = { id: '10000000-0000-4000-8000-000000000005', slug: 'letbuyy-core', name: 'LetBuyy Core',
    is_active: true, default_template: baseline };
  const db = {
    from(table: string) {
      assert.equal(table, 'themes');
      const chain = { select() { return chain }, eq() { return chain }, async maybeSingle() { return { data: theme, error: null } } };
      return chain;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      if (name === 'read_owned_theme_draft_v1') return { data: {
        store: { id: storeId }, has_draft: true, theme_instance_draft_id: draftId,
        version, template_config: previous,
      }, error: null };
      assert.equal(name, 'mutate_owned_theme_draft_v1');
      const receiptVersion = Number(args.p_base_version) + 1;
      return { data: { version: receiptVersion, current_version: Math.max(version, receiptVersion), replayed: receiptVersion < version,
        saved_at: '2026-10-30T00:00:00Z', draft: { id: draftId, version: receiptVersion, auto_saved_at: '2026-10-30T00:00:00Z' } }, error: null };
    },
  };
  const adapter = new ThemeExecutionAdapter(db as never);
  (adapter as unknown as { schemaRegistry: { resolveThemeRuntime: () => Promise<ThemeRuntimeSchema> } }).schemaRegistry = {
    resolveThemeRuntime: async () => runtimeOverride,
  };
  const save = (candidate: typeof baseline, baseVersion = version) => adapter.saveDraft('letbuyy-core', {
    store_id: storeId, template_key: 'index', base_version: baseVersion, idempotency_key: 'synthetic-section-insert',
    client: 'api',
    template_config: candidate,
  }, 'synthetic-actor');
  return { calls, save };
}

test('actual adapter accepts valid group insertion and sends only the current owned revision to CAS RPC', async () => {
  const candidate = structuredClone(baseline);
  candidate.templates.header.sections['new-announcement'] = { type: 'announcement-bar', settings: {} } as typeof candidate.templates.header.sections[string];
  candidate.templates.header.order.splice(1, 0, 'new-announcement');
  const h = harness();
  const receipt = await h.save(candidate);
  assert.equal(receipt.version, 2);
  assert.equal(h.calls.filter(call => call.name === 'mutate_owned_theme_draft_v1').length, 1);
  assert.equal(h.calls.at(-1)?.args.p_base_version, 1);
});

test('actual adapter rejects forged candidate bundle placement before any mutation RPC', async () => {
  const candidate = structuredClone(baseline);
  candidate.templates.header.sections['forged-grid'] = { type: 'product-grid', settings: {} } as typeof candidate.templates.header.sections[string];
  candidate.templates.header.order.push('forged-grid');
  candidate.liquidBundle.sections['product-grid'].schema.enabled_on.groups = ['header', 'template'];
  const h = harness();
  await assert.rejects(() => h.save(candidate), ValidationError);
  assert.equal(h.calls.filter(call => call.name === 'mutate_owned_theme_draft_v1').length, 0);
});

test('legacy group edit keeps exact prior IDs but rejects a forged new ID or changed type', async () => {
  const oldRuntime = structuredClone(runtime) as ThemeRuntimeSchema;
  delete ((oldRuntime.sectionSchemas.header as unknown as { enabled_on: { groups?: string[] } }).enabled_on ?? {}).groups;
  delete ((oldRuntime.sectionSchemas['announcement-bar'] as unknown as { enabled_on: { groups?: string[] } }).enabled_on ?? {}).groups;
  const unchanged = structuredClone(baseline);
  const h = harness(baseline, 1, oldRuntime);
  await h.save(unchanged);
  const forged = structuredClone(unchanged);
  forged.templates.header.sections['new-header'] = { type: 'header', settings: {} } as typeof forged.templates.header.sections[string];
  forged.templates.header.order.push('new-header');
  const h2 = harness(baseline, 1, oldRuntime);
  await assert.rejects(() => h2.save(forged), ValidationError);
  assert.equal(h2.calls.filter(call => call.name === 'mutate_owned_theme_draft_v1').length, 0);
  const changed = structuredClone(unchanged);
  changed.templates.header.sections['header-default'].type = 'announcement-bar';
  const h3 = harness(baseline, 1, oldRuntime);
  await assert.rejects(() => h3.save(changed), ValidationError);
});

test('stale retry still reaches CAS receipt path without mutable schema revalidation', async () => {
  const stale = structuredClone(baseline);
  stale.templates.header.sections['forged-grid'] = { type: 'product-grid', settings: {} } as typeof stale.templates.header.sections[string];
  stale.templates.header.order.push('forged-grid');
  const h = harness(baseline, 8);
  await h.save(stale, 1);
  const mutation = h.calls.find(call => call.name === 'mutate_owned_theme_draft_v1');
  assert.equal(mutation?.args.p_base_version, 1);
  assert.deepEqual(mutation?.args.p_runtime, {});
});
