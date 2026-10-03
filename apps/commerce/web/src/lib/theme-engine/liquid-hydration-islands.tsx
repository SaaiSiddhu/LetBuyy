'use client';

import { useEffect } from 'react';
import {
    readStorefrontApiJson,
    storefrontBrowserApiFetch,
} from '@/lib/api/browser-client';

const CART_STORAGE_KEY = 'lb_cart';
const CART_TOKEN_STORAGE_KEY = 'lb_cart_token';
const CART_SERVER_STORAGE_KEY = 'lb_cart_server';
const CART_OPEN_EVENT = 'letbuyy:cart:open';
const CART_CHANGED_EVENT = 'letbuyy:cart:changed';
const VARIANT_CHANGED_EVENT = 'letbuyy:variant:changed';
const liquidButtonTag = 'button';
const liquidInputTag = 'input';

interface LiquidCartItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    images: string[];
    currency: string;
    slug?: string;
    selectedVariant?: Record<string, string>;
}

type LiquidServerCartLine = {
    product_id: string;
    title: string;
    image_url?: string | null;
    quantity: number;
    unit_price: number;
    currency: string;
    properties?: Record<string, unknown>;
};

type LiquidServerCart = {
    cart_token: string;
    lines: LiquidServerCartLine[];
    currency: string;
    subtotal: number;
    discount_total: number;
    shipping_total: number;
    tax_total: number;
    total: number;
    coupon_codes: string[];
};

interface LiquidHydrationIslandsProps {
    basePath: string;
    storeId: string;
}

