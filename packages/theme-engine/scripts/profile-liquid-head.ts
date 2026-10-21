// Run with `pnpm exec tsx packages/theme-engine/scripts/profile-liquid-head.ts`.
// Compare identical fixtures on two source checkouts; this is local CPU evidence,
// not hosted latency or a catalog/load test. The first three samples warm imports.
import { createHash } from 'node:crypto';
import { createFirstPartyCatalogBundle } from '../src/first-party-theme-catalog';
import { DEFAULT_THEME_SETTINGS } from '../src/index';
import { buildLiquidThemeHeadAssets, LiquidRenderer, sanitizeLiquidHeadStyleText } from '../src/theme-renderer';

const bundle = createFirstPartyCatalogBundle('letbuyy-forge');
const renderer = new LiquidRenderer();
const input = {
    context: { storeId: 'owned-render-benchmark', subdomain: 'owned-render', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: 'owned-render-benchmark', themeId: 'letbuyy-forge', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    liquidBundle: bundle,
    liquidTemplateKey: 'index',
};
const head = buildLiquidThemeHeadAssets(bundle);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const samples = [];
for (let index = 0; index < 28; index++) {
    const headStart = performance.now();
    const css = await sanitizeLiquidHeadStyleText(head);
    const headMs = performance.now() - headStart;
    const renderStart = performance.now();
    const result = await renderer.render(input);
    const renderMs = performance.now() - renderStart;
    if (result.status !== 'rendered' || !result.liquid) throw new Error('Liquid render failed');
    samples.push({ index, warmup: index < 3, headMs, renderMs,
        htmlBytes: Buffer.byteLength(result.liquid.layoutHtml), htmlHash: digest(result.liquid.layoutHtml), cssHash: digest(css) });
}
process.stdout.write(JSON.stringify({ node: process.version, theme: bundle.package.slug, catalogProducts: 0, samples }, null, 2) + '\n');
