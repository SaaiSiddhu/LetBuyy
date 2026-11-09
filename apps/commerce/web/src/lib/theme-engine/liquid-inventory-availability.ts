import { loadThemeServerDom } from '@letbuyy/theme-engine/server-dom';

const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const rows = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

/** Apply server-owned read availability to existing purchase controls without
 * changing an installed/versioned Liquid package, fetching data or rendering a
 * second storefront. The input HTML has already passed the Liquid sanitizer.
 */
export async function applyLiquidInventoryAvailability(html: string, context: unknown): Promise<string> {
    const scope = record(context);
    const products = [scope.product, ...rows(record(scope.collection).products), ...rows(record(scope.search).results),
        ...Object.values(record(scope.section_products)).flatMap(rows),
        ...rows(record(scope.customer).wishlist_products), ...rows(record(scope.buyer_wishlist).products)];
    const unknown = new Set(products.flatMap(value => {
        const product = record(value);
        return product.inventory_known === false && typeof product.id === 'string' ? [product.id] : [];
    }));
    if (!unknown.size) return html;

    const { JSDOM } = await loadThemeServerDom();
    const dom = new JSDOM(`<body>${html}</body>`);
    try {
        const { document } = dom.window;
        for (const purchase of document.querySelectorAll('lb-add-to-cart[data-product-id]')) {
            const id = purchase.getAttribute('data-product-id');
            if (!id || !unknown.has(id)) continue;
            purchase.setAttribute('data-inventory-known', 'false');
            purchase.removeAttribute('data-product-requires-options');
            const section = purchase.closest('[data-section-id],section');
            const picker = section?.querySelector('lb-variant-picker');
            if (picker?.getAttribute('data-product-id') === id || section?.classList.contains('lb-product-detail')) {
                section?.setAttribute('data-inventory-known', 'false');
                const status = picker?.querySelector('[data-lb-variant-status]');
                if (status) status.textContent = 'Stock unavailable. Reload and try again.';
            }
            for (const button of purchase.querySelectorAll('[data-lb-add-to-cart],[data-lb-buy-now]')) {
                button.setAttribute('disabled', '');
                button.setAttribute('aria-disabled', 'true');
                if (button.hasAttribute('data-lb-add-to-cart')) button.textContent = 'Stock unavailable';
            }
            const card = purchase.closest('.lb-product-card');
            for (const badge of card?.querySelectorAll('.lb-product-card__badge--sold-out') ?? []) {
                badge.textContent = 'Stock unavailable';
                badge.classList.remove('lb-product-card__badge--sold-out');
            }
            let status = purchase.querySelector('[data-lb-add-to-cart-status]');
            if (!status) {
                status = document.createElement('span');
                status.setAttribute('data-lb-add-to-cart-status', '');
                status.setAttribute('role', 'status');
                purchase.append(status);
            }
            status.setAttribute('aria-live', 'polite');
            status.textContent = 'Stock unavailable. Reload and try again.';
        }
        return document.body.innerHTML;
    } finally {
        (dom.window as unknown as { close(): void }).close();
    }
}
