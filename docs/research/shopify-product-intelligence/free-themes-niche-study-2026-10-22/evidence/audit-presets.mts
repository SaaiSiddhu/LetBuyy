// Read-only source experiment. Writes research fixtures only; no database or provider calls.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firstPartyThemeListings, createFirstPartyCatalogBundle } from '../../../../../packages/theme-engine/src/first-party-theme-catalog.ts';
import { EXPERIENCE_COMPOSITIONS, collectExperienceCompositionBundleIssues } from '../../../../../packages/theme-engine/src/experience-compositions.ts';
import { applyExperienceToDocument } from '../../../../../packages/theme-engine/src/experience-apply.ts';
import { toThemeDocumentV2 } from '../../../../../packages/theme-engine/src/theme-document.ts';
import { LiquidRenderer } from '../../../../../packages/theme-engine/src/theme-renderer.ts';
import { DEFAULT_THEME_SETTINGS } from '../../../../../packages/theme-engine/src/index.ts';

const root = new URL('../', import.meta.url);
const out = new URL('evidence/current-preset-renders/', root);
const hash = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const product = { id: 'research-product', handle: 'research-item', title: 'Research sample item', price: 1299, currency: 'INR', url: '/products/research-item', description: 'Synthetic shared product for structural comparison. No commercial promises.', images: ['http://127.0.0.1:8766/visuals/research-product.svg'], featured_image: 'http://127.0.0.1:8766/visuals/research-product.svg', available: true, stock: 12, options: [], variants: [], reviews: [], review_count: 0, rating: 0 };
const products = Array.from({ length: 6 }, (_, i) => ({ ...product, id: `research-${i}`, title: `Research item ${i + 1}`, url: `/products/research-${i}` }));

await mkdir(out, { recursive: true });
type ApplyDiff = ReturnType<typeof applyExperienceToDocument>["diff"];
type PageResult = { key: string; status: string; mainHash: string; templateHash: string; sectionTypes: string[]; warnings: string[]; bytes: number; mainBytes: number };
const results: Array<{preset:string;templateSetHash:string;sourceFilesHash:string;pages:PageResult[];fullApplyDiff:ApplyDiff;additiveApplyDiff:ApplyDiff} & Record<string,unknown>> = [];
for (const listing of firstPartyThemeListings()) {
  const bundle = createFirstPartyCatalogBundle(listing.slug);
  const doc = toThemeDocumentV2(bundle);
  const full = applyExperienceToDocument(doc, listing.presetId, { mode: 'COMPLETE_DESIGN', preserveContent: true });
  const additive = applyExperienceToDocument(doc, listing.presetId, { mode: 'COMPOSE_ADDITIVE', preserveContent: true });
  const pageResults: PageResult[] = [];
  for (const key of ['index', 'collection', 'product']) {
    const renderer = new LiquidRenderer();
    const rendered = await renderer.render({
      context: { storeId: 'research-fixture', subdomain: 'research-fixture', path: key === 'index' ? '/' : `/${key}`, previewMode: true, locale: 'en' },
      storeTemplate: { storeId: 'research-fixture', themeId: listing.slug, themeSettings: { ...DEFAULT_THEME_SETTINGS, ...listing.settings }, sections: [] },
      routeTemplate: { id: key, type: key, layoutKey: 'theme', sections: [] },
      liquidTemplateKey: key, liquidBundle: bundle,
      liquidContext: { product, products, collection: { title: 'Research collection', description: 'Synthetic comparable collection', products, url: '/collections/research' }, shop: { name: 'Research store', currency: 'INR' }, cart: { items: [], item_count: 0, total_price: 0 } },
    });
    const html = rendered.liquid?.layoutHtml ?? '';
    const main = rendered.liquid?.contentForLayout ?? '';
    await writeFile(new URL(`${listing.presetId}-${key}.html`, out), html.replace('<head>', '<head><meta charset="utf-8">').replace(/<body([^>]*)>/i, '<body$1><aside style="padding:8px;background:#fff3cd;color:#342b16;font:14px system-ui">SOURCE-DERIVED RESEARCH FIXTURE — shared synthetic data; no live store, cart, or checkout verification.</aside>'));
    pageResults.push({ key, status: rendered.status, mainHash: hash(main), templateHash: hash(bundle.templates[key]), sectionTypes: Object.values(bundle.templates[key]?.sections ?? {}).map(s => s.type), warnings: rendered.warnings, bytes: html.length, mainBytes: main.length });
  }
  results.push({ preset: listing.presetId, slug: listing.slug, name: listing.name, industry: listing.category, settings: listing.settings, templateSetHash: hash(bundle.templates), sectionDefinitionsHash: hash(doc.section_definitions), sourceFilesHash: hash({layout:bundle.layout,sections:bundle.sections,blocks:bundle.blocks,locales:bundle.locales,renderer:bundle.renderer}), declaredComposition: EXPERIENCE_COMPOSITIONS[listing.presetId], missingCompositionTypes: collectExperienceCompositionBundleIssues(doc.section_definitions), fullApplyDiff: full.diff, additiveApplyDiff: additive.diff, pages: pageResults });
}
await writeFile(new URL('evidence/current-presets-audit.json', root), JSON.stringify({ experiment: 'Public pure functions at the current checkout; no persisted catalog, merchant draft or live release inspected.', sourceRoot: fileURLToPath(new URL('../../../../../', import.meta.url)), results }, null, 2));
const rows = results;
console.log(JSON.stringify({ count: rows.length, templateSetVariants: new Set(rows.map(r => r.templateSetHash)).size, sourceFileVariants: new Set(rows.map(r => r.sourceFilesHash)).size, pages: ['index','collection','product'].map(key => ({ key, templateVariants: new Set(rows.map(r => r.pages.find(p => p.key === key)!.templateHash)).size, mainHtmlVariants: new Set(rows.map(r => r.pages.find(p => p.key === key)!.mainHash)).size, statuses: rows.map(r => r.pages.find(p => p.key === key)!.status) })), addedByCompose: rows.map(r => ({ preset:r.preset, full:r.fullApplyDiff.summary, additive:r.additiveApplyDiff.summary })) }, null, 2));
