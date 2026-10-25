import 'server-only';

import { createStorefrontApiClient, storefrontReadInit } from './api/client';
import type { ThemePreviewContentQuery } from '@letbuyy/api-client';
import type { PaginatedResponse } from '@letbuyy/shared-types';

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

// Existing sitemap callers consume the summaries; listing callers also retain
// the canonical pagination envelope. Both use the same scoped public read.
async function listBlogPosts(subdomain: string): Promise<StorefrontBlogPostSummary[]>;
async function listBlogPosts(subdomain: string, query: { page: number; limit: number }): Promise<PaginatedResponse<StorefrontBlogPostSummary>>;
async function listBlogPosts(subdomain: string, query?: { page: number; limit: number }) {
    try {
        const response = await storefrontContentClient(subdomain, 'blog').blogPosts(subdomain, query || { page: 1, limit: 50 });
        const result = { ...response, data: response.data.map(item => mapBlogPostSummary(item as Record<string, unknown>)) };
        return query ? result : result.data;
    } catch (error) {
        if (isNotFoundError(error)) return query ? { data: [], total: 0, page: query.page, limit: query.limit, has_more: false } : [];
        throw error;
    }
}

export const ContentService = {
    async getPreviewContent(subdomain: string, token: string, query: ThemePreviewContentQuery) {
        try {
            const payload = await createStorefrontApiClient({ cache: 'no-store' }).storefront.themePreviewContent(subdomain, token, query);
            if (payload.resource !== query.resource || !Array.isArray(payload.articles) || !Number.isInteger(payload.pagination?.page) || typeof payload.pagination?.has_more !== 'boolean') throw new Error('Invalid preview content response');
            if (query.resource !== 'blog' && payload.content?.id !== query.resource_id) throw new Error('Preview content does not match the selected resource');
            const content = payload.content ? mapContentResource({
                id: payload.content.id, title: payload.content.title ?? undefined, slug: payload.content.slug ?? undefined,
                page_type: payload.content.page_type ?? undefined, content: asRecord(payload.content.content), seo: asRecord(payload.content.seo),
                assigned_template_key: payload.content.assigned_template_key, published_at: payload.content.published_at, updated_at: payload.content.updated_at,
            }) : null;
            return { resource: payload.resource, content, articles: payload.articles.map(mapBlogPostSummary), pagination: payload.pagination };
        } catch (error) {
            if (isNotFoundError(error)) return null;
            // Capability URLs and upstream response objects must never enter logs.
            throw new Error('Preview content is unavailable. Retry the preview.');
        }
    },
    async listPages(subdomain: string) {
        try {
            const data = await storefrontContentClient(subdomain, 'pages').pages(subdomain);
            return data.map((item) => mapContentResource(item as WorkerContentPayload));
        } catch (error) {
            if (isNotFoundError(error)) return [];
            throw error;
        }
    },

    listBlogPosts,

    async getPageBySlug(subdomain: string, slug: string) {
        return fetchContent(() => storefrontContentClient(subdomain, 'pages').page(subdomain, slug) as Promise<WorkerContentPayload>);
    },

    async getBlogPostBySlug(subdomain: string, slug: string) {
        return fetchContent(() => storefrontContentClient(subdomain, 'blog').blogPost(subdomain, slug) as Promise<WorkerContentPayload>);
    },

    async getPolicy(subdomain: string, policyType: string) {
        return fetchContent(() => storefrontContentClient(subdomain, 'policies').policy(subdomain, policyType) as Promise<WorkerContentPayload>);
    },

    // T3-fix W3 — the set of policy TYPES a store has actually published, in one call (the
    // gateway already filters to status='published'). Used to decide which footer/policy links
    // are real before rendering them, instead of the theme unconditionally emitting all four.
    async listPolicies(subdomain: string) {
        try {
            const data = await storefrontContentClient(subdomain, 'policies').policies(subdomain);
            return data.map((item) => mapContentResource(item as WorkerContentPayload));
        } catch (error) {
            if (isNotFoundError(error)) return [];
            throw error;
        }
    },
};
