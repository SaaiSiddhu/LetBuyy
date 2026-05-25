import { ProductService } from '@/lib/product-service';
import { StoreService } from '@/lib/store-service';
import { notFound } from 'next/navigation';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import { createProductDetailFallbackSection } from '@/lib/theme-engine/product-route';
import type { SectionRenderData } from '@/lib/theme-engine/types';

export default async function ProductPage({ params }: { params: Promise<{ subdomain: string; productId: string }> }) {
    const { subdomain, productId } = await params;

    const [product, store] = await Promise.all([
        ProductService.getProductById(productId, subdomain),
        StoreService.getStoreBySubdomain(subdomain),
    ]);

    if (!product || !store) return notFound();

    const plan = resolveStorefrontTemplate(store, {
        type: 'product',
        path: `/store/${subdomain}/product/${productId}`,
        subdomain,
        resourceId: productId,
        fallbackSections: [createProductDetailFallbackSection()],
    });

    const sectionData = new Map<string, SectionRenderData>();
    for (const section of plan.template.sections) {
        sectionData.set(section.id, { product });
    }

    return <StorefrontCompositionEngine store={store} plan={plan} sectionData={sectionData} />;
}
