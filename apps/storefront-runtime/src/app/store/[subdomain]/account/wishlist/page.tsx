// ============================================================
// WISHLIST PAGE — Displays customer's wishlisted products
// ============================================================

'use client';

import { useWishlist } from '@/context/wishlist-context';
import { Heart, ShoppingBag } from '@letbuyy/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { StorefrontEmptyState } from '@/components/storefront/storefront-states';

export default function WishlistPage() {
    const { items, toggleWishlist } = useWishlist();
    const params = useParams();
    const subdomain = params.subdomain as string;
    const basePath = `/store/${subdomain}`;

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
                Wishlist <span className="text-base font-normal" style={{ color: 'var(--text-secondary, #6B7280)' }}>({items.length})</span>
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(productId => (
                    <div
                        key={productId}
                        className="rounded-2xl border p-4 relative transition-shadow hover:shadow-md"
                        style={{ borderColor: 'var(--border, #E5E7EB)' }}
                    >
                        <button
                            onClick={() => toggleWishlist(productId)}
                            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                            aria-label="Remove from wishlist"
                        >
                            <Heart size={18} fill="#ef4444" stroke="#ef4444" />
                        </button>
                        <Link href={`${basePath}/product/${productId}`}>
                            <div
                                className="w-full aspect-square rounded-xl mb-3 flex items-center justify-center"
                                style={{ backgroundColor: 'var(--surface, #F3F4F6)' }}
                            >
                                <ShoppingBag size={24} style={{ color: 'var(--text-secondary, #9CA3AF)' }} />
                            </div>
                            <p className="text-sm font-semibold">
                                Saved product
                            </p>
                            <p className="mt-1 text-xs font-mono" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                {productId.slice(0, 12)}
                            </p>
                            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                                Product detail hydration needs backend support; open the product page for the current storefront record.
                            </p>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}
