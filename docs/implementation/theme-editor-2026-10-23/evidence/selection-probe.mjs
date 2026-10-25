// Reproducible DOM evidence against the actual inspector, not a substitute renderer.
// node --import tsx docs/implementation/theme-editor-2026-10-23/evidence/selection-probe.mjs
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Use the engine's declared jsdom dependency; do not install or mutate manifests.
const { JSDOM } = createRequire(new URL('../../../../packages/theme-engine/package.json', import.meta.url))('jsdom');
const { bindLiquidPreviewInspector } = createRequire(import.meta.url)('../../../../apps/commerce/web/src/lib/theme-engine/liquid-preview-inspector.ts');

const dom = new JSDOM('<div data-theme-renderer="liquid" data-editor-mode="true"><section data-section-id="owned-section"><a href="/products" data-block-id="first">Same label</a><a href="/products" data-block-id="second">Same label</a></section></div>');
const messages = [];
Object.defineProperty(dom.window, 'postMessage', { value: (data, origin) => messages.push({ data, origin }) });
const dispose = bindLiquidPreviewInspector(dom.window.document, 'https://admin.example.test', { 'owned-section': 'Synthetic section' });
const second = dom.window.document.querySelector('[data-block-id="second"]');
const click = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
second.dispatchEvent(click);
assert.equal(click.defaultPrevented, true, 'Positive control: inspector intercepts storefront activation.');
assert.equal(messages.length, 1, 'Positive control: registered section sends one intent.');
assert.equal(messages[0].data.sectionId, 'owned-section');
const result = {
    capturedAt: new Date().toISOString(), classification: 'DOM_REPRODUCED_NOT_BROWSER_OR_SERVICE_ACCEPTANCE',
    task: 'Click the second of two identical-label editable blocks in the same registered section.',
    expected: { sectionId: 'owned-section', blockId: 'second' },
    actual: messages[0],
    exactBlockIdentityPreserved: messages[0].data.blockId === 'second',
    storefrontActivationPrevented: click.defaultPrevented,
    caveat: 'Synthetic DOM supplies editable metadata. Current generated inline block output still needs its own metadata/render trace. No installed theme was changed.',
};
dispose(); dom.window.close();
writeFileSync(new URL('./selection-probe.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
