import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { GenerateContentSchema, CheckCreditsSchema } from '../schemas/ai.schema';

const router = new Hono<{ Bindings: Env }>();

async function resolveAuthorizedUser(
    db: ReturnType<typeof getSupabaseAdmin>,
    authUser: WorkerAuthUser,
    storeId: string
) {
    const customUser = await resolveCustomUser(db, authUser);
    if (!customUser) return null;
    const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, authUser.storeId);
    return ownsStore ? customUser : null;
}

// GET /ai/credits — Get current AI credit balance for a store
router.get('/credits', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    const customUser = await resolveAuthorizedUser(db, auth.user, storeId);
    if (!customUser) {
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
    const customUser = await resolveAuthorizedUser(db, auth.user, storeId);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    let query = db
        .from('ai_usage')
        .select('*', { count: 'exact' })
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

// POST /ai/generate — Generate AI content
router.post('/generate', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.store_id || !body.feature || !body.prompt) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id, feature, and prompt are required' } }, 400);
    }

    const customUser = await resolveAuthorizedUser(db, auth.user, body.store_id);
    if (!customUser) {
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

    const { error } = await db
        .from('ai_usage')
        .insert({
            store_id: body.store_id,
            user_id: customUser.id,
            feature: body.feature,
            prompt: body.prompt,
            output: null,
            tokens_input: 0,
            tokens_output: 0,
            credits_used: 0,
            model: null,
            provider: 'none',
            latency_ms: 0,
            status: 'failed',
            error_message: 'AI provider is not configured for this environment',
        })
        .select('id')
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(
        { error: { code: 'AI_PROVIDER_UNCONFIGURED', message: 'AI generation is not configured for this environment' } },
        503
    );
});

// POST /ai/usage/:id/rate — Rate an AI generation
router.post('/usage/:id/rate', async (c) => {
    const auth = c.get('auth');
    const usageId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!body.rating || body.rating < 1 || body.rating > 5) {
        return c.json({ error: { code: 'VALIDATION', message: 'rating must be between 1 and 5' } }, 400);
    }
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const { data, error } = await db
        .from('ai_usage')
        .update({
            user_rating: body.rating,
            user_feedback: body.feedback || null,
        })
        .eq('id', usageId)
        .eq('user_id', customUser.id)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data));
});

// POST /ai/credits/purchase — Purchase additional credits
router.post('/credits/purchase', async (c) => {
    const auth = c.get('auth');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.store_id || !body.amount) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id and amount are required' } }, 400);
    }
    const customUser = await resolveAuthorizedUser(db, auth.user, body.store_id);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    return c.json(
        { error: { code: 'AI_CREDIT_PURCHASE_UNAVAILABLE', message: 'AI credit purchases are not configured' } },
        503
    );
});

export default router;