function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function readCart(): LiquidCartItem[] {
    try {
        const raw = window.localStorage.getItem(CART_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function getLiquidStorefrontSubdomain(): string | null {
    const match = window.location.pathname.match(/^\/store\/([^/?#]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);

    const querySubdomain = new URLSearchParams(window.location.search).get('subdomain');
    if (querySubdomain) return querySubdomain;

    const hostname = window.location.hostname.split('.')[0];
    return hostname && !['localhost', '127', '0', 'www'].includes(hostname) ? hostname : null;
}

function liquidCartLineInputFromItem(item: LiquidCartItem) {
    return {
        product_id: item.id,
        variant_id: null,
        quantity: item.quantity,
        properties: item.selectedVariant || {},
    };
}

function liquidCartItemsFromServer(cart: LiquidServerCart): LiquidCartItem[] {
    return cart.lines.map((line) => ({
        id: line.product_id,
        name: line.title,
        price: line.unit_price,
        quantity: line.quantity,
        images: line.image_url ? [line.image_url] : [],
        currency: line.currency || 'INR',
        selectedVariant: line.properties && typeof line.properties === 'object' && !Array.isArray(line.properties)
            ? Object.fromEntries(Object.entries(line.properties).filter(([, value]) => typeof value === 'string')) as Record<string, string>
            : undefined,
    }));
}

async function storefrontBrowserCartFetch(subdomain: string, cartToken: string | null, items: LiquidCartItem[]) {
    return storefrontBrowserApiFetch(subdomain, cartToken ? `/cart/${cartToken}` : '/cart', {
        method: cartToken ? 'PATCH' : 'POST',
        body: JSON.stringify({
            lines: items.map(liquidCartLineInputFromItem),
        }),
    });
}

async function syncLiquidCartToServer(items: LiquidCartItem[]) {
    const subdomain = getLiquidStorefrontSubdomain();
    if (!subdomain) return;

    const cartToken = window.localStorage.getItem(CART_TOKEN_STORAGE_KEY);
    try {
        const response = await storefrontBrowserCartFetch(subdomain, cartToken, items);
        const payload = await readStorefrontApiJson<LiquidServerCart>(response);
        if (!response.ok || !payload.success || !payload.data) return;

        window.localStorage.setItem(CART_TOKEN_STORAGE_KEY, payload.data.cart_token);
        writeServerCart(payload.data);
        writeCart(liquidCartItemsFromServer(payload.data), { sync: false });
    } catch {
        // Browser cart remains available from local storage while sync retries on the next mutation.
    }
}

function writeCart(items: LiquidCartItem[], options: { sync?: boolean } = {}) {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT, { detail: { items } }));
    if (options.sync) void syncLiquidCartToServer(items);
}

function addCartItem(item: LiquidCartItem) {
    const items = readCart();
    const existingIndex = items.findIndex((candidate) => candidate.id === item.id);

    if (existingIndex >= 0) {
        items[existingIndex] = {
            ...items[existingIndex],
            quantity: items[existingIndex].quantity + item.quantity,
            selectedVariant: {
                ...items[existingIndex].selectedVariant,
                ...item.selectedVariant,
            },
        };
    } else {
        items.push(item);
    }

    writeCart(items, { sync: true });
    window.dispatchEvent(new CustomEvent(CART_OPEN_EVENT, { detail: { source: 'liquid-add-to-cart' } }));
}

function inferBasePath(): string {
    const match = window.location.pathname.match(/^\/store\/[^/]+/);
    return match?.[0] || '/store';
}

function numericDatasetValue(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function quantityFromElement(element: HTMLElement): number {
    const quantityInput = element.querySelector<HTMLInputElement | HTMLSelectElement>('[name="quantity"],[data-lb-quantity]');
    const rawValue = quantityInput?.value || quantityInput?.getAttribute('data-lb-quantity') || element.dataset.productQuantity;
    return Math.max(1, Math.floor(numericDatasetValue(rawValue, 1)));
}

function selectedVariantsFrom(root: ParentNode): Record<string, string> {
    const selected: Record<string, string> = {};
    const pressedOptions = root.querySelectorAll<HTMLElement>('[data-lb-variant-option][aria-pressed="true"]');
    pressedOptions.forEach((option) => {
        const name = option.dataset.variantName;
        const value = option.dataset.variantValue;
        if (name && value) selected[name] = value;
    });

    const inputs = root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[name^="variant["]');
    inputs.forEach((input) => {
        const match = input.name.match(/^variant\[(.+)]$/);
        if (match?.[1] && input.value) selected[match[1]] = input.value;
    });

    return selected;
}

function cartItemFromElement(element: HTMLElement): LiquidCartItem | null {
    const sectionRoot = element.closest('[data-section-id],section') || document;
    const selectedVariant = {
        ...selectedVariantsFrom(sectionRoot),
        ...selectedVariantsFrom(element),
    };
    const id = element.dataset.productId || element.querySelector<HTMLInputElement>('[name="product_id"],[name="id"]')?.value;
    if (!id) return null;

    const image = element.dataset.productImage || '';
    return {
        id,
        name: element.dataset.productName || 'Product',
        price: numericDatasetValue(element.dataset.productPrice, 0),
        quantity: quantityFromElement(element),
        images: image ? [image] : [],
        currency: element.dataset.productCurrency || 'INR',
        slug: element.dataset.productUrl,
        selectedVariant: Object.keys(selectedVariant).length > 0 ? selectedVariant : undefined,
    };
}

/**
 * `HTMLElement` exists only in the browser. This is a `'use client'` module, but Next.js still
 * evaluates it during the server SSR pass for client components (the `(ssr)` bundle), where
 * `HTMLElement` is undefined — so declaring `class … extends HTMLElement` at module scope threw
 * `ReferenceError: HTMLElement is not defined` and 500'd any route that SSR-mounts these islands
 * (e.g. the theme-editor `/preview` page). Extending this guarded base makes module evaluation
 * safe on the server; in the browser it resolves to the real `HTMLElement`, so the custom elements
 * still register and behave identically. They are only ever defined via `defineLiquidIsland`, which
 * runs exclusively in the browser.
 */
const LiquidIslandBase: typeof HTMLElement =
    typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as typeof HTMLElement);

class LbAddToCartElement extends LiquidIslandBase {
    private readonly handleClick = (event: Event) => {
        const target = event.target instanceof Element ? event.target : null;
        // T6/W3 — Buy now is NOT a second checkout path: it calls the exact same addCurrentProduct()
        // as a plain Add to cart, then navigates straight to the one existing checkout route
        // (the same URL the cart drawer's own Checkout link and the cart page already use) instead
        // of leaving the drawer open. data-lb-buy-now is checked first since a buy-now button may
        // also carry data-lb-add-to-cart for progressive-enhancement/no-JS reasons.
        const buyNowTrigger = target?.closest('[data-lb-buy-now]');
        if (buyNowTrigger) {
            event.preventDefault();
            this.addCurrentProduct({ redirectToCheckout: true });
            return;
        }

        const trigger = target?.closest('[data-lb-add-to-cart],button[type="submit"]');
        if (!trigger && target !== this) return;

        event.preventDefault();
        this.addCurrentProduct();
    };

    private readonly handleSubmit = (event: Event) => {
        event.preventDefault();
        this.addCurrentProduct();
    };

    connectedCallback() {
        this.addEventListener('click', this.handleClick);
        this.addEventListener('submit', this.handleSubmit);
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.handleClick);
        this.removeEventListener('submit', this.handleSubmit);
    }

    private addCurrentProduct(options: { redirectToCheckout?: boolean } = {}) {
        const item = cartItemFromElement(this);
        const status = this.querySelector<HTMLElement>('[data-lb-add-to-cart-status]');
        if (!item) {
            if (status) status.textContent = 'Product unavailable';
            return;
        }

        addCartItem(item);
        if (options.redirectToCheckout) {
            window.location.assign(`${this.dataset.basePath || inferBasePath()}/checkout`);
            return;
        }
        if (status) status.textContent = 'Added';
        this.setAttribute('data-lb-added', 'true');
        window.setTimeout(() => {
            if (status) status.textContent = '';
            this.removeAttribute('data-lb-added');
        }, 1800);
    }
}

// The gateway cart response (StorefrontServerCart) is the single source of truth for money totals.
// We cache it verbatim and render its fields directly — the browser never sums prices or derives any
// total. formatCartMoney only FORMATS a value the gateway already computed.
function readServerCart(): LiquidServerCart | null {
    try {
        const raw = window.localStorage.getItem(CART_SERVER_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as LiquidServerCart) : null;
    } catch {
        return null;
    }
}

function writeServerCart(cart: LiquidServerCart) {
    try {
        window.localStorage.setItem(CART_SERVER_STORAGE_KEY, JSON.stringify(cart));
    } catch {
        // Ignore storage quota errors; the gateway response stays the source of truth on next sync.
    }
}

function formatCartMoney(value: number, currency: string): string {
    try {
        return value.toLocaleString('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 });
    } catch {
        return String(value);
    }
}

function renderLiquidCartTotals(serverCart: LiquidServerCart | null): string {
    // Source of truth = the gateway cart response. Until it has synced we show a pending state rather
    // than computing anything in the browser. Every figure below is a verbatim backend value.
    if (!serverCart) {
        return '<p class="lb-liquid-cart__pending">Updating totals…</p>';
    }

    const currency = serverCart.currency || 'INR';
    const rows: string[] = [
        `<div class="lb-liquid-cart__row"><span>Subtotal</span><span>${escapeHtml(formatCartMoney(serverCart.subtotal, currency))}</span></div>`,
    ];
    if (serverCart.discount_total > 0) {
        rows.push(`<div class="lb-liquid-cart__row"><span>Discounts</span><span>-${escapeHtml(formatCartMoney(serverCart.discount_total, currency))}</span></div>`);
    }
    if (serverCart.coupon_codes.length > 0) {
        rows.push(`<div class="lb-liquid-cart__row"><span>Coupons</span><span>${escapeHtml(serverCart.coupon_codes.join(', '))}</span></div>`);
    }
    if (serverCart.shipping_total > 0) {
        rows.push(`<div class="lb-liquid-cart__row"><span>Shipping</span><span>${escapeHtml(formatCartMoney(serverCart.shipping_total, currency))}</span></div>`);
    }
    if (serverCart.tax_total > 0) {
        rows.push(`<div class="lb-liquid-cart__row"><span>Tax (GST)</span><span>${escapeHtml(formatCartMoney(serverCart.tax_total, currency))}</span></div>`);
    }
    rows.push(`<div class="lb-liquid-cart__row lb-liquid-cart__row--total"><span>Total</span><span>${escapeHtml(formatCartMoney(serverCart.total, currency))}</span></div>`);
    return `<div class="lb-liquid-cart__totals">${rows.join('')}</div>`;
}

class LbCartDrawerElement extends LiquidIslandBase {
    private open = false;

    private readonly handleOpen = () => {
        this.setOpen(true);
    };

    private readonly handleCartChanged = () => {
        this.render();
    };

    private readonly handleClick = (event: Event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        if (target.closest('[data-lb-cart-close]')) {
            this.setOpen(false);
            return;
        }

        if (target.closest('[data-lb-cart-toggle]')) {
            this.setOpen(!this.open);
            return;
        }

        const removeButton = target.closest<HTMLElement>('[data-lb-cart-remove]');
        if (removeButton?.dataset.productId) {
            writeCart(readCart().filter((item) => item.id !== removeButton.dataset.productId), { sync: true });
        }
    };

    connectedCallback() {
        this.addEventListener('click', this.handleClick);
        window.addEventListener(CART_OPEN_EVENT, this.handleOpen);
        window.addEventListener(CART_CHANGED_EVENT, this.handleCartChanged);
        window.addEventListener('storage', this.handleCartChanged);
        this.render();
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.handleClick);
        window.removeEventListener(CART_OPEN_EVENT, this.handleOpen);
        window.removeEventListener(CART_CHANGED_EVENT, this.handleCartChanged);
        window.removeEventListener('storage', this.handleCartChanged);
    }

    private setOpen(value: boolean) {
        this.open = value;
        if (value) {
            const items = readCart();
            if (items.length > 0) void syncLiquidCartToServer(items);
        }
        this.render();
    }

    private render() {
        const items = readCart();
        const serverCart = readServerCart();
        const basePath = this.dataset.basePath || inferBasePath();
        const rows = items.length === 0
            ? '<p class="lb-liquid-cart__empty">Your bag is empty.</p>'
            : items.map((item) => [
                '<div class="lb-liquid-cart__item">',
                `<span>${escapeHtml(item.name)}</span>`,
                `<span>x${item.quantity}</span>`,
                `<${liquidButtonTag} type="button" data-lb-cart-remove data-product-id="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)}">Remove</${liquidButtonTag}>`,
                '</div>',
            ].join('')).join('');

        this.innerHTML = [
            '<style>',
            // T5/W4 — this element used to render its OWN visible "Cart (N)" toggle button; since
            // `ensureLiquidCartDrawer` appends it as the last child of its root (after the footer, on
            // any page with an add-to-cart control) and the toggle set no `position`, that button
            // rendered as a plain in-flow white button below the footer. The header's [data-lb-cart-
            // trigger] (registerLiquidHydrationIslands' delegated listener) is now the SOLE open
            // control, so this element renders the PANEL only — nothing else, at no width.
            '.lb-liquid-cart__panel{position:fixed;inset:0 0 0 auto;z-index:100;width:min(420px,100vw);padding:20px;background:var(--card-bg,rgb(255 255 255));color:var(--card-text,rgb(17 24 39));box-shadow:0 20px 60px rgba(15,23,42,.28);overflow:auto}',
            '.lb-liquid-cart__item{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border-color,rgb(229 231 235))}',
            '.lb-liquid-cart__footer{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-top:20px}',
            '.lb-liquid-cart__checkout{min-height:44px;display:inline-flex;align-items:center;padding:0 16px;border-radius:8px;background:var(--primary,rgb(0 179 179));color:rgb(255 255 255);text-decoration:none;font-weight:700}',
            '.lb-liquid-cart__totals{margin-top:16px;display:grid;gap:6px}',
            '.lb-liquid-cart__row{display:flex;justify-content:space-between;gap:12px;font-size:.95rem}',
            '.lb-liquid-cart__row--total{margin-top:6px;padding-top:10px;border-top:1px solid var(--border-color,rgb(229 231 235));font-weight:700;font-size:1.05rem}',
            '.lb-liquid-cart__pending{margin-top:16px;color:var(--text-secondary,rgb(107 114 128))}',
            '.lb-liquid-cart__close{min-height:44px;min-width:44px;}',
            '.lb-liquid-cart__view-cart{min-height:44px;display:inline-flex;align-items:center;font-weight:700;}',
            '</style>',
            `<aside class="lb-liquid-cart__panel" role="dialog" aria-modal="true" aria-label="Shopping cart" ${this.open ? '' : 'hidden'}>`,
            `<${liquidButtonTag} type="button" data-lb-cart-close class="lb-liquid-cart__close" aria-label="Close cart">Close</${liquidButtonTag}>`,
            '<h2>Cart</h2>',
            rows,
            items.length > 0 ? renderLiquidCartTotals(serverCart) : '',
            '<div class="lb-liquid-cart__footer">',
            `<a class="lb-liquid-cart__view-cart" href="${escapeHtml(basePath)}/cart">View cart</a>`,
            `<a class="lb-liquid-cart__checkout" href="${escapeHtml(basePath)}/checkout">Checkout</a>`,
            '</div>',
            '</aside>',
        ].join('');
    }
}

class LbSearchElement extends LiquidIslandBase {
    private readonly handleSubmit = (event: Event) => {
        event.preventDefault();
        const input = this.querySelector<HTMLInputElement>('input[type="search"],input[name="search"],input[name="q"]');
        const query = input?.value.trim() || '';
        const searchUrl = this.dataset.searchUrl || `${inferBasePath()}/shop`;
        const destination = new URL(searchUrl, window.location.origin);
        if (query) destination.searchParams.set('search', query);
        window.location.assign(destination.toString());
    };

    connectedCallback() {
        if (this.innerHTML.trim().length === 0) {
            this.innerHTML = [
                '<form data-lb-search-form>',
                `<${liquidInputTag} type="search" name="search" placeholder="Search products" aria-label="Search products" />`,
                `<${liquidButtonTag} type="submit">Search</${liquidButtonTag}>`,
                '</form>',
            ].join('');
        }

        this.addEventListener('submit', this.handleSubmit);
    }

    disconnectedCallback() {
        this.removeEventListener('submit', this.handleSubmit);
    }
}

type PredictiveSearchSuggestion = {
    id: string;
    title: string;
    price: number | null;
    currency: string;
    image: string | null;
    url: string;
};

// T5/W3 — the header search overlay's predictive results. Debounced (300ms), cancels the previous
// in-flight request on every new keystroke (AbortController), and keeps the existing full-page GET
// submit working with JS disabled — this class only ever enhances the <form> already in its markup,
// never replaces it. ARIA combobox pattern: the <input> (role="combobox", written in header.liquid)
// gets aria-expanded/aria-activedescendant kept in sync here; results carry role="option" and
// aria-selected; [data-lb-search-results] carries aria-live="polite" (also in the markup) so a
// screen reader announces the result count text this class writes into it.
class LbPredictiveSearchElement extends LiquidIslandBase {
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private abortController: AbortController | null = null;
    private selectedIndex = -1;
    private results: PredictiveSearchSuggestion[] = [];

    private get input(): HTMLInputElement | null {
        return this.querySelector('[data-lb-search-input]');
    }

    private get resultsEl(): HTMLElement | null {
        return this.querySelector('[data-lb-search-results]');
    }

    private readonly handleInput = () => {
        const query = this.input?.value.trim() || '';
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        if (this.abortController) this.abortController.abort();

        if (query.length < 2) {
            this.renderResults([], query, false);
            return;
        }

        this.debounceTimer = setTimeout(() => {
            void this.fetchSuggestions(query);
        }, 300);
    };

    private async fetchSuggestions(query: string) {
        this.renderResults([], query, true);
        this.abortController = new AbortController();
        try {
            const suggestUrl = `/api${inferBasePath()}/search-suggest?q=${encodeURIComponent(query)}`;
            const response = await fetch(suggestUrl, { signal: this.abortController.signal });
            if (!response.ok) {
                this.renderResults([], query, false);
                return;
            }
            const payload = await response.json() as { results?: PredictiveSearchSuggestion[] };
            this.renderResults(Array.isArray(payload.results) ? payload.results : [], query, false);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            this.renderResults([], query, false);
        }
    }

    private renderResults(results: PredictiveSearchSuggestion[], query: string, loading: boolean) {
        const container = this.resultsEl;
        const input = this.input;
        if (!container || !input) return;

        this.results = results;
        this.selectedIndex = -1;
        input.removeAttribute('aria-activedescendant');
        input.setAttribute('aria-expanded', String(loading || results.length > 0));

        if (loading) {
            container.innerHTML = '<p class="lb-predictive-search__loading" role="status">Searching…</p>';
            return;
        }
        if (query.length < 2) {
            container.innerHTML = '';
            return;
        }
        if (results.length === 0) {
            container.innerHTML = `<p class="lb-predictive-search__empty" role="status">No results for "${escapeHtml(query)}"</p>`;
            return;
        }

        const form = this.querySelector<HTMLFormElement>('[data-lb-search-form]');
        const resultsPageUrl = new URL(form?.getAttribute('action') || '/search', window.location.origin);
        resultsPageUrl.searchParams.set('search', query);

        const items = results.map((item, index) => {
            const priceText = item.price != null ? formatCartMoney(item.price, item.currency) : '';
            return [
                `<a href="${escapeHtml(item.url)}" id="lb-search-option-${index}" class="lb-predictive-search__item" role="option" aria-selected="false" data-lb-search-option data-index="${index}">`,
                item.image ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy">` : '',
                `<span>${escapeHtml(item.title)}</span>`,
                priceText ? `<span class="lb-predictive-search__item-price">${escapeHtml(priceText)}</span>` : '',
                '</a>',
            ].join('');
        }).join('');

        container.innerHTML = [
            `<p class="lb-sr-only" role="status">${results.length} result${results.length === 1 ? '' : 's'} found</p>`,
            '<div class="lb-predictive-search__group"><h3>Products</h3>',
            items,
            '</div>',
            `<a class="lb-predictive-search__view-all" href="${escapeHtml(resultsPageUrl.pathname + resultsPageUrl.search)}">Search for "${escapeHtml(query)}"</a>`,
        ].join('');
    }

    private moveSelection(delta: number) {
        if (this.results.length === 0) return;
        const count = this.results.length;
        this.selectedIndex = ((this.selectedIndex + delta) % count + count) % count;

        const options = this.resultsEl?.querySelectorAll<HTMLElement>('[data-lb-search-option]');
        options?.forEach((option, index) => option.setAttribute('aria-selected', String(index === this.selectedIndex)));

        const activeOption = options?.[this.selectedIndex];
        if (activeOption) {
            this.input?.setAttribute('aria-activedescendant', activeOption.id);
            activeOption.scrollIntoView({ block: 'nearest' });
        }
    }

    private readonly handleKeydown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.moveSelection(1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.moveSelection(-1);
        } else if (event.key === 'Enter' && this.selectedIndex >= 0) {
            const option = this.resultsEl?.querySelector<HTMLAnchorElement>(`[data-index="${this.selectedIndex}"]`);
            if (option) {
                event.preventDefault();
                window.location.assign(option.href);
            }
        }
        // Escape is handled by the header-level delegated listener (bindHeaderControls), which
        // closes the whole overlay — this class does not need its own duplicate handler for it.
    };

    connectedCallback() {
        this.input?.addEventListener('input', this.handleInput);
        this.addEventListener('keydown', this.handleKeydown);
    }

    disconnectedCallback() {
        this.input?.removeEventListener('input', this.handleInput);
        this.removeEventListener('keydown', this.handleKeydown);
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        if (this.abortController) this.abortController.abort();
    }
}

type PickerVariant = {
    options?: Record<string, string>;
    stock?: number;
    stock_quantity?: number;
    inventory_qty?: number;
};

// T6/W3 — real variant availability, not merely a picker that always looks selectable.
// `data-variants` carries the same product.variants array the drop already resolves (real
// stock/stock_quantity/inventory_qty per-variant, per commerce-core's ProductVariant shape),
// serialized via the existing `| json` Liquid filter (already auto-HTML-escaped by this engine's
// outputEscape setting — confirmed live, the same mechanism data-product-name already relies on
// for embedding a quoted string inside an attribute). No new data source, no new endpoint.
class LbVariantPickerElement extends LiquidIslandBase {
    private variants: PickerVariant[] = [];

    private readonly handleClick = (event: Event) => {
        const target = event.target instanceof Element ? event.target : null;
        const option = target?.closest<HTMLElement>('[data-lb-variant-option]');
        if (!option) return;

        event.preventDefault();
        this.selectOption(option);
    };

    private readonly handleChange = () => {
        this.applyAvailability();
        window.dispatchEvent(new CustomEvent(VARIANT_CHANGED_EVENT, { detail: selectedVariantsFrom(this) }));
    };

    connectedCallback() {
        try {
            this.variants = JSON.parse(this.dataset.variants || '[]');
        } catch {
            this.variants = [];
        }
        this.addEventListener('click', this.handleClick);
        this.addEventListener('change', this.handleChange);
        this.applyAvailability();
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.handleClick);
        this.removeEventListener('change', this.handleChange);
    }

    private selectOption(option: HTMLElement) {
        const name = option.dataset.variantName;
        const value = option.dataset.variantValue;
        if (!name || !value) return;

        this.querySelectorAll<HTMLElement>(`[data-lb-variant-option][data-variant-name="${CSS.escape(name)}"]`)
            .forEach((candidate) => candidate.setAttribute('aria-pressed', candidate === option ? 'true' : 'false'));

        let hiddenInput = this.querySelector<HTMLInputElement>(`input[name="variant[${CSS.escape(name)}]"]`);
        if (!hiddenInput) {
            hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = `variant[${name}]`;
            this.appendChild(hiddenInput);
        }
        hiddenInput.value = value;
        this.applyAvailability();
        window.dispatchEvent(new CustomEvent(VARIANT_CHANGED_EVENT, { detail: selectedVariantsFrom(this) }));
    }

    // Only judges availability once every option group has a selection — a partial selection
    // (e.g. Size chosen, Colour not yet) cannot honestly be marked available or unavailable.
    private applyAvailability() {
        if (this.variants.length === 0) return;
        const optionGroups = new Set(
            Array.from(this.querySelectorAll<HTMLElement>('[data-lb-variant-option]')).map((el) => el.dataset.variantName),
        );
        const selected = selectedVariantsFrom(this);
        const fullySelected = optionGroups.size > 0 && Array.from(optionGroups).every((name) => name && selected[name]);

        const status = this.querySelector<HTMLElement>('[data-lb-variant-status]');
        if (!fullySelected) {
            if (status) status.textContent = '';
            this.dispatchAvailability(true);
            return;
        }

        const match = this.variants.find((variant) => {
            const options = variant.options || {};
            return Object.entries(selected).every(([name, value]) => options[name] === value);
        });
        const stock = match ? (match.stock ?? match.stock_quantity ?? match.inventory_qty ?? 0) : null;
        const available = match ? stock !== null && stock > 0 : true; // no matching variant record → do not falsely block

        if (status) status.textContent = match && !available ? 'This combination is currently unavailable' : '';
        this.dispatchAvailability(available);
    }

    private dispatchAvailability(available: boolean) {
        const section = this.closest('[data-section-id]') || document;
        section.querySelectorAll<HTMLElement>('[data-lb-add-to-cart],[data-lb-buy-now]').forEach((button) => {
            if (available) button.removeAttribute('disabled');
            else button.setAttribute('disabled', '');
        });
    }
}

// T6/W3 — the PDP image carousel + thumbnails. The Liquid template renders every product image up
// front (progressive enhancement: with JS disabled every image is visible, stacked — never zero
// images), each already marked `hidden` except the first via the `data-lb-gallery-image` markup;
// this class only toggles which one is visible and keeps a thumbnail row in sync. Keyboard: Left/
// Right/Home/End move between thumbnails (roving tabindex, the same one-tab-stop pattern as a
// native tab list), matching the "keyboard-navigable carousel" requirement. Swipe support on touch
// uses plain pointer events (no gesture library dependency) and honours prefers-reduced-motion via
// the existing global CSS rule (the crossfade transition duration collapses to ~0 under it).
class LbProductGalleryElement extends LiquidIslandBase {
    private index = 0;
    private touchStartX: number | null = null;

    private get images(): HTMLElement[] {
        return Array.from(this.querySelectorAll<HTMLElement>('[data-lb-gallery-image]'));
    }

    private get thumbs(): HTMLElement[] {
        return Array.from(this.querySelectorAll<HTMLElement>('[data-lb-gallery-thumb]'));
    }

    private readonly handleClick = (event: Event) => {
        const target = event.target instanceof Element ? event.target : null;
        const thumb = target?.closest<HTMLElement>('[data-lb-gallery-thumb]');
        if (!thumb) return;
        const index = Number(thumb.dataset.index);
        if (Number.isFinite(index)) this.showImage(index, { focusThumb: false });
    };

    private readonly handleKeydown = (event: KeyboardEvent) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target?.closest('[data-lb-gallery-thumb]')) return;
        const count = this.thumbs.length;
        if (count === 0) return;

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            this.showImage((this.index + 1) % count, { focusThumb: true });
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            this.showImage((this.index - 1 + count) % count, { focusThumb: true });
        } else if (event.key === 'Home') {
            event.preventDefault();
            this.showImage(0, { focusThumb: true });
        } else if (event.key === 'End') {
            event.preventDefault();
            this.showImage(count - 1, { focusThumb: true });
        }
    };

    private readonly handleTouchStart = (event: TouchEvent) => {
        this.touchStartX = event.touches[0]?.clientX ?? null;
    };

    private readonly handleTouchEnd = (event: TouchEvent) => {
        if (this.touchStartX === null) return;
        const endX = event.changedTouches[0]?.clientX ?? this.touchStartX;
        const delta = endX - this.touchStartX;
        this.touchStartX = null;
        const count = this.images.length;
        if (count < 2 || Math.abs(delta) < 40) return;
        if (delta < 0) this.showImage((this.index + 1) % count, { focusThumb: false });
        else this.showImage((this.index - 1 + count) % count, { focusThumb: false });
    };

    connectedCallback() {
        this.addEventListener('click', this.handleClick);
        this.addEventListener('keydown', this.handleKeydown);
        this.addEventListener('touchstart', this.handleTouchStart, { passive: true });
        this.addEventListener('touchend', this.handleTouchEnd, { passive: true });
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.handleClick);
        this.removeEventListener('keydown', this.handleKeydown);
        this.removeEventListener('touchstart', this.handleTouchStart);
        this.removeEventListener('touchend', this.handleTouchEnd);
    }

    private showImage(index: number, options: { focusThumb: boolean }) {
        const images = this.images;
        const thumbs = this.thumbs;
        if (index < 0 || index >= images.length) return;

        images.forEach((img, i) => { img.hidden = i !== index; });
        thumbs.forEach((thumb, i) => {
            const active = i === index;
            thumb.setAttribute('aria-selected', String(active));
            thumb.tabIndex = active ? 0 : -1;
        });
        this.index = index;
        if (options.focusThumb) thumbs[index]?.focus();
    }
}

