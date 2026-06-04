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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {items.map(productId => (
                    <div
                        key={productId}
                        className="rounded-2xl border p-4 relative"
                        style={{ borderColor: 'var(--border, #E5E7EB)' }}
                    >
                        <button
                            onClick={() => toggleWishlist(productId)}
                            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-red-50 transition-colors"
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
                            <p className="text-sm font-medium truncate">
                                Product {productId.slice(0, 8)}
                            </p>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}
