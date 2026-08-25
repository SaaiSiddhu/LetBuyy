import type { Metadata } from 'next';
import type { StoreBrandingInput } from '@letbuyy/checkout-core';
import { storefrontApiFetch } from '@/lib/api/client';
import { StoreService } from '@/lib/store-service';
import CheckoutClient, { type CheckoutOriginCartLine } from '../../store/[subdomain]/checkout/checkout-client';
import { sanitizeBranding, brandingCssVariables, sanitizeBrandingUrl } from '../branding';

export const metadata: Metadata = {
    title: 'Secure Checkout',
    robots: { index: false, follow: false },
};

const HANDOFF_QUERY_KEYS = ['site_id', 'cart_token', 'expires_at', 'cart_digest', 'signature', 'channel'] as const;

interface CheckoutSearchParams {
    site_id?: string;
    cart_id?: string;
    cart_token?: string;
    channel?: string;
    expires_at?: string;
    cart_digest?: string;
    signature?: string;
}

interface VerifiedHandoffLine {
    product_id?: string;
    variant_id?: string | null;
    title?: string;
    image_url?: string | null;
    quantity?: number;
    unit_price?: number;
    properties?: Record<string, string>;
}

// T6/W2 — resolves the merchant's real storefront origin for the "back to store" links
// CheckoutClient already renders. checkout.<root> shares no host with the storefront, so these
// must be absolute URLs; the local-dev root domain has no real DNS for a live subdomain, so it
// falls back to the same /store/<subdomain> path every other local verification in this
// environment already uses. This resolver never chooses a tenant — the subdomain it receives
// already came from a store row looked up by the handoff's own verified site_id.
function resolveStorefrontOriginUrl(subdomain: string): string {
    const rootDomain = (process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN || '').trim().toLowerCase();
    if (!rootDomain || rootDomain === 'localhost') {
        return `/store/${subdomain}`;
    }
    return `https://${subdomain}.${rootDomain}`;
}

function InvalidHandoffPage({ reason }: { reason: string }) {
    return (
        <main className="flex min-h-screen items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl border border-[var(--lb-color-border,#e5e7eb)] bg-surface p-8 text-center shadow-xl">
                <h1 className="mb-2 text-xl font-bold text-theme">This checkout link isn&apos;t valid</h1>
                <p className="text-sm text-theme-secondary">{reason}</p>
                <p className="mt-4 text-xs text-theme-muted">Nothing was created. Go back to the store and try checking out again.</p>
            </div>
        </main>
    );
}

async function verifyHandoff(params: CheckoutSearchParams): Promise<
    | { ok: true; siteId: string; subdomain: string; lines: VerifiedHandoffLine[] }
    | { ok: false; status: number; reason: string }
> {
    const cartId = typeof params.cart_id === 'string' ? params.cart_id.trim() : '';
    if (!cartId) return { ok: false, status: 400, reason: 'Missing checkout reference.' };

    const query = new URLSearchParams();
    for (const key of HANDOFF_QUERY_KEYS) {
        const value = params[key];
        if (typeof value === 'string' && value.length > 0) query.set(key, value);
    }

    let response: Response;
    try {
        response = await storefrontApiFetch(`/checkout/${encodeURIComponent(cartId)}/verify-handoff?${query.toString()}`);
    } catch {
        return { ok: false, status: 503, reason: 'Checkout verification is temporarily unavailable.' };
    }

    if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        return {
            ok: false,
            status: response.status,
            reason: body?.error?.message || 'This checkout link is invalid or has expired.',
        };
    }

    const body = await response.json().catch(() => null) as { data?: { site_id?: string; subdomain?: string | null; lines?: VerifiedHandoffLine[] } } | null;
    const siteId = body?.data?.site_id;
    const subdomain = body?.data?.subdomain;
    if (!siteId || !subdomain) return { ok: false, status: 502, reason: 'This store is no longer available.' };

    return { ok: true, siteId, subdomain, lines: Array.isArray(body?.data?.lines) ? body.data.lines : [] };
}

async function loadBranding(storeId: string): Promise<Partial<StoreBrandingInput> | null> {
    try {
        const response = await storefrontApiFetch(`/stores/${encodeURIComponent(storeId)}/branding`);
        if (!response.ok) return null;
        const body = await response.json().catch(() => null) as { data?: { branding?: Partial<StoreBrandingInput> } } | null;
        return body?.data?.branding ?? null;
    } catch {
        return null;
    }
}

function toCartLine(line: VerifiedHandoffLine): CheckoutOriginCartLine | null {
    const id = typeof line.product_id === 'string' ? line.product_id : '';
    const quantity = typeof line.quantity === 'number' ? line.quantity : 0;
    if (!id || quantity <= 0) return null;
    return {
        id,
        variantId: line.variant_id || null,
        name: typeof line.title === 'string' && line.title ? line.title : 'Product',
        images: line.image_url ? [line.image_url] : [],
        price: typeof line.unit_price === 'number' ? line.unit_price : 0,
        quantity,
        selectedVariant: line.properties || {},
    };
}

export default async function CheckoutOriginPage({
    searchParams,
}: {
    searchParams: Promise<CheckoutSearchParams>;
}) {
    const params = await searchParams;
    const verified = await verifyHandoff(params);
    if (!verified.ok) return <InvalidHandoffPage reason={verified.reason} />;

    const store = await StoreService.getStoreBySubdomain(verified.subdomain);
    if (!store) return <InvalidHandoffPage reason="This store is no longer available." />;

    const brandingInput = await loadBranding(verified.siteId);
    const branding = sanitizeBranding(brandingInput);
    const logoUrl = branding.logoUrl ?? sanitizeBrandingUrl(store.logoUrl);
    const cartLines = verified.lines.map(toCartLine).filter((line): line is CheckoutOriginCartLine => line !== null);

    return (
        <div style={brandingCssVariables(branding)} data-checkout-theme={branding.checkoutTheme}>
            <header className="border-b border-[var(--lb-color-border,#e5e7eb)] px-4 py-3">
                <div className="mx-auto flex max-w-5xl items-center justify-between">
                    <a
                        href={resolveStorefrontOriginUrl(store.subdomain)}
                        className="flex items-center gap-2 text-sm font-semibold text-theme"
                    >
                        {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- a merchant logo host is never
                            // known ahead of time, so next/image's static remotePatterns allowlist can't cover it;
                            // the URL itself is already scheme-validated above.
                            <img src={logoUrl} alt={store.name} className="h-7 w-auto" />
                        ) : (
                            <span>{store.name}</span>
                        )}
                    </a>
                    <span className="flex items-center gap-1 text-xs font-medium text-theme-secondary">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <rect x="5" y="11" width="14" height="9" rx="2" />
                            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                        </svg>
                        Secure checkout
                    </span>
                </div>
            </header>
            <CheckoutClient
                storeId={store.id}
                sellerId={store.sellerId}
                subdomain={store.subdomain}
                storeName={store.name}
                codEnabled={store.codEnabled !== false}
                onlinePaymentEnabled={store.onlinePaymentEnabled !== false}
                checkoutOrigin={{
                    storefrontBaseUrl: resolveStorefrontOriginUrl(store.subdomain),
                    cartLines,
                }}
            />
        </div>
    );
}
