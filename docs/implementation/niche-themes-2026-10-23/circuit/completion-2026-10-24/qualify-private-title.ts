/** Actual pure-factory/renderer oracle for a private one-line proposal. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '../../../../../packages/theme-engine/src/first-party-theme-catalog';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../../packages/theme-engine/src/theme-bundle-core';
import { LiquidThemePackageBundleSchema, type LiquidThemePackageBundle } from '../../../../../packages/theme-engine/src/theme-bundle';
import { withNicheOrderPresentation } from '../../../../../packages/theme-engine/src/niche-order-presentation';
import { LiquidRenderer } from '../../../../../packages/theme-engine/src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../../../../../packages/theme-engine/src/theme-settings';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../../../../../packages/theme-engine/src/theme-document';

const output = dirname(fileURLToPath(import.meta.url));
const proposal = resolve(output, 'private-title-proposal');
const root = resolve(output, '../../../../..');
const production = resolve(root, 'packages/theme-engine/src/circuit-theme.ts');
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
type Factory = (base: LiquidThemePackageBundle) => LiquidThemePackageBundle;
function loadPrivateFactory(text: string): Factory {
  const result = { exports: {} as { createCircuitTheme?: Factory } };
  const compiled = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', 'module', compiled)(createRequire(production), result.exports, result);
  assert.equal(typeof result.exports.createCircuitTheme, 'function');
  return result.exports.createCircuitTheme!;
}
function publicPipeline(factory: Factory) {
  const listing = firstPartyThemeListings({ designVersion: '2.0.0' }).find(row => row.slug === 'letbuyy-forge')!;
  const base = createLetbuyyCoreLiquidThemeBundleFixture();
  base.package.slug = listing.slug;
  base.package.name = listing.name;
  const configured = LiquidThemePackageBundleSchema.parse({ ...base, config: { ...base.config, settings_data: { ...base.config.settings_data, current: { ...base.config.settings_data.current, ...listing.settings } } } });
  const before = JSON.stringify(configured);
  const result = withNicheOrderPresentation(factory(configured));
  assert.equal(JSON.stringify(configured), before, 'factory must not mutate input');
  return result;
}
async function render(bundle: LiquidThemePackageBundle, template: 'collection' | 'search') {
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'circuit-private-source-probe', path: template === 'search' ? '/search' : '/products', previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-forge', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: template, type: template, layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: template,
    liquidContext: { shop: { name: 'Synthetic source probe' }, collection: { title: 'Accessories', products: [], total: 0, pagination: { page: 1 } } },
  });
  assert.equal(result.status, 'rendered');
  assert.deepEqual(result.warnings, []);
  return { html: result.liquid!.contentForLayout, style: result.liquid!.headStyleText };
}
function withTitle(bundle: LiquidThemePackageBundle, template: 'collection' | 'search', value: string) {
  const copy = structuredClone(bundle);
  const instance = Object.values(copy.templates[template].sections).find(section => section.type === 'collection-product-list')!;
  instance.settings.title = value;
  return copy;
}
async function main() {
  const meta = JSON.parse(readFileSync(resolve(proposal, 'PROPOSAL.json'), 'utf8'));
  const currentSource = readFileSync(production, 'utf8');
  const candidateSource = readFileSync(resolve(proposal, 'circuit-theme.candidate.ts'), 'utf8');
  assert.equal(hash(currentSource), meta.baseSha256);
  assert.equal(hash(candidateSource), meta.candidateSha256);
  const original = createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0' });
  const reconstructed = publicPipeline(loadPrivateFactory(currentSource));
  assert.deepEqual(reconstructed, original, 'actual public factory pipeline is the baseline oracle');
  const candidate = publicPipeline(loadPrivateFactory(candidateSource));
  const withoutChange = structuredClone(candidate);
  withoutChange.sections['collection-product-list'] = original.sections['collection-product-list'];
  assert.deepEqual(withoutChange, original, 'only the owned results section may change');
  assert.deepEqual(fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(candidate)))), candidate);
  const cases = [];
  for (const template of ['collection', 'search'] as const) {
    const baseline = await render(original, template);
    const fresh = await render(candidate, template);
    assert.deepEqual(fresh, baseline, 'default rendered HTML and styles must stay byte-identical');
    const oldAlpha = await render(withTitle(original, template, 'CIRCUIT_TITLE_ALPHA'), template);
    const oldBeta = await render(withTitle(original, template, 'CIRCUIT_TITLE_BETA'), template);
    assert.deepEqual(oldAlpha, oldBeta, 'RED: old declared setting has no rendering effect');
    const alpha = await render(withTitle(candidate, template, 'CIRCUIT_TITLE_ALPHA'), template);
    const beta = await render(withTitle(candidate, template, 'CIRCUIT_TITLE_BETA'), template);
    assert.ok(alpha.html.includes('<h2>CIRCUIT_TITLE_ALPHA</h2>'));
    assert.ok(beta.html.includes('<h2>CIRCUIT_TITLE_BETA</h2>'));
    assert.ok(!alpha.html.includes('CIRCUIT_TITLE_BETA') && !beta.html.includes('CIRCUIT_TITLE_ALPHA'));
    const cleared = await render(withTitle(candidate, template, ''), template);
    assert.deepEqual(cleared, fresh);
    const escaped = await render(withTitle(candidate, template, '<script>CIRCUIT_UNTRUSTED_TITLE</script>'), template);
    assert.ok(escaped.html.includes('&lt;script&gt;CIRCUIT_UNTRUSTED_TITLE&lt;/script&gt;'));
    assert.ok(!escaped.html.includes('<script>CIRCUIT_UNTRUSTED_TITLE'));
    for (const [name, result] of Object.entries({ baseline, fresh, oldAlpha, oldBeta, alpha, beta, cleared, escaped })) writeFileSync(resolve(proposal, `${template}-${name}.html`), result.html);
    cases.push({ template, observedOldFieldEffect: false, privateCustomTitleRenders: true, clearRestoresExactDefault: true, merchantTextEscaped: true, defaultHtmlAndStyleByteIdentical: true, originalDefaultHtmlSha256: hash(baseline.html), privateDefaultHtmlSha256: hash(fresh.html) });
  }
  assert.equal(hash(readFileSync(production, 'utf8')), meta.baseSha256, 'Main source unchanged');
  const report = { recordedAt: new Date().toISOString(), classification: 'PRIVATE_ACTUAL_SOURCE_FACTORY_RENDERER_QUALIFICATION_ONLY', mainApplied: false, review: 'PENDING', source: meta, baselinePublicBundleSha256: hash(JSON.stringify(original)), candidateBundleSha256: hash(JSON.stringify(candidate)), actualPublicPipelineEquality: true, sourceScopeOnlyResultsSection: true, realJSONDocumentRoundtrip: true, cases, limitations: ['No mounted editor, save/reload, preview/publish, browser, native PostgreSQL, provider or current installed acceptance.', 'No product regression suite, typecheck, full build or real governance gate was run.', 'Any eventual apply needs allocator source lease, independent review, catalogue/version lineage and affected candidate retests.'] };
  writeFileSync(resolve(proposal, 'SOURCE_QUALIFICATION.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ classification: report.classification, mainApplied: false, actualPublicPipelineEquality: true, sourceScopeOnlyResultsSection: true, realJSONDocumentRoundtrip: true, cases }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
