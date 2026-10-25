import assert from 'node:assert/strict';
import test from 'node:test';
import { LiquidRenderer, createMinimalLiquidThemeBundleFixture, DEFAULT_THEME_SETTINGS } from '../src/index.ts';

async function renderFont(body: string, display = body) {
    const bundle = createMinimalLiquidThemeBundleFixture();
    bundle.config.settings_data.current.bodyFontFamily = body;
    bundle.config.settings_data.current.headingFontFamily = display;
    return new LiquidRenderer().render({
        context: { storeId: '33333333-3333-4333-8333-333333333333', subdomain: 'synthetic-font', path: '/', locale: 'en', previewMode: false },
        storeTemplate: { storeId: '33333333-3333-4333-8333-333333333333', themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        liquidBundle: bundle, liquidTemplateKey: 'index',
    });
}
test('actual sanitized head tokens quote Source Sans 3 as one family and retain canonical fallbacks', async () => {
    const rendered = await renderFont('Source Sans 3', 'Playfair Display');
    assert.equal(rendered.status, 'rendered', rendered.warnings.join(', '));
    assert.match(rendered.liquid!.headStyleText!, /--font-body:"Source Sans 3",\s*system-ui/);
    assert.match(rendered.liquid!.headStyleText!, /--font-display:"Playfair Display",\s*Georgia/);
    assert.doesNotMatch(rendered.liquid!.headStyleText!, /--font-body:Source Sans 3;/);
});
test('a valid family list stays a list, including quoted names and generic family semantics', async () => {
    const rendered = await renderFont('"Source Sans 3", serif', 'Inter, system-ui, sans-serif');
    const css = rendered.liquid!.headStyleText!;
    assert.match(css, /--font-body:"Source Sans 3", serif;/);
    assert.match(css, /--font-display:"Inter", system-ui, sans-serif;/);
    assert.doesNotMatch(css, /"Inter, system-ui, sans-serif"/);
});
test('unsafe font inputs fail closed without CSS, tag or fetch injection', async () => {
    for (const font of ['Inter; color:maroon', '</style><script>fontInjection()</script>', 'url(https://unsafe.example.invalid/font)', 'Unclosed "font']) {
        const rendered = await renderFont(font);
        assert.equal(rendered.status, 'rendered', rendered.warnings.join(', '));
        const css = rendered.liquid!.headStyleText!;
        assert.match(css, /--font-body:"Inter", system-ui, sans-serif;/);
        assert.doesNotMatch(css, /maroon|fontInjection|unsafe\.example|<script|Unclosed/);
    }
});
