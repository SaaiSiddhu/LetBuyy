'use client';

import { PreviewWishlistProvider } from './_context/wishlist-context';
import { CheckoutProvider } from './_context/checkout-context';

export default function UrbanKicksLayout({ children }: { children: React.ReactNode }) {
    return (
        <PreviewWishlistProvider>
            <CheckoutProvider>
                {children}
            </CheckoutProvider>
        </PreviewWishlistProvider>
    );
}
