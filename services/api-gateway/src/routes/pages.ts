import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import {
    CreatePageSchema,
    CreatePolicySchema,
    ListNavigationQuery,
    ListPagesQuery,
    ListPoliciesQuery,
    ReplaceNavigationSchema,
    UpdatePageSchema,
    UpdatePolicySchema,
} from '../schemas/page.schema';
import type { z } from 'zod';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;

type CreatePageInput = z.infer<typeof CreatePageSchema>;
type ListPagesInput = z.infer<typeof ListPagesQuery>;
type UpdatePageInput = z.infer<typeof UpdatePageSchema>;
type ListPoliciesInput = z.infer<typeof ListPoliciesQuery>;
type CreatePolicyInput = z.infer<typeof CreatePolicySchema>;
type UpdatePolicyInput = z.infer<typeof UpdatePolicySchema>;
type ListNavigationInput = z.infer<typeof ListNavigationQuery>;
type ReplaceNavigationInput = z.infer<typeof ReplaceNavigationSchema>;

interface PageOwnerRow {
    id: string;
    store_id?: string | null;
    stores?: unknown;
}

interface PageRow extends PageOwnerRow {
    title?: string | null;
    slug?: string | null;
    body?: string | null;
    content?: Record<string, unknown> | null;
    html_content?: string | null;
    status?: string | null;
    page_type?: string | null;
    show_in_nav?: boolean | null;
    updated_at?: string | null;
    published_at?: string | null;
    seo?: Record<string, unknown> | null;
    assigned_template_key?: string | null;
}

interface StorefrontPolicyRow {
    id: string;
    store_id: string;
    policy_type: string;
    slug: string;
    title: string;
    body?: Record<string, unknown> | null;
    status?: string | null;
    seo?: Record<string, unknown> | null;
    published_at?: string | null;
    updated_at?: string | null;
}

interface NavigationMenuRow {
    id: string;
    store_id: string;
    handle: string;
    name: string;
    location: string;
}

interface NavigationItemRow {
    id: string;
    menu_id: string;
    store_id: string;
    parent_item_id?: string | null;
    label: string;
    url?: string | null;
    target_type?: string | null;
    target_resource_id?: string | null;
    sort_order?: number | null;
    is_visible?: boolean | null;
    open_in_new_tab?: boolean | null;
    metadata?: Record<string, unknown> | null;
    updated_at?: string | null;
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

function isSchemaMismatchError(error: DatabaseErrorLike): boolean {
    const text = databaseErrorText(error);
    return text.includes('does not exist') || text.includes('schema cache') || text.includes('could not find');
}

function isMissingTableError(error: DatabaseErrorLike, tableName: string): boolean {
    return databaseErrorText(error).includes(tableName.toLowerCase()) && isSchemaMismatchError(error);
}

async function requireOwnedStore(c: AppContext, storeId: string) {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return {
            db,
            ok: false as const,
            response: c.json({ success: false, error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403),
        };
    }

    if (!(await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId))) {
        return {
            db,
            ok: false as const,
            response: c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403),
        };
    }

    return { db, ok: true as const, customUser };
}

function seoFromInput(input: {
    seo_title?: string | null;
    seo_description?: string | null;
}) {
    return {
        title: input.seo_title || null,
        description: input.seo_description || null,
    };
}

function bodyToContent(body: string | undefined | null) {
    return { body: body || '' };
}

function normalizeStorefrontPage(row: PageRow) {
    const content = row.content || {};
    const body = row.body || row.html_content || getString(content, 'body') || getString(content, 'html') || '';
    const seo = row.seo || {};

    return {
        id: row.id,
        store_id: row.store_id,
        title: row.title || 'Untitled page',
        slug: row.slug || '',
        body,
        content: content || { body },
        page_type: row.page_type || 'custom',
        status: row.status || 'draft',
        show_in_nav: Boolean(row.show_in_nav),
        seo_title: getString(seo, 'title'),
        seo_description: getString(seo, 'description'),
        assigned_template_key: row.assigned_template_key || null,
        published_at: row.published_at || null,
        updated_at: row.updated_at || null,
    };
}

