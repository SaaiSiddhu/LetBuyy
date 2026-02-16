import { StoreService } from '@/lib/store-service';
import { ProductService } from '@/lib/product-service';
import { notFound } from 'next/navigation';
import { DEFAULT_THEME_SETTINGS } from '@/types/store';
import EnhancedShopGrid from '../shop/enhanced-shop-grid';

// === COST OPTIMIZATION: ISR - Regenerate pages every 5 minutes ===
export const revalidate = 300;

/**
 * /store/[subdomain]/products — All Products page
 * Server component that fetches products from Supabase and renders
 * the full EnhancedShopGrid with search, sort, and filtering.
 */
export default async function StorefrontProductsPage({ params }: { params: Promise<{ subdomain: string }> }) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);

    if (!store) return notFound();

    // Get all products: try selectedProductIds first, then fall back to seller's full catalog
    let products = await ProductService.getProductsByIds(store.selectedProductIds);

    if (products.length === 0 && store.sellerId) {
        products = await ProductService.getProductsBySellerId(store.sellerId);
    }

    // Fallback: try fetching all products for this store
    if (products.length === 0 && store.id) {
        products = await ProductService.getProductsByStoreId(store.id);
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
