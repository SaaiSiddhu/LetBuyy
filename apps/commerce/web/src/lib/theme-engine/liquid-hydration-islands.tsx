'use client';
import { parsePickerVariants, type PickerVariant } from './variant-options-carrier';
import { VariantFactsController } from './variant-facts-controller';
import { buyerVariantUrl, buyerUrlWithVariant, uniquePickerVariant, variantFromBuyerUrl, type PickerOptionGroups } from './variant-selection-url';
import { bindMadeYoursPersonalization, createMadeYoursCartEditControls, type MadeYoursPersonalizationController } from './madeyours-personalization';
import { loadMadeYoursReviewContext, loadMadeYoursCartEditChoices } from './personalization-review-client';
import { PersonalizationCartDraftSchema, readProductFactSnapshot, type PersonalizationCartDraft, type ProductFactSnapshot } from '@letbuyy/commerce-core';
import { StorefrontCartRevisionSchema, type StorefrontConfiguredLineEdit, type StorefrontCartLineInput } from '@letbuyy/checkout-core';
import { orderItemFactsText } from '@/lib/order-fact-readback';

import { useEffect } from 'react';
import { reconcileStoredCart } from '@/lib/checkout/cart-lifecycle';
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
    variantId?: string | null;
    serverLineId?: string;
    marketplaceListingId?: string | null;
    personalization?: PersonalizationCartDraft;
    configurationFingerprint?: string | null;
    snapshotFingerprint?: string;
    nicheSnapshot?: ProductFactSnapshot;
}

type LiquidServerCartLine = {
    id?: string;
    product_id: string;
    variant_id?: string | null;
    title: string;
    image_url?: string | null;
    quantity: number;
    unit_price: number;
    currency: string;
    properties?: Record<string, unknown>;
    marketplace_listing_id?: string | null;
    personalization?: PersonalizationCartDraft;
    configuration_fingerprint?: string | null;
    snapshot_fingerprint?: string;
    niche_snapshot?: ProductFactSnapshot;
};