async function ensurePageRevision(
    db: ReturnType<typeof getSupabaseAdmin>,
    page: PageRow,
    content: Record<string, unknown>,
    seo: Record<string, unknown>,
) {
    const revisionNumberResult = await db
        .from('storefront_page_revisions')
        .select('revision_number')
        .eq('page_id', page.id)
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (isMissingTableError(revisionNumberResult.error, 'storefront_page_revisions')) return null;
    if (revisionNumberResult.error) throw new Error(revisionNumberResult.error.message);

    const nextRevision = Number(revisionNumberResult.data?.revision_number || 0) + 1;
    const revisionInsert = await db
        .from('storefront_page_revisions')
        .insert({
            page_id: page.id,
            store_id: page.store_id,
            revision_number: nextRevision,
            title: page.title || 'Untitled page',
            slug: page.slug || '',
            seo,
            content,
            template_key: page.assigned_template_key || null,
        })
        .select('id')
        .single();

    if (revisionInsert.error) throw new Error(revisionInsert.error.message);
    return revisionInsert.data?.id as string | undefined;
}

async function ensureNavigationMenu(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    location: string,
    name?: string,
): Promise<NavigationMenuRow | null> {
    const existing = await db
        .from('navigation_menus')
        .select('id,store_id,handle,name,location')
        .eq('store_id', storeId)
        .eq('handle', location)
        .is('deleted_at', null)
        .maybeSingle();

    if (!existing.error && existing.data) return existing.data as NavigationMenuRow;
    if (existing.error && !(isMissingTableError(existing.error, 'navigation_menus') || isSchemaMismatchError(existing.error))) {
        throw new Error(existing.error.message);
    }
    if (existing.error && isMissingTableError(existing.error, 'navigation_menus')) return null;

    const created = await db
        .from('navigation_menus')
        .insert({
            store_id: storeId,
            handle: location,
            location,
            name: name || `${location.charAt(0).toUpperCase()}${location.slice(1)} menu`,
            status: 'active',
        })
        .select('id,store_id,handle,name,location')
        .single();

    if (created.error) throw new Error(created.error.message);
    return created.data as NavigationMenuRow;
}

async function syncPageNavigationItem(
    db: ReturnType<typeof getSupabaseAdmin>,
    page: ReturnType<typeof normalizeStorefrontPage>,
) {
    const menu = await ensureNavigationMenu(db, page.store_id || '', 'main', 'Main menu');
    if (!menu) return;

    const existing = await db
        .from('navigation_menu_items')
        .select('id')
        .eq('menu_id', menu.id)
        .eq('target_type', 'page')
        .eq('target_resource_id', page.id)
        .is('deleted_at', null)
        .maybeSingle();

    if (existing.error && !(isMissingTableError(existing.error, 'navigation_menu_items') || isSchemaMismatchError(existing.error))) {
        throw new Error(existing.error.message);
    }
    if (existing.error && isMissingTableError(existing.error, 'navigation_menu_items')) return;

    if (!page.show_in_nav || page.status !== 'published') {
        if (existing.data?.id) {
            await db
                .from('navigation_menu_items')
                .update({ deleted_at: new Date().toISOString(), is_visible: false })
                .eq('id', existing.data.id);
        }
        return;
    }

    const payload = {
        menu_id: menu.id,
        store_id: page.store_id,
        label: page.title,
        url: `/${page.slug}`,
        target_type: 'page',
        target_resource_id: page.id,
        is_visible: true,
    };

    if (existing.data?.id) {
        await db.from('navigation_menu_items').update(payload).eq('id', existing.data.id);
    } else {
        await db.from('navigation_menu_items').insert(payload);
    }
}

router.get('/', validate('query', ListPagesQuery), async (c) => {
    const query = c.get('validatedQuery') as ListPagesInput;
    const offset = (query.page - 1) * query.limit;
    const ownership = await requireOwnedStore(c, query.store_id);
    if (!ownership.ok) return ownership.response;
    const { db } = ownership;

    let newPagesRequest = db
        .from('storefront_pages')
        .select('id,store_id,title,slug,status,page_type,seo,content,assigned_template_key,published_at,updated_at', { count: 'exact' })
        .eq('store_id', query.store_id)
        .is('deleted_at', null);

    if (query.status !== 'all') newPagesRequest = newPagesRequest.eq('status', query.status);

    const newPagesResult = await newPagesRequest
        .order('updated_at', { ascending: false })
        .range(offset, offset + query.limit - 1);

    if (!newPagesResult.error) {
        return c.json(paginated(
            (newPagesResult.data || []).map((row) => normalizeStorefrontPage(row as PageRow)),
            newPagesResult.count || 0,
            query.page,
            query.limit
        ));
    }

    if (!(isMissingTableError(newPagesResult.error, 'storefront_pages') || isSchemaMismatchError(newPagesResult.error))) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: newPagesResult.error.message } }, 500);
    }

    const buildPagesQuery = (includeDeletedAtFilter: boolean) => {
        let request = db
            .from('pages')
            .select('*', { count: 'exact' })
            .eq('store_id', query.store_id);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);
        if (query.status !== 'all') request = request.eq('status', query.status);

        return request
            .order('display_order', { ascending: true })
            .order('updated_at', { ascending: false })
            .range(offset, offset + query.limit - 1);
    };

    let { data, error, count } = await buildPagesQuery(true);

    if (isMissingDeletedAtError(error)) {
        ({ data, error, count } = await buildPagesQuery(false));
    }

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated((data || []).map(normalizePage), count || 0, query.page, query.limit));
});

