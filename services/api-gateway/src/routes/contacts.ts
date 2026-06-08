import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser } from '../lib/auth-user';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';

const router = new Hono<{ Bindings: Env }>();

// POST /contacts — Public: submit a contact form
router.post('/', async (c) => {
    const body = await c.req.json();
    const { store_id, name, email, phone, message, form_id } = body;

    if (!store_id || !name || (!email && !phone)) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id, name, and email or phone required' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const { data: store } = await db
        .from('sites')
        .select('id')
        .eq('id', store_id)
        .eq('status', 'published')
        .is('deleted_at', null)
        .maybeSingle();

    if (!store) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Store not found' } }, 404);
    }

    const { data, error } = await db
        .from('contact_submissions')
        .insert({
            store_id,
            name,
            email: email || null,
            phone: phone || null,
            message: message || '',
            source: 'storefront',
            status: 'new',
        })
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // TODO: Send notification to store owner via Resend

    return c.json(success(data), 201);
});

// GET /contacts — Protected: list contacts for authenticated user's stores
router.get('/', authMiddleware, async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data: sites, error: sitesError } = await db
        .from('sites')
        .select('id')
        .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`)
        .is('deleted_at', null);

    if (sitesError) {
        return c.json({ error: { code: 'DB_ERROR', message: sitesError.message } }, 500);
    }

    const siteIds = (sites || []).map((site) => site.id as string);
    if (siteIds.length === 0) return c.json(success([]));

    const { data, error } = await db
        .from('contact_submissions')
        .select('*')
        .in('store_id', siteIds)
        .order('created_at', { ascending: false });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

export default router;
