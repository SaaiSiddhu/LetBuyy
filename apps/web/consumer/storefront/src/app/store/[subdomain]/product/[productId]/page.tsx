import { ProductService } from '@/lib/product-service';
import { StoreService } from '@/lib/store-service';
import { notFound } from 'next/navigation';
import ProductDetailsClient from './product-details-client';

export default async function ProductPage({ params }: { params: Promise<{ subdomain: string; productId: string }> }) {
    const { subdomain, productId } = await params;

    // Fetch product and store in parallel
    const [product, store] = await Promise.all([
        ProductService.getProductById(productId),
        StoreService.getStoreBySubdomain(subdomain),
    ]);

    if (!product) return notFound();

    const theme = store?.templateConfig?.themeSettings;

    return (
        <ProductDetailsClient
            product={product}
            subdomain={subdomain}
            theme={theme}
        />
    );
}
