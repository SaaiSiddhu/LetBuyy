import { z } from 'zod';
import { UuidSchema } from '@letbuyy/shared-types';
import { normalizeStorefrontRoutePage, type CmsStorefrontRoutePageRecord } from '@letbuyy/cms-core';
import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';

const querySchema = z.object({
    resource: z.enum(['page', 'article', 'blog']), resource_id: UuidSchema.optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
}).superRefine((query, context) => {
    if ((query.resource !== 'blog' && !query.resource_id) || (query.resource === 'blog' && query.resource_id))
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['resource_id'], message: 'Choose one resource for a page or article preview.' });
});
const failure = (status: 400 | 404 | 500, code: string, message: string) => ({ status, body: { success: false, error: { code, message } } });
const articleSummary = (row: Record<string, unknown>) => ({
    id: String(row.id), title: String(row.title || 'Untitled post'), slug: String(row.slug || ''),
    excerpt: row.excerpt || null, featured_image: row.featured_image || null, published_at: row.published_at || null, updated_at: row.updated_at || null,
});

/** Called only after the existing signed preview verifies token, site, expiry
 * and saved draft. The caller supplies the verified site, never query.store_id.
 * A preview may read unpublished current CMS content; nothing is published here. */
export async function readThemePreviewContent(db: SupabaseClient, verifiedStoreId: string, input: unknown) {
    const parsed = querySchema.safeParse(input);
    if (!parsed.success) return failure(400, 'VALIDATION', 'Invalid preview content resource or page.');
    const { resource, resource_id, page, limit } = parsed.data;
    if (resource === 'blog') {
        const { data, error, count } = await db.from('blog_posts').select('id,title,slug,excerpt,featured_image,published_at,updated_at', { count: 'exact' })
            .eq('store_id', verifiedStoreId).is('deleted_at', null).neq('status', 'archived')
            .order('created_at', { ascending: false }).order('id', { ascending: true }).range((page - 1) * limit, page * limit);
        if (error || count === null || !Number.isInteger(count) || count < 0) return failure(500, 'PREVIEW_CONTENT_UNAVAILABLE', 'Preview content is unavailable.');
        const rows = (data || []) as Record<string, unknown>[];
        return { status: 200 as const, body: { success: true, data: { resource, content: null, articles: rows.slice(0, limit).map(articleSummary), pagination: { page, limit, has_more: rows.length > limit, total: count, total_pages: Math.max(1, Math.ceil(count / limit)) } } } };
    }
    const result = resource === 'page'
        ? await db.from('storefront_pages').select('id,title,slug,page_type,status,content,seo,assigned_template_key,published_at,updated_at')
            .eq('store_id', verifiedStoreId).eq('id', resource_id!).is('deleted_at', null).neq('status', 'archived').maybeSingle()
        : await db.from('blog_posts').select('id,title,slug,excerpt,content,content_html,featured_image,published_at,updated_at,seo_title,seo_description,og_image_url,canonical_url')
            .eq('store_id', verifiedStoreId).eq('id', resource_id!).is('deleted_at', null).neq('status', 'archived').maybeSingle();
    if (result.error) return failure(500, 'PREVIEW_CONTENT_UNAVAILABLE', 'Preview content is unavailable.');
    if (!result.data) return failure(404, 'NOT_FOUND', 'Preview content not found.');
    const row = result.data as Record<string, unknown>;
    const content = resource === 'page' ? normalizeStorefrontRoutePage(row as unknown as CmsStorefrontRoutePageRecord) : normalizeStorefrontRoutePage({
        id: String(row.id), title: String(row.title || 'Untitled post'), slug: String(row.slug || ''), page_type: 'blog_post',
        content: { body: row.content || '', html: row.content_html || '', image: row.featured_image || '', excerpt: row.excerpt || '' },
        seo: { title: row.seo_title || row.title, description: row.seo_description || row.excerpt, ogImage: row.og_image_url || row.featured_image, canonicalUrl: row.canonical_url || '' },
        published_at: row.published_at as string | null, updated_at: row.updated_at as string | null,
    });
    return { status: 200 as const, body: { success: true, data: { resource, content, articles: [], pagination: { page: 1, limit: 1, has_more: false } } } };
}

/** Exact collection metadata for the preview picker, including beyond page one.
 * Uses the same already-verified site capability as the CMS helper above. */
export async function readThemePreviewCollection(db: SupabaseClient, verifiedStoreId: string, identifier: unknown) {
    const parsed = UuidSchema.safeParse(identifier);
    if (!parsed.success) return failure(400, 'VALIDATION', 'Choose a valid preview collection.');
    const { data, error } = await db.from('collections').select('id,title,description,image_url')
        .eq('store_id', verifiedStoreId).eq('id', parsed.data).eq('is_active', true).is('deleted_at', null).maybeSingle();
    if (error) return failure(500, 'PREVIEW_CONTENT_UNAVAILABLE', 'Preview collection is unavailable.');
    if (!data) return failure(404, 'NOT_FOUND', 'Preview collection not found.');
    return { status: 200 as const, body: { success: true, data } };
}