type LiquidServerCart = {
    id?: string;
    status?: string;
    updated_at?: string;
    edit_receipt?: { operation_key?: string };
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
    variantProductIds?: string[];
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

function cartItemVariantLabel(item: LiquidCartItem): string {
    const options = item.selectedVariant;
    if (!options || typeof options !== 'object' || Array.isArray(options)) return '';
    return Object.entries(options).filter(([, value]) => typeof value === 'string' && value.trim())
        .slice(0, 6).map(([name, value]) => `${name}: ${value}`).join(' · ');
}

function cartItemAccessibleName(item: LiquidCartItem): string {
    const variant = cartItemVariantLabel(item);
    const accepted = readProductFactSnapshot(item.nicheSnapshot)?.personalization;
    return [item.name, variant, accepted?.text].filter(Boolean).join(', ');
}

function cartConfigurationKey(item: LiquidCartItem): string {
    const draft = PersonalizationCartDraftSchema.safeParse(item.personalization);
    return JSON.stringify([item.id, item.variantId ?? null, item.marketplaceListingId ?? null,
        draft.success ? [draft.data.facts_revision, draft.data.review_fingerprint, draft.data.method_id, draft.data.style_id, draft.data.placement_id, draft.data.text] : null]);
}

function cartItemKey(item: LiquidCartItem): string { return item.serverLineId || cartConfigurationKey(item); }
function savedCartIsClosed(): boolean { const status = readServerCart()?.status; return Boolean(status && status !== 'active'); }

function cartSavedFactsMarkup(item: LiquidCartItem): string {
    const text = orderItemFactsText({ niche_snapshot: item.nicheSnapshot });
    return text ? `<small class="lb-cart__saved-facts">${escapeHtml(text)}</small>` : '';
}

function getLiquidStorefrontSubdomain(): string | null {
    const match = window.location.pathname.match(/^\/store\/([^/?#]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);

    const querySubdomain = new URLSearchParams(window.location.search).get('subdomain');
    if (querySubdomain) return querySubdomain;

    const hostname = window.location.hostname.split('.')[0];
    return hostname && !['localhost', '127', '0', 'www'].includes(hostname) ? hostname : null;
}

function liquidCartLineInputFromItem(item: LiquidCartItem): StorefrontCartLineInput {
    return {
        product_id: item.id,
        variant_id: item.variantId ?? null,
        quantity: item.quantity,
        properties: item.selectedVariant || {},
        ...(item.marketplaceListingId ? { marketplace_listing_id: item.marketplaceListingId } : {}),
        ...(item.personalization ? { personalization: PersonalizationCartDraftSchema.parse(item.personalization) } : {}),
    };
}

function liquidCartItemsFromServer(cart: LiquidServerCart): LiquidCartItem[] {
    return cart.lines.map((line) => ({
        id: line.product_id,
        variantId: line.variant_id ?? null,
        serverLineId: line.id,
        marketplaceListingId: line.marketplace_listing_id,
        ...(line.personalization && PersonalizationCartDraftSchema.safeParse(line.personalization).success ? { personalization: PersonalizationCartDraftSchema.parse(line.personalization) } : {}),
        configurationFingerprint: line.configuration_fingerprint,
        snapshotFingerprint: line.snapshot_fingerprint,
        nicheSnapshot: readProductFactSnapshot(line.niche_snapshot) ?? undefined,
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

// A command carries its original SERVER revision through the local queue and
// uncertain retry. This is a precondition, never a local version authority.
const cartMutationBases = new WeakMap<LiquidCartItem[], string | undefined>();

function mutationFromAcknowledgedCart(change: (items: LiquidCartItem[]) => LiquidCartItem[]): LiquidCartItem[] | null {
    const cart = readServerCart(), token = window.localStorage.getItem(CART_TOKEN_STORAGE_KEY);
    if (!cart || cart.cart_token !== token || !StorefrontCartRevisionSchema.safeParse(cart.updated_at).success) return null;
    const items = change(liquidCartItemsFromServer(cart)); cartMutationBases.set(items, cart.updated_at); return items;
}

async function storefrontBrowserCartFetch(subdomain: string, cartToken: string | null, items: LiquidCartItem[], expectedRevision: string | undefined) {
    return storefrontBrowserApiFetch(subdomain, cartToken ? `/cart/${cartToken}` : '/cart', {
        method: cartToken ? 'PATCH' : 'POST',
        body: JSON.stringify({
            lines: items.map(liquidCartLineInputFromItem),
            ...(cartToken && expectedRevision ? { expected_updated_at: expectedRevision } : {}),
        }),
    });
}

let activeConfiguredEdit: { host: HTMLElement; destroy(): void } | null = null;

function configuredCartEditButton(item: LiquidCartItem): string {
    return item.serverLineId && item.personalization && readProductFactSnapshot(item.nicheSnapshot)?.personalization
        ? `<${liquidButtonTag} type="button" class="my-link" data-lb-cart-edit data-cart-line-key="${escapeHtml(item.serverLineId)}" data-lb-cart-focus="edit:${escapeHtml(item.serverLineId)}" aria-label="Edit personalization for ${escapeHtml(cartItemAccessibleName(item))}">Edit personalization</${liquidButtonTag}>` : '';
}

/** Shared by the installed drawer and full-cart island. The accepted cart is
 * never optimistically changed by this flow. Unknown acknowledgement keeps
 * one frozen command/key and blocks a new intent until its receipt is known. */
export async function openMadeYoursCartEdit(host: HTMLElement, lineId: string): Promise<void> {
    if (activeConfiguredEdit) return;
    const subdomain = getLiquidStorefrontSubdomain(), token = window.localStorage.getItem(CART_TOKEN_STORAGE_KEY);
    if (!subdomain || !token || !host.isConnected) return;
    const root = document.createElement('section'); root.setAttribute('aria-label', 'Edit saved personalization');
    root.dataset.lbCartEditPanel = ''; root.className = 'my-personalization';
    const heading = document.createElement('h3'); heading.textContent = 'Edit personalization';
    const accepted = document.createElement('p');
    const originalDisplay = readCart().find(item => item.serverLineId === lineId);
    accepted.textContent = originalDisplay ? `Saved: ${cartItemAccessibleName(originalDisplay)}. Quantity ${originalDisplay.quantity}.` : 'Your saved line stays unchanged until these changes are confirmed.';
    const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.textContent = 'Loading saved configuration…';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel'; cancel.dataset.lbCartEditCancel = '';
    root.append(heading, accepted, status, cancel);
    (host.querySelector('[data-lb-cart-dialog]') || host).append(root);
    let controller: MadeYoursPersonalizationController | null = null, controls: HTMLElement | null = null;
    let save: HTMLButtonElement | null = null, variantSelect: HTMLSelectElement | null = null;
    let base: LiquidServerCart | null = null, command: StorefrontConfiguredLineEdit | null = null, busy = false, closed = false, needsFreshBase = false, acceptingReceipt = false, uncertain = false;
    const request = new AbortController();
    const ownsContext = () => !closed && host.isConnected && getLiquidStorefrontSubdomain() === subdomain
        && window.localStorage.getItem(CART_TOKEN_STORAGE_KEY) === token;
    const close = (force = false) => {
        if (closed || (!force && (busy || command))) { if (!closed) status.textContent = 'Confirm the pending saved edit before closing. Use Check saved edit.'; return; }
        closed = true; request.abort(); controller?.destroy(); root.remove();
        document.removeEventListener('click', guardNavigation, true); document.removeEventListener('keydown', escape, true);
        document.removeEventListener('cancel', escapeCancel, true); window.removeEventListener('beforeunload', beforeUnload);
        window.removeEventListener('storage', cartContextChanged); window.removeEventListener(CART_CHANGED_EVENT, cartContextChanged);
        activeConfiguredEdit = null; window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT));
        const focus = [...host.querySelectorAll<HTMLElement>('[data-lb-cart-edit]')].find(node => node.dataset.cartLineKey === lineId)
            || host.querySelector<HTMLElement>('[data-lb-cart-edit],[data-lb-cart-close],a'); focus?.focus();
    };
    const guardNavigation = (event: Event) => {
        const node = event.target instanceof Element ? event.target : null;
        if (!node || root.contains(node)) return;
        if (node.closest('a[href], [data-lb-cart-close], [data-lb-cart-toggle], [data-lb-cart-remove], [data-lb-cart-step], [data-lb-add-to-cart], [data-lb-buy-now]')) {
            event.preventDefault(); event.stopImmediatePropagation(); status.textContent = 'Finish saving or Cancel this edit before leaving or changing your cart.'; cancel.focus();
        }
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); } };
    const escapeCancel = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); close(); };
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const cartContextChanged = () => {
        if (closed || acceptingReceipt) return;
        if (!ownsContext()) { close(true); return; } // retire private draft on cart/store identity change
        if (!base || !readServerCart()?.updated_at || readServerCart()!.updated_at === base.updated_at || command) return;
        needsFreshBase = true; controller?.setBasePurchasable(false);
        status.textContent = 'Your saved cart changed in another window. This draft is preserved; reload the saved cart and review it again.';
        retry.textContent = 'Reload saved cart and review'; retry.hidden = false;
    };
    activeConfiguredEdit = { host, destroy: () => close(true) };
    cancel.addEventListener('click', () => close()); document.addEventListener('click', guardNavigation, true);
    document.addEventListener('keydown', escape, true); document.addEventListener('cancel', escapeCancel, true);
    window.addEventListener('beforeunload', beforeUnload); cancel.focus();
    const usable = (cart: LiquidServerCart | undefined): cart is LiquidServerCart => Boolean(cart && cart.cart_token === token
        && typeof cart.id === 'string' && StorefrontCartRevisionSchema.safeParse(cart.updated_at).success && Array.isArray(cart.lines)
        && cart.lines.every(line => line && typeof line.id === 'string' && typeof line.product_id === 'string'
            && Number.isSafeInteger(line.quantity) && line.quantity > 0 && Number.isFinite(line.unit_price)));
    const readBase = async () => {
        const response = await storefrontBrowserApiFetch(subdomain, `/cart/${encodeURIComponent(token)}`, { cache: 'no-store', signal: request.signal });
        const payload = await readStorefrontApiJson<LiquidServerCart>(response);
        if (!response.ok || !payload.success || !usable(payload.data) || payload.data.status !== 'active' || !ownsContext()) throw new Error('Saved cart unavailable');
        if (base && payload.data.id !== base.id) throw new Error('Cart identity changed');
        return payload.data;
    };
    const freeze = (value: boolean) => {
        controls?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input, select, button').forEach(node => { node.disabled = value; });
        if (variantSelect) variantSelect.disabled = value;
        cancel.disabled = value;
    };
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Reload saved cart and review'; retry.hidden = true;
    retry.dataset.lbCartEditRetry = ''; root.insertBefore(retry, cancel);
    window.addEventListener('storage', cartContextChanged); window.addEventListener(CART_CHANGED_EVENT, cartContextChanged);
    retry.addEventListener('click', () => {
        if (command) { void submit(); return; }
        retry.disabled = true;
        void readBase().then(cart => {
            base = cart;
            if (!cart.lines.some(line => line.id === lineId)) { status.textContent = 'The original line was changed or removed. Cancel to return to your current cart.'; return; }
            needsFreshBase = false;
            controller?.setBasePurchasable(Boolean(variantSelect?.selectedOptions[0] && !variantSelect.selectedOptions[0].disabled));
            controller?.invalidateReview('Your draft is preserved. Review it again against the saved cart.'); retry.hidden = true;
        }).catch(() => { status.textContent = 'Saved cart is unavailable. Your draft and saved line are preserved.'; }).finally(() => { retry.disabled = false; });
    });
    const submit = async () => {
        if (busy || !ownsContext() || !base || !save) return;
        if (!command) {
            const draft = controller?.readReviewedCartDraft(); if (needsFreshBase || !draft || !variantSelect) return;
            command = { operation_key: crypto.randomUUID(), expected_updated_at: base.updated_at!, line_id: lineId,
                replacement: { variant_id: variantSelect.value || null, personalization: draft } };
            uncertain = false;
        }
        busy = true; freeze(true); retry.hidden = true; status.textContent = 'Saving reviewed changes…';
        const sent = command;
        try {
            const response = await storefrontBrowserApiFetch(subdomain, `/cart/${encodeURIComponent(token)}`, {
                method: 'PATCH', body: JSON.stringify({ line_edit: sent }), cache: 'no-store', signal: request.signal,
            });
            const payload = await readStorefrontApiJson<LiquidServerCart>(response);
            if (!ownsContext()) return;
            if (response.ok && payload.success && usable(payload.data) && payload.data.id === base.id
                && payload.data.edit_receipt?.operation_key === sent.operation_key) {
                command = null; busy = false;
                acceptingReceipt = true; writeServerCart(payload.data); writeCart(liquidCartItemsFromServer(payload.data), { sync: false }); acceptingReceipt = false;
                close(true);
                // Existing capability-bound lifecycle owns converted-order retirement.
                // A closed cart without that proof remains closed, never reopened.
                if (payload.data.status !== 'active') void reconcileStoredCart(subdomain);
                return;
            }
            if (response.status >= 400 && response.status < 500) {
                const code = typeof payload.error === 'object' && payload.error?.code;
                const knownRefusal = typeof code === 'string' && !['CART_EDIT_RECONCILIATION_REQUIRED', 'CART_EDIT_INTENT_CONFLICT'].includes(code)
                    && /^(?:CART_|PERSONALIZATION_|VARIANT_|PRODUCT_|INSUFFICIENT_INVENTORY$|UNAUTHORIZED$|VALIDATION$)/.test(code);
                // An auth/refusal on a recovery read does not disprove the
                // earlier commit. Keep its exact command until acknowledged.
                if (uncertain || !knownRefusal) throw new Error('Original acknowledgement still unknown');
                command = null; needsFreshBase = true; freeze(false); controller?.setBasePurchasable(false);
                controller?.invalidateReview('This edit was not accepted. Your draft and saved line are preserved.');
                if (save) save.disabled = true;
                status.textContent = response.status === 401 ? 'Sign in at this store, then reload the saved cart and review this draft.' : 'The saved cart or choices changed. Reload the saved cart and review this draft again.';
                retry.textContent = 'Reload saved cart and review'; retry.hidden = false; return;
            }
            throw new Error('Acknowledgement unknown');
        } catch {
            if (!ownsContext()) return;
            uncertain = true;
            status.textContent = 'We could not confirm this save. Your original line and draft remain here. If sign-in expired, sign in in another tab, then check the same saved edit.';
            retry.textContent = 'Check saved edit'; retry.hidden = false; retry.focus();
        } finally { busy = false; retry.disabled = false; }
    };
    try {
        if (cartSyncQueue) await cartSyncQueue;
        if (!ownsContext()) return;
        base = await readBase();
        const line = base.lines.find(row => row.id === lineId);
        if (!line?.personalization) throw new Error('Saved configuration unavailable');
        const [choices, context] = await Promise.all([
            loadMadeYoursCartEditChoices(subdomain, line.product_id, request.signal),
            loadMadeYoursReviewContext(subdomain, line.product_id, line.variant_id ?? null, request.signal).catch(() => null),
        ]);
        if (!ownsContext()) return;
        const facts = context?.facts || choices?.facts; if (!facts) throw new Error('Current personalization choices unavailable');
        controls = createMadeYoursCartEditControls(document, line.product_id, facts);
        root.insertBefore(controls, retry);
        const label = document.createElement('label'); label.textContent = 'Product option'; variantSelect = document.createElement('select'); variantSelect.dataset.lbCartEditVariant = ''; label.append(variantSelect); root.insertBefore(label, controls);
        const variants = choices?.variants || [];
        if (!variants.length && !line.variant_id) { const option = document.createElement('option'); option.value = ''; option.textContent = line.title; variantSelect.append(option); }
        for (const variant of variants) {
            if (!variant.id) continue; const option = document.createElement('option'); option.value = variant.id;
            option.textContent = variant.label || Object.values(variant.options || {}).join(' · ') || 'Product option';
            option.disabled = (variant.stock ?? variant.stock_quantity ?? variant.inventory_qty ?? 0) < 1; variantSelect.append(option);
        }
        if (line.variant_id && ![...variantSelect.options].some(option => option.value === line.variant_id)) {
            const option = document.createElement('option'); option.value = line.variant_id; option.textContent = 'Saved option is unavailable'; option.disabled = true; variantSelect.prepend(option);
        }
        variantSelect.value = line.variant_id || '';
        let initialContext = context;
        controller = bindMadeYoursPersonalization(controls, { loadReviewContext: (variant, signal) => {
            if (initialContext?.variant_id === variant) { const value = initialContext; initialContext = null; return Promise.resolve(value); }
            return loadMadeYoursReviewContext(subdomain, line.product_id, variant, signal);
        } });
        if (!controller) throw new Error('Personalization controls unavailable');
        controller.restoreDraft(line.personalization);
        const select = () => { const selected = variantSelect!.selectedOptions[0]; controller!.setSelection(variantSelect!.value || null, Boolean(selected && !selected.disabled)); };
        variantSelect.addEventListener('change', select); select();
        save = controls.querySelector<HTMLButtonElement>('[data-lb-add-to-cart]'); save?.addEventListener('click', () => { void submit(); });
        status.textContent = 'Your saved configuration remains unchanged. Specify, Review, then save your changes.';
        controls.querySelector<HTMLInputElement>('[data-lb-personalization-text]')?.focus();
    } catch {
        if (!ownsContext()) return;
        status.textContent = 'Saved configuration or current choices are unavailable. Your saved cart is unchanged. Cancel and try again.';
    }
}

let cartSyncQueue: Promise<boolean> | null = null;

function syncLiquidCartToServer(items: LiquidCartItem[], onFailure?: (code: string, status?: number) => void): Promise<boolean> {
    const subdomain = getLiquidStorefrontSubdomain();
    const expectedRevision = cartMutationBases.get(items);
    const run = () => getLiquidStorefrontSubdomain() === subdomain ? performLiquidCartSync(items, onFailure, expectedRevision) : Promise.resolve(false);
    const task = cartSyncQueue ? cartSyncQueue.then(run, run) : run();
    cartSyncQueue = task;
    const clear = () => { if (cartSyncQueue === task) cartSyncQueue = null; };
    void task.then(clear, clear);
    return task;
}

async function performLiquidCartSync(items: LiquidCartItem[], onFailure?: (code: string, status?: number) => void, expectedRevision?: string): Promise<boolean> {
    const subdomain = getLiquidStorefrontSubdomain();
    if (!subdomain) return false;
    const expectedItems = JSON.stringify(items);
    if (window.localStorage.getItem(CART_STORAGE_KEY) !== expectedItems) return false;

    const reconciliation = reconcileStoredCart(subdomain);
    if (reconciliation) {
        const outcome = await reconciliation;
        if (outcome === 'retired') return false;
        if (outcome === 'unavailable') return false;
    }
    const cartToken = window.localStorage.getItem(CART_TOKEN_STORAGE_KEY);
    try {
        const response = await storefrontBrowserCartFetch(subdomain, cartToken, items, expectedRevision);
        const payload = await readStorefrontApiJson<LiquidServerCart>(response);
        if (!response.ok || !payload.success || !payload.data
            || typeof payload.data.cart_token !== 'string' || !payload.data.cart_token.trim()) {
            if (getLiquidStorefrontSubdomain() === subdomain && window.localStorage.getItem(CART_TOKEN_STORAGE_KEY) === cartToken) {
                onFailure?.(typeof payload.error === 'object' && payload.error?.code ? payload.error.code : 'CART_UNAVAILABLE', response.status);
            }
            return false;
        }

        if (getLiquidStorefrontSubdomain() !== subdomain || window.localStorage.getItem(CART_TOKEN_STORAGE_KEY) !== cartToken) return false;
        // A newer local mutation keeps its own lines; subsequent queued sync uses this receipt's token.
        window.localStorage.setItem(CART_TOKEN_STORAGE_KEY, payload.data.cart_token);
        if (window.localStorage.getItem(CART_STORAGE_KEY) !== expectedItems) return false;
        writeServerCart(payload.data);
        writeCart(liquidCartItemsFromServer(payload.data), { sync: false });
        return true;
    } catch {
        // Browser cart remains available from local storage while sync retries on the next mutation.
        return false;
    }
}

function writeCart(items: LiquidCartItem[], options: { sync?: boolean } = {}) {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT, { detail: { items } }));
    if (options.sync) void syncLiquidCartToServer(items);
}