const REVIEW_TURNSTILE_CALLBACK = 'onLbReviewTurnstileLoad';

type ReviewTurnstileApi = {
    render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
    reset: (widgetId: string) => void;
    remove: (widgetId: string) => void;
};

function getReviewTurnstile(): ReviewTurnstileApi | undefined {
    return (window as unknown as { turnstile?: ReviewTurnstileApi }).turnstile;
}

function canUseReviewDevBypass(): boolean {
    return process.env.NODE_ENV === 'development'
        && process.env.NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS === 'true';
}

function reviewApiMessage(payload: unknown, fallback: string): string {
    if (payload && typeof payload === 'object') {
        const error = (payload as { error?: unknown }).error;
        if (typeof error === 'string') return error;
        if (error && typeof error === 'object') {
            const message = (error as { message?: unknown }).message;
            if (typeof message === 'string') return message;
        }
    }
    return fallback;
}

function reviewStarsMarkup(): string {
    const stars: string[] = [];
    for (let value = 1; value <= 5; value += 1) {
        stars.push(
            `<input type="radio" name="rating" value="${value}" id="lb-review-star-${value}" class="lb-review-form__radio">`,
            `<${liquidButtonTag} type="button" class="lb-review-form__star" data-lb-review-star="${value}" aria-pressed="false" aria-label="${value} star${value === 1 ? '' : 's'}">★</${liquidButtonTag}>`,
        );
    }
    return stars.join('');
}

