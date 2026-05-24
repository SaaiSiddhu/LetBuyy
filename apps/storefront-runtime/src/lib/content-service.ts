import 'server-only';

import { readWorkerJson, workerFetch } from './worker-client';

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

async function fetchContent(path: string): Promise<StorefrontContentResource | null> {
    const response = await workerFetch(path);
    if (response.status === 404) return null;

    const payload = await readWorkerJson(response);
    const data = payload?.data as WorkerContentPayload | undefined;
    return data ? mapContentResource(data) : null;
}

export const ContentService = {
    async getPageBySlug(subdomain: string, slug: string) {
        return fetchContent(`/storefront/${encodeURIComponent(subdomain)}/pages/${encodeURIComponent(slug)}`);
    },

    async getPolicy(subdomain: string, policyType: string) {
        return fetchContent(`/storefront/${encodeURIComponent(subdomain)}/policies/${encodeURIComponent(policyType)}`);
    },
};
