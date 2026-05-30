import { notFound } from 'next/navigation';
import ContentResourceRenderer from '@/components/content/content-resource-renderer';
import { ContentService } from '@/lib/content-service';
import { StoreService } from '@/lib/store-service';
import { buildStoreMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

type Props = {
    params: Promise<{ subdomain: string; slug: string }>;
};

function seoText(seo: Record<string, unknown>, key: string): string | undefined {
    const value = seo[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { subdomain, slug } = await params;
    const [store, post] = await Promise.all([
        StoreService.getStoreBySubdomain(subdomain),
        ContentService.getBlogPostBySlug(subdomain, slug),
    ]);

    if (!store || !post) return { title: 'Post Not Found' };

    return buildStoreMetadata(store, {
        title: seoText(post.seo, 'title') || `${post.title} | ${store.name}`,
        description: seoText(post.seo, 'description') || `${post.title} from ${store.name}.`,
        path: `/blog/${post.slug}`,
        image: seoText(post.seo, 'ogImage'),
    });
}

export default async function BlogPostPage({ params }: Props) {
    const { subdomain, slug } = await params;
    const [store, post] = await Promise.all([
        StoreService.getStoreBySubdomain(subdomain),
        ContentService.getBlogPostBySlug(subdomain, slug),
    ]);

    if (!store || !post) return notFound();

    return (
        <ContentResourceRenderer
            store={store}
            resource={post}
            routeType="article"
            path={`/store/${subdomain}/blog/${slug}`}
            subdomain={subdomain}
        />
    );
}