// Review submission island. Reuses the existing /api/reviews POST route (which wraps the canonical
// storefront.submitProductReview gateway call + customer session + Turnstile). No new backend.
// Turnstile is mandatory server-side (verifyTurnstileToken rejects a missing token), so this mirrors
// the React TurnstileWidget: dev-bypass token in local dev, invisible widget when a site key is set.
class LbReviewFormElement extends LiquidIslandBase {
    private turnstileToken: string | null = null;
    private turnstileWidgetId: string | null = null;
    private submitting = false;

    connectedCallback() {
        if (!this.dataset.productId || !this.dataset.storeId) return;
        this.renderForm();
        this.setupTurnstile();
        this.addEventListener('submit', this.handleSubmit);
        this.addEventListener('click', this.handleStarClick);
    }

    disconnectedCallback() {
        this.removeEventListener('submit', this.handleSubmit);
        this.removeEventListener('click', this.handleStarClick);
        const turnstile = getReviewTurnstile();
        if (this.turnstileWidgetId && turnstile) {
            try {
                turnstile.remove(this.turnstileWidgetId);
            } catch {
                // Ignore stale widget handles after navigation.
            }
        }
    }

    private renderForm() {
        this.innerHTML = [
            '<style>',
            '.lb-review-form{display:grid;gap:12px;margin-top:20px;padding:18px;border:1px solid var(--border-color,rgb(229 231 235));border-radius:12px;background:var(--card-bg,rgb(255 255 255));color:var(--card-text,inherit)}',
            '.lb-review-form__title{margin:0;font-size:1.05rem}',
            '.lb-review-form__radio{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}',
            '.lb-review-form__stars{display:inline-flex;gap:2px}',
            '.lb-review-form__star{min-height:44px;min-width:36px;border:0;background:none;font-size:1.6rem;line-height:1;cursor:pointer;color:var(--border-color,rgb(209 213 219))}',
            '.lb-review-form__star[aria-pressed="true"]{color:rgb(245 158 11)}',
            '.lb-review-form__field{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--border-color,rgb(229 231 235));border-radius:8px;background:var(--input-bg,rgb(249 250 251));color:var(--card-text,inherit);font:inherit}',
            'textarea.lb-review-form__field{min-height:84px;resize:vertical}',
            '.lb-review-form__submit{min-height:44px;padding:0 18px;border:0;border-radius:8px;background:var(--primary,rgb(0 179 179));color:rgb(255 255 255);font-weight:700;cursor:pointer;justify-self:start}',
            '.lb-review-form__submit:disabled{opacity:.6;cursor:progress}',
            '.lb-review-form__status[data-kind="error"]{color:rgb(220 38 38)}',
            '.lb-review-form__status[data-kind="success"]{color:rgb(22 163 74)}',
            '</style>',
            '<form class="lb-review-form" novalidate>',
            '  <h3 class="lb-review-form__title">Write a review</h3>',
            '  <div class="lb-review-form__stars" role="radiogroup" aria-label="Your rating">',
            reviewStarsMarkup(),
            '  </div>',
            `  <${liquidInputTag} type="text" name="review_name" class="lb-review-form__field" placeholder="Your name" autocomplete="name" maxlength="120">`,
            `  <${liquidInputTag} type="text" name="review_title" class="lb-review-form__field" placeholder="Review title (optional)" maxlength="120">`,
            '  <textarea name="review_body" class="lb-review-form__field" placeholder="Share your experience with this product" maxlength="2000"></textarea>',
            '  <div data-lb-review-turnstile hidden></div>',
            '  <p data-lb-review-status class="lb-review-form__status" aria-live="polite"></p>',
            `  <${liquidButtonTag} type="submit" class="lb-review-form__submit">Submit review</${liquidButtonTag}>`,
            '</form>',
        ].join('');
    }

    private currentRating(): number {
        const checked = this.querySelector<HTMLInputElement>('input[name="rating"]:checked');
        return checked ? Number(checked.value) : 0;
    }

    private setStatus(message: string, kind: 'error' | 'success' | '') {
        const status = this.querySelector<HTMLElement>('[data-lb-review-status]');
        if (!status) return;
        status.textContent = message;
        if (kind) {
            status.dataset.kind = kind;
        } else {
            status.removeAttribute('data-kind');
        }
    }

    private setSubmitDisabled(disabled: boolean) {
        const button = this.querySelector<HTMLButtonElement>('.lb-review-form__submit');
        if (button) button.disabled = disabled;
    }

    private readonly handleStarClick = (event: Event) => {
        const target = event.target instanceof Element
            ? event.target.closest<HTMLElement>('[data-lb-review-star]')
            : null;
        if (!target) return;

        const value = Number(target.dataset.lbReviewStar);
        const input = this.querySelector<HTMLInputElement>(`input[name="rating"][value="${value}"]`);
        if (input) input.checked = true;
        this.querySelectorAll<HTMLElement>('[data-lb-review-star]').forEach((star) => {
            star.setAttribute('aria-pressed', Number(star.dataset.lbReviewStar) <= value ? 'true' : 'false');
        });
    };

