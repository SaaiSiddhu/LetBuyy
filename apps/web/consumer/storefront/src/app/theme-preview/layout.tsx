'use client';

import { CartProvider } from '@/context/cart-context';

export default function ThemePreviewLayout({ children }: { children: React.ReactNode }) {
    return <CartProvider>{children}</CartProvider>;
}
