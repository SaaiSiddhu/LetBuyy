import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// POST /contacts — Public: submit a contact form
router.post('/', async (c) => {
    const body = await c.req.json();
    const { store_id, name, email, phone, message, form_id } = body;

    if (!store_id || !name || (!email && !phone)) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id, name, and email or phone required' } }, 400);
    }

    const db = getSupabaseAdmin(c);

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
router.get('/', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('contact_submissions')
        .select('*, stores!inner(user_id)')
        .eq('stores.user_id', auth.user.id)
        .order('created_at', { ascending: false });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

export default router;