router.post('/', validate('json', CreatePageSchema), async (c) => {
    const body = c.get('validatedBody') as CreatePageInput;
    const ownership = await requireOwnedStore(c, body.store_id);
    if (!ownership.ok) return ownership.response;
    const { db, customUser } = ownership;

    const slug = body.slug || toSlug(body.title);
    const now = new Date().toISOString();
    const content = bodyToContent(body.body);
    const seo = seoFromInput(body);

    const newPageResult = await db
        .from('storefront_pages')
        .insert({
            store_id: body.store_id,
            title: body.title,
            slug,
            content,
            seo,
            page_type: body.page_type,
            status: body.status,
            published_at: body.status === 'published' ? now : null,
            created_by: customUser.id,
            updated_by: customUser.id,
        })
        .select('id,store_id,title,slug,status,page_type,seo,content,assigned_template_key,published_at,updated_at')
        .single();

    if (!newPageResult.error && newPageResult.data) {
        const page = normalizeStorefrontPage({ ...(newPageResult.data as PageRow), show_in_nav: body.show_in_nav });
        const revisionId = await ensurePageRevision(db, page as PageRow, content, seo);
        if (revisionId && body.status === 'published') {
            await db.from('storefront_pages').update({ published_revision_id: revisionId }).eq('id', page.id);
        }
        await syncPageNavigationItem(db, page);
        return c.json(success(page), 201);
    }

    if (!(isMissingTableError(newPageResult.error, 'storefront_pages') || isSchemaMismatchError(newPageResult.error))) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: newPageResult.error?.message || 'Unable to create page' } }, 500);
    }

    const { data, error } = await db
        .from('pages')
        .insert({
            store_id: body.store_id,
            title: body.title,
            slug,
            body: body.body,
            html_content: body.body,
            content: { body: body.body },
            page_type: body.page_type,
            status: body.status,
            show_in_nav: body.show_in_nav,
            seo_title: body.seo_title || null,
            seo_description: body.seo_description || null,
            display_order: body.display_order,
            published_at: body.status === 'published' ? now : null,
        })
        .select()
        .single();

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(normalizePage(data)), 201);
});

router.get('/policies', validate('query', ListPoliciesQuery), async (c) => {
    const query = c.get('validatedQuery') as ListPoliciesInput;
    const ownership = await requireOwnedStore(c, query.store_id);
    if (!ownership.ok) return ownership.response;
    const { db } = ownership;

    let request = db
        .from('storefront_policies')
        .select('id,store_id,policy_type,slug,title,body,status,seo,published_at,updated_at')
        .eq('store_id', query.store_id)
        .is('deleted_at', null)
        .order('policy_type', { ascending: true });

    if (query.status !== 'all') request = request.eq('status', query.status);

    const { data, error } = await request;
    if (error) {
        if (isMissingTableError(error, 'storefront_policies') || isSchemaMismatchError(error)) {
            return c.json(success([]));
        }
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success((data || []).map(normalizePolicy)));
});

router.post('/policies', validate('json', CreatePolicySchema), async (c) => {
    const body = c.get('validatedBody') as CreatePolicyInput;
    const ownership = await requireOwnedStore(c, body.store_id);
    if (!ownership.ok) return ownership.response;
    const { db, customUser } = ownership;
    const now = new Date().toISOString();
    const policySlug = body.slug || body.policy_type;

    const { data, error } = await db
        .from('storefront_policies')
        .upsert({
            store_id: body.store_id,
            policy_type: body.policy_type,
            slug: policySlug,
            title: body.title,
            body: bodyToContent(body.body),
            status: body.status,
            seo: seoFromInput(body),
            published_at: body.status === 'published' ? now : null,
            created_by: customUser.id,
            updated_by: customUser.id,
        }, { onConflict: 'store_id,policy_type' })
        .select('id,store_id,policy_type,slug,title,body,status,seo,published_at,updated_at')
        .single();

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(normalizePolicy(data as StorefrontPolicyRow)), 201);
});

