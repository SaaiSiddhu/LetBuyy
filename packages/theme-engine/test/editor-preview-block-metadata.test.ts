import assert from 'node:assert/strict';
import test from 'node:test';
import { LiquidRenderer, createMinimalLiquidThemeBundleFixture, DEFAULT_THEME_SETTINGS } from '../src/index.ts';

async function render(previewMode: boolean, inline: boolean) {
    const bundle = createMinimalLiquidThemeBundleFixture();
    const section = bundle.templates.index.sections.spotlight;
    section.blocks = { first: { type: 'badge', settings: { label: 'Same label' }, blocks: {}, block_order: [], disabled: false }, second: { type: 'badge', settings: { label: 'Same label' }, blocks: {}, block_order: [], disabled: false } };
    section.block_order = ['first', 'second'];
    if (inline) {
        delete bundle.blocks.badge;
        const schema = bundle.sections.spotlight.source.slice(bundle.sections.spotlight.source.indexOf('{% schema %}'));
        bundle.sections.spotlight.source = '<section data-section-id="{{ section.id }}">{% for block in section.blocks %}<span {{ block.editor_attributes | raw }}>{{ block.settings.label }}</span>{% endfor %}</section>' + schema;
    } else {
        bundle.blocks.badge.source = '<span {{ block.editor_attributes | raw }}>{{ block.settings.label }}</span>';
    }
    return new LiquidRenderer().render({
        context: { storeId: '33333333-3333-4333-8333-333333333333', subdomain: 'synthetic-editor', path: '/', previewMode, locale: 'en' },
        storeTemplate: { storeId: '33333333-3333-4333-8333-333333333333', themeId: bundle.package.slug, themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
        liquidTemplateKey: 'index', liquidBundle: bundle,
    });
}
for (const inline of [true, false]) test(`preview block identity reaches the actual ${inline ? 'inline' : 'standalone'} Liquid drop and sanitizer`, async () => {
    const preview = await render(true, inline);
    assert.equal(preview.status, 'rendered', preview.warnings.join(', '));
    const html = preview.liquid!.sections[0].html;
    assert.match(html, /data-block-id="first"/); assert.match(html, /data-block-id="second"/);
    assert.equal((html.match(/Same label/g) || []).length, 2);
    const published = await render(false, inline);
    assert.equal(published.status, 'rendered', published.warnings.join(', '));
    assert.doesNotMatch(published.liquid!.sections[0].html, /data-block-id/);
    assert.equal((published.liquid!.sections[0].html.match(/Same label/g) || []).length, 2);
});
