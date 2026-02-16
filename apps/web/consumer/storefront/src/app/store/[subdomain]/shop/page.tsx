import { StoreService } from '@/lib/store-service';
import { ProductService } from '@/lib/product-service';
import { notFound } from 'next/navigation';
import { DEFAULT_THEME_SETTINGS } from '@/types/store';

// === COST OPTIMIZATION: ISR - Regenerate pages every 5 minutes ===
export const revalidate = 300; // seconds
import EnhancedShopGrid from './enhanced-shop-grid';

export default async function ShopPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) return notFound();

    // Use store's selected product IDs (same as main page)
    // Also try fetching by sellerId as fallback
    let products = await ProductService.getProductsByIds(store.selectedProductIds);

    // If no products from selectedProductIds, try fetching by sellerId
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