router.patch('/policies/:id', validate('json', UpdatePolicySchema), async (c) => {
    const policyId = c.req.param('id');
    const body = c.get('validatedBody') as UpdatePolicyInput;
    const db = getSupabaseAdmin(c);
    const auth = c.get('auth');
    const customUser = await resolveCustomUser(db, auth.user);

    const existing = await db
        .from('storefront_policies')
        .select('id,store_id,policy_type,slug,title,body,status,seo,published_at,updated_at')
        .eq('id', policyId)
        .is('deleted_at', null)
        .maybeSingle();

    if (existing.error || !existing.data) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } }, 404);
    }

    const policy = existing.data as StorefrontPolicyRow;
    if (!customUser || !(await verifySiteOwnership(db, policy.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const updates: Record<string, unknown> = {
        ...('policy_type' in body ? { policy_type: body.policy_type } : {}),
        ...('slug' in body ? { slug: body.slug } : {}),
        ...('title' in body ? { title: body.title } : {}),
        ...('status' in body ? { status: body.status } : {}),
        ...('body' in body ? { body: bodyToContent(body.body) } : {}),
        seo: {
            ...(policy.seo || {}),
            ...seoFromInput({
                seo_title: body.seo_title ?? getString(policy.seo || {}, 'title'),
                seo_description: body.seo_description ?? getString(policy.seo || {}, 'description'),
            }),
        },
        updated_by: customUser.id,
    };
    if (body.status === 'published') updates.published_at = new Date().toISOString();

    const updated = await db
        .from('storefront_policies')
        .update(updates)
        .eq('id', policyId)
        .select('id,store_id,policy_type,slug,title,body,status,seo,published_at,updated_at')
        .single();

    if (updated.error || !updated.data) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: updated.error?.message || 'Unable to update policy' } }, 500);
    }

    return c.json(success(normalizePolicy(updated.data as StorefrontPolicyRow)));
});

router.delete('/policies/:id', async (c) => {
    const policyId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const auth = c.get('auth');
    const customUser = await resolveCustomUser(db, auth.user);
    const existing = await db
        .from('storefront_policies')
        .select('id,store_id')
        .eq('id', policyId)
        .is('deleted_at', null)
        .maybeSingle();

    if (existing.error || !existing.data) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Policy not found' } }, 404);
    }

    const policy = existing.data as StorefrontPolicyRow;
    if (!customUser || !(await verifySiteOwnership(db, policy.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db
        .from('storefront_policies')
        .update({ deleted_at: new Date().toISOString(), status: 'archived', updated_by: customUser.id })
        .eq('id', policyId);

    if (error) return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    return c.json(success({ deleted: true }));
});

router.get('/navigation', validate('query', ListNavigationQuery), async (c) => {
    const query = c.get('validatedQuery') as ListNavigationInput;
    const ownership = await requireOwnedStore(c, query.store_id);
    if (!ownership.ok) return ownership.response;
    const { db } = ownership;
    const menu = await ensureNavigationMenu(db, query.store_id, query.location);

    if (!menu) return c.json(success({ menu: null, items: [] }));

    const { data, error } = await db
        .from('navigation_menu_items')
        .select('id,menu_id,store_id,parent_item_id,label,url,target_type,target_resource_id,sort_order,is_visible,open_in_new_tab,metadata,updated_at')
        .eq('menu_id', menu.id)
        .eq('store_id', query.store_id)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

    if (error) {
        if (isMissingTableError(error, 'navigation_menu_items') || isSchemaMismatchError(error)) {
            return c.json(success({ menu, items: [] }));
        }
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ menu, items: (data || []).map(normalizeNavigationItem) }));
});

