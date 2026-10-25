/** Pure actual-renderer reproduction. No app/server/browser/database or persistence. */
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFirstPartyCatalogBundle } from '../../../../../packages/theme-engine/src/first-party-theme-catalog';
import { LiquidRenderer } from '../../../../../packages/theme-engine/src/theme-renderer';
import { DEFAULT_THEME_SETTINGS } from '../../../../../packages/theme-engine/src/theme-settings';

const output = dirname(fileURLToPath(import.meta.url));
const root = resolve(output, '../../../../..');
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const bundle = createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0' });
async function render(template: string, instanceId: string, key: string, value: string) {
  const candidate = structuredClone(bundle);
  candidate.templates[template].sections[instanceId].settings[key] = value;
  const result = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'circuit-source-probe', path: template === 'collection' ? '/products' : '/account/orders/source-probe', previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: 'letbuyy-forge', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: template, type: template === 'collection' ? 'collection' : 'customer_order', layoutKey: 'theme', sections: [] },
    liquidBundle: candidate, liquidTemplateKey: template,
    liquidContext: { shop: { name: 'Synthetic source probe' }, collection: { title: 'Accessories', products: [], total: 0, pagination: { page: 1 } }, order: { id: 'synthetic-not-persisted', name: 'Source probe', order_number: 'SOURCE-ONLY', line_items: [], subtotal: 0, total: 0 }, buyer: { id: 'synthetic-not-authenticated' } },
  });
  return { status: result.status, warnings: result.warnings, html: result.liquid?.contentForLayout ?? null };
}
async function main() {
  const rows = [];
  for (const scope of [
    { template: 'collection', instanceId: 'forge-results-collection', sectionType: 'collection-product-list', field: 'title' },
    { template: 'customers/order', instanceId: 'customer-order-detail-default', sectionType: 'customer-order-detail', field: 'heading' },
  ]) {
    const first = await render(scope.template, scope.instanceId, scope.field, 'CIRCUIT_HEADING_PROBE_ALPHA');
    const second = await render(scope.template, scope.instanceId, scope.field, 'CIRCUIT_HEADING_PROBE_BETA');
    const safeName = scope.sectionType;
    writeFileSync(resolve(output, `heading-probe-${safeName}-alpha.html`), first.html ?? '');
    writeFileSync(resolve(output, `heading-probe-${safeName}-beta.html`), second.html ?? '');
    rows.push({ ...scope, firstStatus: first.status, secondStatus: second.status, warnings: [first.warnings, second.warnings], alphaPresent: first.html?.includes('CIRCUIT_HEADING_PROBE_ALPHA') ?? false, betaPresent: second.html?.includes('CIRCUIT_HEADING_PROBE_BETA') ?? false, identicalRenderedContent: first.html !== null && first.html === second.html, alphaSha256: first.html === null ? null : digest(first.html), betaSha256: second.html === null ? null : digest(second.html), evidence: [`heading-probe-${safeName}-alpha.html`, `heading-probe-${safeName}-beta.html`] });
  }
  const report = { recordedAt: new Date().toISOString(), classification: 'ACTUAL_SOURCE_RENDERER_ONLY_NOT_BROWSER_PERSISTENCE_OR_AUTH_PROOF', sourceManifestSha256: digest(readFileSync(resolve(output, 'SOURCE_MANIFEST.json'), 'utf8')), bundleSha256: digest(JSON.stringify(bundle)), rows, productCasesExecuted: 0, defectsConfirmedAtSourceRender: rows.filter(row => row.firstStatus === 'rendered' && row.secondStatus === 'rendered' && !row.alphaPresent && !row.betaPresent && row.identicalRenderedContent).map(row => row.sectionType) };
  writeFileSync(resolve(output, 'HEADING_SOURCE_REPRODUCTION.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ classification: report.classification, defectsConfirmedAtSourceRender: report.defectsConfirmedAtSourceRender, rows: rows.map(row => ({ sectionType: row.sectionType, firstStatus: row.firstStatus, secondStatus: row.secondStatus, identicalRenderedContent: row.identicalRenderedContent, alphaPresent: row.alphaPresent, betaPresent: row.betaPresent, warnings: row.warnings })) }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