function addCartItem(item: LiquidCartItem, options: { sync?: boolean; openDrawer?: boolean } = {}): LiquidCartItem[] {
    const server = readServerCart();
    const items = server && server.cart_token === window.localStorage.getItem(CART_TOKEN_STORAGE_KEY)
        ? liquidCartItemsFromServer(server) : readCart();
    cartMutationBases.set(items, server?.updated_at);
    const existingIndex = items.findIndex((candidate) => cartConfigurationKey(candidate) === cartConfigurationKey(item));

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

    if (options.sync === false) writeCart(items, { sync: false });
    else writeCart(items, { sync: true });
    if (options.openDrawer !== false) window.dispatchEvent(new CustomEvent(CART_OPEN_EVENT, { detail: { source: 'liquid-add-to-cart' } }));
    return items;
}

function inferBasePath(): string {
    const match = window.location.pathname.match(/^\/store\/[^/]+/);
    return match?.[0] || '';
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
    const selected = Object.create(null) as Record<string, string>;
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

    const picker = sectionRoot.querySelector<HTMLElement>('lb-variant-picker');
    let variant: PickerVariant | undefined;
    if (picker) {
        const variants = parsePickerVariants(picker.dataset.variants);
        if (!variants.length) return null;
        const groups = new Set(Array.from(picker.querySelectorAll<HTMLElement>('[data-lb-variant-option]')).map(option => option.dataset.variantName));
        if (variants.length && (!groups.size || !Array.from(groups).every(name => name && selectedVariant[name]))) return null;
        variant = variants.find(row => row.options && Object.entries(selectedVariant).every(([name, value]) => row.options![name] === value));
        if (variants.length && (!variant?.id || (variant.stock ?? variant.stock_quantity ?? variant.inventory_qty ?? 0) <= 0)) return null;
    }

    const image = element.dataset.productImage || '';
    return {
        id,
        name: element.dataset.productName || 'Product',
        price: variant?.price ?? numericDatasetValue(element.dataset.productPrice, 0),
        variantId: variant?.id ?? null,
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
    private productFacts: VariantFactsController | null = null;
    private personalization: MadeYoursPersonalizationController | null = null;
    private personalizationSection: HTMLElement | null = null;
    private retryPersonalization: { key: string; items: LiquidCartItem[]; before: LiquidCartItem[] } | null = null;
    private checkoutPending = false;
    private genericAddAttempt = 0;
    private retryGenericAdd: { key: string; items: LiquidCartItem[]; before: LiquidCartItem[] } | null = null;
    private readonly handleSelectionChange = (event: Event) => {
        if (event.target instanceof Element && event.target.closest('lb-variant-picker')) this.refreshPersonalizationSelection();
    };

    refreshPersonalizationSelection() {
        if (!this.personalization) return;
        const item = cartItemFromElement(this);
        this.personalization.setSelection(item?.variantId ?? null, Boolean(item));
    }

    static get observedAttributes() { return ['data-product-id']; }
    attributeChangedCallback(_name: string, previous: string | null, current: string | null) {
        if (previous !== current && this.isConnected && this.personalization) this.bindPersonalization();
    }

    private bindPersonalization() {
        this.personalization?.destroy(); this.retryPersonalization = null;
        const subdomain = getLiquidStorefrontSubdomain(), productId = this.dataset.productId;
        this.personalization = bindMadeYoursPersonalization(this, {
            loadReviewContext: (variantId, signal) => subdomain && productId ? loadMadeYoursReviewContext(subdomain, productId, variantId, signal) : Promise.resolve(null),
        });
        this.refreshPersonalizationSelection();
    }
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
        if (this.closest('[data-catalog-demo-read-only="true"],[data-catalog-demo-inert]')) return;
        this.addEventListener('click', this.handleClick);
        this.addEventListener('submit', this.handleSubmit);
        const section = this.closest<HTMLElement>('[data-section-id]');
        if (section && this.dataset.productId && !section.querySelector('lb-variant-picker')) {
            this.productFacts = new VariantFactsController(section, this.dataset.productId, this.dataset.productCurrency || 'INR', [], true);
        }
        this.bindPersonalization();
        if (this.personalization) {
            this.personalizationSection = section;
            section?.addEventListener('click', this.handleSelectionChange);
            section?.addEventListener('change', this.handleSelectionChange);
        }
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.handleClick);
        this.removeEventListener('submit', this.handleSubmit);
        this.productFacts?.dispose();
        this.productFacts = null;
        this.personalizationSection?.removeEventListener('click', this.handleSelectionChange);
        this.personalizationSection?.removeEventListener('change', this.handleSelectionChange);
        this.personalizationSection = null;
        this.personalization?.destroy(); this.personalization = null;
        this.retryPersonalization = null;
        this.retryGenericAdd = null;
        this.genericAddAttempt++;
    }

    private async addCurrentProduct(options: { redirectToCheckout?: boolean } = {}) {
        if (this.checkoutPending || this.closest('[data-catalog-demo-read-only="true"],[data-catalog-demo-inert]')) return;
        if (this.dataset.productRequiresOptions === 'true') {
            if (this.dataset.productUrl) window.location.assign(this.dataset.productUrl);
            return;
        }
        const item = cartItemFromElement(this);
        const status = this.querySelector<HTMLElement>('[data-lb-add-to-cart-status]');
        if (!item) {
            if (status) status.textContent = 'Product unavailable';
            return;
        }
        if (this.dataset.lbPersonalizationRequired === 'true') {
            const draft = this.personalization?.readReviewedCartDraft();
            if (!draft) { if (status) status.textContent = 'Review your current personalization details before adding to cart.'; return; }
            item.personalization = draft;
            this.checkoutPending = true;
            const button = this.querySelector<HTMLButtonElement>('[data-lb-add-to-cart]');
            if (button) button.disabled = true;
            try {
                const subdomain = getLiquidStorefrontSubdomain();
                const reconciliation = subdomain ? reconcileStoredCart(subdomain) : null;
                if (reconciliation && await reconciliation === 'unavailable') {
                    if (status) status.textContent = 'We could not check your previous checkout. Please try again.';
                    return;
                }
                if (!this.isConnected || !this.personalization?.readReviewedCartDraft()) return;
                const key = JSON.stringify([cartConfigurationKey(item), item.quantity]), currentItems = readCart();
                const retry = this.retryPersonalization;
                const reuse = retry?.key === key && JSON.stringify(retry.items) === JSON.stringify(currentItems);
                const previous = reuse ? retry.before : currentItems;
                const items = reuse ? retry.items : addCartItem(item, { sync: false, openDrawer: false });
                this.retryPersonalization = { key, items, before: previous };
                let failureCode = '';
                if (!await syncLiquidCartToServer(items, code => { failureCode = code; })) {
                    if (failureCode.startsWith('PERSONALIZATION_') || ['INSUFFICIENT_INVENTORY', 'VARIANT_NOT_FOUND', 'PRODUCT_NOT_FOUND'].includes(failureCode)) {
                        if (JSON.stringify(readCart()) === JSON.stringify(items)) writeCart(previous, { sync: false });
                        this.retryPersonalization = null;
                        this.personalization?.refreshReviewContext('Personalization choices changed. Review your details again.');
                    }
                    if (status && this.isConnected) status.textContent = 'We could not save this configuration. Review any updated choices and try again.';
                    return;
                }
                this.retryPersonalization = null;
                if (!this.isConnected) return;
                if (status) status.textContent = 'Added';
                if (options.redirectToCheckout) window.location.assign(`${this.dataset.basePath ?? inferBasePath()}/checkout`);
                else window.dispatchEvent(new CustomEvent(CART_OPEN_EVENT, { detail: { source: 'liquid-add-to-cart' } }));
            } finally { this.checkoutPending = false; this.refreshPersonalizationSelection(); }
            return;
        }

        const attempt = ++this.genericAddAttempt;
        const subdomain = getLiquidStorefrontSubdomain();
        const button = options.redirectToCheckout ? this.querySelector<HTMLButtonElement>('[data-lb-buy-now]') : null;
        if (options.redirectToCheckout) this.checkoutPending = true;
        if (button) button.disabled = true;
        this.removeAttribute('data-lb-added');
        if (status) status.textContent = 'Saving…';
        try {
            // Reuse the canonical queue and receipt. Neither purchase action opens
            // checkout/the drawer or announces success while its write is pending.
            const reconciliation = subdomain ? reconcileStoredCart(subdomain) : null;
            if (reconciliation && await reconciliation === 'unavailable') {
                if (status && attempt === this.genericAddAttempt) status.textContent = 'We could not check your previous checkout. Please try again.';
                return;
            }
            if (!this.isConnected || getLiquidStorefrontSubdomain() !== subdomain) return;
            const key = JSON.stringify([cartConfigurationKey(item), item.quantity]);
            const currentItems = readCart(), retry = this.retryGenericAdd;
            const reuse = retry?.key === key && JSON.stringify(retry.items) === JSON.stringify(currentItems);
            const before = reuse ? retry.before : currentItems;
            const items = reuse ? retry.items : addCartItem(item, { sync: false, openDrawer: false });
            this.retryGenericAdd = null;
            let failureStatus = 0;
            const accepted = await syncLiquidCartToServer(items, (_code, responseStatus) => { failureStatus = responseStatus ?? 0; });
            if (!this.isConnected || attempt !== this.genericAddAttempt || getLiquidStorefrontSubdomain() !== subdomain) return;
            if (!accepted) {
                // A definite rejection discards only this unchanged optimistic
                // draft. An uncertain transport result is retried as a replacement
                // of the same lines, never as a second quantity increment.
                if (JSON.stringify(readCart()) === JSON.stringify(items)) {
                    if (failureStatus >= 400 && failureStatus < 500) writeCart(before, { sync: false });
                    else this.retryGenericAdd = { key, items, before };
                }
                if (status) status.textContent = failureStatus === 409
                    ? 'This quantity or selection is no longer available. Check your choices and try again.'
                    : options.redirectToCheckout ? 'We could not prepare checkout. Please try again.'
                        : 'We could not save your cart. Check your choices and try again.';
                return;
            }
            this.retryGenericAdd = null;
            if (status) status.textContent = 'Added';
            this.setAttribute('data-lb-added', 'true');
            if (options.redirectToCheckout) window.location.assign(`${this.dataset.basePath ?? inferBasePath()}/checkout`);
            else window.dispatchEvent(new CustomEvent(CART_OPEN_EVENT, { detail: { source: 'liquid-add-to-cart' } }));
            window.setTimeout(() => {
                if (attempt !== this.genericAddAttempt || !this.isConnected) return;
                if (status) status.textContent = '';
                this.removeAttribute('data-lb-added');
            }, 1800);
        } catch {
            if (status && this.isConnected && attempt === this.genericAddAttempt) status.textContent = 'We could not save your cart. Please try again.';
        } finally {
            if (options.redirectToCheckout) this.checkoutPending = false;
            if (button) button.disabled = false;
        }
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
    private opener: HTMLElement | null = null;

    private readonly handleOpen = () => {
        this.setOpen(true);
    };

    private readonly handleCartChanged = () => {
        this.render();
    };

    private readonly handleCancel = (event: Event) => {
        if (event.target instanceof Element && event.target.matches('[data-lb-cart-dialog]')) {
            event.preventDefault();
            this.setOpen(false);
        }
    };

    private readonly handleClick = (event: Event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        if (target.matches('[data-lb-cart-dialog]')) {
            const pointer = event as MouseEvent;
            const bounds = target.getBoundingClientRect();
            if (pointer.clientX < bounds.left || pointer.clientX > bounds.right || pointer.clientY < bounds.top || pointer.clientY > bounds.bottom) this.setOpen(false);
            return;
        }

        if (target.closest('[data-lb-cart-close]')) {
            this.setOpen(false);
            return;
        }

        if (target.closest('[data-lb-cart-toggle]')) {
            this.setOpen(!this.open);
            return;
        }

        const editButton = target.closest<HTMLElement>('[data-lb-cart-edit]');
        if (editButton?.dataset.cartLineKey) { event.preventDefault(); void openMadeYoursCartEdit(this, editButton.dataset.cartLineKey); return; }

        const removeButton = target.closest<HTMLElement>('[data-lb-cart-remove]');
        if (removeButton?.dataset.cartLineKey) {
            const items = mutationFromAcknowledgedCart(lines => lines.filter(item => cartItemKey(item) !== removeButton.dataset.cartLineKey));
            if (items) writeCart(items, { sync: true });
        }
    };

    connectedCallback() {
        this.addEventListener('click', this.handleClick);
        this.addEventListener('cancel', this.handleCancel, true);
        window.addEventListener(CART_OPEN_EVENT, this.handleOpen);
        window.addEventListener(CART_CHANGED_EVENT, this.handleCartChanged);
        window.addEventListener('storage', this.handleCartChanged);
        this.render();
    }

    disconnectedCallback() {
        if (activeConfiguredEdit?.host === this) activeConfiguredEdit.destroy();
        if (this.open) this.setOpen(false);
        this.removeEventListener('click', this.handleClick);
        this.removeEventListener('cancel', this.handleCancel, true);
        window.removeEventListener(CART_OPEN_EVENT, this.handleOpen);
        window.removeEventListener(CART_CHANGED_EVENT, this.handleCartChanged);
        window.removeEventListener('storage', this.handleCartChanged);
    }

    private setOpen(value: boolean) {
        if (value && !this.open) this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.open = value;
        if (value) {
            void this.refreshSavedCart();
        }
        this.render();
        if (!value) {
            if (this.opener?.isConnected) this.opener.focus();
            this.opener = null;
        }
    }

    private async refreshSavedCart() {
        if (cartSyncQueue) await cartSyncQueue;
        const subdomain = getLiquidStorefrontSubdomain(), token = window.localStorage.getItem(CART_TOKEN_STORAGE_KEY);
        if (!subdomain || !token || !this.open) return;
        try {
            const response = await storefrontBrowserApiFetch(subdomain, `/cart/${encodeURIComponent(token)}`, { cache: 'no-store' });
            const payload = await readStorefrontApiJson<LiquidServerCart>(response);
            if (!this.isConnected || !this.open || getLiquidStorefrontSubdomain() !== subdomain || window.localStorage.getItem(CART_TOKEN_STORAGE_KEY) !== token) return;
            if (!response.ok || !payload.success || !payload.data || payload.data.cart_token !== token || !Array.isArray(payload.data.lines)) return;
            writeServerCart(payload.data); writeCart(liquidCartItemsFromServer(payload.data), { sync: false });
        } catch { /* An unavailable read never writes an old local cart to the server. */ }
    }

    private render() {
        if (activeConfiguredEdit?.host === this) return;
        const previousDialog = this.querySelector<HTMLDialogElement>('[data-lb-cart-dialog]');
        const active = document.activeElement instanceof HTMLElement && previousDialog?.contains(document.activeElement) ? document.activeElement : null;
        const focusKey = active?.dataset.lbCartFocus;
        if (previousDialog?.open) previousDialog.close();
        const items = readCart();
        const serverCart = readServerCart();
        const basePath = this.dataset.basePath || inferBasePath();
        const rows = items.length === 0
            ? '<p class="lb-liquid-cart__empty">Your bag is empty.</p>'
            : items.map((item) => [
                '<div class="lb-liquid-cart__item">',
                `<span>${escapeHtml(item.name)}<small class="lb-liquid-cart__variant">${escapeHtml(cartItemVariantLabel(item))}</small>${cartSavedFactsMarkup(item)}${configuredCartEditButton(item)}</span>`,
                `<span>x${item.quantity}</span>`,
                `<${liquidButtonTag} type="button" data-lb-cart-remove data-cart-line-key="${escapeHtml(cartItemKey(item))}" data-lb-cart-focus="${escapeHtml(cartItemKey(item))}" data-product-id="${escapeHtml(item.id)}" data-variant-id="${escapeHtml(item.variantId || '')}" aria-label="Remove ${escapeHtml(cartItemAccessibleName(item))}">Remove</${liquidButtonTag}>`,
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
            '.lb-liquid-cart__panel{position:fixed;inset:0 0 0 auto;z-index:100;box-sizing:border-box;width:min(420px,100%);max-width:100%;height:100dvh;max-height:100dvh;margin:0;border:0;padding:20px;background:var(--card-bg,rgb(255 255 255));color:var(--card-text,rgb(17 24 39));box-shadow:0 20px 60px rgba(15,23,42,.28);overflow:auto}',
            '.lb-liquid-cart__panel::backdrop{background:rgba(0,0,0,.35)}',
            '.lb-liquid-cart__panel :focus-visible{outline:2px solid var(--tl-focus-color,var(--lb-color-focus-ring));outline-offset:3px}',
            '.lb-liquid-cart__item{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border-color,rgb(229 231 235))}',
            '.lb-liquid-cart__variant{display:block;overflow-wrap:anywhere}',
            '.lb-cart__saved-facts{display:block;white-space:pre-line;overflow-wrap:anywhere;font-weight:400}',
            '.lb-liquid-cart__footer{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-top:20px}',
            '.lb-liquid-cart__checkout{min-height:44px;display:inline-flex;align-items:center;padding:0 16px;border-radius:8px;background:var(--primary,rgb(0 179 179));color:rgb(255 255 255);text-decoration:none;font-weight:700}',
            '.lb-liquid-cart__totals{margin-top:16px;display:grid;gap:6px}',
            '.lb-liquid-cart__row{display:flex;justify-content:space-between;gap:12px;font-size:.95rem}',
            '.lb-liquid-cart__row--total{margin-top:6px;padding-top:10px;border-top:1px solid var(--border-color,rgb(229 231 235));font-weight:700;font-size:1.05rem}',
            '.lb-liquid-cart__pending{margin-top:16px;color:var(--text-secondary,rgb(107 114 128))}',
            '.lb-liquid-cart__close{min-height:44px;min-width:44px;}',
            '.lb-liquid-cart__view-cart{min-height:44px;display:inline-flex;align-items:center;font-weight:700;}',
            '</style>',
            '<dialog data-lb-cart-dialog class="lb-liquid-cart__panel" role="dialog" aria-modal="true" aria-label="Shopping cart">',
            `<${liquidButtonTag} type="button" data-lb-cart-close data-lb-cart-focus="close" class="lb-liquid-cart__close" aria-label="Close cart">Close</${liquidButtonTag}>`,
            '<h2>Cart</h2>',
            rows,
            items.length > 0 ? renderLiquidCartTotals(serverCart) : '',
            '<div class="lb-liquid-cart__footer">',
            `<a class="lb-liquid-cart__view-cart" data-lb-cart-focus="view" href="${escapeHtml(basePath)}/cart">View cart</a>`,
            savedCartIsClosed() ? '<span role="status">This saved cart is closed.</span>' : `<a class="lb-liquid-cart__checkout" data-lb-cart-focus="checkout" href="${escapeHtml(basePath)}/checkout">Checkout</a>`,
            '</div>',
            '</dialog>',
        ].join('');
        const dialog = this.querySelector<HTMLDialogElement>('[data-lb-cart-dialog]');
        if (this.open && this.isConnected && dialog) {
            // Native modal behavior supplies background inertness, Tab containment and Escape.
            // A browser without it still has the ordinary full cart route.
            if (typeof dialog.showModal !== 'function') {
                this.open = false;
                window.location.assign(`${basePath}/cart`);
                return;
            }
            dialog.showModal();
            const retained = focusKey ? Array.from(dialog.querySelectorAll<HTMLElement>('[data-lb-cart-focus]')).find(element => element.dataset.lbCartFocus === focusKey) : null;
            (retained ?? dialog.querySelector<HTMLElement>('[data-lb-cart-close]'))?.focus();
        }
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

    private get basePath(): string {
        return this.dataset.basePath || inferBasePath();
    }

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
            const suggestUrl = `/api${this.basePath}/search-suggest?q=${encodeURIComponent(query)}`;
            const response = await fetch(suggestUrl, { signal: this.abortController.signal });
            if (!response.ok) {
                this.renderUnavailable();
                return;
            }
            const payload = await response.json() as { results?: PredictiveSearchSuggestion[] };
            this.renderResults(Array.isArray(payload.results) ? payload.results : [], query, false);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            this.renderUnavailable();
        }
    }

    private renderUnavailable() {
        this.results = [];
        this.selectedIndex = -1;
        this.input?.removeAttribute('aria-activedescendant');
        this.input?.setAttribute('aria-expanded', 'false');
        if (this.resultsEl) this.resultsEl.innerHTML = '<p class="lb-predictive-search__empty" role="status">Search suggestions are unavailable. Use Search to view results.</p>';
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

// T6/W3 — real variant availability, not merely a picker that always looks selectable.
// `data-variants` carries the same product.variants array the drop already resolves (real
// stock/stock_quantity/inventory_qty per-variant, per commerce-core's ProductVariant shape),
// serialized via the existing `| json` Liquid filter (already auto-HTML-escaped by this engine's
// outputEscape setting — confirmed live, the same mechanism data-product-name already relies on
// for embedding a quoted string inside an attribute). No new data source, no new endpoint.
class LbVariantPickerElement extends LiquidIslandBase {
    private variants: PickerVariant[] = [];
    private facts: VariantFactsController | null = null;
    private urlPath: string | null = null;
    private readonly handlePopState = () => { if (this.ownsBuyerUrl()) this.restoreUrlSelection(); };

    private readonly handleClick = (event: Event) => {
        const target = event.target instanceof Element ? event.target : null;
        const option = target?.closest<HTMLElement>('[data-lb-variant-option]');
        if (!option) return;

        event.preventDefault();
        this.selectOption(option);
    };

    private readonly handleChange = () => {
        this.applyAvailability();
        this.syncVariantUrl();
        window.dispatchEvent(new CustomEvent(VARIANT_CHANGED_EVENT, { detail: selectedVariantsFrom(this) }));
    };

    connectedCallback() {
        this.variants = parsePickerVariants(this.dataset.variants);
        const section = this.closest<HTMLElement>('[data-section-id]');
        if (section && this.dataset.productId) {
            this.facts = new VariantFactsController(section, this.dataset.productId, section.querySelector<HTMLElement>('lb-add-to-cart')?.dataset.productCurrency || 'INR', this.variants);
        }
        this.addEventListener('click', this.handleClick);
        this.addEventListener('change', this.handleChange);
        const url = this.dataset.productId ? buyerVariantUrl(window.location.href, this.dataset.productId) : null;
        this.urlPath = url ? url.origin + url.pathname : null;
        // Ownership may become unique after another picker disconnects; each event still checks it.
        if (this.urlPath) window.addEventListener('popstate', this.handlePopState);
        if (this.ownsBuyerUrl()) {
            this.restoreUrlSelection();
        } else this.applyAvailability();
    }

    disconnectedCallback() {
        this.removeEventListener('click', this.handleClick);
        this.removeEventListener('change', this.handleChange);
        window.removeEventListener('popstate', this.handlePopState);
        this.urlPath = null;
        this.facts?.dispose();
        this.facts = null;
    }

    private selectOption(option: HTMLElement) {
        if (!this.setOption(option)) return;
        this.applyAvailability();
        this.syncVariantUrl();
        window.dispatchEvent(new CustomEvent(VARIANT_CHANGED_EVENT, { detail: selectedVariantsFrom(this) }));
    }

    private optionElements() {
        return [...this.querySelectorAll<HTMLElement>('[data-lb-variant-option]')].filter(element => element.closest('lb-variant-picker') === this);
    }

    private optionGroups(): PickerOptionGroups {
        const groups = new Map<string, Set<string>>();
        for (const element of this.optionElements()) {
            const name = element.dataset.variantName, value = element.dataset.variantValue;
            if (!name || !value) continue;
            if (!groups.has(name)) groups.set(name, new Set());
            groups.get(name)!.add(value);
        }
        return groups;
    }

    private ownsBuyerUrl() {
        if (!this.urlPath || !this.dataset.productId || this.closest('[data-catalog-demo-read-only],[data-catalog-demo-inert]')) return false;
        const url = buyerVariantUrl(window.location.href, this.dataset.productId);
        if (!url || url.origin + url.pathname !== this.urlPath) return false;
        const owners = [...document.querySelectorAll<HTMLElement>('lb-variant-picker')].filter(element => element.dataset.productId?.toLowerCase() === this.dataset.productId!.toLowerCase() && !element.closest('[data-catalog-demo-read-only],[data-catalog-demo-inert]'));
        return owners.length === 1 && owners[0] === this;
    }

    private restoreUrlSelection() {
        if (!this.dataset.productId) return;
        const variant = variantFromBuyerUrl(window.location.href, this.dataset.productId, this.variants, this.optionGroups());
        for (const option of this.optionElements()) option.setAttribute('aria-pressed', 'false');
        for (const input of this.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[name^="variant["]')) {
            if (input.closest('lb-variant-picker') !== this) continue;
            if (input.tagName === 'INPUT' && input.getAttribute('type') === 'hidden') input.remove();
            else input.value = '';
        }
        if (variant?.options) for (const [name, value] of Object.entries(variant.options)) {
            const option = this.optionElements().find(element => element.dataset.variantName === name && element.dataset.variantValue === value);
            if (option) this.setOption(option);
        }
        this.applyAvailability();
        window.dispatchEvent(new CustomEvent(VARIANT_CHANGED_EVENT, { detail: selectedVariantsFrom(this) }));
    }

    private syncVariantUrl() {
        if (!this.ownsBuyerUrl() || !this.dataset.productId) return;
        const match = uniquePickerVariant(this.variants, this.optionGroups(), selectedVariantsFrom(this));
        const next = buyerUrlWithVariant(window.location.href, this.dataset.productId, match?.id || null);
        if (next && next !== window.location.href) window.history.replaceState(window.history.state, '', next);
    }

    private setOption(option: HTMLElement): boolean {
        if (option.closest('lb-variant-picker') !== this) return false;
        const name = option.dataset.variantName;
        const value = option.dataset.variantValue;
        if (!name || !value) return false;

        this.optionElements().filter(candidate => candidate.dataset.variantName === name)
            .forEach((candidate) => candidate.setAttribute('aria-pressed', candidate === option ? 'true' : 'false'));

        let hiddenInput = this.querySelector<HTMLInputElement>(`input[name="variant[${CSS.escape(name)}]"]`);
        if (!hiddenInput) {
            hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = `variant[${name}]`;
            this.appendChild(hiddenInput);
        }
        hiddenInput.value = value;
        return true;
    }

    // Only judges availability once every option group has a selection — a partial selection
    // (e.g. Size chosen, Colour not yet) cannot honestly be marked available or unavailable.
    private applyAvailability() {
        if (this.variants.length === 0) {
            const status = this.querySelector<HTMLElement>('[data-lb-variant-status]');
            if (status) status.textContent = 'Product options are unavailable. Reload and try again.';
            this.facts?.update(null, 'unknown');
            this.dispatchAvailability(false);
            return;
        }
        const optionGroups = new Set(
            Array.from(this.querySelectorAll<HTMLElement>('[data-lb-variant-option]')).map((el) => el.dataset.variantName),
        );
        const selected = selectedVariantsFrom(this);
        const fullySelected = optionGroups.size > 0 && Array.from(optionGroups).every((name) => name && selected[name]);

        const status = this.querySelector<HTMLElement>('[data-lb-variant-status]');
        if (!fullySelected) {
            if (status) status.textContent = 'Choose your options';
            this.facts?.update(null, 'incomplete');
            this.dispatchAvailability(false);
            return;
        }

        const match = uniquePickerVariant(this.variants, this.optionGroups(), selected);
        const stock = match ? (match.stock ?? match.stock_quantity ?? match.inventory_qty ?? 0) : null;
        const available = Boolean(match?.id) && stock !== null && stock > 0;

        if (status) status.textContent = !available ? 'This combination is currently unavailable' : '';
        const price = this.closest('[data-section-id]')?.querySelector<HTMLElement>('.lb-product-detail__price-current');
        if (price && match?.price != null) price.textContent = formatCartMoney(match.price, this.closest('[data-section-id]')?.querySelector<HTMLElement>('lb-add-to-cart')?.dataset.productCurrency || 'INR');
        this.facts?.update(match || null, match ? (available ? 'selected' : 'unavailable') : 'unknown');
        this.dispatchAvailability(available);
    }

    private dispatchAvailability(available: boolean) {
        const section = this.closest('[data-section-id]') || document;
        section.querySelectorAll<HTMLElement>('[data-lb-add-to-cart],[data-lb-buy-now]').forEach((button) => {
            if (available) button.removeAttribute('disabled');
            else button.setAttribute('disabled', '');
        });
        section.querySelectorAll('lb-add-to-cart').forEach(element => {
            if (element instanceof LbAddToCartElement) element.refreshPersonalizationSelection();
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
            '  <div data-lb-review-turnstile></div>',
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
            size: 'flexible',
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
        '.lb-wishlist-toggle__message{display:block;font-size:var(--lb-text-xs,0.75rem);color:var(--text-secondary,rgb(107 114 128))}',
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

// Wishlist toggle island. Guests use localStorage; existing store customers use the legacy
// customer route; canonical buyers use the verified buyer/store relationship route. Auth and
// initial state come from the server-rendered drop, so no extra request is needed on load.
class LbWishlistToggleElement extends LiquidIslandBase {
    // View coordination only. Authority still comes from the signed buyer/site BFF.
    private static readonly connected = new Set<LbWishlistToggleElement>();
    private static readonly pendingProducts = new Map<string, symbol>();
    private static readonly unknownProducts = new Set<string>();
    private active = false;
    private saving = false;
    private unconfirmed = false;
    private generation = 0;

    connectedCallback() {
        if (!this.dataset.productId) return;
        this.generation += 1;
        ensureWishlistStyles();
        this.active = this.resolveInitialActive();
        const key = this.productScope();
        this.saving = key !== null && LbWishlistToggleElement.pendingProducts.has(key);
        this.unconfirmed ||= key !== null && LbWishlistToggleElement.unknownProducts.has(key);
        LbWishlistToggleElement.connected.add(this);
        this.renderToggle();
        this.addEventListener('click', this.handleClick);
        window.addEventListener(WISHLIST_CHANGED_EVENT, this.handleWishlistChanged);
    }

    disconnectedCallback() {
        this.generation += 1;
        this.unconfirmed ||= this.saving;
        this.saving = false;
        LbWishlistToggleElement.connected.delete(this);
        this.removeEventListener('click', this.handleClick);
        window.removeEventListener(WISHLIST_CHANGED_EVENT, this.handleWishlistChanged);
    }

    private get isAuthenticated(): boolean { return this.dataset.authenticated === 'true'; }
    private get isBuyer(): boolean { return this.dataset.accountType === 'buyer'; }
    private get isBuyerLinked(): boolean { return this.dataset.buyerLinked === 'true'; }
    private get isBuyerUnavailable(): boolean { return this.dataset.buyerUnavailable === 'true'; }

    private captureScope(): string {
        return JSON.stringify([this.dataset.accountType, this.dataset.authenticated, this.dataset.buyerId,
            this.dataset.storeId, this.dataset.productId, this.dataset.variantId,
            this.dataset.buyerLinked, this.dataset.buyerUnavailable]);
    }

    private productScope(): string | null {
        // The existing wishlist deduplicates by customer/product, not variant.
        // Legacy customer controls have no canonical buyer ID: keep them instance-bound.
        return this.isBuyer && this.dataset.buyerId && this.dataset.storeId && this.dataset.productId
            ? JSON.stringify([this.dataset.buyerId, this.dataset.storeId, this.dataset.productId]) : null;
    }

    private scopeControls(key: string | null): LbWishlistToggleElement[] {
        return key === null ? [this] : Array.from(LbWishlistToggleElement.connected)
            .filter((element) => element.isConnected && element.productScope() === key);
    }

    private resolveInitialActive(): boolean {
        if (this.isAuthenticated) return this.dataset.inWishlist === 'true';
        return readWishlist().includes(this.dataset.productId || '');
    }

    private label(): string {
        return this.unconfirmed ? 'Reload wishlist to check saved state' : this.saving ? 'Updating wishlist'
            : this.isBuyer && this.isBuyerUnavailable ? 'Wishlist temporarily unavailable'
                : this.isBuyer && !this.isBuyerLinked ? 'Connect store account to use wishlist'
                    : this.active ? 'Remove from wishlist' : 'Add to wishlist';
    }

    private renderToggle() {
        const label = this.label();
        this.innerHTML = [
            `<${liquidButtonTag} type="button" data-lb-wishlist-button class="lb-wishlist-toggle__button" aria-pressed="${this.unconfirmed ? 'mixed' : this.active ? 'true' : 'false'}" aria-label="${label}" title="${label}">`,
            WISHLIST_HEART_SVG,
            `</${liquidButtonTag}>`,
            '<span class="lb-wishlist-toggle__message" role="status" aria-live="polite"></span>',
        ].join('');
        this.updateVisual();
        if (this.unconfirmed) this.showReload('Reload your wishlist to check the saved state.');
    }

    private updateVisual() {
        const button = this.querySelector<HTMLButtonElement>('[data-lb-wishlist-button]');
        if (!button) return;
        button.disabled = this.saving || this.unconfirmed;
        button.setAttribute('aria-busy', String(this.saving));
        button.setAttribute('aria-pressed', this.unconfirmed ? 'mixed' : String(this.active));
        button.setAttribute('aria-label', this.label());
        button.setAttribute('title', this.label());
    }

    private readonly handleWishlistChanged = (event: Event) => {
        if (this.isAuthenticated) return;
        const productId = this.dataset.productId;
        if (!productId) return;
        const detail = (event as CustomEvent<{ items?: string[] }>).detail;
        const items = Array.isArray(detail?.items) ? detail.items : readWishlist();
        const next = items.includes(productId);
        if (next !== this.active) { this.active = next; this.updateVisual(); }
    };

    private readonly handleClick = (event: Event) => {
        const trigger = event.target instanceof Element ? event.target.closest('[data-lb-wishlist-button]') : null;
        if (!trigger) return;
        event.preventDefault();
        void this.toggle();
    };

    private showMessage(message: string) {
        const status = this.querySelector<HTMLElement>('.lb-wishlist-toggle__message');
        if (status) status.textContent = message;
    }

    private showReload(message: string) {
        this.showMessage(message + ' ');
        const status = this.querySelector<HTMLElement>('.lb-wishlist-toggle__message');
        if (!status) return;
        const reload = document.createElement('a');
        reload.href = window.location.href;
        reload.textContent = 'Reload wishlist';
        status.append(reload);
    }

    private markUnconfirmed(key: string | null) {
        if (key !== null) LbWishlistToggleElement.unknownProducts.add(key);
        for (const element of this.scopeControls(key)) {
            element.unconfirmed = true;
            element.updateVisual();
            element.showReload('We could not confirm the change. Reload to check your saved items.');
        }
    }

    private async toggle() {
        const productId = this.dataset.productId;
        if (!productId || this.saving || this.unconfirmed) return;
        if (this.isBuyerUnavailable) { this.showMessage('Your wishlist is temporarily unavailable. Please try again later.'); return; }
        if (this.isBuyer && !this.dataset.buyerId) { this.showMessage('Reload your account before changing your wishlist.'); return; }
        if (this.isBuyer && !this.isBuyerLinked) {
            const basePath = this.dataset.basePath;
            if (basePath) window.location.assign(`${basePath}/account/settings`);
            else this.showMessage('Connect your verified store account in account settings to save items.');
            return;
        }

        const nextActive = !this.active;
        if (this.isAuthenticated) {
            const key = this.productScope();
            if (key !== null && LbWishlistToggleElement.unknownProducts.has(key)) {
                this.unconfirmed = true;
                this.updateVisual();
                this.showReload('Reload your wishlist to check the saved state.');
                return;
            }
            if (key !== null && LbWishlistToggleElement.pendingProducts.has(key)) return;
            const token = Symbol('wishlist-request');
            if (key !== null) LbWishlistToggleElement.pendingProducts.set(key, token);
            const generation = this.generation;
            const scope = this.captureScope();
            const current = () => this.isConnected && generation === this.generation && scope === this.captureScope();
            for (const element of this.scopeControls(key)) { element.saving = true; element.updateVisual(); }
            try {
                const response = await fetch(this.isBuyer ? '/api/buyer/wishlist' : '/api/customer/wishlist', {
                    method: nextActive ? 'POST' : 'DELETE',
                    headers: { 'Content-Type': 'application/json', ...(this.isBuyer ? { 'x-letbuyy-expected-buyer-id': this.dataset.buyerId || '' } : {}) },
                    body: JSON.stringify(this.isBuyer ? { productId, variantId: this.dataset.variantId || null }
                        : { productId, storeId: this.dataset.storeId, variantId: this.dataset.variantId || null }),
                });
                if (!current() || !response.ok) { this.markUnconfirmed(key); return; }
                for (const element of this.scopeControls(key)) {
                    element.saving = false;
                    element.unconfirmed = false;
                    element.active = nextActive;
                    element.updateVisual();
                    element.showMessage('');
                    if (!nextActive && window.location.pathname.endsWith('/account/wishlist')) element.closest('.lb-product-card')?.remove();
                }
            } catch {
                this.markUnconfirmed(key);
            } finally {
                if (key !== null && LbWishlistToggleElement.pendingProducts.get(key) === token) LbWishlistToggleElement.pendingProducts.delete(key);
                for (const element of this.scopeControls(key)) { element.saving = false; element.updateVisual(); }
                if (generation === this.generation && scope !== this.captureScope()) {
                    this.saving = false;
                    this.unconfirmed = true;
                    this.active = this.resolveInitialActive();
                    this.updateVisual();
                    this.showReload('Your account or selected item changed. Reload before changing your wishlist.');
                }
            }
            return;
        }

        // Preserve the existing explicit guest/device wishlist policy and event.
        this.active = nextActive;
        this.updateVisual();
        const items = readWishlist();
        const next = nextActive ? Array.from(new Set([...items, productId])) : items.filter((id) => id !== productId);
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
        '.lb-cart__variant{display:block;overflow-wrap:anywhere;font-weight:400}',
        '.lb-cart__saved-facts{display:block;white-space:pre-line;overflow-wrap:anywhere;font-weight:400}',
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
    private attempt = 0;
    private pending = false;
    private unconfirmed = false;
    private message = '';
    private syncContext: { subdomain: string | null; token: string | null } | null = null;

    connectedCallback() {
        ensureCartPageStyles();
        this.baseHref = this.dataset.basePath || inferBasePath();
        this.renderCart();
        this.addEventListener('click', this.handleClick);
        window.addEventListener(CART_CHANGED_EVENT, this.handleCartChanged);
        window.addEventListener('storage', this.handleCartChanged);
        const items = readCart();
        if (items.length > 0) {
            if (window.localStorage.getItem(CART_TOKEN_STORAGE_KEY)) void this.recoverCart(items, ++this.attempt, getLiquidStorefrontSubdomain(), window.localStorage.getItem(CART_TOKEN_STORAGE_KEY), 'review');
            else {
                // A local draft without a receipt may be a lost POST response.
                // Mounting/reloading must not create a second cart implicitly.
                this.unconfirmed = true;
                this.message = 'We could not confirm this cart. Review your items before checkout.';
                this.renderCart();
            }
        }
    }

    disconnectedCallback() {
        if (activeConfiguredEdit?.host === this) activeConfiguredEdit.destroy();
        this.attempt++;
        this.removeEventListener('click', this.handleClick);
        window.removeEventListener(CART_CHANGED_EVENT, this.handleCartChanged);
        window.removeEventListener('storage', this.handleCartChanged);
    }

    private readonly handleCartChanged = () => {
        if (this.pending && this.syncContext && (getLiquidStorefrontSubdomain() !== this.syncContext.subdomain
            || window.localStorage.getItem(CART_TOKEN_STORAGE_KEY) !== this.syncContext.token)) {
            this.pending = false;
            this.unconfirmed = true;
            this.message = 'Your cart changed while saving. Reload the saved cart before checkout.';
            this.syncContext = null;
        }
        if (!window.localStorage.getItem(CART_TOKEN_STORAGE_KEY) && readCart().length === 0 && !readServerCart()) {
            this.attempt++;
            this.pending = false;
            this.unconfirmed = false;
            this.message = '';
            this.syncContext = null;
        }
        this.renderCart();
    };

    private readonly handleClick = (event: Event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;

        if (target.closest('[data-lb-cart-refresh]')) {
            event.preventDefault();
            void this.recoverCart(readCart(), ++this.attempt, getLiquidStorefrontSubdomain(), window.localStorage.getItem(CART_TOKEN_STORAGE_KEY), 'review');
            return;
        }

        const editButton = target.closest<HTMLElement>('[data-lb-cart-edit]');
        if (editButton?.dataset.cartLineKey) { event.preventDefault(); void openMadeYoursCartEdit(this, editButton.dataset.cartLineKey); return; }

        const removeButton = target.closest<HTMLElement>('[data-lb-cart-remove]');
        if (removeButton?.dataset.cartLineKey) {
            event.preventDefault();
            const next = mutationFromAcknowledgedCart(lines => lines.filter(item => cartItemKey(item) !== removeButton.dataset.cartLineKey));
            if (next) void this.syncCart(next, true);
            else this.requireSavedCartReview();
            return;
        }

        const stepButton = target.closest<HTMLElement>('[data-lb-cart-step]');
        if (stepButton?.dataset.cartLineKey) {
            event.preventDefault();
            this.stepQuantity(stepButton.dataset.cartLineKey, stepButton.dataset.lbCartStep === 'down' ? -1 : 1);
        }
    };

    private stepQuantity(lineKey: string, delta: number) {
        const next = mutationFromAcknowledgedCart(lines => lines
            .map((item) => (cartItemKey(item) === lineKey ? { ...item, quantity: item.quantity + delta } : item))
            .filter((item) => item.quantity > 0));
        if (next) void this.syncCart(next, true);
        else this.requireSavedCartReview();
    }

    private requireSavedCartReview() {
        this.attempt++;
        this.pending = false;
        this.unconfirmed = true;
        this.syncContext = null;
        this.message = 'We could not confirm this cart. Review your items before checkout.';
        this.renderCart();
    }

    private active(attempt: number, subdomain: string | null) {
        return this.isConnected && this.attempt === attempt && getLiquidStorefrontSubdomain() === subdomain;
    }

    private async syncCart(items: LiquidCartItem[], write = false) {
        const attempt = ++this.attempt, subdomain = getLiquidStorefrontSubdomain();
        const token = window.localStorage.getItem(CART_TOKEN_STORAGE_KEY);
        this.syncContext = { subdomain, token };
        this.pending = true;
        this.unconfirmed = true;
        this.message = 'Updating your cart…';
        if (write) writeCart(items, { sync: false });
        else this.renderCart();
        let status = 0;
        const accepted = await syncLiquidCartToServer(items, (_code, responseStatus) => { status = responseStatus ?? 0; });
        if (!this.active(attempt, subdomain)) return;
        if (accepted) {
            this.pending = false;
            const currentToken = window.localStorage.getItem(CART_TOKEN_STORAGE_KEY), currentReceipt = readServerCart();
            const stillAccepted = currentToken && currentReceipt && this.validReceipt(currentReceipt, currentToken)
                && JSON.stringify(liquidCartItemsFromServer(currentReceipt)) === window.localStorage.getItem(CART_STORAGE_KEY);
            this.unconfirmed = !stillAccepted;
            this.message = stillAccepted ? '' : 'Your cart changed while saving. Reload the saved cart before checkout.';
            this.syncContext = null;
            this.renderCart();
            return;
        }
        await this.recoverCart(items, attempt, subdomain, token, status >= 400 && status < 500 ? 'rejected' : 'unknown');
    }

    private validReceipt(cart: LiquidServerCart | undefined, token: string): cart is LiquidServerCart {
        return Boolean(cart && cart.cart_token === token && typeof cart.currency === 'string'
            && Array.isArray(cart.lines) && cart.lines.every(line => line && typeof line.product_id === 'string'
                && typeof line.title === 'string' && Number.isSafeInteger(line.quantity) && line.quantity > 0
                && Number.isFinite(line.unit_price) && line.unit_price >= 0 && typeof line.currency === 'string')
            && (['subtotal', 'discount_total', 'shipping_total', 'tax_total', 'total'] as const).every(key =>
                Number.isFinite(cart[key]) && cart[key] >= 0)
            && Array.isArray(cart.coupon_codes) && cart.coupon_codes.every(code => typeof code === 'string'));
    }

    private async recoverCart(items: LiquidCartItem[], attempt: number, subdomain: string | null, token: string | null, outcome: 'rejected' | 'unknown' | 'review') {
        const draft = JSON.stringify(items);
        const ownsCart = () => this.active(attempt, subdomain) && window.localStorage.getItem(CART_TOKEN_STORAGE_KEY) === token;
        const ownsDraft = () => ownsCart()
            && window.localStorage.getItem(CART_STORAGE_KEY) === draft;
        if (!ownsDraft()) {
            if (ownsCart()) {
                this.pending = false;
                this.message = 'Your cart changed while saving. Reload the saved cart before checkout.';
                this.renderCart();
            }
            return;
        }
        this.pending = true;
        this.syncContext = { subdomain, token };
        this.unconfirmed = true;
        this.message = 'Checking your saved cart…';
        this.renderCart();
        try {
            if (subdomain && token) {
                // A cached receipt may predate another queued write. Read the
                // capability-bound canonical cart; never retry the mutation.
                const reconciliation = reconcileStoredCart(subdomain);
                if (reconciliation && await reconciliation !== 'ready') throw new Error('Cart unavailable');
                if (!ownsDraft()) return;
                const previousReceipt = window.localStorage.getItem(CART_SERVER_STORAGE_KEY);
                const response = await storefrontBrowserApiFetch(subdomain, `/cart/${encodeURIComponent(token)}`);
                const payload = await readStorefrontApiJson<LiquidServerCart>(response);
                if (!ownsDraft() || window.localStorage.getItem(CART_SERVER_STORAGE_KEY) !== previousReceipt) return;
                if (!response.ok || !payload.success || !this.validReceipt(payload.data, token)) throw new Error('Cart unavailable');
                writeServerCart(payload.data);
                writeCart(liquidCartItemsFromServer(payload.data), { sync: false });
                this.unconfirmed = outcome === 'unknown';
                this.message = outcome === 'rejected' ? 'This cart update was not accepted. Review the saved quantities.'
                    : outcome === 'review' ? '' : 'We could not confirm this update. Reload the saved cart before checkout.';
                return;
            }
        } catch {
            // Unknown transport/receipt outcomes do not prove a denied write.
        } finally {
            if (ownsCart()) {
                this.pending = false;
                this.syncContext = null;
                if (this.unconfirmed) this.message = 'We could not confirm this update. Reload the saved cart before checkout.';
                this.renderCart();
            }
        }
    }

    private renderCart() {
        if (activeConfiguredEdit?.host === this) return;
        const items = readCart();
        const notice = this.message ? `<p data-lb-cart-status role="${this.pending ? 'status' : 'alert'}">${escapeHtml(this.message)}</p>` : '';
        const retry = this.unconfirmed && !this.pending ? `<${liquidButtonTag} type="button" data-lb-cart-refresh>Reload saved cart</${liquidButtonTag}>` : '';
        if (items.length === 0) {
            this.innerHTML = notice + retry + `<p class="lb-cart__empty">Your cart is empty. <a href="${escapeHtml(this.baseHref)}/shop">Browse products</a></p>`;
            return;
        }

        const rows = items.map((item) => [
            '<li class="lb-cart__item">',
            `<span class="lb-cart__title">${escapeHtml(item.name)}<small class="lb-cart__variant">${escapeHtml(cartItemVariantLabel(item))}</small>${cartSavedFactsMarkup(item)}${configuredCartEditButton(item)}</span>`,
            '<span class="lb-cart__qty">',
            `<${liquidButtonTag} type="button" data-lb-cart-step="down" data-cart-line-key="${escapeHtml(cartItemKey(item))}" data-product-id="${escapeHtml(item.id)}" data-variant-id="${escapeHtml(item.variantId || '')}" aria-label="Decrease quantity of ${escapeHtml(cartItemAccessibleName(item))}">-</${liquidButtonTag}>`,
            `<span aria-live="polite">${item.quantity}</span>`,
            `<${liquidButtonTag} type="button" data-lb-cart-step="up" data-cart-line-key="${escapeHtml(cartItemKey(item))}" data-product-id="${escapeHtml(item.id)}" data-variant-id="${escapeHtml(item.variantId || '')}" aria-label="Increase quantity of ${escapeHtml(cartItemAccessibleName(item))}">+</${liquidButtonTag}>`,
            '</span>',
            `<${liquidButtonTag} type="button" data-lb-cart-remove data-cart-line-key="${escapeHtml(cartItemKey(item))}" data-product-id="${escapeHtml(item.id)}" data-variant-id="${escapeHtml(item.variantId || '')}" aria-label="Remove ${escapeHtml(cartItemAccessibleName(item))}">Remove</${liquidButtonTag}>`,
            '</li>',
        ].join('')).join('');

        this.innerHTML = [
            notice, retry,
            `<ul class="lb-cart__items">${rows}</ul>`,
            renderLiquidCartTotals(readServerCart()),
            this.pending || this.unconfirmed || savedCartIsClosed() ? '<span class="lb-cart__checkout" aria-disabled="true">Review your cart before checkout</span>'
                : `<a class="lb-cart__checkout" href="${escapeHtml(this.baseHref)}/checkout">Proceed to checkout</a>`,
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
            const body = await response.json() as { buyer?: { id?: unknown; email?: unknown; email_verified?: unknown; full_name?: unknown; phone?: unknown }; error?: string };
            if (!response.ok || !body.buyer || typeof body.buyer.id !== 'string' || typeof body.buyer.email !== 'string') throw new Error(body.error || 'profile_load_failed');
            const buyer = body.buyer;
            const linkStatus = new URLSearchParams(window.location.search).get('buyer_link');
            const linkMessage = linkStatus === 'linked' ? 'This store account is connected.'
                : linkStatus === 'unverified' ? 'Verify your LetBuyy email before connecting a store account.'
                    : linkStatus === 'conflict' ? 'This store customer record is already connected to another LetBuyy account. Contact the store for help.'
                        : linkStatus ? 'We could not connect this store account. You can try again shortly.' : '';
            this.innerHTML = [
                '<div class="lb-settings__forms">',
                '<form class="lb-settings__profile-form" data-lb-settings-buyer-profile>',
                '<h2>LetBuyy profile</h2>',
                `<input type="hidden" name="expectedBuyerId" value="${escapeHtml(buyer.id)}">`,
                `<p class="lb-settings__email-display">${escapeHtml(buyer.email)}${buyer.email_verified ? ' · Verified' : ' · Not verified'}</p>`,
                `<label>Full name<${liquidInputTag} type="text" name="fullName" maxlength="200" value="${escapeHtml(buyer.full_name ?? '')}" autocomplete="name"></${liquidInputTag}></label>`,
                `<label>Phone<${liquidInputTag} type="tel" name="phone" maxlength="32" value="${escapeHtml(buyer.phone ?? '')}" autocomplete="tel" inputmode="tel"></${liquidInputTag}></label>`,
                '<p class="lb-settings__profile-msg" aria-live="polite"></p>',
                `<${liquidButtonTag} type="submit">Save profile</${liquidButtonTag}>`,
                '</form>',
                '<section class="lb-settings__profile-form">',
                '<h2>Connect this store account</h2>',
                '<p>Reconfirm your LetBuyy sign-in to connect a store customer record with the same verified email. This action does not claim past orders; historical orders require a separate verified claim flow.</p>',
                linkMessage ? `<p role="status" aria-live="polite">${escapeHtml(linkMessage)}</p>` : '',
                '<form method="post" action="/api/buyer-auth/start">',
                '<input type="hidden" name="intent" value="link_store_customer">',
                `<input type="hidden" name="return_to" value="${escapeHtml(`${this.basePath}/account/settings`)}">`,
                `<${liquidButtonTag} type="submit">Connect store account</${liquidButtonTag}>`,
                '</form>',
                '</section>',
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
        const fd = new FormData(form);
        const expectedBuyerId = String(fd.get('expectedBuyerId') ?? '').trim();
        if (!expectedBuyerId) {
            if (msg) msg.textContent = 'Reload your account before saving profile changes.';
            return;
        }
        if (msg) msg.textContent = 'Saving…';
        try {
            const response = await fetch('/api/buyer/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: String(fd.get('fullName') ?? '').trim(), phone: String(fd.get('phone') ?? '').trim(), expectedBuyerId }),
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
    private buyerId: string | null = null;
    private loadVersion = 0;
    private loadController: AbortController | null = null;

    connectedCallback() {
        this.basePath = this.dataset.basePath || inferBasePath();
        this.buyerMode = this.dataset.accountType === 'buyer';
        this.addEventListener('click', this.handleClick);
        void this.loadAddresses();
    }

    disconnectedCallback() {
        this.loadVersion++;
        this.loadController?.abort();
        this.buyerId = null;
        this.addresses = [];
        this.editingId = null;
        this.removeEventListener('click', this.handleClick);
    }

    private async loadAddresses() {
        const version = ++this.loadVersion;
        this.loadController?.abort();
        const controller = this.loadController = new AbortController();
        this.buyerId = null;
        this.addresses = [];
        this.editingId = null;
        this.innerHTML = '<p class="lb-addresses__loading">Loading addresses…</p>';
        try {
            let buyerId: string | null = null;
            if (this.buyerMode) {
                const profile = await fetch('/api/buyer/profile', { cache: 'no-store', signal: controller.signal });
                const data = await profile.json() as { buyer?: { id?: unknown } };
                if (!profile.ok || typeof data.buyer?.id !== 'string' || !data.buyer.id.trim()) throw new Error('buyer_identity_unavailable');
                buyerId = data.buyer.id;
            }
            if (controller.signal.aborted || version !== this.loadVersion || !this.isConnected) return;
            const res = await fetch(this.buyerMode ? '/api/buyer/addresses' : '/api/customer/addresses', { cache: 'no-store', signal: controller.signal });
            if (!res.ok) throw new Error('address_load_failed');
            const data = await res.json() as { addresses?: Array<Record<string, unknown>> };
            if (controller.signal.aborted || version !== this.loadVersion || !this.isConnected) return;
            if (!Array.isArray(data.addresses)) throw new Error('address_load_failed');
            this.addresses = data.addresses;
            this.buyerId = buyerId;
        } catch {
            if (controller.signal.aborted || version !== this.loadVersion || !this.isConnected) return;
            this.innerHTML = '<p class="lb-addresses__error" role="alert">We could not load your addresses. <button type="button" data-lb-addr-retry>Try again</button></p>';
            return;
        }
        this.renderList();
    }

    private writeHeaders(): Record<string, string> | null {
        // Bind edits to the identity this view loaded. This is a stale-form
        // comparison only; the server's signed session remains the authority.
        if (this.buyerMode && !this.buyerId) return null;
        return { 'Content-Type': 'application/json', ...(this.buyerMode ? { 'x-letbuyy-expected-buyer-id': this.buyerId! } : {}) };
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
        const headers = this.writeHeaders();
        if (!headers) { if (msg) msg.textContent = 'Reload your account before changing saved addresses.'; return; }
        const version = this.loadVersion;
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
                headers,
                body: JSON.stringify(body),
            });
            if (version !== this.loadVersion || !this.isConnected) return;
            if (res.ok) {
                await this.loadAddresses();
            } else {
                if (msg) msg.textContent = res.status === 409 ? 'Your account changed. Reload before saving.' : 'Failed to save address.';
            }
        } catch {
            if (version !== this.loadVersion || !this.isConnected) return;
            if (msg) msg.textContent = 'Network error. Try again.';
        }
    }

    private async setDefault(id: string) {
        const headers = this.writeHeaders();
        if (!headers) return;
        const version = this.loadVersion;
        try {
            const res = this.buyerMode
                ? await fetch(`/api/buyer/addresses/${encodeURIComponent(id)}`, { method: 'PATCH', headers, body: JSON.stringify({ is_default: true }) })
                : await fetch('/api/customer/addresses', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_default: true }) });
            if (version !== this.loadVersion || !this.isConnected) return;
            if (!res.ok) throw new Error('address_update_failed');
            await this.loadAddresses();
        } catch {
            if (version !== this.loadVersion || !this.isConnected) return;
            this.innerHTML = '<p class="lb-addresses__error" role="alert">We could not update the default address. <button type="button" data-lb-addr-retry>Reload</button></p>';
        }
    }

    private async deleteAddress(id: string) {
        const headers = this.writeHeaders();
        if (!headers) return;
        const version = this.loadVersion;
        try {
            const res = this.buyerMode
                ? await fetch(`/api/buyer/addresses/${encodeURIComponent(id)}`, { method: 'DELETE', headers })
                : await fetch('/api/customer/addresses', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
            if (version !== this.loadVersion || !this.isConnected) return;
            if (!res.ok) throw new Error('address_delete_failed');
            await this.loadAddresses();
        } catch {
            if (version !== this.loadVersion || !this.isConnected) return;
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

// T1/W2 — generic Turnstile-for-a-plain-<form> island for the transitional customer login form.
// It is a no-JS-first <form method="post"> submission that POSTs directly to /api/customer/login;
// there is no client-side submit handler to attach a token to. This island fills the same role
// TurnstileWidget.tsx plays for React forms: render a visible responsive
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
            size: 'flexible',
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

export function bindVariantPurchaseControls(root: HTMLElement, productIds: string[]) {
    const required = new Set(productIds);
    root.querySelectorAll<HTMLElement>('lb-add-to-cart').forEach(element => {
        const picker = element.closest('[data-section-id],section')?.querySelector<HTMLElement>('lb-variant-picker');
        if (!required.has(element.dataset.productId || '') || picker?.dataset.productId === element.dataset.productId) return;
        element.dataset.productRequiresOptions = 'true';
        element.querySelectorAll<HTMLButtonElement>('[data-lb-add-to-cart],[data-lb-buy-now]').forEach(button => { button.textContent = 'Choose options'; });
    });
}

export default function LiquidHydrationIslands({ basePath, storeId, variantProductIds = [] }: LiquidHydrationIslandsProps) {
    useEffect(() => {
        registerLiquidHydrationIslands();
        const root = document.querySelector<HTMLElement>('[data-theme-renderer="liquid"][data-editor-mode]');
        if (!root) return;

        root.dataset.storeId = storeId;
        bindVariantPurchaseControls(root, variantProductIds);
        root.querySelectorAll<HTMLElement>('lb-predictive-search').forEach(search => {
            search.dataset.basePath = basePath;
        });
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
    }, [basePath, storeId, variantProductIds]);

    return null;
}
