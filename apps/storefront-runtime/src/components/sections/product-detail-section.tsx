import ProductReviews from '@/components/product/product-reviews';
import ProductDetailsClient from '@/app/store/[subdomain]/product/[productId]/product-details-client';
import type { ProductModel, SectionModel, ThemeSettings } from '@/types/store';

export default function ProductDetailSection({
    product,
    subdomain,
    storeId,
    section,
    theme,
}: {
    product?: ProductModel;
    subdomain: string;
    storeId: string;
    section: SectionModel;
    theme: ThemeSettings;
}) {
    if (!product) return null;

    const showReviews = section.settings.showReviews !== false;

    return (
        <>
            <ProductDetailsClient
                product={product}
                subdomain={subdomain}
                theme={theme}
            />
            {showReviews && (
                <div className="max-w-5xl mx-auto px-4 pb-12">
                    <ProductReviews
                        productId={product.id}
                        storeId={storeId}
                        primaryColor={theme.primaryColor}
                    />
                </div>
            )}
        </>
    );
}
