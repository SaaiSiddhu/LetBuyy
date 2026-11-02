import { buildLiquidThemePackagePersistencePayload } from '/private/tmp/letbuyy-theme-editor-slice-20261030-02/packages/theme-engine/src/theme-bundle';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '/private/tmp/letbuyy-theme-editor-slice-20261030-02/packages/theme-engine/src/theme-bundle-core';
import { collectThemeTemplateValidationIssues, getThemeSettingsSchema } from '/private/tmp/letbuyy-theme-editor-slice-20261030-02/packages/theme-engine/src/index';
import { sectionInsertionRefusal } from '/private/tmp/letbuyy-theme-editor-slice-20261030-02/packages/theme-engine/src/editor-section-insertion';
import { ThemeExecutionAdapter } from '/private/tmp/letbuyy-theme-editor-slice-20261030-02/services/api-gateway/src/execution/theme-execution.adapter';

async function main() {
  const bundle = createLetbuyyCoreLiquidThemeBundleFixture();
  const baseline = { themeId: 'letbuyy-core', templates: structuredClone(bundle.templates), liquidBundle: structuredClone(bundle) };
  const runtime = { source: 'database', themePackageId: '10000000-0000-4000-8000-000000000003', themePackageVersionId: '10000000-0000-4000-8000-000000000004', sectionSchemas: buildLiquidThemePackagePersistencePayload(bundle).schemaManifest.section_schemas, settingsSchema: getThemeSettingsSchema('letbuyy-core') };
  const check = (templateConfig: Record<string, unknown>) => collectThemeTemplateValidationIssues({ templateConfig, runtime: runtime as never, themeSlug: 'letbuyy-core', trustedPreviousConfig: baseline });
  console.log(JSON.stringify({ kind: 'positive_control', issues: check(baseline), node: process.version, execPath: process.execPath }));

  const legacy = { themeId: 'letbuyy-core', rendererEngine: 'liquid', liquidBundle: structuredClone(bundle), sections: { header: { id: 'review-forged-grid', type: 'product-grid', settings: {}, blocks: [] }, template: [] } };
  const calls: string[] = [];
  const db = {
    from(table: string) {
      if (table !== 'themes') throw new Error(`unexpected table ${table}`);
      const chain = { select() { return chain; }, eq() { return chain; }, async maybeSingle() { return { data: { id: '10000000-0000-4000-8000-000000000005', slug: 'letbuyy-core', name: 'LetBuyy Core', is_active: true, default_template: baseline }, error: null }; } };
      return chain;
    },
    async rpc(name: string) {
      calls.push(name);
      if (name === 'read_owned_theme_draft_v1') return { data: { store: { id: '10000000-0000-4000-8000-000000000001' }, has_draft: true, theme_instance_draft_id: '10000000-0000-4000-8000-000000000002', version: 1, template_config: baseline }, error: null };
      if (name !== 'mutate_owned_theme_draft_v1') throw new Error(`unexpected RPC ${name}`);
      return { data: { version: 2, current_version: 2, replayed: false, saved_at: '2026-10-30T00:00:00Z', draft: { id: '10000000-0000-4000-8000-000000000002', version: 2 } }, error: null };
    },
  };
  const adapter = new ThemeExecutionAdapter(db as never);
  (adapter as unknown as { schemaRegistry: { resolveThemeRuntime: () => Promise<unknown> } }).schemaRegistry = { resolveThemeRuntime: async () => runtime };
  let saveError: string | null = null;
  try { await adapter.saveDraft('letbuyy-core', { store_id: '10000000-0000-4000-8000-000000000001', template_key: 'index', base_version: 1, idempotency_key: 'review-legacy-header', client: 'api', template_config: legacy } as never, 'synthetic-actor'); }
  catch (error) { saveError = error instanceof Error ? error.message : String(error); }
  console.log(JSON.stringify({ kind: 'legacy_header_eligibility_bypass', trustedProductGridGroups: runtime.sectionSchemas['product-grid'].enabled_on, issues: check(legacy), mutationCalls: calls.filter(x => x === 'mutate_owned_theme_draft_v1').length, saveError }));

  const rows = Array.from({ length: 50 }, (_, i) => ({ id: `review-hero-${i}`, type: 'hero-banner', order: (i + 1) * 10, settings: {}, blocks: [] }));
  const groups = { header: [], footer: [], template: rows };
  const candidate = { ...baseline, sections: { template: [...rows, { id: 'review-new-51', type: 'hero-banner', order: 510, settings: {}, blocks: [] }] } };
  candidate.templates.index.sections = Object.fromEntries(candidate.sections.template.map(row => [row.id, { type: row.type, settings: {}, blocks: {} }])) as typeof candidate.templates.index.sections;
  candidate.templates.index.order = candidate.sections.template.map(row => row.id);
  console.log(JSON.stringify({ kind: 'catalog_server_count_disagreement', existingCount: rows.length, uiRefusal: sectionInsertionRefusal(bundle, groups, 'index', { group: 'template', templateKey: 'index', position: 'end' }, 'hero-banner'), issues: check(candidate) }));

  const duplicate = { ...baseline, templates: structuredClone(bundle.templates) };
  const reused = duplicate.templates.index.order[0];
  duplicate.templates.header.sections[reused] = { type: 'announcement-bar', settings: {} } as typeof duplicate.templates.header.sections[string];
  duplicate.templates.header.order.push(reused);
  console.log(JSON.stringify({ kind: 'cross_group_duplicate_id', duplicateId: reused, issues: check(duplicate) }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
