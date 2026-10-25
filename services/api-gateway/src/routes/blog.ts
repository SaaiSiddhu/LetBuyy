import { resolveMerchantResourceStoreIds } from '../lib/tenant-context';
import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import {
    CreateBlogPostSchema,
    ListBlogCommentsQuery,
    ListBlogPostsQuery,
    UpdateBlogCommentSchema,
    UpdateBlogPostSchema,
} from '../schemas/blog.schema';
import {
    normalizeBlogCommentRecord,
    type CmsBlogCommentRecord,
} from '@letbuyy/cms-core';
import type { z } from 'zod';

const router = new Hono<{ Bindings: Env }>();

type CreateBlogPostInput = z.infer<typeof CreateBlogPostSchema>;
type UpdateBlogPostInput = z.infer<typeof UpdateBlogPostSchema>;
type ListBlogPostsQueryInput = z.infer<typeof ListBlogPostsQuery>;
type ListBlogCommentsQueryInput = z.infer<typeof ListBlogCommentsQuery>;
type UpdateBlogCommentInput = z.infer<typeof UpdateBlogCommentSchema>;

interface BlogOwnerRow {
    store_id?: string | null;
    stores?: unknown;
}

type DatabaseErrorLike = {
    message?: string;
    details?: string;
    hint?: string;
} | null | undefined;

function databaseErrorText(error: DatabaseErrorLike): string {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}

