import { ProductService } from '@/lib/product-service';
import { ReviewService } from '@/lib/review-service';
import { StoreService } from '@/lib/store-service';
import { notFound } from 'next/navigation';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import { createProductDetailFallbackSection } from '@/lib/theme-engine/product-route';
import type { SectionRenderData } from '@/lib/theme-engine/types';
import { buildBreadcrumbJsonLd, buildProductJsonLd, buildStoreJsonLd, buildStoreMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string; productId: string }> }): Promise<Metadata> {
    const { subdomain, productId } = await params;
    const [product, store] = await Promise.all([
        ProductService.getProductById(productId, subdomain),
        StoreService.getStoreBySubdomain(subdomain),
    ]);

    if (!product || !store) return { title: 'Product Not Found' };

    const description = product.seoDescription || product.description || `${product.name} from ${store.name}.`;
    const title = product.seoTitle || `${product.name} | ${store.name}`;

    return buildStoreMetadata(store, {
        title,
        description,
        path: `/product/${product.id}`,
        image: product.images[0],
    });
}

export default async function ProductPage({ params }: { params: Promise<{ subdomain: string; productId: string }> }) {
    const { subdomain, productId } = await params;

    const [product, store] = await Promise.all([
        ProductService.getProductById(productId, subdomain),
        StoreService.getStoreBySubdomain(subdomain),
    ]);

    if (!product || !store) return notFound();

    const reviews = await ReviewService.getProductReviews(store.id, product.id, subdomain);

    const plan = resolveStorefrontTemplate(store, {
        type: 'product',
        path: `/store/${subdomain}/product/${productId}`,
        subdomain,
        resourceId: productId,
        fallbackSections: [createProductDetailFallbackSection()],
    });

    const sectionData = new Map<string, SectionRenderData>();
    for (const section of plan.template.sections) {
        sectionData.set(section.id, { product, reviews });
    }

    const jsonLdNodes = [
        buildProductJsonLd(store, product),
        buildBreadcrumbJsonLd(store, [
            { name: 'Home', path: '/' },
            { name: 'Shop', path: '/shop' },
            { name: product.name, path: `/product/${product.id}` },
        ]),
        buildStoreJsonLd(store),
    ];

    return (
        <>
            {jsonLdNodes.map((node, index) => (
                <script
                    key={index}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(node).replace(/</g, '\\u003c') }}
                />
            ))}
            <StorefrontCompositionEngine store={store} plan={plan} sectionData={sectionData} />
        </>
    );
}