    private readonly handleSubmit = async (event: Event) => {
        event.preventDefault();
        if (this.submitting) return;

        const rating = this.currentRating();
        if (rating < 1) {
            this.setStatus('Please select a rating.', 'error');
            return;
        }

        const productId = this.dataset.productId || '';
        const storeId = this.dataset.storeId || '';
        const title = this.querySelector<HTMLInputElement>('input[name="review_title"]')?.value.trim() || undefined;
        const body = this.querySelector<HTMLTextAreaElement>('textarea[name="review_body"]')?.value.trim() || undefined;
        const customerName = this.querySelector<HTMLInputElement>('input[name="review_name"]')?.value.trim() || undefined;

        this.submitting = true;
        this.setSubmitDisabled(true);
        this.setStatus('Submitting your review…', '');

        try {
            const response = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId,
                    storeId,
                    rating,
                    title,
                    reviewBody: body,
                    customerName,
                    turnstileToken: this.turnstileToken,
                }),
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                const message = response.status === 409
                    ? 'You have already reviewed this product.'
                    : reviewApiMessage(payload, 'Unable to submit your review.');
                this.setStatus(message, 'error');
                this.resetTurnstile();
                return;
            }

            this.querySelector<HTMLFormElement>('form')?.reset();
            this.querySelectorAll<HTMLElement>('[data-lb-review-star]').forEach((star) => star.setAttribute('aria-pressed', 'false'));
            this.setStatus('Thank you! Your review will appear after approval.', 'success');
            this.resetTurnstile();
        } catch {
            this.setStatus('Unable to submit your review. Please try again.', 'error');
        } finally {
            this.submitting = false;
            this.setSubmitDisabled(false);
        }
    };

    private setupTurnstile() {
        if (canUseReviewDevBypass()) {
            this.turnstileToken = 'dev-bypass-token';
            return;
        }

        const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
        if (!siteKey) {
            this.turnstileToken = null;
            return;
        }

        const render = () => this.renderTurnstile(siteKey);
        if (getReviewTurnstile()) {
            render();
            return;
        }

        if (!document.querySelector('script[src*="turnstile"]')) {
            (window as unknown as Record<string, unknown>)[REVIEW_TURNSTILE_CALLBACK] = render;
            const script = document.createElement('script');
            script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?onload=${REVIEW_TURNSTILE_CALLBACK}`;
            script.async = true;
            document.head.appendChild(script);
            return;
        }

        let attempts = 0;
        const timer = window.setInterval(() => {
            attempts += 1;
            if (getReviewTurnstile()) {
                window.clearInterval(timer);
                render();
            } else if (attempts > 50) {
                window.clearInterval(timer);
            }
        }, 200);
    }

    private renderTurnstile(siteKey: string) {
        const turnstile = getReviewTurnstile();
        const container = this.querySelector<HTMLElement>('[data-lb-review-turnstile]');
        if (!turnstile || !container) return;

        if (this.turnstileWidgetId) {
            try {
                turnstile.remove(this.turnstileWidgetId);
            } catch {
                // Ignore stale widget handles after navigation.
            }
            this.turnstileWidgetId = null;
        }

        this.turnstileWidgetId = turnstile.render(container, {
            sitekey: siteKey,
            size: 'invisible',
            callback: (token: string) => { this.turnstileToken = token; },
            'expired-callback': () => { this.turnstileToken = null; },
            'error-callback': () => { this.turnstileToken = null; },
        });
    }

    private resetTurnstile() {
        this.turnstileToken = canUseReviewDevBypass() ? 'dev-bypass-token' : null;
        const turnstile = getReviewTurnstile();
        if (this.turnstileWidgetId && turnstile) {
            try {
                turnstile.reset(this.turnstileWidgetId);
            } catch {
                // Ignore reset races during navigation.
            }
        }
    }
}

const WISHLIST_STORAGE_KEY = 'lb_wishlist';
const WISHLIST_CHANGED_EVENT = 'letbuyy:wishlist:changed';
const WISHLIST_HEART_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M12 20.7 4.2 13a4.6 4.6 0 0 1 0-6.5 4.6 4.6 0 0 1 6.5 0l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 0 4.6 4.6 0 0 1 0 6.5z"/></svg>';

let wishlistStylesInjected = false;
function ensureWishlistStyles() {
    if (wishlistStylesInjected || typeof document === 'undefined') return;
    wishlistStylesInjected = true;
    const style = document.createElement('style');
    style.dataset.lbWishlistStyles = 'true';
    style.textContent = [
        '.lb-wishlist-toggle__button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:8px;border:0;background:none;cursor:pointer;color:var(--card-text,rgb(17 24 39));opacity:.65;transition:opacity .15s ease,transform .15s ease}',
        '.lb-wishlist-toggle__button:hover{opacity:1}',
        '.lb-wishlist-toggle__button:active{transform:scale(.92)}',
        '.lb-wishlist-toggle__button svg{fill:none;stroke:currentColor;stroke-width:2;transition:transform .15s ease}',
        '.lb-wishlist-toggle__button[aria-pressed="true"]{color:var(--primary,rgb(225 29 72));opacity:1}',
        '.lb-wishlist-toggle__button[aria-pressed="true"] svg{fill:currentColor;transform:scale(1.08)}',
    ].join('');
    document.head.appendChild(style);
}

function readWishlist(): string[] {
    try {
        const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
        return [];
    }
}

function writeWishlist(items: string[]) {
    try {
        window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
    } catch {
        // Ignore storage quota errors; the toggle still reflects the click in-session.
    }
    window.dispatchEvent(new CustomEvent(WISHLIST_CHANGED_EVENT, { detail: { items } }));
}

// Wishlist toggle island. Mirrors the React wishlist-context: guest = localStorage ('lb_wishlist'),
// authenticated = the existing /api/customer/wishlist route (POST/DELETE -> customer_wishlists).
// Auth + initial state come from the server-rendered drop (data-authenticated, data-in-wishlist) so
// there is no extra request on load. No new backend, no new storage model.
class LbWishlistToggleElement extends LiquidIslandBase {
    private active = false;

    connectedCallback() {
        if (!this.dataset.productId) return;
        ensureWishlistStyles();
        this.active = this.resolveInitialActive();
        this.renderToggle();
        this.addEventListener('click', this.handleClick);
        window.addEventListener(WISHLIST_CHANGED_EVENT, this.handleWishlistChanged);
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.handleClick);
        window.removeEventListener(WISHLIST_CHANGED_EVENT, this.handleWishlistChanged);
    }

    private get isAuthenticated(): boolean {
        return this.dataset.authenticated === 'true';
    }

    private resolveInitialActive(): boolean {
        if (this.isAuthenticated) return this.dataset.inWishlist === 'true';
        return readWishlist().includes(this.dataset.productId || '');
    }

    private renderToggle() {
        const label = this.active ? 'Remove from wishlist' : 'Add to wishlist';
        this.innerHTML = [
            `<${liquidButtonTag} type="button" data-lb-wishlist-button class="lb-wishlist-toggle__button" aria-pressed="${this.active ? 'true' : 'false'}" aria-label="${label}" title="${label}">`,
            WISHLIST_HEART_SVG,
            `</${liquidButtonTag}>`,
        ].join('');
    }

    private updateVisual() {
        const button = this.querySelector<HTMLButtonElement>('[data-lb-wishlist-button]');
        if (!button) return;
        const label = this.active ? 'Remove from wishlist' : 'Add to wishlist';
        button.setAttribute('aria-pressed', this.active ? 'true' : 'false');
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
    }

    private readonly handleWishlistChanged = (event: Event) => {
        if (this.isAuthenticated) return;
        const productId = this.dataset.productId;
        if (!productId) return;
        const detail = (event as CustomEvent<{ items?: string[] }>).detail;
        const items = Array.isArray(detail?.items) ? detail.items : readWishlist();
        const next = items.includes(productId);
        if (next !== this.active) {
            this.active = next;
            this.updateVisual();
        }
    };

    private readonly handleClick = (event: Event) => {
        const trigger = event.target instanceof Element
            ? event.target.closest('[data-lb-wishlist-button]')
            : null;
        if (!trigger) return;
        event.preventDefault();
        void this.toggle();
    };

    private async toggle() {
        const productId = this.dataset.productId;
        if (!productId) return;

        const nextActive = !this.active;
        this.active = nextActive;
        this.updateVisual();

        if (this.isAuthenticated) {
            try {
                const response = await fetch('/api/customer/wishlist', {
                    method: nextActive ? 'POST' : 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productId,
                        storeId: this.dataset.storeId,
                        variantId: this.dataset.variantId || null,
                    }),
                });
                if (!response.ok) {
                    this.active = !nextActive;
                    this.updateVisual();
                }
            } catch {
                this.active = !nextActive;
                this.updateVisual();
            }
            return;
        }

        const items = readWishlist();
        const next = nextActive
            ? Array.from(new Set([...items, productId]))
            : items.filter((id) => id !== productId);
        writeWishlist(next);
    }
}

let cartPageStylesInjected = false;
function ensureCartPageStyles() {
    if (cartPageStylesInjected || typeof document === 'undefined') return;
    cartPageStylesInjected = true;
    const style = document.createElement('style');
    style.dataset.lbCartPageStyles = 'true';
    style.textContent = [
        '.lb-cart-page{max-width:760px;margin:0 auto;padding:24px 16px}',
        '.lb-cart__items{list-style:none;margin:0 0 20px;padding:0;display:grid;gap:8px}',
        '.lb-cart__item{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border-color,rgb(229 231 235))}',
        '.lb-cart__qty{display:inline-flex;align-items:center;gap:8px}',
        '.lb-cart__qty button{min-height:36px;min-width:36px;border:1px solid var(--border-color,rgb(229 231 235));border-radius:8px;background:none;cursor:pointer;color:inherit}',
        '.lb-cart__item button[data-lb-cart-remove]{min-height:36px;padding:0 10px;border:0;background:none;cursor:pointer;color:var(--text-secondary,rgb(107 114 128))}',
        '.lb-cart__empty{padding:32px 0;text-align:center;color:var(--text-secondary,rgb(107 114 128))}',
        '.lb-liquid-cart__totals{display:grid;gap:6px;margin-top:8px}',
        '.lb-liquid-cart__row{display:flex;justify-content:space-between;gap:12px;font-size:.95rem}',
        '.lb-liquid-cart__row--total{margin-top:6px;padding-top:10px;border-top:1px solid var(--border-color,rgb(229 231 235));font-weight:700;font-size:1.05rem}',
        '.lb-liquid-cart__pending{color:var(--text-secondary,rgb(107 114 128))}',
        '.lb-cart__checkout{display:inline-flex;align-items:center;justify-content:center;min-height:48px;margin-top:20px;padding:0 24px;border-radius:8px;background:var(--primary,rgb(0 179 179));color:rgb(255 255 255);text-decoration:none;font-weight:700}',
    ].join('');
    document.head.appendChild(style);
}

// Full-page cart island. The cart is browser-owned (localStorage) and hydrated here; every money total
// comes verbatim from the gateway via renderLiquidCartTotals (slice 5) — nothing is summed in the
// browser. The checkout link is unchanged (/store/<sub>/checkout); checkout/payment/order are untouched.
class LbCartElement extends LiquidIslandBase {
    private baseHref = '';

    connectedCallback() {
        ensureCartPageStyles();
        this.baseHref = this.dataset.basePath || inferBasePath();
        this.renderCart();
        this.addEventListener('click', this.handleClick);
        window.addEventListener(CART_CHANGED_EVENT, this.handleCartChanged);
        window.addEventListener('storage', this.handleCartChanged);
        const items = readCart();
        if (items.length > 0) void syncLiquidCartToServer(items);
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.handleClick);
        window.removeEventListener(CART_CHANGED_EVENT, this.handleCartChanged);
        window.removeEventListener('storage', this.handleCartChanged);
    }

    private readonly handleCartChanged = () => {
        this.renderCart();
    };

    private readonly handleClick = (event: Event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const removeButton = target.closest<HTMLElement>('[data-lb-cart-remove]');
        if (removeButton?.dataset.productId) {
            event.preventDefault();
            writeCart(readCart().filter((item) => item.id !== removeButton.dataset.productId), { sync: true });
            return;
        }

        const stepButton = target.closest<HTMLElement>('[data-lb-cart-step]');
        if (stepButton?.dataset.productId) {
            event.preventDefault();
            this.stepQuantity(stepButton.dataset.productId, stepButton.dataset.lbCartStep === 'down' ? -1 : 1);
        }
    };

    private stepQuantity(productId: string, delta: number) {
        const next = readCart()
            .map((item) => (item.id === productId ? { ...item, quantity: item.quantity + delta } : item))
            .filter((item) => item.quantity > 0);
        writeCart(next, { sync: true });
    }

    private renderCart() {
        const items = readCart();
        if (items.length === 0) {
            this.innerHTML = `<p class="lb-cart__empty">Your cart is empty. <a href="${escapeHtml(this.baseHref)}/shop">Browse products</a></p>`;
            return;
        }

        const rows = items.map((item) => [
            '<li class="lb-cart__item">',
            `<span class="lb-cart__title">${escapeHtml(item.name)}</span>`,
            '<span class="lb-cart__qty">',
            `<${liquidButtonTag} type="button" data-lb-cart-step="down" data-product-id="${escapeHtml(item.id)}" aria-label="Decrease quantity of ${escapeHtml(item.name)}">-</${liquidButtonTag}>`,
            `<span aria-live="polite">${item.quantity}</span>`,
            `<${liquidButtonTag} type="button" data-lb-cart-step="up" data-product-id="${escapeHtml(item.id)}" aria-label="Increase quantity of ${escapeHtml(item.name)}">+</${liquidButtonTag}>`,
            '</span>',
            `<${liquidButtonTag} type="button" data-lb-cart-remove data-product-id="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)}">Remove</${liquidButtonTag}>`,
            '</li>',
        ].join('')).join('');

        this.innerHTML = [
            `<ul class="lb-cart__items">${rows}</ul>`,
            renderLiquidCartTotals(readServerCart()),
            `<a class="lb-cart__checkout" href="${escapeHtml(this.baseHref)}/checkout">Proceed to checkout</a>`,
        ].join('');
    }
}

// Account settings island. Renders profile display + edit forms calling the existing
// /api/customer/profile (PATCH) and /api/customer/set-password (POST) endpoints.
// No new backend, no new auth, no new schema.
class LbCustomerSettingsElement extends LiquidIslandBase {
    private basePath = '';
    private buyerMode = false;

    connectedCallback() {
        this.basePath = this.dataset.basePath || inferBasePath();
        this.buyerMode = this.dataset.accountType === 'buyer';
        if (this.buyerMode) {
            void this.renderBuyer();
            return;
        }
        this.render();
    }

    private async renderBuyer() {
        this.innerHTML = '<p role="status">Loading your LetBuyy profile…</p>';
        try {
            const response = await fetch('/api/buyer/profile', { cache: 'no-store' });
            const body = await response.json() as { buyer?: { email?: unknown; email_verified?: unknown; full_name?: unknown; phone?: unknown }; error?: string };
            if (!response.ok || !body.buyer || typeof body.buyer.email !== 'string') throw new Error(body.error || 'profile_load_failed');
            const buyer = body.buyer;
            this.innerHTML = [
                '<div class="lb-settings__forms">',
                '<form class="lb-settings__profile-form" data-lb-settings-buyer-profile>',
                '<h2>LetBuyy profile</h2>',
                `<p class="lb-settings__email-display">${escapeHtml(buyer.email)}${buyer.email_verified ? ' · Verified' : ' · Not verified'}</p>`,
                `<label>Full name<${liquidInputTag} type="text" name="fullName" maxlength="200" value="${escapeHtml(buyer.full_name ?? '')}" autocomplete="name"></${liquidInputTag}></label>`,
                `<label>Phone<${liquidInputTag} type="tel" name="phone" maxlength="32" value="${escapeHtml(buyer.phone ?? '')}" autocomplete="tel" inputmode="tel"></${liquidInputTag}></label>`,
                '<p class="lb-settings__profile-msg" aria-live="polite"></p>',
                `<${liquidButtonTag} type="submit">Save profile</${liquidButtonTag}>`,
                '</form>',
                `<${liquidButtonTag} type="button" data-lb-buyer-signout>Sign out at this store</${liquidButtonTag}>`,
                '</div>',
            ].join('');

            const form = this.querySelector<HTMLFormElement>('[data-lb-settings-buyer-profile]');
            form?.addEventListener('submit', (event) => {
                event.preventDefault();
                void this.saveBuyerProfile(form);
            });
            this.querySelector('[data-lb-buyer-signout]')?.addEventListener('click', () => { void this.signOutBuyer(); });
        } catch {
            this.innerHTML = '<p class="lb-settings__error" role="alert">We could not load your LetBuyy profile. <button type="button" data-lb-buyer-retry>Try again</button></p>';
            this.querySelector('[data-lb-buyer-retry]')?.addEventListener('click', () => { void this.renderBuyer(); });
        }
    }

    private async saveBuyerProfile(form: HTMLFormElement) {
        const msg = this.querySelector<HTMLElement>('.lb-settings__profile-msg');
        if (msg) msg.textContent = 'Saving…';
        const fd = new FormData(form);
        try {
            const response = await fetch('/api/buyer/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: String(fd.get('fullName') ?? '').trim(), phone: String(fd.get('phone') ?? '').trim() }),
            });
            if (msg) msg.textContent = response.ok ? 'Your LetBuyy profile is saved.' : 'We could not save your profile. Please try again.';
        } catch {
            if (msg) msg.textContent = 'Network error. Your profile was not saved.';
        }
    }

    private async signOutBuyer() {
        try {
            const response = await fetch('/api/buyer-auth/logout', { method: 'POST', headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('signout_failed');
            window.location.assign(this.basePath);
        } catch {
            const message = document.createElement('p');
            message.setAttribute('role', 'alert');
            message.textContent = 'We could not sign you out. Please try again.';
            this.append(message);
        }
    }

    private render() {
        const email = this.dataset.email || '';
        const name = this.dataset.name || '';
        const phone = this.dataset.phone || '';
        this.innerHTML = [
            '<div class="lb-settings__forms">',
            '<form class="lb-settings__profile-form" data-lb-settings-profile>',
            '<h2>Profile</h2>',
            `<p class="lb-settings__email-display">${escapeHtml(email)}</p>`,
            `<label>Full name<${liquidInputTag} type="text" name="fullName" value="${escapeHtml(name)}" autocomplete="name"></${liquidInputTag}></label>`,
            `<label>Phone<${liquidInputTag} type="tel" name="phone" value="${escapeHtml(phone)}" autocomplete="tel" inputmode="tel"></${liquidInputTag}></label>`,
            `<label class="lb-settings__marketing"><${liquidInputTag} type="checkbox" name="acceptsMarketing"></${liquidInputTag}> Send me store updates</label>`,
            '<p class="lb-settings__profile-msg" aria-live="polite"></p>',
            `<${liquidButtonTag} type="submit">Save changes</${liquidButtonTag}>`,
            '</form>',
            '<form class="lb-settings__password-form" data-lb-settings-password>',
            '<h2>Change password</h2>',
            `<label>Current password<${liquidInputTag} type="password" name="currentPassword" autocomplete="current-password" placeholder="Leave blank if not set"></${liquidInputTag}></label>`,
            `<label>New password<${liquidInputTag} type="password" name="newPassword" autocomplete="new-password" required></${liquidInputTag}></label>`,
            `<label>Confirm password<${liquidInputTag} type="password" name="confirmPassword" autocomplete="new-password" required></${liquidInputTag}></label>`,
            '<p class="lb-settings__password-msg" aria-live="polite"></p>',
            `<${liquidButtonTag} type="submit">Update password</${liquidButtonTag}>`,
            '</form>',
            '</div>',
        ].join('');

        const profileForm = this.querySelector<HTMLFormElement>('[data-lb-settings-profile]');
        const passwordForm = this.querySelector<HTMLFormElement>('[data-lb-settings-password]');

        profileForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = this.querySelector<HTMLElement>('.lb-settings__profile-msg');
            if (msg) msg.textContent = 'Saving…';
            const fd = new FormData(profileForm);
            try {
                const res = await fetch('/api/customer/profile', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fullName: String(fd.get('fullName') ?? '').trim(),
                        phone: String(fd.get('phone') ?? '').trim() || undefined,
                        acceptsMarketing: Boolean(fd.get('acceptsMarketing')),
                    }),
                });
                if (msg) msg.textContent = res.ok ? 'Saved!' : 'Failed to save. Try again.';
            } catch {
                if (msg) msg.textContent = 'Network error. Try again.';
            }
        });

        passwordForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = this.querySelector<HTMLElement>('.lb-settings__password-msg');
            const fd = new FormData(passwordForm);
            const newPw = String(fd.get('newPassword') ?? '');
            const confirmPw = String(fd.get('confirmPassword') ?? '');
            if (newPw.length < 6) { if (msg) msg.textContent = 'Password must be at least 6 characters.'; return; }
            if (newPw !== confirmPw) { if (msg) msg.textContent = 'Passwords do not match.'; return; }
            if (msg) msg.textContent = 'Updating…';
            try {
                const res = await fetch('/api/customer/set-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        currentPassword: String(fd.get('currentPassword') ?? '').trim() || undefined,
                        password: newPw,
                    }),
                });
                if (msg) msg.textContent = res.ok ? 'Password updated!' : 'Failed to update. Try again.';
                if (res.ok) passwordForm.reset();
            } catch {
                if (msg) msg.textContent = 'Network error. Try again.';
            }
        });
    }
}

// Address manager island. Reads the address list from /api/customer/addresses (GET) and renders
// address cards + add/edit/delete/set-default using existing CRUD endpoints. No new APIs.
class LbAddressManagerElement extends LiquidIslandBase {
    private basePath = '';
    private buyerMode = false;
    private addresses: Array<Record<string, unknown>> = [];
    private editingId: string | null = null;

    connectedCallback() {
        this.basePath = this.dataset.basePath || inferBasePath();
        this.buyerMode = this.dataset.accountType === 'buyer';
        this.addEventListener('click', this.handleClick);
        void this.loadAddresses();
    }

    private async loadAddresses() {
        this.innerHTML = '<p class="lb-addresses__loading">Loading addresses…</p>';
        try {
            const res = await fetch(this.buyerMode ? '/api/buyer/addresses' : '/api/customer/addresses', { cache: 'no-store' });
            if (!res.ok) throw new Error('address_load_failed');
            const data = await res.json() as { addresses?: Array<Record<string, unknown>> };
            this.addresses = Array.isArray(data.addresses) ? data.addresses : [];
        } catch {
            this.innerHTML = '<p class="lb-addresses__error" role="alert">We could not load your addresses. <button type="button" data-lb-addr-retry>Try again</button></p>';
            return;
        }
        this.renderList();
    }

    private renderList() {
        const cards = this.addresses.map((addr) => {
            const id = String(addr.id ?? '');
            const label = String(addr.label ?? 'address');
            const isDefault = Boolean(addr.is_default);
            const full_name = String(addr.full_name ?? '');
            const line1 = String(addr.address_line1 ?? '');
            const line2 = String(addr.address_line2 ?? '');
            const landmark = String(addr.landmark ?? '');
            const city = String(addr.city ?? '');
            const state = String(addr.state ?? '');
            const zip = String(addr.postal_code ?? '');
            return [
                `<div class="lb-address-card${isDefault ? ' lb-address-card--default' : ''}" data-address-id="${escapeHtml(id)}">`,
                `<span class="lb-address-card__label">${escapeHtml(label)}${isDefault ? ' <span class="lb-address-card__default-badge">Default</span>' : ''}</span>`,
                `<p class="lb-address-card__name">${escapeHtml(full_name)}</p>`,
                `<p class="lb-address-card__line">${escapeHtml(line1)}</p>`,
                line2 ? `<p class="lb-address-card__line">${escapeHtml(line2)}</p>` : '',
                `<p class="lb-address-card__city">${escapeHtml(city)}, ${escapeHtml(state)} ${escapeHtml(zip)}</p>`,
                landmark ? `<p class="lb-address-card__landmark">Landmark: ${escapeHtml(landmark)}</p>` : '',
                '<div class="lb-address-card__actions">',
                `<${liquidButtonTag} type="button" data-lb-addr-edit="${escapeHtml(id)}">Edit</${liquidButtonTag}>`,
                !isDefault ? `<${liquidButtonTag} type="button" data-lb-addr-default="${escapeHtml(id)}">Set default</${liquidButtonTag}>` : '',
                `<${liquidButtonTag} type="button" data-lb-addr-delete="${escapeHtml(id)}">Delete</${liquidButtonTag}>`,
                '</div></div>',
            ].join('');
        }).join('');

        this.innerHTML = [
            cards || '<p class="lb-addresses__empty">No saved addresses yet.</p>',
            `<${liquidButtonTag} type="button" class="lb-addresses__add-btn" data-lb-addr-add>+ Add address</${liquidButtonTag}>`,
        ].join('');

    }

    private readonly handleClick = (e: Event) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target) return;

        if (target.closest('[data-lb-addr-retry]')) { void this.loadAddresses(); return; }

        const editBtn = target.closest<HTMLElement>('[data-lb-addr-edit]');
        if (editBtn?.dataset.lbAddrEdit) { this.showForm(editBtn.dataset.lbAddrEdit); return; }

        const addBtn = target.closest<HTMLElement>('[data-lb-addr-add]');
        if (addBtn) { this.showForm(null); return; }

        const defaultBtn = target.closest<HTMLElement>('[data-lb-addr-default]');
        if (defaultBtn?.dataset.lbAddrDefault) { void this.setDefault(defaultBtn.dataset.lbAddrDefault); return; }

        const deleteBtn = target.closest<HTMLElement>('[data-lb-addr-delete]');
        if (deleteBtn?.dataset.lbAddrDelete) { void this.deleteAddress(deleteBtn.dataset.lbAddrDelete); return; }

        const cancelBtn = target.closest<HTMLElement>('[data-lb-addr-cancel]');
        if (cancelBtn) { this.renderList(); return; }
    };

    private showForm(id: string | null) {
        this.editingId = id;
        const existing = id ? this.addresses.find((a) => String(a.id) === id) : null;
        const v = (field: string) => escapeHtml(String(existing?.[field] ?? ''));
        this.innerHTML = [
            `<form class="lb-address-form" data-lb-addr-form>`,
            `<h3>${id ? 'Edit' : 'New'} address</h3>`,
            `<label>Label<select name="label"><option value="home" ${existing?.label === 'home' || !existing?.label ? 'selected' : ''}>Home</option><option value="work" ${existing?.label === 'work' ? 'selected' : ''}>Work</option><option value="other" ${existing?.label === 'other' ? 'selected' : ''}>Other</option></select></label>`,
            `<label>Full name<${liquidInputTag} type="text" name="full_name" value="${v('full_name')}" required></${liquidInputTag}></label>`,
            `<label>Phone<${liquidInputTag} type="tel" name="phone" value="${v('phone')}" inputmode="tel"></${liquidInputTag}></label>`,
            `<label>Address line 1<${liquidInputTag} type="text" name="address_line1" value="${v('address_line1')}" required></${liquidInputTag}></label>`,
            `<label>Address line 2<${liquidInputTag} type="text" name="address_line2" value="${v('address_line2')}"></${liquidInputTag}></label>`,
            `<label>City<${liquidInputTag} type="text" name="city" value="${v('city')}" required></${liquidInputTag}></label>`,
            `<label>State<${liquidInputTag} type="text" name="state" value="${v('state')}" required></${liquidInputTag}></label>`,
            `<label>PIN Code<${liquidInputTag} type="text" name="postal_code" value="${v('postal_code')}" inputmode="numeric" maxlength="6" required></${liquidInputTag}></label>`,
            `<label>Landmark<${liquidInputTag} type="text" name="landmark" value="${v('landmark')}"></${liquidInputTag}></label>`,
            `<label class="lb-address-form__default"><${liquidInputTag} type="checkbox" name="is_default" ${existing?.is_default ? 'checked' : ''}></${liquidInputTag}> Set as default</label>`,
            '<p class="lb-address-form__msg" aria-live="polite"></p>',
            `<${liquidButtonTag} type="submit">${id ? 'Update' : 'Save'} address</${liquidButtonTag}>`,
            `<${liquidButtonTag} type="button" data-lb-addr-cancel>Cancel</${liquidButtonTag}>`,
            '</form>',
        ].join('');

        const form = this.querySelector<HTMLFormElement>('[data-lb-addr-form]');
        form?.addEventListener('submit', (e) => { e.preventDefault(); void this.saveAddress(form); });
    }

    private async saveAddress(form: HTMLFormElement) {
        const msg = this.querySelector<HTMLElement>('.lb-address-form__msg');
        if (msg) msg.textContent = 'Saving…';
        const fd = new FormData(form);
        const body: Record<string, unknown> = {
            full_name: String(fd.get('full_name') ?? ''),
            phone: String(fd.get('phone') ?? '') || undefined,
            address_line1: String(fd.get('address_line1') ?? ''),
            address_line2: String(fd.get('address_line2') ?? '') || undefined,
            city: String(fd.get('city') ?? ''),
            state: String(fd.get('state') ?? ''),
            postal_code: String(fd.get('postal_code') ?? ''),
            landmark: String(fd.get('landmark') ?? '') || undefined,
            country: 'IN',
            is_default: Boolean(fd.get('is_default')),
        };
        if (this.buyerMode) body.label = String(fd.get('label') ?? 'home');
        if (this.editingId && !this.buyerMode) body.id = this.editingId;
        try {
            const collectionUrl = this.buyerMode ? '/api/buyer/addresses' : '/api/customer/addresses';
            const itemUrl = this.editingId && this.buyerMode ? `/api/buyer/addresses/${encodeURIComponent(this.editingId)}` : collectionUrl;
            const res = await fetch(this.buyerMode ? itemUrl : collectionUrl, {
                method: this.buyerMode ? (this.editingId ? 'PATCH' : 'POST') : (this.editingId ? 'PUT' : 'POST'),
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                await this.loadAddresses();
            } else {
                if (msg) msg.textContent = 'Failed to save address.';
            }
        } catch {
            if (msg) msg.textContent = 'Network error. Try again.';
        }
    }

    private async setDefault(id: string) {
        try {
            const res = this.buyerMode
                ? await fetch(`/api/buyer/addresses/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_default: true }) })
                : await fetch('/api/customer/addresses', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_default: true }) });
            if (!res.ok) throw new Error('address_update_failed');
            await this.loadAddresses();
        } catch {
            this.innerHTML = '<p class="lb-addresses__error" role="alert">We could not update the default address. <button type="button" data-lb-addr-retry>Reload</button></p>';
        }
    }

    private async deleteAddress(id: string) {
        try {
            const res = this.buyerMode
                ? await fetch(`/api/buyer/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' })
                : await fetch('/api/customer/addresses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
            if (!res.ok) throw new Error('address_delete_failed');
            await this.loadAddresses();
        } catch {
            this.innerHTML = '<p class="lb-addresses__error" role="alert">We could not delete this address. <button type="button" data-lb-addr-retry>Reload</button></p>';
        }
    }
}

// F7-Lane-B — lb-logout hydration island.
//
// Progressive-enhancement logout: the no-JS path is a native <form method="post"> child
// (rendered by the Liquid section, see theme-bundle.ts customer-account section). When JS
// is available, connectedCallback intercepts the submit button's click, fires a fetch() POST
// to data-logout-url, and on success redirects to /customers/login. On fetch failure it falls
// back to native form.submit() so logout always works regardless of JS availability.
//
// ART-17 compliant: this is a Web Component island, not a React section renderer.
// DOMPurify allowlist: lb-logout is added to ADD_TAGS and CUSTOM_ELEMENT_HANDLING.tagNameCheck
// in theme-renderer.ts (LANE-A). data-logout-url is allowed by the existing data-* attr regex.
class LbLogoutElement extends LiquidIslandBase {
    private readonly handleClick = (event: Event) => {
        const target = event.target instanceof Element ? event.target : null;
        // Only intercept clicks that reach a submit button inside this element.
        if (!target?.closest('button[type="submit"],button:not([type])')) return;
        event.preventDefault();
        void this.performLogout();
    };

    connectedCallback() {
        this.addEventListener('click', this.handleClick);
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.handleClick);
    }

    private async performLogout(): Promise<void> {
        const logoutUrl = this.dataset.logoutUrl || '/api/customer/logout';
        try {
            const response = await fetch(logoutUrl, {
                method: 'POST',
                credentials: 'include',
                headers: { 'content-type': 'application/json' },
            });
            // On 2xx/redirect: session cleared — redirect to login.
            // On 4xx (e.g. 401 = already logged out, 403 = CSRF rejected): treat as
            // "session already gone" and redirect to login unconditionally. Falling
            // through to form.submit() on a 401 would POST again and loop.
            // Only genuine network errors (catch branch) use the form.submit() fallback.
            if (response.ok || response.redirected || (response.status >= 400 && response.status < 500)) {
                window.location.assign('/customers/login');
                return;
            }
            // 5xx: server error — fall through to form.submit() below.
        } catch {
            // Network failure — fall through to native form submission below.
        }
        // Fallback: let the browser POST the form (no-JS path, always works).
        const form = this.querySelector<HTMLFormElement>('form');
        if (form) {
            form.submit();
        } else {
            // Last resort: navigate directly (GET, may not clear session but avoids stuck state).
            window.location.assign('/customers/login');
        }
    }
}

const FORM_TURNSTILE_CALLBACK = 'onLbFormTurnstileLoad';

type FormTurnstileApi = {
    render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
    reset: (widgetId: string) => void;
    remove: (widgetId: string) => void;
};

function getFormTurnstile(): FormTurnstileApi | undefined {
    return (window as unknown as { turnstile?: FormTurnstileApi }).turnstile;
}

function canUseFormTurnstileDevBypass(): boolean {
    return process.env.NODE_ENV === 'development'
        && process.env.NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS === 'true';
}

// T1/W2 — generic Turnstile-for-a-plain-<form> island. The customer register/login forms are
// no-JS-first <form method="post"> submissions (D10 pattern) that POST directly to
// /api/customer/register|login; there is no client-side submit handler to attach a token to.
// This island fills the SAME role TurnstileWidget.tsx plays for React forms: render an invisible
// challenge and, on solve, write the token straight into the sibling hidden
// <input name="turnstileToken"> that the Liquid section already renders — so the native form
// submission (JS or no-JS) carries a real token with zero extra wiring in the section markup.
// If the challenge hasn't solved yet when the shopper submits, the hidden input stays empty and
// the server-side verifyTurnstileToken correctly rejects with TURNSTILE_REQUIRED — this is a
// race, never a bypass; the check itself is untouched.
class LbTurnstileElement extends LiquidIslandBase {
    private widgetId: string | null = null;

    connectedCallback() {
        if (canUseFormTurnstileDevBypass()) {
            this.writeToken('dev-bypass-token');
            return;
        }

        const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
        if (!siteKey) return;

        const render = () => this.renderWidget(siteKey);
        if (getFormTurnstile()) {
            render();
            return;
        }

        if (!document.querySelector('script[src*="turnstile"]')) {
            (window as unknown as Record<string, unknown>)[FORM_TURNSTILE_CALLBACK] = render;
            const script = document.createElement('script');
            script.src = `https://challenges.cloudflare.com/turnstile/v0/api.js?onload=${FORM_TURNSTILE_CALLBACK}`;
            script.async = true;
            document.head.appendChild(script);
            return;
        }

        let attempts = 0;
        const timer = window.setInterval(() => {
            attempts += 1;
            if (getFormTurnstile()) {
                window.clearInterval(timer);
                render();
            } else if (attempts > 50) {
                window.clearInterval(timer);
            }
        }, 200);
    }

    disconnectedCallback() {
        const turnstile = getFormTurnstile();
        if (this.widgetId && turnstile) {
            try {
                turnstile.remove(this.widgetId);
            } catch {
                // Ignore stale widget handles after navigation.
            }
        }
    }

    private renderWidget(siteKey: string) {
        const turnstile = getFormTurnstile();
        if (!turnstile) return;

        if (this.widgetId) {
            try {
                turnstile.remove(this.widgetId);
            } catch {
                // Ignore stale widget handles.
            }
            this.widgetId = null;
        }

        this.widgetId = turnstile.render(this, {
            sitekey: siteKey,
            size: 'invisible',
            callback: (token: string) => this.writeToken(token),
            'expired-callback': () => this.writeToken(''),
            'error-callback': () => this.writeToken(''),
        });
    }

    private writeToken(token: string) {
        const form = this.closest('form');
        const input = form?.querySelector<HTMLInputElement>('input[name="turnstileToken"]') || this.querySelector<HTMLInputElement>('input[name="turnstileToken"]');
        if (input) input.value = token;
    }
}

