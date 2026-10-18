// ============================================================
// WISHLIST PAGE — Displays customer's wishlisted products
// ============================================================

'use client';

import { useWishlist } from '@/context/wishlist-context';
import { Button, Heart, ShoppingBag } from '@letbuyy/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { StorefrontEmptyState } from '@/components/storefront/storefront-states';

export default function WishlistPageClient() {
    const { items, toggleWishlist, buyerSession, buyerStoreLinked, storeAccountUnavailable, unavailable, isLoading } = useWishlist();
    const params = useParams();
    const subdomain = params.subdomain as string;
    const basePath = `/store/${subdomain}`;

    if (isLoading) return <p className="py-8 text-sm" role="status">Checking your saved items…</p>;

    if (unavailable) {
        return (
            <div role="alert" className="rounded-2xl border p-6" style={{ borderColor: 'var(--border)' }}>
                <h1 className="text-xl font-semibold">Wishlist unavailable</h1>
                <p className="mt-2 text-sm">We could not check your saved items right now.</p>
                <Button unstyled type="button" onClick={() => window.location.reload()} className="mt-4 min-h-11 rounded-full px-4 font-semibold" style={{ backgroundColor: 'var(--primary)', color: 'var(--lb-color-text-inverse, white)' }}>Try again</Button>
            </div>
        );
    }

    if (buyerSession && !buyerStoreLinked) {
        if (storeAccountUnavailable) {
            return (
                <div role="alert" className="rounded-2xl border p-6" style={{ borderColor: 'var(--border)' }}>
                    <h1 className="text-xl font-semibold">This store account is unavailable</h1>
                    <p className="mt-2 text-sm">Contact the store to restore access to its wishlist.</p>
                </div>
            );
        }
        return (
            <StorefrontEmptyState
                icon={<Heart size={28} aria-hidden="true" />}
                title="Connect this store account"
                body="Link your verified store customer account in settings to use this store's saved wishlist."
                actionHref={`${basePath}/account/settings`}
                actionLabel="Open account settings"
                actionIcon={<Heart size={18} aria-hidden="true" />}
            />
        );
    }

    if (items.length === 0) {
        return (
            <StorefrontEmptyState
                icon={<Heart size={28} aria-hidden="true" />}
                title="Your wishlist is empty"
                body="Save items you love and come back to them anytime."
                actionHref={`${basePath}/shop`}
                actionLabel="Browse products"
                actionIcon={<ShoppingBag size={18} aria-hidden="true" />}
            />
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">
                Wishlist <span className="text-base font-normal" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>({items.length})</span>
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(productId => (
                    <div
                        key={productId}
                        className="rounded-2xl border p-4 relative transition-shadow hover:shadow-md"
                        style={{ borderColor: 'var(--border, rgb(229 231 235))' }}
                    >
                        <Button unstyled
                            onClick={() => toggleWishlist(productId)}
                            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                            aria-label="Remove from wishlist"
                        >
                            <Heart size={18} fill="rgb(239 68 68)" stroke="rgb(239 68 68)" />
                        </Button>
                        <Link href={`${basePath}/product/${productId}`}>
                            <div
                                className="w-full aspect-square rounded-xl mb-3 flex items-center justify-center"
                                style={{ backgroundColor: 'var(--surface, rgb(243 244 246))' }}
                            >
                                <ShoppingBag size={24} style={{ color: 'var(--text-secondary, rgb(156 163 175))' }} />
                            </div>
                            <p className="text-sm font-semibold">
                                Saved product
                            </p>
                            <p className="mt-1 text-xs font-mono" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                {productId.slice(0, 12)}
                            </p>
                            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary, rgb(107 114 128))' }}>
                                Product detail hydration needs backend support; open the product page for the current storefront record.
                            </p>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}
