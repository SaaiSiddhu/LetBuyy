import { ProductService, StorefrontCatalogueError } from '@/lib/product-service';
import { ReviewService } from '@/lib/review-service';
import { StoreService } from '@/lib/store-service';
import { notFound } from 'next/navigation';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import { createProductDetailFallbackSection } from '@/lib/theme-engine/product-route';
import type { SectionRenderData } from '@/lib/theme-engine/types';
import { buildBreadcrumbJsonLd, buildProductJsonLd, buildStoreJsonLd, buildStoreMetadata } from '@/lib/seo';
import { LetbuyyApiError } from '@letbuyy/api-client';
import type { Metadata } from 'next';

export const revalidate = 30;

// T3-fix W1 — ProductService.getProductById throws on every failure (by design: a gateway
// outage must not read as "no such product", see product-service.ts's own StorefrontCatalogueError
// doc comment). That means "genuinely absent" and "the call failed" arrive here identically as a
// throw, and this page previously had no try/catch at all, so BOTH cases escaped as an uncaught
// exception (a 500, not a 404). Unwrap to the real LetbuyyApiError and only treat a genuine
// gateway 404/NOT_FOUND as absence; any other cause (network failure, 500, schema error) is
// rethrown so app/error.tsx's real error boundary handles it — never silently swallowed into notFound().
async function loadProductOrThrow(productId: string, subdomain: string) {
    try {
        return await ProductService.getProductById(productId, subdomain);
    } catch (err) {
        const cause = err instanceof StorefrontCatalogueError ? err.cause : err;
        if (cause instanceof LetbuyyApiError && cause.status === 404) return null;
        throw err;
    }
}

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string; productId: string }> }): Promise<Metadata> {
    const { subdomain, productId } = await params;
    const [product, store] = await Promise.all([
        loadProductOrThrow(productId, subdomain),
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
        loadProductOrThrow(productId, subdomain),
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
