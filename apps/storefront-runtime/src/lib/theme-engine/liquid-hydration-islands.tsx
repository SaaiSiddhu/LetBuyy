'use client';

import { useEffect } from 'react';

const CART_STORAGE_KEY = 'lb_cart';
const CART_OPEN_EVENT = 'letbuyy:cart:open';
const CART_CHANGED_EVENT = 'letbuyy:cart:changed';
const VARIANT_CHANGED_EVENT = 'letbuyy:variant:changed';

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

function writeCart(items: LiquidCartItem[]) {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT, { detail: { items } }));
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

    writeCart(items);
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

class LbAddToCartElement extends HTMLElement {
    private readonly handleClick = (event: Event) => {
        const target = event.target instanceof Element ? event.target : null;
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

    private addCurrentProduct() {
        const item = cartItemFromElement(this);
        const status = this.querySelector<HTMLElement>('[data-lb-add-to-cart-status]');
        if (!item) {
            if (status) status.textContent = 'Product unavailable';
            return;
        }

        addCartItem(item);
        if (status) status.textContent = 'Added';
        this.setAttribute('data-lb-added', 'true');
        window.setTimeout(() => {
            if (status) status.textContent = '';
            this.removeAttribute('data-lb-added');
        }, 1800);
    }
}

class LbCartDrawerElement extends HTMLElement {
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
            writeCart(readCart().filter((item) => item.id !== removeButton.dataset.productId));
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
        this.render();
    }

    private render() {
        const items = readCart();
        const count = items.reduce((sum, item) => sum + item.quantity, 0);
        const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const basePath = this.dataset.basePath || inferBasePath();
        const rows = items.length === 0
            ? '<p class="lb-liquid-cart__empty">Your bag is empty.</p>'
            : items.map((item) => [
                '<div class="lb-liquid-cart__item">',
                `<span>${escapeHtml(item.name)}</span>`,
                `<span>x${item.quantity}</span>`,
                `<button type="button" data-lb-cart-remove data-product-id="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)}">Remove</button>`,
                '</div>',
            ].join('')).join('');

        this.innerHTML = [
            '<style>',
            '.lb-liquid-cart__toggle{min-height:44px;padding:0 14px;border:1px solid var(--border-color,#e5e7eb);border-radius:8px;background:var(--card-bg,#fff);color:var(--card-text,#111827);font-weight:700}',
            '.lb-liquid-cart__panel{position:fixed;inset:0 0 0 auto;z-index:100;width:min(420px,100vw);padding:20px;background:var(--card-bg,#fff);color:var(--card-text,#111827);box-shadow:0 20px 60px rgba(15,23,42,.28);overflow:auto}',
            '.lb-liquid-cart__item{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border-color,#e5e7eb)}',
            '.lb-liquid-cart__footer{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-top:20px}',
            '.lb-liquid-cart__checkout{min-height:44px;display:inline-flex;align-items:center;padding:0 16px;border-radius:8px;background:var(--primary,#00b3b3);color:#fff;text-decoration:none;font-weight:700}',
            '</style>',
            `<button type="button" data-lb-cart-toggle class="lb-liquid-cart__toggle" aria-expanded="${this.open ? 'true' : 'false'}">Cart (${count})</button>`,
            `<aside class="lb-liquid-cart__panel" role="dialog" aria-modal="true" aria-label="Shopping cart" ${this.open ? '' : 'hidden'}>`,
            '<button type="button" data-lb-cart-close aria-label="Close cart">Close</button>',
            '<h2>Cart</h2>',
            rows,
            '<div class="lb-liquid-cart__footer">',
            `<strong>Subtotal: ${escapeHtml(total.toLocaleString('en-IN', { style: 'currency', currency: items[0]?.currency || 'INR', maximumFractionDigits: 0 }))}</strong>`,
            `<a class="lb-liquid-cart__checkout" href="${escapeHtml(basePath)}/checkout">Checkout</a>`,
            '</div>',
            '</aside>',
        ].join('');
    }
}

class LbSearchElement extends HTMLElement {
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
                '<input type="search" name="search" placeholder="Search products" aria-label="Search products" />',
                '<button type="submit">Search</button>',
                '</form>',
            ].join('');
        }

        this.addEventListener('submit', this.handleSubmit);
    }

    disconnectedCallback() {
        this.removeEventListener('submit', this.handleSubmit);
    }
}

class LbVariantPickerElement extends HTMLElement {
    private readonly handleClick = (event: Event) => {
        const target = event.target instanceof Element ? event.target : null;
        const option = target?.closest<HTMLElement>('[data-lb-variant-option]');
        if (!option) return;

        event.preventDefault();
        this.selectOption(option);
    };

    private readonly handleChange = () => {
        window.dispatchEvent(new CustomEvent(VARIANT_CHANGED_EVENT, { detail: selectedVariantsFrom(this) }));
    };

    connectedCallback() {
        this.addEventListener('click', this.handleClick);
        this.addEventListener('change', this.handleChange);
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
        window.dispatchEvent(new CustomEvent(VARIANT_CHANGED_EVENT, { detail: selectedVariantsFrom(this) }));
    }
}

function defineLiquidIsland(name: string, constructor: CustomElementConstructor) {
    if (!window.customElements.get(name)) {
        window.customElements.define(name, constructor);
    }
}

export function registerLiquidHydrationIslands() {
    defineLiquidIsland('lb-add-to-cart', LbAddToCartElement);
    defineLiquidIsland('lb-cart-drawer', LbCartDrawerElement);
    defineLiquidIsland('lb-search', LbSearchElement);
    defineLiquidIsland('lb-variant-picker', LbVariantPickerElement);
}

function ensureLiquidCartDrawer(root: ParentNode, basePath: string) {
    const hasDrawer = root.querySelector('lb-cart-drawer,[data-lb-island="cart-drawer"]');
    const needsDrawer = root.querySelector('lb-add-to-cart,[data-lb-island="add-to-cart"],[data-lb-cart-toggle]');
    if (hasDrawer || !needsDrawer) return;

    const drawer = document.createElement('lb-cart-drawer');
    drawer.dataset.lbIsland = 'cart-drawer';
    drawer.dataset.basePath = basePath;
    root.appendChild(drawer);
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
    }, [basePath, storeId]);

    return null;
}
