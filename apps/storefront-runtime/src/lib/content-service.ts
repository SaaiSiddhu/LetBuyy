import 'server-only';

import { readWorkerJson, storefrontReadInit, workerFetch } from './worker-client';

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

async function fetchContent(path: string): Promise<StorefrontContentResource | null> {
    const response = await workerFetch(path, storefrontReadInit(CONTENT_REVALIDATE_SECONDS, ['storefront:content']));
    if (response.status === 404) return null;

    const payload = await readWorkerJson(response);
    const data = payload?.data as WorkerContentPayload | undefined;
    return data ? mapContentResource(data) : null;
}

export const ContentService = {
    async listPages(subdomain: string) {
        const response = await workerFetch(
            `/storefront/${encodeURIComponent(subdomain)}/pages`,
            storefrontReadInit(CONTENT_REVALIDATE_SECONDS, [`storefront:${subdomain}:pages`]),
        );
        if (response.status === 404) return [];
        const payload = await readWorkerJson(response);
        const data = payload?.data;
        return Array.isArray(data)
            ? data.map((item) => mapContentResource(item as WorkerContentPayload))
            : [];
    },

    async listBlogPosts(subdomain: string) {
        const response = await workerFetch(
            `/storefront/${encodeURIComponent(subdomain)}/blog?limit=100`,
            storefrontReadInit(CONTENT_REVALIDATE_SECONDS, [`storefront:${subdomain}:blog`]),
        );
        if (response.status === 404) return [];
        const payload = await readWorkerJson(response);
        const data = payload?.data;
        return Array.isArray(data)
            ? data.map((item) => mapBlogPostSummary(item as Record<string, unknown>))
            : [];
    },

    async getPageBySlug(subdomain: string, slug: string) {
        return fetchContent(`/storefront/${encodeURIComponent(subdomain)}/pages/${encodeURIComponent(slug)}`);
    },

    async getBlogPostBySlug(subdomain: string, slug: string) {
        return fetchContent(`/storefront/${encodeURIComponent(subdomain)}/blog/${encodeURIComponent(slug)}`);
    },

    async getPolicy(subdomain: string, policyType: string) {
        return fetchContent(`/storefront/${encodeURIComponent(subdomain)}/policies/${encodeURIComponent(policyType)}`);
    },
};
