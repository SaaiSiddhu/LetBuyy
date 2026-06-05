import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { DEFAULT_THEME_SETTINGS } from '../../packages/theme-engine/src/index';
import { LiquidRenderer } from '../../packages/theme-engine/src/theme-renderer';
import {
    createMinimalLiquidThemeBundleFixture,
    type LiquidThemePackageBundle,
} from '../../packages/theme-engine/src/theme-bundle';

const testDir = dirname(fileURLToPath(import.meta.url));
const rendererSource = readFileSync(join(testDir, '../../packages/theme-engine/src/theme-renderer.ts'), 'utf8');
const compositionSource = readFileSync(join(testDir, '../../apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx'), 'utf8');

function commerceBundle(): LiquidThemePackageBundle {
    const bundle = createMinimalLiquidThemeBundleFixture();

    return {
        ...bundle,
        sections: {
            ...bundle.sections,
            spotlight: {
                ...bundle.sections.spotlight,
                source: [
                    '<section data-commerce-drop-proof="true">',
                    '  <h1>{{ product.title }}</h1>',
                    '  <p data-price>{{ product.price | money_with_currency: product.currency }}</p>',
                    '  <p data-collection-count>{{ collection.products.size }}</p>',
                    '  <p data-cart-count>{{ cart.item_count }}</p>',
                    '  <p data-customer-email>{{ customer.email }}</p>',
                    '  <p data-shop-name>{{ shop.name }}</p>',
                    '</section>',
                    '{% schema %}',
                    '{ "name": "Spotlight", "settings": [], "blocks": [] }',
                    '{% endschema %}',
                ].join('\n'),
            },
        },
    };
}

test('Liquid renderer exposes bounded commerce drops and sanitized header/footer app embeds', async () => {
    const renderer = new LiquidRenderer();
    const result = await renderer.render({
        context: {
            storeId: 'store_123',
            subdomain: 'local-kicks',
            path: '/products/canvas-runner',
            previewMode: false,
            locale: 'en',
        },
        storeTemplate: {
            storeId: 'store_123',
            themeId: 'liquid-starter',
            themeSettings: DEFAULT_THEME_SETTINGS,
            sections: [],
        },
        routeTemplate: {
            id: 'index',
            type: 'product',
            layoutKey: 'theme',
            sections: [],
        },
        liquidBundle: commerceBundle(),
        liquidTemplateKey: 'index',
        liquidAppEmbeds: {
            header: [{ html: '<meta name="app-embed" content="loyalty"><script>alert(1)</script>' }],
            footer: [{ html: '<div data-loyalty-footer onclick="alert(1)">Rewards</div>' }],
        },
        liquidContext: {
            shop: { name: 'Local Kicks' },
            product: {
                id: 'prod_1',
                handle: 'canvas-runner',
                title: 'Canvas Runner',
                price: 129900,
                currency: 'INR',
                images: ['https://cdn.letbuyy.test/canvas-runner.png'],
            },
            collection: {
                id: 'all-products',
                handle: 'all-products',
                title: 'All Products',
                products: [{ id: 'prod_1', title: 'Canvas Runner' }],
            },
            cart: {
                item_count: 2,
                total_price: 259800,
                currency: 'INR',
                items: [{ product_id: 'prod_1', quantity: 2 }],
            },
            customer: {
                id: 'cust_1',
                email: 'shopper@example.com',
                first_name: 'Asha',
            },
        },
    });

    assert.equal(result.status, 'rendered');
    const layout = result.liquid?.layoutHtml || '';

    assert.match(layout, /name="app-embed"/);
    assert.match(layout, /data-loyalty-footer/);
    assert.doesNotMatch(layout, /<script/i);
    assert.doesNotMatch(layout, /onclick=/i);
    assert.match(layout, /Canvas Runner/);
    assert.match(layout, /INR 1,299\.00/);
    assert.match(layout, /data-collection-count[^>]*>1</);
    assert.match(layout, /data-cart-count[^>]*>2</);
    assert.match(layout, /shopper@example\.com/);
    assert.match(layout, /Local Kicks/);
});

test('Liquid commerce and embed surfaces stay wired through the storefront composition engine', () => {
    assert.match(rendererSource, /interface LiquidCommerceDrops/);
    assert.match(rendererSource, /liquidAppEmbeds\?: LiquidAppEmbeds/);
    assert.match(rendererSource, /content_for_header: contentForHeader/);
    assert.match(rendererSource, /content_for_footer: contentForFooter/);
    assert.match(rendererSource, /buildLiquidCommerceDrops\(input\.liquidContext\)/);
    assert.match(rendererSource, /engine\.registerFilter\('money_with_currency'/);
    assert.match(compositionSource, /liquidAppEmbeds: buildLiquidAppEmbeds\(store\.templateConfig\.appBlocks\)/);
    assert.match(compositionSource, /liquidContext: buildLiquidCommerceContext\(\{[\s\S]*sectionData/);
});