// T2a/W3a — mobile hamburger drawer. Same markup serves both widths (see LIQUID_THEME_BASE_CSS):
// CSS repositions the ONE nav-links list between an off-canvas mobile drawer and a static desktop
// row, so this island only needs to own open/close state and a11y attributes, never nav content.
// T5/W2/W1 — <lb-mobile-nav> owns two related widgets sharing one markup: the off-canvas drawer
// (mobile) and, at desktop, the same nested <details> becoming per-item dropdowns (see the CSS
// section in liquid-theme.css). Rebuilt this phase for: a real close button, a real Tab focus trap
// while the drawer is open (previously only set initial focus, never constrained subsequent Tabs),
// Escape closing the innermost open thing first (a dropdown, then the drawer), click-outside closing
// an open desktop dropdown, and arrow-key navigation within an open dropdown's links.
class LbMobileNavElement extends LiquidIslandBase {
    private readonly handleClick = (event: Event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        if (target.closest('[data-lb-nav-toggle]')) {
            this.setOpen(this.dataset.open !== 'true');
            return;
        }
        if (target.closest('[data-lb-nav-close]') || target.closest('[data-lb-nav-scrim]') || target.closest('[data-lb-nav-panel] a')) {
            this.setOpen(false);
            return;
        }

        // Click outside an open desktop dropdown closes it (native <details> only closes another
        // <details> that shares its `name` group — these don't share one, since desktop dropdowns
        // must be able to be open independently, one per top-level item, hence this manual check).
        const clickedDropdown = target.closest<HTMLDetailsElement>('[data-lb-nav-dropdown]');
        this.querySelectorAll<HTMLDetailsElement>('[data-lb-nav-dropdown][open]').forEach((dropdown) => {
            if (dropdown !== clickedDropdown) dropdown.open = false;
        });
    };

