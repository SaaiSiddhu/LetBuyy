// ============================================================
// WISHLIST PAGE — Displays customer's wishlisted products
// ============================================================

'use client';

import { useWishlist } from '@/context/wishlist-context';
import { Heart, ShoppingBag } from '@letbuyy/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function WishlistPage() {
    const { items, toggleWishlist } = useWishlist();
    const params = useParams();
    const subdomain = params.subdomain as string;
    const basePath = `/store/${subdomain}`;

    if (items.length === 0) {
        return (
            <div className="text-center py-16">
                <div
                    className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                    style={{ backgroundColor: 'var(--surface, #F3F4F6)' }}
                >
                    <Heart size={28} style={{ color: 'var(--text-secondary, #9CA3AF)' }} />
                </div>
                <h2 className="text-lg font-semibold mb-1">Your wishlist is empty</h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary, #6B7280)' }}>
                    Save items you love and come back to them anytime.
                </p>
                <Link
                    href={`${basePath}/shop`}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold"
                    style={{ backgroundColor: 'var(--primary)' }}
                >
                    <ShoppingBag size={18} />
                    Browse Products
                </Link>
            </div>
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
