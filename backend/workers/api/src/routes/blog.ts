import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// ──────────────────────────────────────────────
//  POSTS
// ──────────────────────────────────────────────

// GET /blog/posts — List posts (filter by store, status)
router.get('/posts', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const status = c.req.query('status');
    const categoryId = c.req.query('category_id');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    let query = db
        .from('blog_posts')
        .select('*, blog_categories(name, slug), stores!inner(user_id)', { count: 'exact' })
        .eq('stores.user_id', auth.user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (storeId) query = query.eq('store_id', storeId);
    if (status) query = query.eq('status', status);
    if (categoryId) query = query.eq('category_id', categoryId);

    const { data, error, count } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /blog/posts/:id — Get a single post with tags
router.get('/posts/:id', async (c) => {
    const postId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('blog_posts')
        .select('*, blog_categories(id, name, slug), blog_post_tags(tag_id, blog_tags(id, name, slug))')
        .eq('id', postId)
        .single();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
    }

    return c.json(success(data));
});

// POST /blog/posts — Create a new post
router.post('/posts', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.title || !body.store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'title and store_id are required' } }, 400);
    }

    // Verify store ownership
    const { data: store } = await db
        .from('stores')
        .select('id')
        .eq('id', body.store_id)
        .eq('user_id', auth.user.id)
        .single();

    if (!store) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'You do not own this store' } }, 403);
    }

    const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data: post, error } = await db
        .from('blog_posts')
        .insert({
            store_id: body.store_id,
            author_id: auth.user.id,
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
router.patch('/posts/:id', async (c) => {
    const auth = c.get('auth');
    const postId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    // Verify ownership
    const { data: existing } = await db
        .from('blog_posts')
        .select('store_id, stores!inner(user_id)')
        .eq('id', postId)
        .single();

    if (!existing || (existing as any).stores?.user_id !== auth.user.id) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const allowed = [
        'title', 'slug', 'excerpt', 'content', 'content_html', 'featured_image',
        'category_id', 'status', 'seo_title', 'seo_description', 'og_image_url',
        'allow_comments', 'is_featured', 'is_pinned', 'reading_time_min',
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key];
    }

    // Auto-set published_at when publishing
    if (updates.status === 'published') {
        updates.published_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'No valid fields to update' } }, 400);
    }

    const { data, error } = await db
        .from('blog_posts')
        .update(updates)
        .eq('id', postId)
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

    const { data: post } = await db
        .from('blog_posts')
        .select('store_id, stores!inner(user_id)')
        .eq('id', postId)
        .single();

    if (!post || (post as any).stores?.user_id !== auth.user.id) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db
        .from('blog_posts')
        .update({ status: 'archived' })
        .eq('id', postId);

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

    let query = db
        .from('blog_categories')
        .select('*, stores!inner(user_id)')
        .eq('stores.user_id', auth.user.id)
        .order('display_order', { ascending: true });

    if (storeId) query = query.eq('store_id', storeId);

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

    if (!body.name || !body.store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'name and store_id are required' } }, 400);
    }

    const { data: store } = await db
        .from('stores')
        .select('id')
        .eq('id', body.store_id)
        .eq('user_id', auth.user.id)
        .single();

    if (!store) {
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

    const { data: cat } = await db
        .from('blog_categories')
        .select('store_id, stores!inner(user_id)')
        .eq('id', catId)
        .single();

    if (!cat || (cat as any).stores?.user_id !== auth.user.id) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db.from('blog_categories').delete().eq('id', catId);

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

    let query = db
        .from('blog_tags')
        .select('*, stores!inner(user_id)')
        .eq('stores.user_id', auth.user.id)
        .order('name', { ascending: true });

    if (storeId) query = query.eq('store_id', storeId);

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

    if (!body.name || !body.store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'name and store_id are required' } }, 400);
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

export default router;
