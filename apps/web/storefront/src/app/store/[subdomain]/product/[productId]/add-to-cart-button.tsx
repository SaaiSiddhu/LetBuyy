'use client';

import { useCart } from '@/context/cart-context';
import { ProductModel } from '@/types/store';
import { ShoppingBag } from 'lucide-react';
import { useState } from 'react';

export default function AddToCartButton({ product }: { product: ProductModel }) {
    const { addToCart } = useCart();
    const [isAdded, setIsAdded] = useState(false);

    const handleAdd = () => {
        addToCart(product);
        setIsAdded(true);
        setTimeout(() => setIsAdded(false), 2000);
    };

    return (
        <button
            onClick={handleAdd}
            className={`w-full py-4 text-white text-lg font-bold rounded-[var(--radius)] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 ${isAdded ? 'bg-green-600 shadow-green-200' : 'bg-primary shadow-primary/30 hover:shadow-primary/50'
                }`}
        >
            <ShoppingBag size={22} />
            {isAdded ? 'Added to Bag' : 'Add to Cart'}
        </button>
    );
}
