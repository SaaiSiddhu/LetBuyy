import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '../src/first-party-theme-catalog';
import { buildLiquidThemeHeadAssets, sanitizeLiquidHeadStyleText, sanitizeRenderedHtml } from '../src/theme-renderer';

// Independent reference for the previous serialize -> new window -> head path.
// The production sanitizer and its URL/data hooks remain the same in both paths.
async function reparsedHead(raw: string) {
    const html = await sanitizeRenderedHtml(
        `<!doctype html><html><head>${raw}</head><body></body></html>`,
        { wholeDocument: true },
    );
    const dom = new JSDOM(html);
    const head = dom.window.document.head;
    const result = {
        html: head.innerHTML.trim(),
        css: Array.from(head.querySelectorAll('style')).map(node => node.textContent ?? '').join('\n').trim(),
    };
    dom.window.close();
    return result;
}

for (const theme of firstPartyThemeListings()) {
    test(`${theme.slug}: head DOM extraction preserves exact sanitized theme CSS`, async () => {
        const raw = buildLiquidThemeHeadAssets(createFirstPartyCatalogBundle(theme.slug));
        const previous = await reparsedHead(raw);
        assert.ok(previous.css.length > 0);
        assert.equal(await sanitizeLiquidHeadStyleText(raw), previous.css);
        assert.equal(await sanitizeRenderedHtml(raw, { allowHeadMetadata: true }), previous.html);
    });
}

test('head extraction retains sanitizer behavior for malformed and hostile metadata', async () => {
    for (const raw of [
        '', '   ', '<style>.a{color:red}</style><style>.b{color:blue}</style>',
        '<style>.a{color:red}</style><script>alert(1)</script><style>.b{color:blue}</style>',
        '<style>.a{color:red}</style></head><body><img src=x onerror="alert(1)">',
        '<meta name="description" content="&quot;&lt;script&gt;">',
        '<style>.a{content:"</style><script>alert(1)</script>"}</style>',
        '<style>.a{color:red}</style><base href="https://example.invalid/">',
        '<svg onload="alert(1)"><foreignObject><style>.bad{color:red}</style></foreignObject></svg>',
        '<noscript><style>.a{color:red}</style></noscript><style>.b{color:blue}</style>',
    ]) {
        const previous = await reparsedHead(raw);
        assert.equal(await sanitizeLiquidHeadStyleText(raw), previous.css);
        const metadata = await sanitizeRenderedHtml(raw, { allowHeadMetadata: true });
        assert.equal(metadata, previous.html);
        const dom = new JSDOM(`<!doctype html><head>${metadata}</head>`);
        assert.equal(dom.window.document.querySelectorAll('script,base,[onerror],[onload]').length, 0);
        dom.window.close();
    }
});

test('interleaved heads keep each theme independent and do not change body sanitization', async () => {
    const themes = firstPartyThemeListings().map(theme => buildLiquidThemeHeadAssets(createFirstPartyCatalogBundle(theme.slug)));
    const expected = await Promise.all(themes.map(reparsedHead));
    for (let round = 0; round < 3; round++) {
        assert.deepEqual(await Promise.all(themes.map(raw => sanitizeLiquidHeadStyleText(raw))), expected.map(head => head.css));
        const body = await sanitizeRenderedHtml('<script>alert(1)</script><lb-add-to-cart data-product-id="owned"><button>Add to cart</button></lb-add-to-cart>');
        assert.doesNotMatch(body, /<script/);
        assert.match(body, /<lb-add-to-cart/);
        assert.doesNotMatch(body, /<html|<head|<body/);
    }
});