function isMissingColumnError(error: DatabaseErrorLike, columnName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(columnName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function isMissingDeletedAtError(error: DatabaseErrorLike): boolean {
    return isMissingColumnError(error, 'deleted_at');
}

function isMissingTableError(error: DatabaseErrorLike, tableName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(tableName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

// ──────────────────────────────────────────────
//  POSTS
// ──────────────────────────────────────────────

// GET /blog/posts — List posts (filter by store, status)
router.get('/posts', validate('query', ListBlogPostsQuery), async (c) => {
    const auth = c.get('auth');
    const q = c.get('validatedQuery') as ListBlogPostsQueryInput;
    const offset = (q.page - 1) * q.limit;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = q.store_id ? [q.store_id] : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);
    if (q.store_id && !(await verifySiteOwnership(db, q.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }
    if (ownedStoreIds.length === 0) return c.json(paginated([], 0, q.page, q.limit));

    let query = db
        .from('blog_posts')
        .select('*, blog_categories(name, slug)', { count: 'exact' })
        .in('store_id', ownedStoreIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + q.limit - 1);

    if (q.status) query = query.eq('status', q.status);
    if (q.category_id) query = query.eq('category_id', q.category_id);

    const { data, error, count } = await query;

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, q.page, q.limit));
});

// GET /blog/posts/:id — Get a single post with tags
router.get('/posts/:id', async (c) => {
    const auth = c.get('auth');
    const postId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const storeIds = await resolveMerchantResourceStoreIds(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data, error } = await db
        .from('blog_posts')
        .select('*, blog_categories(id, name, slug), blog_post_tags(tag_id, blog_tags(id, name, slug))')
        .eq('id', postId).in('store_id', storeIds)
        .single();

    if (error || !data || !(await verifySiteOwnership(db, data.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
    }

    return c.json(success(data));
});

// POST /blog/posts — Create a new post
router.post('/posts', validate('json', CreateBlogPostSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateBlogPostInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this store' } }, 403);
    }

    const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data: post, error } = await db
        .from('blog_posts')
        .insert({
            store_id: body.store_id,
            author_id: customUser.id,
            title: body.title,
            slug,
            excerpt: body.excerpt || null,
            content: body.content || '',
            content_html: body.content_html || '',
            featured_image: body.featured_image || null,
            category_id: body.category_id || null,
            status: body.status || 'draft',
            published_at: body.status === 'published' ? new Date().toISOString() : null,
            seo_title: body.seo_title || null,
            seo_description: body.seo_description || null,
            allow_comments: body.allow_comments ?? true,
            is_featured: body.is_featured ?? false,
            reading_time_min: body.reading_time_min || null,
        })
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Attach tags if provided
    if (body.tag_ids && Array.isArray(body.tag_ids) && body.tag_ids.length > 0) {
        const tagRows = body.tag_ids.map((tagId: string) => ({ post_id: post.id, tag_id: tagId }));
        await db.from('blog_post_tags').insert(tagRows);
    }

    return c.json(success(post), 201);
});

// PATCH /blog/posts/:id — Update a post
router.patch('/posts/:id', validate('json', UpdateBlogPostSchema), async (c) => {
    const auth = c.get('auth');
    const postId = c.req.param('id');
    const body = c.get('validatedBody') as UpdateBlogPostInput;
    const patch = body as Record<string, unknown>;
    const db = getSupabaseAdmin(c);
    const storeIds = await resolveMerchantResourceStoreIds(c);
    const customUser = await resolveCustomUser(db, auth.user);

    // Verify ownership
    const { data: existing } = await db
        .from('blog_posts')
        .select('store_id')
        .eq('id', postId).in('store_id', storeIds)
        .single();

    const ownedPost = existing as BlogOwnerRow | null;
    if (!customUser || !ownedPost?.store_id || !(await verifySiteOwnership(db, ownedPost.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const allowed = [
        'title', 'slug', 'excerpt', 'content', 'content_html', 'featured_image',
        'category_id', 'status', 'seo_title', 'seo_description', 'og_image_url',
        'allow_comments', 'is_featured', 'is_pinned', 'reading_time_min',
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
        if (patch[key] !== undefined) updates[key] = patch[key];
    }

    // Auto-set published_at when publishing
    if (updates.status === 'published') {
        updates.published_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0 && !body.tag_ids) {
        return c.json({ error: { code: 'VALIDATION', message: 'No valid fields to update' } }, 400);
    }

    if (Object.keys(updates).length === 0) updates.updated_at = new Date().toISOString();
    const { data, error } = await db
        .from('blog_posts')
        .update(updates)
        .eq('id', postId).in('store_id', storeIds)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Replace tags if provided
    if (body.tag_ids && Array.isArray(body.tag_ids)) {
        await db.from('blog_post_tags').delete().eq('post_id', postId);
        if (body.tag_ids.length > 0) {
            const tagRows = body.tag_ids.map((tagId: string) => ({ post_id: postId, tag_id: tagId }));
            await db.from('blog_post_tags').insert(tagRows);
        }
    }

    return c.json(success(data));
});

// DELETE /blog/posts/:id — Soft delete (archive)
router.delete('/posts/:id', async (c) => {
    const auth = c.get('auth');
    const postId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const storeIds = await resolveMerchantResourceStoreIds(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: post } = await db
        .from('blog_posts')
        .select('store_id')
        .eq('id', postId).in('store_id', storeIds)
        .single();

    const ownedPost = post as BlogOwnerRow | null;
    if (!customUser || !ownedPost?.store_id || !(await verifySiteOwnership(db, ownedPost.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db
        .from('blog_posts')
        .update({ status: 'archived' })
        .eq('id', postId).in('store_id', storeIds);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

// ──────────────────────────────────────────────
//  CATEGORIES
// ──────────────────────────────────────────────

// GET /blog/categories
router.get('/categories', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = storeId ? [storeId] : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);
    if (storeId && !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }
    if (ownedStoreIds.length === 0) return c.json(success([]));

    let query = db
        .from('blog_categories')
        .select('*')
        .in('store_id', ownedStoreIds)
        .order('display_order', { ascending: true });

    const { data, error } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// POST /blog/categories
router.post('/categories', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!body.name || !body.store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'name and store_id are required' } }, 400);
    }

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data, error } = await db
        .from('blog_categories')
        .insert({
            store_id: body.store_id,
            name: body.name,
            slug,
            description: body.description || null,
            image_url: body.image_url || null,
            parent_id: body.parent_id || null,
            display_order: body.display_order || 0,
        })
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// DELETE /blog/categories/:id
router.delete('/categories/:id', async (c) => {
    const auth = c.get('auth');
    const catId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const storeIds = await resolveMerchantResourceStoreIds(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: cat } = await db
        .from('blog_categories')
        .select('store_id')
        .eq('id', catId).in('store_id', storeIds)
        .single();

    const ownedCategory = cat as BlogOwnerRow | null;
    if (!customUser || !ownedCategory?.store_id || !(await verifySiteOwnership(db, ownedCategory.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db.from('blog_categories').delete().eq('id', catId).in('store_id', storeIds);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

// ──────────────────────────────────────────────
//  TAGS
// ──────────────────────────────────────────────

// GET /blog/tags
router.get('/tags', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = storeId ? [storeId] : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);
    if (storeId && !(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }
    if (ownedStoreIds.length === 0) return c.json(success([]));

    let query = db
        .from('blog_tags')
        .select('*')
        .in('store_id', ownedStoreIds)
        .order('name', { ascending: true });

    const { data, error } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// POST /blog/tags — Create or get existing tag
router.post('/tags', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!body.name || !body.store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'name and store_id are required' } }, 400);
    }
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Upsert: return existing or create new
    const { data, error } = await db
        .from('blog_tags')
        .upsert(
            { store_id: body.store_id, name: body.name, slug },
            { onConflict: 'store_id,slug' }
        )
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// ──────────────────────────────────────────────
//  COMMENTS
// ──────────────────────────────────────────────

router.get('/comments', validate('query', ListBlogCommentsQuery), async (c) => {
    const auth = c.get('auth');
    const q = c.get('validatedQuery') as ListBlogCommentsQueryInput;
    const offset = (q.page - 1) * q.limit;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, q.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const buildCommentsQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
            .from('blog_comments')
            .select('*, blog_posts(title)', { count: 'exact' })
            .eq('store_id', q.store_id);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        if (q.status !== 'all') query = query.eq('status', q.status);

        return query
            .order('created_at', { ascending: false })
            .range(offset, offset + q.limit - 1);
    };

    let { data, error, count } = await buildCommentsQuery(true);

    if (isMissingDeletedAtError(error)) {
        ({ data, error, count } = await buildCommentsQuery(false));
    }

    if (isMissingTableError(error, 'blog_comments')) {
        return c.json(paginated([], 0, q.page, q.limit));
    }

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(((data || []) as CmsBlogCommentRecord[]).map(normalizeBlogCommentRecord), count || 0, q.page, q.limit));
});

router.patch('/comments/:id', validate('json', UpdateBlogCommentSchema), async (c) => {
    const auth = c.get('auth');
    const commentId = c.req.param('id');
    const body = c.get('validatedBody') as UpdateBlogCommentInput;
    const db = getSupabaseAdmin(c);
    const storeIds = await resolveMerchantResourceStoreIds(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const selectExistingComment = (includeDeletedAtFilter: boolean) => {
        let request = db
            .from('blog_comments')
            .select('store_id')
            .eq('id', commentId).in('store_id', storeIds);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);
        return request.single();
    };

    let { data: existing, error: existingError } = await selectExistingComment(true);

    if (isMissingDeletedAtError(existingError)) {
        ({ data: existing, error: existingError } = await selectExistingComment(false));
    }

    const ownedComment = existing as BlogOwnerRow | null;
    if (!customUser || !ownedComment?.store_id || !(await verifySiteOwnership(db, ownedComment.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('blog_comments')
        .update({ status: body.status, moderated_at: new Date().toISOString() })
        .eq('id', commentId).in('store_id', storeIds)
        .select('*, blog_posts(title)')
        .single();

    if (error || !data) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error?.message || 'Unable to update comment' } }, 500);
    }

    return c.json(success(normalizeBlogCommentRecord(data as CmsBlogCommentRecord)));
});

router.delete('/comments/:id', async (c) => {
    const auth = c.get('auth');
    const commentId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const storeIds = await resolveMerchantResourceStoreIds(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const selectExistingComment = (includeDeletedAtFilter: boolean) => {
        let request = db
            .from('blog_comments')
            .select('store_id')
            .eq('id', commentId).in('store_id', storeIds);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);
        return request.single();
    };

    let { data: existing, error: existingError } = await selectExistingComment(true);

    if (isMissingDeletedAtError(existingError)) {
        ({ data: existing, error: existingError } = await selectExistingComment(false));
    }

    const ownedComment = existing as BlogOwnerRow | null;
    if (!customUser || !ownedComment?.store_id || !(await verifySiteOwnership(db, ownedComment.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db
        .from('blog_comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', commentId).in('store_id', storeIds);

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ deleted: true }));
});

async function listOwnedStoreIds(
    db: ReturnType<typeof getSupabaseAdmin>,
    userId: string,
    sessionStoreId?: string
) {
    const buildOwnedStoresQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
        .from('sites')
        .select('id')
        .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        if (sessionStoreId) query = query.eq('id', sessionStoreId);
        return query;
    };

    let { data, error } = await buildOwnedStoresQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error } = await buildOwnedStoresQuery(false));
    }
    if (error) throw new Error(`Store ownership lookup failed: ${error.message}`);

    return (data || []).map((store) => store.id as string);
}

export default router;
