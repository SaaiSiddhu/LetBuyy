import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { LiquidRenderer, createMinimalLiquidThemeBundleFixture, DEFAULT_THEME_SETTINGS } from '../src/index.ts';

test('actual Liquid JSON filter keeps hostile display text inert and preserves the sanitized variant carrier', async () => {
    const bundle = createMinimalLiquidThemeBundleFixture();
    const source = bundle.sections.spotlight.source;
    bundle.sections.spotlight.source = '<section data-section-id="{{ section.id }}"><lb-variant-picker data-variants="{{ product.variants | json }}"></lb-variant-picker></section>' + source.slice(source.indexOf('{% schema %}'));
    const variants = [{ id: 'owned-variant', care: 'Literal <script>alert("x")</script> & preserve > punctuation', label: 'Quotes " and apostrophe \' · हिन्दी', entity: '&gt; &quot; &#60;', options: { Finish: 'Oak' } }];
    const rendered = await new LiquidRenderer().render({
        context: { storeId: '33333333-3333-4333-8333-333333333333', subdomain: 'synthetic-json', path: '/product/owned', previewMode: false, locale: 'en' },
        storeTemplate: { storeId: '33333333-3333-4333-8333-333333333333', themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        liquidBundle: bundle, liquidTemplateKey: 'index', liquidContext: { product: { variants } },
    });
    assert.equal(rendered.status, 'rendered', rendered.warnings.join(', '));
    const dom = new JSDOM(rendered.liquid!.sections[0].html);
    try {
        const carrier = dom.window.document.querySelector('lb-variant-picker')?.getAttribute('data-variants');
        assert.ok(carrier, 'sanitization must retain the inert JSON carrier for the real picker');
        assert.doesNotMatch(carrier, /[<>&]/);
        assert.deepEqual(JSON.parse(carrier), variants, 'JSON.parse restores the exact merchant text');
        assert.equal(dom.window.document.querySelector('script'), null);
        assert.doesNotMatch(rendered.liquid!.sections[0].html, /onerror=|<script/);
    } finally { dom.window.close(); }
});
