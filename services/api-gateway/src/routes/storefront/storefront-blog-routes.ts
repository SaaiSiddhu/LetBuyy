// ROUTE-1 — the public storefront blog band, extracted from public-routes.ts.
//
// public-routes.ts was at 1496 lines against route-line-count-validator's `<= 1500`: four lines from
// being unable to accept any new public route at all, a limit MKT-3 had already had to work around.
// The blog is the cleanest boundary in that file — two public GETs over blog posts, sharing nothing
// with catalog, cart, theme or checkout beyond the store loader and the cache helpers.
//
// Module-level utilities are imported; anything public-routes.ts receives by INJECTION is injected
// here too, so there is never a second definition of a store lookup to drift from the first.
// storefrontCacheTags is the one local helper, and it is passed rather than copied: two cache-tag
// rules that disagree produce a purge that misses, which is invisible until stale data is served.

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, getSupabaseAdmin, paginated, success } from '../../lib/supabase';
import {
    cachedJson,
    storefrontRequestCacheKey,
    STOREFRONT_CACHE_SWR_SECONDS,
    STOREFRONT_CACHE_TTL_SECONDS,
} from '../../lib/storefront-cache';
import { normalizeStorefrontHandle, type PublishedStoreRecord } from '@letbuyy/tenant-core';
import type { AppContext } from './customer-engagement-routes';

export interface StorefrontBlogRoutesDeps {
    loadPublishedStore: (c: AppContext, handle: string) => Promise<PublishedStoreRecord | null>;
    normalizePublicRouteToken: (value: string) => string | null;
    /// Passed, not copied: two cache-tag rules that disagree produce a purge that misses, and a
    /// purge that misses is invisible until someone is served stale content.
    storefrontCacheTags: (storeId: string, handle: string, ...tags: string[]) => string[];
}

export function registerStorefrontBlogRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: StorefrontBlogRoutesDeps,
): void {
    const { loadPublishedStore, normalizePublicRouteToken, storefrontCacheTags } = deps;

    router.get('/:subdomain/blog', async (c) => {
        const page = parseInt(c.req.query('page') || '1');
        const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50);
        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'blog', handle), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const db = getSupabaseAdmin(c);
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }
            const { data, count } = await db.from('blog_posts').select('id,title,slug,excerpt,featured_image,published_at,created_at,updated_at,is_pinned,seo_title,seo_description,og_image_url', { count: 'exact' })
                .eq('store_id', store.id).eq('status', 'published').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
            return {
                body: paginated(data || [], count || 0, page, limit),
                tags: storefrontCacheTags(store.id, handle, 'storefront:blog'),
            };
        });
    });

    // GET /storefront/:subdomain/blog/:slug
    router.get('/:subdomain/blog/:slug', async (c) => {
        const slug = normalizePublicRouteToken(c.req.param('slug'));
        if (!slug) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid blog post slug' } }, 400);
        }

        const handle = normalizeStorefrontHandle(c.req.param('subdomain')) || c.req.param('subdomain');
        return cachedJson(c, await storefrontRequestCacheKey(c, 'blog-detail', handle, slug), STOREFRONT_CACHE_TTL_SECONDS, STOREFRONT_CACHE_SWR_SECONDS, async () => {
            const db = getSupabaseAdmin(c);
            const store = await loadPublishedStore(c, c.req.param('subdomain'));
            if (!store) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Store not found' } },
                };
            }

            const { data, error } = await db.from('blog_posts')
                .select('id,title,slug,excerpt,content,content_html,featured_image,published_at,updated_at,seo_title,seo_description,og_image_url,canonical_url')
                .eq('store_id', store.id)
                .eq('status', 'published')
                .eq('slug', slug)
                .maybeSingle();

            if (error) return { status: 500, body: dbFailureBody() };
            if (!data) {
                return {
                    status: 404,
                    body: { success: false, error: { code: 'NOT_FOUND', message: 'Blog post not found' } },
                };
            }

            return {
                body: success({
                    id: data.id,
                    title: data.title,
                    slug: data.slug,
                    page_type: 'blog_post',
                    content: {
                        body: data.content || '',
                        html: data.content_html || '',
                        image: data.featured_image || '',
                        excerpt: data.excerpt || '',
                    },
                    seo: {
                        title: data.seo_title || data.title,
                        description: data.seo_description || data.excerpt || '',
                        ogImage: data.og_image_url || data.featured_image || '',
                        canonicalUrl: data.canonical_url || '',
                    },
                    published_at: data.published_at,
                    updated_at: data.updated_at,
                }),
                tags: storefrontCacheTags(store.id, handle, 'storefront:blog', `storefront:blog:${slug}`),
            };
        });
    });
}
