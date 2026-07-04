import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createUrbanKicksLiquidThemeBundleFixture,
    LiquidRenderer,
    DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = 'benchmark-store-id-0000-0000-0000';
const N = 25;
const BUDGET_MS = 30_000; // generous; single-render expectation is <100ms steady-state

test('Urban Kicks fixture renders N=25 times within 30s budget', async () => {
    const bundle = createUrbanKicksLiquidThemeBundleFixture();
    const renderer = new LiquidRenderer();
    const input = {
        context: { storeId: STORE_ID, subdomain: 'bench', path: '/', previewMode: false, locale: 'en' },
        storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        routeTemplate: { id: 'index', type: 'index' as const, layoutKey: 'theme', sections: [] },
        liquidBundle: bundle,
        liquidTemplateKey: 'index',
    };

    const times: number[] = [];
    const totalStart = Date.now();

    for (let i = 0; i < N; i++) {
        const start = Date.now();
        const result = await renderer.render(input);
        const elapsed = Date.now() - start;
        times.push(elapsed);
        // Each individual render must succeed
        assert.equal(result.status, 'rendered', `render ${i} failed: ${result.warnings.join(', ')}`);
    }

    const totalMs = Date.now() - totalStart;
    const avgMs = Math.round(totalMs / N);
    const maxMs = Math.max(...times);
    const minMs = Math.min(...times);

    // Log per-render breakdown for before/after comparison
    console.log(`[benchmark] Urban Kicks N=${N}: total=${totalMs}ms avg=${avgMs}ms min=${minMs}ms max=${maxMs}ms`);
    console.log(`[benchmark] per-render ms: [${times.join(', ')}]`);

    assert.ok(totalMs < BUDGET_MS, `Total ${totalMs}ms exceeded ${BUDGET_MS}ms budget`);
});