router.put('/navigation/:location', validate('json', ReplaceNavigationSchema), async (c) => {
    const location = c.req.param('location');
    const body = c.get('validatedBody') as ReplaceNavigationInput;
    if (body.location !== location) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'Location mismatch' } }, 400);
    }

    const ownership = await requireOwnedStore(c, body.store_id);
    if (!ownership.ok) return ownership.response;
    const { db } = ownership;
    const menu = await ensureNavigationMenu(db, body.store_id, location, body.name);
    if (!menu) return c.json({ success: false, error: { code: 'DB_ERROR', message: 'Navigation tables are not migrated' } }, 503);

    const deletedAt = new Date().toISOString();
    const deleteResult = await db
        .from('navigation_menu_items')
        .update({ deleted_at: deletedAt, is_visible: false })
        .eq('menu_id', menu.id)
        .eq('store_id', body.store_id)
        .is('deleted_at', null);

    if (deleteResult.error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: deleteResult.error.message } }, 500);
    }

    if (body.items.length > 0) {
        const insertResult = await db
            .from('navigation_menu_items')
            .insert(body.items.map((item, index) => ({
                menu_id: menu.id,
                store_id: body.store_id,
                parent_item_id: item.parent_item_id || null,
                label: item.label,
                url: item.url,
                target_type: item.target_type,
                target_resource_id: item.target_resource_id || null,
                sort_order: item.sort_order ?? index,
                is_visible: item.is_visible,
                open_in_new_tab: item.open_in_new_tab,
                metadata: {},
            })));

        if (insertResult.error) {
            return c.json({ success: false, error: { code: 'DB_ERROR', message: insertResult.error.message } }, 500);
        }
    }

    return c.json(success({ replaced: true, menu_id: menu.id, count: body.items.length }));
});

router.patch('/:id', validate('json', UpdatePageSchema), async (c) => {
    const pageId = c.req.param('id');
    const body = c.get('validatedBody') as UpdatePageInput;
    const db = getSupabaseAdmin(c);
    const auth = c.get('auth');
    const customUser = await resolveCustomUser(db, auth.user);

    const newExisting = await db
        .from('storefront_pages')
        .select('id,store_id,title,slug,status,page_type,seo,content,assigned_template_key,published_at,updated_at')
        .eq('id', pageId)
        .is('deleted_at', null)
        .maybeSingle();

    if (!newExisting.error && newExisting.data) {
        const ownedPage = newExisting.data as PageRow;
        if (!customUser || !ownedPage.store_id || !(await verifySiteOwnership(db, ownedPage.store_id, customUser.id, auth.user.storeId))) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const previous = normalizeStorefrontPage(ownedPage);
        const content = body.body !== undefined ? bodyToContent(body.body) : (ownedPage.content || {});
        const seo = {
            ...ownedPage.seo,
            ...seoFromInput({
                seo_title: body.seo_title ?? getString(ownedPage.seo || {}, 'title'),
                seo_description: body.seo_description ?? getString(ownedPage.seo || {}, 'description'),
            }),
        };
        const updates: Record<string, unknown> = {
            ...('title' in body ? { title: body.title } : {}),
            ...('slug' in body ? { slug: body.slug } : {}),
            ...('page_type' in body ? { page_type: body.page_type } : {}),
            ...('status' in body ? { status: body.status } : {}),
            content,
            seo,
            updated_by: customUser.id,
        };

        if (body.status === 'published') updates.published_at = new Date().toISOString();

        const updated = await db
            .from('storefront_pages')
            .update(updates)
            .eq('id', pageId)
            .select('id,store_id,title,slug,status,page_type,seo,content,assigned_template_key,published_at,updated_at')
            .single();

        if (updated.error || !updated.data) {
            return c.json({ success: false, error: { code: 'DB_ERROR', message: updated.error?.message || 'Unable to update page' } }, 500);
        }

        const normalized = normalizeStorefrontPage({
            ...(updated.data as PageRow),
            show_in_nav: body.show_in_nav ?? previous.show_in_nav,
        });
        const revisionId = await ensurePageRevision(db, normalized as PageRow, content, seo);
        if (revisionId && normalized.status === 'published') {
            await db.from('storefront_pages').update({ published_revision_id: revisionId }).eq('id', normalized.id);
        }
        await syncPageNavigationItem(db, normalized);
        return c.json(success(normalized));
    }

    if (newExisting.error && !(isMissingTableError(newExisting.error, 'storefront_pages') || isSchemaMismatchError(newExisting.error))) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: newExisting.error.message } }, 500);
    }

    const selectExistingPage = (includeDeletedAtFilter: boolean) => {
        let request = db
            .from('pages')
            .select('id, store_id')
            .eq('id', pageId);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);
        return request.single();
    };

    let { data: existing, error: existingError } = await selectExistingPage(true);

    if (isMissingDeletedAtError(existingError)) {
        ({ data: existing, error: existingError } = await selectExistingPage(false));
    }

    const ownedPage = existing as PageOwnerRow | null;
    if (!customUser || !ownedPage?.store_id || !(await verifySiteOwnership(db, ownedPage.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const updates: Record<string, unknown> = { ...body };
    if (body.body !== undefined) {
        updates.html_content = body.body;
        updates.content = { body: body.body };
    }
    if (body.status === 'published') {
        updates.published_at = new Date().toISOString();
    }

    const { data, error } = await db
        .from('pages')
        .update(updates)
        .eq('id', pageId)
        .select()
        .single();

    if (error || !data) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error?.message || 'Unable to update page' } }, 500);
    }

    return c.json(success(normalizePage(data)));
});

