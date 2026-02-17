/**
 * Urban Kicks — Dynamic Shop Page Component
 * 
 * Server component that fetches the store's products and renders
 * the enhanced shop grid. Delegates to the shared EnhancedShopGrid
 * client component for filtering, sorting, and display.
 */

import { StoreService } from '@/lib/store-service';
import { ProductService } from '@/lib/product-service';
import { notFound } from 'next/navigation';
import { DEFAULT_THEME_SETTINGS } from '@/types/store';
import EnhancedShopGrid from '@/app/store/[subdomain]/shop/enhanced-shop-grid';

// ISR — regenerate every 5 minutes
export const revalidate = 300;

interface DynamicShopPageProps {
    subdomain: string;
}

export default async function DynamicShopPage({ subdomain }: DynamicShopPageProps) {
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return notFound();

    let products = await ProductService.getProductsByIds(store.selectedProductIds);
    if (products.length === 0 && store.sellerId) {
        products = await ProductService.getProductsBySellerId(store.sellerId);
    }

    const theme = store.templateConfig?.themeSettings || DEFAULT_THEME_SETTINGS;

    return (
        <EnhancedShopGrid
            products={products}
            theme={theme}
            subdomain={subdomain}
            storeName={store.name}
        />
    );
}
