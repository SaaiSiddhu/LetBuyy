import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// GET /notifications — List notifications for the authenticated user
router.get('/', async (c) => {
    const auth = c.get('auth');
    const isRead = c.req.query('is_read');
    const type = c.req.query('type');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    let query = db
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (isRead !== undefined) query = query.eq('is_read', isRead === 'true');
    if (type) query = query.eq('type', type);

    const { data, error, count } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /notifications/count — Unread notification count
router.get('/count', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);

    const { count, error } = await db
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', auth.user.id)
        .eq('is_read', false);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ count: count || 0 });
});

// PATCH /notifications/:id/read — Mark notification as read
router.patch('/:id/read', async (c) => {
    const auth = c.get('auth');
    const notifId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { error } = await db
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId)
        .eq('user_id', auth.user.id);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ marked: true }));
});

// POST /notifications/read-all — Mark all as read
router.post('/read-all', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);

    const { error } = await db
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', auth.user.id)
        .eq('is_read', false);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({ marked_all: true }));
});

// GET /notifications/preferences — Get notification preferences
router.get('/preferences', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    let query = db
        .from('notification_preferences')
        .select('*')
        .eq('user_id', auth.user.id);

    if (storeId) query = query.eq('store_id', storeId);

    const { data, error } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

// PUT /notifications/preferences — Upsert notification preferences
router.put('/preferences', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.channel || !body.category) {
        return c.json({ error: { code: 'VALIDATION', message: 'channel and category are required' } }, 400);
    }

    const { data, error } = await db
        .from('notification_preferences')
        .upsert(
            {
                user_id: auth.user.id,
                store_id: body.store_id || null,
                channel: body.channel,
                category: body.category,
                enabled: body.enabled ?? true,
            },
            { onConflict: 'user_id,store_id,channel,category' }
        )
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data));
});

// POST /notifications/email-log — Record a transactional email delivery result
router.post('/email-log', async (c) => {
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.recipient_email || !body.email_type || !body.subject || !body.status) {
        return c.json({ error: { code: 'VALIDATION', message: 'recipient_email, email_type, subject, and status are required' } }, 400);
    }

    const { data, error } = await db
        .from('email_logs')
        .insert({
            recipient_email: body.recipient_email,
            email_type: body.email_type,
            subject: body.subject,
            status: body.status,
            error_message: body.error_message || null,
            metadata: body.metadata || {},
        })
        .select('id')
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// POST /notifications/onboarding-failure-log — Record failed onboarding attempt metadata
router.post('/onboarding-failure-log', async (c) => {
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.requested_name || !body.site_type || !body.failure_reason) {
        return c.json({ error: { code: 'VALIDATION', message: 'requested_name, site_type, and failure_reason are required' } }, 400);
    }

    const requestedSubdomain = (body.requested_subdomain || body.requested_name)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '');

    const { data, error } = await db
        .from('onboarding_attempts')
        .insert({
            requested_name: body.requested_name,
            requested_subdomain: requestedSubdomain,
            site_type: body.site_type,
            status: 'failed',
            failure_reason: body.failure_reason,
            error_details: body.error_details || null,
        })
        .select('id')
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

// DELETE /notifications/:id — Delete a notification
router.delete('/:id', async (c) => {
    const auth = c.get('auth');
    const notifId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { error } = await db
        .from('notifications')
        .delete()
        .eq('id', notifId)
        .eq('user_id', auth.user.id);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

export default router;
