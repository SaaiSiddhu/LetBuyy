import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// GET /ai/credits — Get current AI credit balance for a store
router.get('/credits', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    // Verify store ownership
    const { data: store } = await db
        .from('stores')
        .select('id')
        .eq('id', storeId)
        .eq('user_id', auth.user.id)
        .single();

    if (!store) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('ai_credits')
        .select('*')
        .eq('store_id', storeId)
        .single();

    if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found (not an actual error — credits just haven't been initialized)
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Return default credits if none exist yet
    return c.json(success(data || {
        store_id: storeId,
        balance: 100,
        plan_credits: 100,
        bonus_credits: 0,
        total_used: 0,
        total_purchased: 0,
    }));
});

// GET /ai/usage — List AI usage history
router.get('/usage', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const feature = c.req.query('feature');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    let query = db
        .from('ai_usage')
        .select('*, stores!inner(user_id)', { count: 'exact' })
        .eq('stores.user_id', auth.user.id)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (feature) query = query.eq('feature', feature);

    const { data, error, count } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// POST /ai/generate — Generate AI content (stub — logs usage, returns placeholder)
router.post('/generate', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.store_id || !body.feature || !body.prompt) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id, feature, and prompt are required' } }, 400);
    }

    // Verify store ownership
    const { data: store } = await db
        .from('stores')
        .select('id')
        .eq('id', body.store_id)
        .eq('user_id', auth.user.id)
        .single();

    if (!store) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Check credit balance
    const { data: credits } = await db
        .from('ai_credits')
        .select('balance')
        .eq('store_id', body.store_id)
        .single();

    const balance = credits?.balance ?? 100;
    if (balance <= 0) {
        return c.json({ error: { code: 'INSUFFICIENT_CREDITS', message: 'No AI credits remaining. Please purchase more credits.' } }, 402);
    }

    // Stub: log the usage and return a placeholder
    const placeholderOutput = `[AI Generation Placeholder]\n\nFeature: ${body.feature}\nPrompt: "${body.prompt}"\n\nThis is a placeholder response. AI generation will be available once the OpenAI API integration is configured.`;

    const { data: usage, error } = await db
        .from('ai_usage')
        .insert({
            store_id: body.store_id,
            user_id: auth.user.id,
            feature: body.feature,
            prompt: body.prompt,
            output: placeholderOutput,
            tokens_input: 0,
            tokens_output: 0,
            credits_used: 0, // Don't charge for stubs
            model: 'stub',
            provider: 'none',
            latency_ms: 0,
            status: 'completed',
        })
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success({
        id: usage.id,
        output: placeholderOutput,
        credits_used: 0,
        credits_remaining: balance,
        is_stub: true,
        message: 'AI generation is coming soon. This is a placeholder response.',
    }), 201);
});

// POST /ai/usage/:id/rate — Rate an AI generation
router.post('/usage/:id/rate', async (c) => {
    const auth = c.get('auth');
    const usageId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.rating || body.rating < 1 || body.rating > 5) {
        return c.json({ error: { code: 'VALIDATION', message: 'rating must be between 1 and 5' } }, 400);
    }

    const { data, error } = await db
        .from('ai_usage')
        .update({
            user_rating: body.rating,
            user_feedback: body.feedback || null,
        })
        .eq('id', usageId)
        .eq('user_id', auth.user.id)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data));
});

// POST /ai/credits/purchase — Purchase additional credits (stub)
router.post('/credits/purchase', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();

    if (!body.store_id || !body.amount) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id and amount are required' } }, 400);
    }

    // Stub: return a message about payment integration
    return c.json({
        data: {
            message: 'Credit purchases will be available once payment integration is configured.',
            store_id: body.store_id,
            requested_amount: body.amount,
            is_stub: true,
        },
    });
});

export default router;