    private readonly handleKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            const openDropdown = this.querySelector<HTMLDetailsElement>('[data-lb-nav-dropdown][open]');
            if (openDropdown) {
                openDropdown.open = false;
                openDropdown.querySelector('summary')?.focus();
                return;
            }
            if (this.dataset.open === 'true') this.setOpen(false);
            return;
        }

        if (this.dataset.open === 'true') this.trapTab(event);

        const withinDropdown = (event.target as Element | null)?.closest<HTMLDetailsElement>('[data-lb-nav-dropdown][open]');
        if (withinDropdown && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            const links = Array.from(withinDropdown.querySelectorAll<HTMLElement>('.lb-header__nav-submenu a'));
            if (links.length === 0) return;
            const current = links.indexOf(document.activeElement as HTMLElement);
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            const next = current === -1 ? 0 : ((current + delta) % links.length + links.length) % links.length;
            links[next]?.focus();
        }
    };

    // A real focus trap: while the drawer is open, Tab/Shift+Tab cycle only among the panel's own
    // focusable elements — previously Tab could walk focus straight out into the (visually hidden
    // behind the scrim, but still in the DOM and still focusable) rest of the page.
    private trapTab(event: KeyboardEvent) {
        if (event.key !== 'Tab') return;
        const panel = this.querySelector<HTMLElement>('[data-lb-nav-panel]');
        if (!panel) return;
        const focusable = Array.from(
            panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'),
        ).filter((el) => el.offsetParent !== null);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        } else if (!panel.contains(active)) {
            event.preventDefault();
            first.focus();
        }
    }

    connectedCallback() {
        this.dataset.open = 'false';
        this.addEventListener('click', this.handleClick);
        this.addEventListener('keydown', this.handleKeydown);
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.handleClick);
        this.removeEventListener('keydown', this.handleKeydown);
        document.body.style.overflow = '';
    }

    private setOpen(open: boolean) {
        this.dataset.open = open ? 'true' : 'false';
        const toggle = this.querySelector<HTMLButtonElement>('[data-lb-nav-toggle]');
        toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
        // Body scroll lock while the drawer is open — a fixed-position off-canvas panel over a
        // scrollable page is otherwise disorienting on touch devices (the page keeps scrolling
        // behind the drawer). Reverts on close/disconnect.
        document.body.style.overflow = open ? 'hidden' : '';
        if (open) {
            const closeButton = this.querySelector<HTMLElement>('[data-lb-nav-close]');
            (closeButton || this.querySelector<HTMLElement>('[data-lb-nav-panel] a'))?.focus();
        } else {
            this.querySelectorAll<HTMLDetailsElement>('[data-lb-nav-dropdown][open]').forEach((d) => { d.open = false; });
            toggle?.focus();
        }
    }
}

