// Reproducer for the completed read-only source probe, not installed/browser proof.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const root = '/Volumes/Projects/LetBuyy';
const require = createRequire(`${root}/packages/theme-engine/package.json`);
const { Liquid } = require('liquidjs');
const artifact = 'docs/implementation/niche-theme-programme/release-v2/proposals/81e91859ebc8c497a49da337d064e1885a76964839d14e39f4a0a3de2283f47f/letbuyy-summit-2.0.0.json';
const bundle = JSON.parse(readFileSync(`${root}/${artifact}`, 'utf8')).document.liquidBundle;
const engine = new Liquid({ dynamicPartials: false, strictFilters: true, strictVariables: false, ownPropertyOnly: true, outputEscape: 'escape', jsTruthy: false });
const heading = (type, tag) => bundle.sections[type].source.match(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`))[0];
const filter = heading('collection-filter', 'h1');
const order = heading('customer-order-detail', 'h1');
const grid = heading('product-grid', 'h2');
const cases = [];
for (const [name, source, before, after] of [
    ['collection-filter normal collection', filter, { collection: { title: 'Gifts' }, section: { settings: { title: 'Find a thoughtful gift' } } }, { collection: { title: 'Gifts' }, section: { settings: { title: 'Birthday surprises' } } }],
    ['collection-filter empty-title fallback control', filter, { collection: { title: '' }, section: { settings: { title: 'Find a thoughtful gift' } } }, { collection: { title: '' }, section: { settings: { title: 'Birthday surprises' } } }],
    ['customer-order-detail heading', order, { order: { number: 'SYNTHETIC-WITNESS' }, section: { settings: { heading: 'Order' } } }, { order: { number: 'SYNTHETIC-WITNESS' }, section: { settings: { heading: 'Your gift order' } } }],
    ['product-grid positive control', grid, { section: { settings: { title: 'Small boxes. Thoughtful combinations.' } } }, { section: { settings: { title: 'Birthday surprises' } } }],
]) {
    const first = await engine.parseAndRender(source, before);
    const edited = await engine.parseAndRender(source, after);
    cases.push({ name, fragment: source, before: first, after: edited, headingChanged: first !== edited });
}
const body = bundle.sections['collection-product-list'].source.replace(/{%\s*schema\s*%}[\s\S]*?{%\s*endschema\s*%}/g, '');
process.stdout.write(JSON.stringify({ classification: 'READ_ONLY_LIQUID_HEADING_FRAGMENT_WITNESS_NOT_BROWSER_OR_ORDER_PROOF', cases, collectionProductList: { declaredHeading: true, bodyReferencesSectionSettings: /section\.settings/.test(body), titleTokenCount: (body.match(/section\.settings\.title/g) || []).length } }) + '\n');