router.delete('/:id', async (c) => {
    const pageId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const auth = c.get('auth');
    const customUser = await resolveCustomUser(db, auth.user);

    const newExisting = await db
        .from('storefront_pages')
        .select('id, store_id')
        .eq('id', pageId)
        .is('deleted_at', null)
        .maybeSingle();

    if (!newExisting.error && newExisting.data) {
        const ownedPage = newExisting.data as PageOwnerRow;
        if (!customUser || !ownedPage.store_id || !(await verifySiteOwnership(db, ownedPage.store_id, customUser.id, auth.user.storeId))) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const deletedAt = new Date().toISOString();
        const { error } = await db
            .from('storefront_pages')
            .update({ deleted_at: deletedAt, status: 'archived', updated_by: customUser.id })
            .eq('id', pageId);

        if (error) {
            return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        await db
            .from('navigation_menu_items')
            .update({ deleted_at: deletedAt, is_visible: false })
            .eq('store_id', ownedPage.store_id)
            .eq('target_resource_id', pageId);

        return c.json(success({ deleted: true }));
    }

    if (newExisting.error && !(isMissingTableError(newExisting.error, 'storefront_pages') || isSchemaMismatchError(newExisting.error))) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: newExisting.error.message } }, 500);
    }

    const selectExistingPage = (includeDeletedAtFilter: boolean) => {
        let request = db
            .from('pages')
            .select('id, store_id')
            .eq('id', pageId);

        if (includeDeletedAtFilter) request = request.is('deleted_at', null);
        return request.single();
    };

    let { data: existing, error: existingError } = await selectExistingPage(true);

    if (isMissingDeletedAtError(existingError)) {
        ({ data: existing, error: existingError } = await selectExistingPage(false));
    }

    const ownedPage = existing as PageOwnerRow | null;
    if (!customUser || !ownedPage?.store_id || !(await verifySiteOwnership(db, ownedPage.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db
        .from('pages')
        .update({ deleted_at: new Date().toISOString(), status: 'archived' })
        .eq('id', pageId);

    if (error) {
        return c.json({ success: false, error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ deleted: true }));
});

function normalizePage(row: PageRow) {
    const { stores: _stores, content, ...page } = row;
    const body = page.body || page.html_content || getString(content || {}, 'body') || '';

    return {
        ...page,
        content: content || { body },
        body,
        page_type: page.page_type || 'custom',
        show_in_nav: Boolean(page.show_in_nav),
    };
}

function normalizePolicy(row: StorefrontPolicyRow) {
    const body = row.body || {};
    const seo = row.seo || {};

    return {
        id: row.id,
        store_id: row.store_id,
        policy_type: row.policy_type,
        slug: row.slug,
        title: row.title,
        body: getString(body, 'body') || getString(body, 'html') || '',
        content: body,
        status: row.status || 'draft',
        seo_title: getString(seo, 'title'),
        seo_description: getString(seo, 'description'),
        published_at: row.published_at || null,
        updated_at: row.updated_at || null,
    };
}

function normalizeNavigationItem(row: NavigationItemRow) {
    return {
        id: row.id,
        menu_id: row.menu_id,
        store_id: row.store_id,
        parent_item_id: row.parent_item_id || null,
        label: row.label,
        url: row.url || '#',
        target_type: row.target_type || 'url',
        target_resource_id: row.target_resource_id || null,
        sort_order: row.sort_order || 0,
        is_visible: row.is_visible !== false,
        open_in_new_tab: row.open_in_new_tab === true,
        metadata: row.metadata || {},
        updated_at: row.updated_at || null,
    };
}

function getString(data: Record<string, unknown>, key: string) {
    const value = data[key];
    return typeof value === 'string' ? value : null;
}

function toSlug(input: string) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 100);
}

export default router;
