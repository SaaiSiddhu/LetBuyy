import 'server-only';

import { createStorefrontApiClient, storefrontReadInit } from './worker-client';

export type StorefrontContentResource = {
    id: string;
    title: string;
    slug: string;
    pageType?: string;
    policyType?: string;
    content: Record<string, unknown>;
    seo: Record<string, unknown>;
    assignedTemplateKey?: string | null;
    publishedAt?: string | null;
    updatedAt?: string | null;
};

export type StorefrontBlogPostSummary = {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    featuredImage?: string | null;
    publishedAt?: string | null;
    updatedAt?: string | null;
};

type WorkerContentPayload = Record<string, unknown> & {
    id?: string;
    title?: string;
    slug?: string;
    page_type?: string;
    policy_type?: string;
    content?: Record<string, unknown>;
    seo?: Record<string, unknown>;
    assigned_template_key?: string | null;
    published_at?: string | null;
    updated_at?: string | null;
};

const CONTENT_REVALIDATE_SECONDS = 60;

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function mapContentResource(data: WorkerContentPayload): StorefrontContentResource {
    return {
        id: data.id || '',
        title: data.title || 'Untitled page',
        slug: data.slug || '',
        pageType: data.page_type,
        policyType: data.policy_type,
        content: asRecord(data.content),
        seo: asRecord(data.seo),
        assignedTemplateKey: data.assigned_template_key || null,
        publishedAt: data.published_at || null,
        updatedAt: data.updated_at || null,
    };
}

function mapBlogPostSummary(data: Record<string, unknown>): StorefrontBlogPostSummary {
    return {
        id: (data.id as string) || '',
        title: (data.title as string) || 'Untitled post',
        slug: (data.slug as string) || '',
        excerpt: data.excerpt as string | null,
        featuredImage: data.featured_image as string | null,
        publishedAt: (data.published_at as string) || (data.created_at as string) || null,
        updatedAt: data.updated_at as string | null,
    };
}

function isNotFoundError(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 404);
}

function storefrontContentClient(subdomain: string, tag: string) {
    return createStorefrontApiClient(
        storefrontReadInit(CONTENT_REVALIDATE_SECONDS, [
            'storefront:content',
            `storefront:${subdomain}:${tag}`,
        ]),
    ).storefront;
}

async function fetchContent(fetcher: () => Promise<WorkerContentPayload>): Promise<StorefrontContentResource | null> {
    try {
        const data = await fetcher();
        return data ? mapContentResource(data) : null;
    } catch (error) {
        if (isNotFoundError(error)) return null;
        throw error;
    }
}

export const ContentService = {
    async listPages(subdomain: string) {
        try {
            const data = await storefrontContentClient(subdomain, 'pages').pages(subdomain);
            return data.map((item) => mapContentResource(item as WorkerContentPayload));
        } catch (error) {
            if (isNotFoundError(error)) return [];
            throw error;
        }
    },

    async listBlogPosts(subdomain: string) {
        try {
            const response = await storefrontContentClient(subdomain, 'blog').blogPosts(subdomain, { limit: 100 });
            return response.data.map((item) => mapBlogPostSummary(item as Record<string, unknown>));
        } catch (error) {
            if (isNotFoundError(error)) return [];
            throw error;
        }
    },

    async getPageBySlug(subdomain: string, slug: string) {
        return fetchContent(() => storefrontContentClient(subdomain, 'pages').page(subdomain, slug) as Promise<WorkerContentPayload>);
    },

    async getBlogPostBySlug(subdomain: string, slug: string) {
        return fetchContent(() => storefrontContentClient(subdomain, 'blog').blogPost(subdomain, slug) as Promise<WorkerContentPayload>);
    },

    async getPolicy(subdomain: string, policyType: string) {
        return fetchContent(() => storefrontContentClient(subdomain, 'policies').policy(subdomain, policyType) as Promise<WorkerContentPayload>);
    },
};
