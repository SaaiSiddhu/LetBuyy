'use client';

import { useCart } from '@/context/cart-context';
import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function CartIcon() {
    const { cartCount, isOpen, setIsOpen } = useCart();
    const params = useParams();
    const subdomain = params.subdomain as string;

    return (
        <Link
            href={`/cart`}
            className="relative p-2 text-theme-secondary hover:text-primary transition-colors group"
        >
            <ShoppingBag size={24} className="group-hover:scale-110 transition-transform" />
            {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full animate-pulse">
                    {cartCount}
                </span>
            )}
        </Link>
    );
}
