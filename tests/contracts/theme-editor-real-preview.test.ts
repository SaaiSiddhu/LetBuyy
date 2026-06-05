import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const editorPageSource = readFileSync(
    join(testDir, '../../apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx'),
    'utf8',
);
const centerPanelSource = readFileSync(
    join(testDir, '../../apps/merchant-control-plane/src/components/theme-editor/CenterPanel.tsx'),
    'utf8',
);
const storefrontPreviewSource = readFileSync(
    join(testDir, '../../apps/storefront-runtime/src/app/preview/page.tsx'),
    'utf8',
);

test('web theme editor uses the real storefront iframe preview path', () => {
    assert.match(editorPageSource, /import CenterPanel from '@\/components\/theme-editor\/CenterPanel'/);
    assert.match(editorPageSource, /<CenterPanel/);
    assert.match(editorPageSource, /previewToken=\{previewToken\}/);
    assert.match(editorPageSource, /previewError=\{previewError\}/);
    assert.match(editorPageSource, /isPreviewRefreshing=\{isPreviewRefreshing\}/);
    assert.doesNotMatch(editorPageSource, /const PREVIEW_PRODUCTS/);
    assert.doesNotMatch(editorPageSource, /function PreviewCanvas/);
    assert.doesNotMatch(editorPageSource, /ProductPreviewCard/);
});

test('web theme editor persists draft changes before minting preview tokens', () => {
    assert.match(editorPageSource, /syncPreviewDraft/);
    assert.match(editorPageSource, /\/api\/themes\/\$\{themeId\}\/editor\/draft/);
    assert.match(editorPageSource, /\/api\/themes\/\$\{themeId\}\/preview-session/);
    assert.match(editorPageSource, /setPreviewToken\(nextPreviewToken\)/);
    assert.match(editorPageSource, /setPreviewError\(err instanceof Error/);
    assert.match(editorPageSource, /window\.setTimeout\(\(\) => \{/);
    assert.match(editorPageSource, /isDirty \? 900 : 0/);
});

test('center preview panel targets storefront preview route and bridges section selection', () => {
    assert.match(centerPanelSource, /new URL\('\/preview', storefrontBaseUrl\)/);
    assert.match(centerPanelSource, /url\.searchParams\.set\('subdomain', storeName\)/);
    assert.match(centerPanelSource, /theme_preview_token/);
    assert.match(centerPanelSource, /letbuyy:theme-editor:section-select/);
    assert.match(centerPanelSource, /onSelectSection\?\.\(message\.sectionId\)/);
    assert.match(centerPanelSource, /LETBUYY_THEME_EDITOR_SELECTION/);
});

test('storefront preview route renders tenant data with the editor bridge', () => {
    assert.match(storefrontPreviewSource, /StorefrontPreviewBridge/);
    assert.match(storefrontPreviewSource, /StoreService\.getPreviewStoreBySubdomain\(subdomain, previewToken\)/);
    assert.match(storefrontPreviewSource, /StorefrontCompositionEngine/);
    assert.match(storefrontPreviewSource, /data-letbuyy-preview-route="true"/);
});
