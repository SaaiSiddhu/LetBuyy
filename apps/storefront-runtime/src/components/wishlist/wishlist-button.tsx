// ============================================================
// WISHLIST BUTTON — Heart toggle for products
// ============================================================

'use client';

import { Heart } from '@letbuyy/ui';
import { useWishlist } from '@/context/wishlist-context';
import { motion } from 'framer-motion';

interface Props {
    productId: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizes = {
    sm: 16,
    md: 20,
    lg: 24,
};

export default function WishlistButton({ productId, size = 'md', className = '' }: Props) {
    const { isInWishlist, toggleWishlist } = useWishlist();
    const active = isInWishlist(productId);

    return (
        <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleWishlist(productId);
            }}
            className={`p-1.5 rounded-full transition-colors ${className}`}
            aria-label={active ? 'Remove from wishlist' : 'Add to wishlist'}
        >
            <Heart
                size={sizes[size]}
                fill={active ? 'var(--primary, #ef4444)' : 'none'}
                stroke={active ? 'var(--primary, #ef4444)' : 'currentColor'}
                strokeWidth={1.5}
            />
        </motion.button>
    );
}