function defineLiquidIsland(name: string, constructor: CustomElementConstructor) {
    if (!window.customElements.get(name)) {
        window.customElements.define(name, constructor);
    }
}

export function registerLiquidHydrationIslands() {
    if (typeof window === 'undefined' || typeof window.customElements === 'undefined') return;
    defineLiquidIsland('lb-add-to-cart', LbAddToCartElement);
    defineLiquidIsland('lb-cart-drawer', LbCartDrawerElement);
    defineLiquidIsland('lb-search', LbSearchElement);
    defineLiquidIsland('lb-variant-picker', LbVariantPickerElement);
    defineLiquidIsland('lb-review-form', LbReviewFormElement);
    defineLiquidIsland('lb-wishlist-toggle', LbWishlistToggleElement);
    defineLiquidIsland('lb-cart', LbCartElement);
    defineLiquidIsland('lb-customer-settings', LbCustomerSettingsElement);
    defineLiquidIsland('lb-address-manager', LbAddressManagerElement);
    // F7-Lane-B: lb-logout island — progressive-enhancement POST logout.
    // LANE-A must land first (DOMPurify ADD_TAGS + tagNameCheck in theme-renderer.ts).
    defineLiquidIsland('lb-logout', LbLogoutElement);
    // T1/W2: lb-turnstile island — see class doc above.
    defineLiquidIsland('lb-turnstile', LbTurnstileElement);
    // T2a/W3a: lb-mobile-nav island — hamburger drawer.
    defineLiquidIsland('lb-mobile-nav', LbMobileNavElement);
    // T5/W3: lb-predictive-search island — header search overlay's debounced results.
    defineLiquidIsland('lb-predictive-search', LbPredictiveSearchElement);
    // T6/W3: lb-product-gallery island — PDP image carousel + thumbnails.
    defineLiquidIsland('lb-product-gallery', LbProductGalleryElement);
}

function ensureLiquidCartDrawer(root: ParentNode, basePath: string) {
    const hasDrawer = root.querySelector('lb-cart-drawer,[data-lb-island="cart-drawer"]');
    // T5/W4 — [data-lb-cart-toggle] (the drawer's own visible "Cart (N)" button) no longer renders;
    // the header's [data-lb-cart-trigger] is the sole open control now, and it exists on every page
    // that has a header (i.e. every real page), so the drawer must exist wherever it does too — not
    // just on pages with an add-to-cart control — or clicking it would silently do nothing.
    const needsDrawer = root.querySelector('lb-add-to-cart,[data-lb-island="add-to-cart"],[data-lb-cart-trigger]');
    if (hasDrawer || !needsDrawer) return;

    const drawer = document.createElement('lb-cart-drawer');
    drawer.dataset.lbIsland = 'cart-drawer';
    drawer.dataset.basePath = basePath;
    root.appendChild(drawer);
}

// T2a/W3a — header cart-count sync. The header's `{{ cart.item_count | default: 0 }}` is an honest
// SSR placeholder (no cart token exists server-side); this reuses the SAME CART_CHANGED_EVENT /
// `storage` signals the cart-drawer and cart-page islands already listen for (see
// LbCartDrawerElement/LbCartElement above) rather than inventing a second cart-sync mechanism.
function syncHeaderCartCount() {
    const serverCart = readServerCart();
    const count = serverCart
        ? serverCart.lines.reduce((sum, line) => sum + line.quantity, 0)
        : readCart().reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll<HTMLElement>('[data-lb-cart-count]').forEach((el) => {
        el.textContent = String(count);
    });
}

function openHeaderSearchOverlay(toggle: HTMLElement) {
    const overlayId = toggle.getAttribute('aria-controls');
    const overlay = overlayId ? document.getElementById(overlayId) : null;
    if (!overlay) return;
    overlay.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    overlay.querySelector<HTMLInputElement>('[data-lb-search-input]')?.focus();
}

function closeHeaderSearchOverlay(overlay: HTMLElement) {
    overlay.hidden = true;
    const toggle = document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(overlay.id)}"]`);
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.focus();
}

// T5/W4 — the header cart control ([data-lb-cart-trigger]) is a real <a href="…/cart"> (works with
// JS disabled, in a new tab, or if the drawer never mounted) that a delegated click handler upgrades
// into the drawer's open trigger. T5/W3 — the search icon similarly toggles the full-width overlay
// this same delegated handler owns. Delegated on `root` (not document) so it only ever affects this
// store's own render, and is registered/torn down alongside everything else this effect owns.
function bindHeaderControls(root: HTMLElement): () => void {
    const handleClick = (event: Event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        const cartTrigger = target.closest<HTMLElement>('[data-lb-cart-trigger]');
        if (cartTrigger) {
            event.preventDefault();
            window.dispatchEvent(new CustomEvent(CART_OPEN_EVENT, { detail: { source: 'header-cart-trigger' } }));
            return;
        }

        const searchToggle = target.closest<HTMLElement>('[data-lb-search-toggle]');
        if (searchToggle) {
            openHeaderSearchOverlay(searchToggle);
            return;
        }

        const searchClose = target.closest<HTMLElement>('[data-lb-search-close]');
        const overlayFromClose = searchClose?.closest<HTMLElement>('.lb-header__search-overlay');
        if (overlayFromClose) {
            closeHeaderSearchOverlay(overlayFromClose);
        }
    };

    const handleKeydown = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        const openOverlay = root.querySelector<HTMLElement>('.lb-header__search-overlay:not([hidden])');
        if (openOverlay) closeHeaderSearchOverlay(openOverlay);
    };

    root.addEventListener('click', handleClick);
    root.addEventListener('keydown', handleKeydown);
    return () => {
        root.removeEventListener('click', handleClick);
        root.removeEventListener('keydown', handleKeydown);
    };
}

export default function LiquidHydrationIslands({ basePath, storeId }: LiquidHydrationIslandsProps) {
    useEffect(() => {
        registerLiquidHydrationIslands();
        const root = document.querySelector<HTMLElement>('[data-theme-renderer="liquid"]');
        if (!root) return;

        root.dataset.storeId = storeId;
        root.querySelectorAll<HTMLElement>('lb-cart-drawer').forEach((drawer) => {
            drawer.dataset.basePath = drawer.dataset.basePath || basePath;
        });
        ensureLiquidCartDrawer(root, basePath);
        const unbindHeaderControls = bindHeaderControls(root);

        syncHeaderCartCount();
        window.addEventListener(CART_CHANGED_EVENT, syncHeaderCartCount);
        window.addEventListener('storage', syncHeaderCartCount);
        return () => {
            window.removeEventListener(CART_CHANGED_EVENT, syncHeaderCartCount);
            window.removeEventListener('storage', syncHeaderCartCount);
            unbindHeaderControls();
        };
    }, [basePath, storeId]);

    return null;
}
