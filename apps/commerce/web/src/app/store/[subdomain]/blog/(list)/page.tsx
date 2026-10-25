// /store/[subdomain]/blog — Blog listing page for Liquid-engine stores.
//
// DATA SOURCE (VERIFIED REAL): services/api-gateway public-routes.ts GET /:subdomain/blog
// → blog_posts table (status='published', ordered by is_pinned desc, created_at desc).
// Fields available: id, title, slug, excerpt, featured_image, published_at, is_pinned.
// Author name NOT returned by public endpoint — omitted per plan honesty contract.
//
// The canonical public API supplies the real page and total for Liquid pagination.
// The 'blog-listing' Liquid section (LANE-A, E1) iterates {{ blog.articles }}.
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { StoreService } from '@/lib/store-service';
import { ContentService } from '@/lib/content-service';
import { buildStoreMetadata } from '@/lib/seo';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import type { SectionRenderData } from '@/lib/theme-engine/types';
import type { StorefrontBlogPostSummary } from '@/lib/content-service';

export const revalidate = 60;

type Props = {
    params: Promise<{ subdomain: string }>;
    searchParams?: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return { title: 'Blog' };
    return buildStoreMetadata(store, {
        title: `Blog | ${store.name}`,
        description: `Read the latest posts from ${store.name}.`,
        path: '/blog',
    });
}

function blogPostToArticleDrop(post: StorefrontBlogPostSummary): Record<string, unknown> {
    return {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt ?? null,
        featured_image: post.featuredImage ?? null,
        // Shopify convention: image mirrors featured_image
        image: post.featuredImage ?? null,
        published_at: post.publishedAt ?? null,
        updated_at: post.updatedAt ?? null,
        // url follows Shopify convention: /blogs/news/<slug> → simplified to /blog/<slug> for LetBuyy
        url: `/blog/${post.slug}`,
    };
}

function blogPageNumber(value: string | string[] | undefined): number | null {
    if (value === undefined) return 1;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
    const page = Number(value);
    return Number.isSafeInteger(page) && page <= 1000 ? page : null;
}

export default async function BlogListingPage({ params, searchParams }: Props) {
    const { subdomain } = await params;
    const page = blogPageNumber((await searchParams)?.page);
    if (page === null) return notFound();
    const [store, posts] = await Promise.all([
        StoreService.getStoreBySubdomain(subdomain),
        ContentService.listBlogPosts(subdomain, { page, limit: 20 }),
    ]);

    if (!store) return notFound();

    const articles = posts.data.map(blogPostToArticleDrop);

    const renderPlan = resolveStorefrontTemplate(store, {
        type: 'blog',
        path: `/store/${subdomain}/blog`,
        subdomain,
        searchParams: { page: String(page) },
    });

    const sectionData = new Map<string, SectionRenderData>();

    // E9 contract: populate liquidContext.blog for the composition engine.
    // buildLiquidCommerceContext in composition-engine reads liquidContext when the plan passes it;
    // we inject it via the liquidPage prop using a sentinel key that buildLiquidCommerceContext
    // spreads into the top-level context (the 'blog' key is checked in composition-engine E9 branch).
    // Since the composition engine spreads `page` into context when provided, we use a separate
    // mechanism: pass the blog drop as part of the liquidPage payload under the 'blog' key so the
    // E9 branch in buildLiquidCommerceContext can forward it to the Liquid scope.
    const blogDrop: Record<string, unknown> = {
        articles,
        current_page: posts.page,
        pages_count: Math.max(1, Math.ceil(posts.total / posts.limit)),
        total: posts.total,
        has_more: posts.has_more,
    };

    // liquidPage is forwarded to buildLiquidCommerceContext → spread into the scope.
    // The E9 branch in composition-engine.tsx reads plan.route.type === 'blog' and extracts
    // the blog drop from liquidPage._blog (sentinel key to avoid collision with any 'blog' template).
    const liquidPageWithBlog: Record<string, unknown> = {
        _blog: blogDrop,
    };

    return (
        <StorefrontCompositionEngine
            store={store}
            plan={renderPlan}
            sectionData={sectionData}
            liquidPage={liquidPageWithBlog}
        />
    );
}
