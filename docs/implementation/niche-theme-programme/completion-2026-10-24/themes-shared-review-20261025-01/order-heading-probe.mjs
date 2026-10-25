// One finite, source-only actual-render review. No DB, browser, network or package writes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '../../../../../packages/theme-engine/src/first-party-theme-catalog.ts';
import { LiquidRenderer } from '../../../../../packages/theme-engine/src/theme-renderer.ts';
import { DEFAULT_THEME_SETTINGS } from '../../../../../packages/theme-engine/src/theme-settings.ts';

const { JSDOM } = createRequire(new URL('../../../../../packages/theme-engine/package.json', import.meta.url))('jsdom');
const sha = text => createHash('sha256').update(text).digest('hex');
const results = [];
for (const listing of firstPartyThemeListings({ designVersion: '2.0.0' })) {
  const original = createFirstPartyCatalogBundle(listing.slug, { customizationVersion: '2.1.0' });
  const before = JSON.stringify(original), bundle = structuredClone(original);
  const template = bundle.templates['customers/order'];
  const id = template.order.find(id => template.sections[id].type === 'customer-order-detail');
  assert.ok(id);
  const heading = `Configured ${listing.name} heading`;
  template.sections[id].settings.heading = heading;
  const source = bundle.sections['customer-order-detail'].source;
  const order = { number: 'HEADING-REVIEW', status: 'confirmed', currency: 'INR', total: 100,
    line_items: [{ title: 'Synthetic source-only item', quantity: 1, line_price: 100, niche_facts_text: 'SAVED_FACTS_POSITIVE_CONTROL' }] };
  const rendered = await new LiquidRenderer().render({
    context: { storeId: '11111111-1111-4111-8111-111111111111', subdomain: 'source-review', path: '/account/orders/source-only', previewMode: false, locale: 'en-IN' },
    storeTemplate: { themeId: listing.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'customers/order', type: 'page', layoutKey: 'theme', sections: [] },
    liquidBundle: bundle, liquidTemplateKey: 'customers/order',
    liquidContext: { shop: { name: 'Source-only heading review' }, buyer: { id: 'source-only-buyer' }, order },
  });
  assert.equal(rendered.status, 'rendered');
  const html = rendered.liquid.contentForLayout, dom = new JSDOM(html);
  try {
    const observedHeading = dom.window.document.querySelector('.lb-order-detail h1')?.textContent;
    assert.ok(observedHeading?.includes(order.number));
    results.push({ slug: listing.slug, name: listing.name, version: original.package.version,
      sectionSourceSha256: sha(source), declaredTextHeading: bundle.sections['customer-order-detail'].schema.settings.find(x => x.id === 'heading')?.type === 'text',
      inputHeading: heading, expectedHeading: `${heading} #${order.number}`, observedHeading,
      headingApplied: observedHeading === `${heading} #${order.number}`,
      savedFactsPositiveControl: dom.window.document.body.textContent.includes('SAVED_FACTS_POSITIVE_CONTROL'),
      renderedHtmlSha256: sha(html), originalBundleUnchanged: before === JSON.stringify(original),
      status: observedHeading === `${heading} #${order.number}` ? 'HEADING_EFFECT_CONFIRMED_SOURCE_ONLY' : 'REPRODUCED_DECLARED_HEADING_NO_EFFECT',
    });
  } finally { dom.window.close(); }
}
const report = { recordedAt: new Date().toISOString(), scope: 'Actual canonical Liquid source rendering of current210; not mounted/browser/order evidence',
  runReference: '49ada80bc494', results, reproduced: results.filter(x => !x.headingApplied).map(x => x.slug),
  noMainOrCandidateEdits: true, noNewBuildOrNative: true, noBrowserDatabaseProviderOrNetworkActions: true };
writeFileSync(new URL('./ORDER_HEADING_ALL10_SOURCE_REVIEW.json', import.meta.url), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ reviewed: results.length, headingApplied: results.filter(x => x.headingApplied).length, reproduced: report.reproduced }) + '\n');
