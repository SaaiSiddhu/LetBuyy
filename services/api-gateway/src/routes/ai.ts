import { Hono } from 'hono';
import type { Env } from '../index';
import { createAiCreditPurchaseAdapter } from '@letbuyy/infrastructure/ai-credit-purchase-adapter';
import { createAiCapabilitySeam, createAiGenerationAdapter } from '@letbuyy/infrastructure/ai-generation-adapter';
import type { AIHomepageGenerationResult } from '@letbuyy/shared-types';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { AppError } from '../lib/errors';
import { dbErrorBody, getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { AiHomepageGenerationSchema, AiOperatorCommandSchema, GenerateContentSchema } from '../schemas/ai.schema';

const router = new Hono<{ Bindings: Env }>();

type AiFeature =
    | 'product_description'
    | 'seo_meta'
    | 'blog_post'
    | 'social_copy'
    | 'email_campaign'
    | 'ad_copy'
    | 'custom';

const AI_FEATURES = new Set<AiFeature>([
    'product_description',
    'seo_meta',
    'blog_post',
    'social_copy',
    'email_campaign',
    'ad_copy',
    'custom',
]);

function normalizeAiFeature(value: unknown): AiFeature | null {
    const feature = String(value || '').trim();
    if (feature === 'social_caption') return 'social_copy';
    if (feature === 'email_template') return 'email_campaign';
    if (feature === 'brand_tagline') return 'custom';
    return AI_FEATURES.has(feature as AiFeature) ? feature as AiFeature : null;
}

type AiOperatorTool =
    | 'answer_metrics'
    | 'create_product'
    | 'draft_discount'
    | 'draft_homepage_section';

type AiOperatorToolCall = {
    id: string;
    tool: AiOperatorTool;
    label: string;
    status: 'ready' | 'completed' | 'requires_confirmation' | 'unavailable';
    summary: string;
    payload: Record<string, unknown>;
    result?: Record<string, unknown> | null;
};

type OperatorStoreRow = {
    id: string;
    name?: string | null;
    theme_id?: string | null;
    template_config?: Record<string, unknown> | null;
};

function genericAiUnavailable() {
    return {
        error: {
            code: 'AI_PROVIDER_UNCONFIGURED',
            message: 'AI generation is temporarily unavailable.',
        },
    };
}

function genericAiOperatorUnavailable() {
    return {
        error: {
            code: 'AI_OPERATOR_UNAVAILABLE',
            message: 'AI operator is temporarily unavailable.',
        },
    };
}

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function textValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function numberFromText(message: string, patterns: RegExp[], fallback: number): number {
    for (const pattern of patterns) {
        const match = message.match(pattern);
        const value = Number(match?.[1] || match?.[2] || '');
        if (Number.isFinite(value) && value >= 0) return value;
    }
    return fallback;
}

function quotedText(message: string): string | null {
    const quoted = message.match(/["'“”]([^"'“”]{2,120})["'“”]/);
    return quoted?.[1]?.trim() || null;
}

function productNameFromMessage(message: string): string {
    const quoted = quotedText(message);
    if (quoted) return quoted;
    const cleaned = message
        .replace(/create|add|new|product|with|price|stock|units|pcs|pieces/gi, ' ')
        .replace(/₹|rs\.?|inr|\d+(\.\d+)?|%/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned.length >= 3 ? cleaned.slice(0, 80) : 'AI drafted product';
}

function couponCodeFromMessage(message: string): string {
    const explicit = message.match(/\b(?:code|coupon)\s+([A-Z0-9_-]{3,24})\b/i)?.[1];
    if (explicit) return explicit.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
    return `AI${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

function buildProductTool(storeId: string, message: string): AiOperatorToolCall {
    const name = productNameFromMessage(message);
    const price = numberFromText(message, [
        /₹\s*(\d+(?:\.\d+)?)/i,
        /\b(?:rs\.?|inr|price)\s*(\d+(?:\.\d+)?)/i,
    ], 0);
    const stock = Math.round(numberFromText(message, [
        /\bstock\s*(\d+)/i,
        /\b(\d+)\s*(?:units|pcs|pieces)\b/i,
    ], 0));

    return {
        id: `tool_${crypto.randomUUID()}`,
        tool: 'create_product',
        label: 'Create draft product',
        status: 'ready',
        summary: `Create draft product "${name}"${price > 0 ? ` at INR ${price}` : ''}.`,
        payload: {
            store_id: storeId,
            name,
            description: `Draft created by LetBuyy AI from: ${message.slice(0, 300)}`,
            price,
            stock,
            is_active: false,
            tags: ['ai-draft'],
        },
    };
}

router.get('/seam', async (c) => {
    const seam = createAiCapabilitySeam({
        mode: c.env.LETBUYY_AI_MODEL_MODE === 'live' ? 'live' : 'sandbox',
        provider: c.env.AI_PROVIDER,
        model: c.env.AI_PROVIDER_MODEL,
    });

    if (seam.status === 'human_required') {
        // [HUMAN-REQUIRED] HR-AI-MODEL-LIVE: model/provider approval and credentials are not activated in V1 local mode.
    }

    return c.json(success(seam));
});

function buildDiscountTool(storeId: string, message: string): AiOperatorToolCall {
    const percent = Math.min(90, Math.max(1, Math.round(numberFromText(message, [
        /(\d{1,2})\s*%/,
        /\b(?:discount|off)\s*(\d{1,2})\b/i,
    ], 10))));
    const code = couponCodeFromMessage(message);
    return {
        id: `tool_${crypto.randomUUID()}`,
        tool: 'draft_discount',
        label: 'Draft discount code',
        status: 'ready',
        summary: `Draft inactive ${percent}% discount code ${code}.`,
        payload: {
            store_id: storeId,
            code,
            description: 'AI drafted discount. Review and activate when ready.',
            type: 'percentage',
            value: percent,
            usage_limit: 100,
            per_customer_limit: 1,
            is_active: false,
        },
    };
}

function themeSlugFromStore(store: OperatorStoreRow | null): string {
    const config = recordValue(store?.template_config);
    return textValue(config.themeId, textValue(store?.theme_id, 'minimal_modern'));
}

function buildThemeTool(storeId: string, message: string, store: OperatorStoreRow | null): AiOperatorToolCall {
    const now = new Date().toISOString();
    const themeSlug = themeSlugFromStore(store);
    const templateConfig = { ...recordValue(store?.template_config) };
    const sections = { ...recordValue(templateConfig.sections) };
    const templateSections = Array.isArray(sections.template) ? [...sections.template] : [];
    const title = quotedText(message) || 'Fresh arrivals';
    const section = {
        id: `ai_section_${Date.now()}`,
        type: 'heroBanner',
        order: templateSections.length + 1,
        visible: true,
        settings: {
            title,
            subtitle: 'A new AI-drafted homepage section is ready for review.',
            buttonText: 'Shop now',
            buttonLink: '/products',
            alignment: 'center',
        },
        blocks: [],
        createdAt: now,
        updatedAt: now,
    };

    return {
        id: `tool_${crypto.randomUUID()}`,
        tool: 'draft_homepage_section',
        label: 'Draft homepage section',
        status: 'ready',
        summary: `Add a draft homepage hero section titled "${title}".`,
        payload: {
            store_id: storeId,
            theme_slug: themeSlug,
            template_config: {
                ...templateConfig,
                themeId: themeSlug,
                sections: {
                    ...sections,
                    template: [...templateSections, section],
                },
                updatedAt: now,
            },
        },
    };
}

function cleanHomepageCopy(value: unknown, fallback: string, maxLength: number): string {
    const cleaned = textValue(value)
        .replace(/\s+/g, ' ')
        .replace(/[{}[\]<>]/g, '')
        .trim();
    if (!cleaned) return fallback;
    return cleaned.slice(0, maxLength);
}

function firstPromptSentence(value: string, fallback: string): string {
    const sentence = value
        .split(/[.!?\n]/)
        .map((part) => part.trim())
        .find((part) => part.length >= 4);
    return cleanHomepageCopy(sentence || value, fallback, 110);
}

function homepageSummaryFromOutput(output: string, prompt: string): string {
    const cleaned = output
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !/^homepage[_\s-]*generator/i.test(line))
        .join(' ');
    const source = cleaned || prompt;
    return cleanHomepageCopy(source, 'Review the generated homepage draft before publishing.', 260);
}

function templateSections(templateConfig: Record<string, unknown>): Record<string, unknown> {
    return { ...recordValue(templateConfig.sections) };
}

function generatedSection(
    type: string,
    order: number,
    settings: Record<string, unknown>,
    blocks: Record<string, unknown>[] = []
) {
    const now = new Date().toISOString();
    return {
        id: `ai_home_${crypto.randomUUID()}`,
        type,
        order,
        visible: true,
        isVisible: true,
        settings,
        blocks,
        createdAt: now,
        updatedAt: now,
    };
}

function buildHomepageTemplate(input: {
    storeId: string;
    themeSlug: string;
    prompt: string;
    aiOutput: string;
    sectionCount: number;
    templateConfig: Record<string, unknown>;
}): AIHomepageGenerationResult {
    const now = new Date().toISOString();
    const existingSections = templateSections(input.templateConfig);
    const title = firstPromptSentence(input.prompt, 'Your new homepage');
    const summary = homepageSummaryFromOutput(input.aiOutput, input.prompt);
    const generatedSections = [
        generatedSection('heroBanner', 1, {
            heading: title,
            subheading: summary,
            ctaText: 'Shop now',
            ctaLink: '/products',
            textAlign: 'center',
            textPosition: 'center',
            overlay: 0.42,
            height: 'large',
        }),
        generatedSection('productGrid', 2, {
            title: 'Shop the collection',
            subtitle: 'Browse products selected for this storefront.',
            columns: 4,
            columnsTablet: 3,
            columnsMobile: 2,
            rows: 2,
            showTitle: true,
            showPrice: true,
            showRating: false,
            showAddToCart: true,
            sortBy: 'newest',
        }),
        generatedSection('aboutSection', 3, {
            heading: 'Why this store',
            content: summary,
            image: '',
            imagePosition: 'right',
            showButton: false,
            buttonText: 'Learn more',
            buttonLink: '/about',
            layout: 'side-by-side',
        }),
        generatedSection('newsletter', 4, {
            heading: 'Get store updates',
            subheading: 'Receive new product updates from this storefront.',
            buttonText: 'Subscribe',
            placeholderText: 'Enter your email',
            successMessage: 'Thank you for subscribing.',
            layout: 'inline',
            showIcon: true,
        }),
        generatedSection('trustBadges', 5, {
            title: 'Store policies',
            subtitle: 'Review checkout, delivery, and return details before ordering.',
        }, [
            {
                id: `ai_block_${crypto.randomUUID()}`,
                type: 'image',
                order: 0,
                isVisible: true,
                settings: {
                    icon: 'security',
                    label: 'Secure checkout',
                    description: 'Checkout runs through LetBuyy commerce infrastructure.',
                },
            },
            {
                id: `ai_block_${crypto.randomUUID()}`,
                type: 'image',
                order: 1,
                isVisible: true,
                settings: {
                    icon: 'policy',
                    label: 'Clear policies',
                    description: 'Keep shipping and return policies visible for shoppers.',
                },
            },
        ]),
    ].slice(0, input.sectionCount);

    const sections = {
        ...existingSections,
        template: generatedSections,
    };
    const templateConfig = {
        ...input.templateConfig,
        storeId: input.storeId,
        themeId: input.themeSlug,
        sections,
        updatedAt: now,
        aiHomepageDraft: {
            prompt: input.prompt,
            generated_at: now,
            source: 'mobile-ai-homepage-generator',
        },
    };

    return {
        store_id: input.storeId,
        theme_slug: input.themeSlug,
        prompt: input.prompt,
        title,
        summary,
        template_config: templateConfig,
        sections: generatedSections,
        generated_at: now,
    };
}

async function loadOperatorStore(db: ReturnType<typeof getSupabaseAdmin>, storeId: string): Promise<OperatorStoreRow | null> {
    const { data, error } = await db
        .from('sites')
        .select('id,name,theme_id,template_config')
        .eq('id', storeId)
        .single();
    if (error) return null;
    return data as OperatorStoreRow;
}

async function buildMetricsTool(db: ReturnType<typeof getSupabaseAdmin>, storeId: string): Promise<AiOperatorToolCall> {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [{ data: orders }, { count: products }, { count: customers }] = await Promise.all([
        db.from('orders').select('total,payment_status,status').eq('store_id', storeId).gte('created_at', since),
        db.from('products').select('id', { count: 'exact', head: true }).eq('store_id', storeId).eq('is_active', true),
        db.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', storeId),
    ]);
    const orderRows = Array.isArray(orders) ? orders : [];
    const paid = orderRows.filter((order) => order.payment_status === 'paid');
    const revenue = paid.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const openOrders = orderRows.filter((order) => !['delivered', 'cancelled', 'refunded'].includes(String(order.status || ''))).length;
    const summary = `Last 7 days: INR ${Math.round(revenue)} revenue, ${orderRows.length} orders, ${openOrders} open orders, ${products || 0} active products, and ${customers || 0} customers.`;
    return {
        id: `tool_${crypto.randomUUID()}`,
        tool: 'answer_metrics',
        label: 'Answer store metrics',
        status: 'completed',
        summary,
        payload: { store_id: storeId, period: '7d' },
        result: {
            revenue,
            orders: orderRows.length,
            open_orders: openOrders,
            active_products: products || 0,
            customers: customers || 0,
        },
    };
}

function wantsMetrics(message: string): boolean {
    return /\b(sales|revenue|orders?|metrics?|analytics|customers?|week|today|performance)\b/i.test(message);
}

function wantsProduct(message: string): boolean {
    return /\b(create|add|draft|new)\b/i.test(message) && /\bproduct\b/i.test(message);
}

function wantsDiscount(message: string): boolean {
    return /\b(create|add|draft|new)\b/i.test(message) && /\b(discount|coupon|promo|offer)\b/i.test(message);
}

function wantsThemeSection(message: string): boolean {
    return /\b(homepage|home page|hero|banner|section|theme)\b/i.test(message) && /\b(create|add|draft|edit|update)\b/i.test(message);
}

function operatorSummary(calls: AiOperatorToolCall[]): string {
    if (calls.length === 0) {
        return 'I can answer metrics, draft products, draft discount codes, and prepare homepage section drafts.';
    }
    const completed = calls.filter((call) => call.status === 'completed').map((call) => call.summary);
    const ready = calls.filter((call) => call.status === 'ready').map((call) => call.summary);
    return [...completed, ...ready].join(' ');
}

function createCreditPurchaseAdapter(env: Env) {
    return createAiCreditPurchaseAdapter({
        mode: env.AI_CREDIT_PURCHASE_MODE,
        provider: env.AI_CREDIT_PURCHASE_PROVIDER,
        razorpayKeyId: env.AI_CREDIT_RAZORPAY_KEY_ID || env.RAZORPAY_KEY_ID,
        razorpayKeySecret: env.AI_CREDIT_RAZORPAY_KEY_SECRET || env.RAZORPAY_KEY_SECRET,
        pricePerCreditMinor: env.AI_CREDIT_PRICE_INR_PAISE,
        currency: 'INR',
        environment: env.ENVIRONMENT,
        appEnv: env.APP_ENV,
        nodeEnv: env.NODE_ENV,
    });
}

function decorateCredits(
    credits: Record<string, unknown>,
    storeId: string,
    adapter: ReturnType<typeof createCreditPurchaseAdapter>
) {
    return {
        store_id: storeId,
        ...credits,
        purchase_available: adapter.available,
        purchase_mode: adapter.mode,
        purchase_provider: adapter.provider,
    };
}

async function loadAiCreditProjection(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string
): Promise<Record<string, unknown>> {
    const [{ data: creditConfig, error: creditError }, { data: usageTotal, error: usageError }] = await Promise.all([
        db
            .from('ai_credits')
            .select('id,plan_credits,bonus_credits,total_purchased,reset_period,updated_at')
            .eq('store_id', storeId)
            .maybeSingle(),
        db.rpc('read_merchant_ai_usage_total', { p_store_id: storeId }),
    ]);

    if (creditError && creditError.code !== 'PGRST116') {
        throw new AppError('AI credit information is temporarily unavailable.', 500, 'DB_ERROR');
    }
    if (usageError) {
        throw new AppError('AI credit information is temporarily unavailable.', 500, 'DB_ERROR');
    }

    const config = (creditConfig || {}) as Record<string, unknown>;
    const planCredits = Number(config.plan_credits ?? 100);
    const bonusCredits = Number(config.bonus_credits ?? 0);
    const totalPurchased = Number(config.total_purchased ?? 0);
    const totalUsed = typeof usageTotal === 'number' || typeof usageTotal === 'string' ? Number(usageTotal) : NaN;
    if (!Number.isSafeInteger(totalUsed)) {
        throw new AppError('AI credit information is temporarily unavailable.', 500, 'DB_ERROR');
    }
    const available = Math.max(0, planCredits + bonusCredits + totalPurchased - totalUsed);

    return {
        id: config.id || null,
        store_id: storeId,
        balance: available,
        plan_credits: planCredits,
        bonus_credits: bonusCredits,
        total_used: totalUsed,
        total_purchased: totalPurchased,
        reset_period: config.reset_period || 'monthly',
        // The canonical table records last_reset_at, not a future reset_at.
        // No next reset is scheduled by this read-only projection.
        reset_at: null,
        updated_at: config.updated_at || null,
        projection_source: 'ai_usage',
    };
}

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

    let credits;
    try {
        credits = await loadAiCreditProjection(db, storeId);
    } catch {
        return c.json(dbErrorBody('AI credit information is temporarily unavailable.'), 500);
    }

    return c.json(success(decorateCredits(credits, storeId, createCreditPurchaseAdapter(c.env))));
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
    const rawBody = await c.req.json() as Record<string, unknown>;
    const parsed = GenerateContentSchema.safeParse({
        ...rawBody,
        type: rawBody.type || rawBody.feature,
    });
    const db = getSupabaseAdmin(c);

    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id, feature, and prompt are required' } }, 400);
    }
    const body = parsed.data;
    const feature = normalizeAiFeature(rawBody.feature || body.type);
    if (!feature) {
        return c.json({ error: { code: 'VALIDATION', message: 'Unsupported AI generation feature' } }, 400);
    }
    const prompt = body.prompt.trim();

    const customUser = await resolveAuthorizedUser(db, auth.user, body.store_id);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    let creditProjection;
    try {
        creditProjection = await loadAiCreditProjection(db, body.store_id);
    } catch {
        return c.json(dbErrorBody('AI credit information is temporarily unavailable.'), 500);
    }

    const balance = Number(creditProjection.balance || 0);
    if (balance <= 0) {
        return c.json({ error: { code: 'INSUFFICIENT_CREDITS', message: 'No AI credits remaining. Please purchase more credits.' } }, 402);
    }

    const adapter = createAiGenerationAdapter({
        mode: c.env.AI_PROVIDER_MODE,
        provider: c.env.AI_PROVIDER,
        apiKey: c.env.AI_PROVIDER_API_KEY,
        baseUrl: c.env.AI_PROVIDER_BASE_URL,
        model: c.env.AI_PROVIDER_MODEL,
        environment: c.env.ENVIRONMENT,
        appEnv: c.env.APP_ENV,
        nodeEnv: c.env.NODE_ENV,
    });
    const startedAt = Date.now();

    if (!adapter.available) {
        const { error } = await db
            .from('ai_usage')
            .insert({
                store_id: body.store_id,
                user_id: customUser.id,
                feature,
                prompt,
                output: null,
                tokens_input: 0,
                tokens_output: 0,
                credits_used: 0,
                model: adapter.model || null,
                provider: adapter.provider,
                latency_ms: 0,
                status: 'failed',
                error_message: 'AI provider is not configured',
            })
            .select('id')
            .single();

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        return c.json(genericAiUnavailable(), 503);
    }

    let generation;
    try {
        generation = await adapter.generate({
            storeId: body.store_id,
            feature,
            prompt,
            context: body.context || null,
        });
    } catch {
        const { error } = await db
            .from('ai_usage')
            .insert({
                store_id: body.store_id,
                user_id: customUser.id,
                feature,
                prompt,
                output: null,
                tokens_input: 0,
                tokens_output: 0,
                credits_used: 0,
                model: adapter.model || null,
                provider: adapter.provider,
                latency_ms: Date.now() - startedAt,
                status: 'failed',
                error_message: 'AI provider request failed',
            })
            .select('id')
            .single();

        if (error) {
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }

        return c.json({ error: { code: 'AI_PROVIDER_FAILED', message: 'AI generation could not be completed.' } }, 502);
    }

    const creditsUsed = Math.min(balance, Math.max(1, generation.creditsUsed));
    const { data: usage, error: usageError } = await db
        .from('ai_usage')
        .insert({
            store_id: body.store_id,
            user_id: customUser.id,
            feature,
            prompt,
            output: generation.output,
            tokens_input: generation.tokensInput,
            tokens_output: generation.tokensOutput,
            credits_used: creditsUsed,
            model: generation.model,
            provider: generation.provider,
            latency_ms: Number(generation.metadata.latency_ms || Date.now() - startedAt),
            status: 'completed',
            error_message: null,
        })
        .select()
        .single();

    if (usageError) {
        return c.json({ error: { code: 'DB_ERROR', message: usageError.message } }, 500);
    }

    let updatedCredits;
    try {
        updatedCredits = await loadAiCreditProjection(db, body.store_id);
    } catch {
        return c.json(dbErrorBody('AI credit information is temporarily unavailable.'), 500);
    }

    return c.json(success({
        usage,
        credits: decorateCredits(updatedCredits, body.store_id, createCreditPurchaseAdapter(c.env)),
        output: generation.output,
    }), 201);
});

// POST /ai/homepage — Generate an editable homepage draft for the mobile editor
router.post('/homepage', async (c) => {
    const auth = c.get('auth');
    const rawBody = await c.req.json() as Record<string, unknown>;
    const parsed = AiHomepageGenerationSchema.safeParse(rawBody);
    const db = getSupabaseAdmin(c);

    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id and prompt are required' } }, 400);
    }

    const body = parsed.data;
    const customUser = await resolveAuthorizedUser(db, auth.user, body.store_id);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    let creditProjection;
    let store;
    try {
        [creditProjection, store] = await Promise.all([
            loadAiCreditProjection(db, body.store_id),
            loadOperatorStore(db, body.store_id),
        ]);
    } catch {
        return c.json(dbErrorBody('AI credit information is temporarily unavailable.'), 500);
    }
    const balance = Number(creditProjection.balance || 0);
    if (balance <= 0) {
        return c.json({ error: { code: 'INSUFFICIENT_CREDITS', message: 'No AI credits remaining.' } }, 402);
    }

    const adapter = createAiGenerationAdapter({
        mode: c.env.AI_PROVIDER_MODE,
        provider: c.env.AI_PROVIDER,
        apiKey: c.env.AI_PROVIDER_API_KEY,
        baseUrl: c.env.AI_PROVIDER_BASE_URL,
        model: c.env.AI_PROVIDER_MODEL,
        environment: c.env.ENVIRONMENT,
        appEnv: c.env.APP_ENV,
        nodeEnv: c.env.NODE_ENV,
    });
    const prompt = body.prompt.trim();
    const themeSlug = textValue(body.theme_slug, themeSlugFromStore(store));
    const baseTemplate = Object.keys(body.template_config).length > 0
        ? recordValue(body.template_config)
        : recordValue(store?.template_config);
    const startedAt = Date.now();

    if (!adapter.available) {
        await db.from('ai_usage').insert({
            store_id: body.store_id,
            user_id: customUser.id,
            feature: 'homepage_generator',
            prompt,
            output: null,
            tokens_input: 0,
            tokens_output: 0,
            credits_used: 0,
            model: adapter.model || null,
            provider: adapter.provider,
            latency_ms: 0,
            status: 'failed',
            error_message: 'AI provider is not configured',
        });
        return c.json({
            error: {
                code: 'AI_HOMEPAGE_GENERATOR_UNAVAILABLE',
                message: 'AI homepage generation is temporarily unavailable.',
            },
        }, 503);
    }

    let generation;
    try {
        generation = await adapter.generate({
            storeId: body.store_id,
            feature: 'homepage_generator',
            prompt,
            context: {
                language: body.locale,
                section_count: body.section_count,
                theme_slug: themeSlug,
                instruction: 'Return concise commerce homepage copy only. Do not invent metrics, awards, certifications, delivery promises, discounts, or policies.',
            },
        });
    } catch {
        await db.from('ai_usage').insert({
            store_id: body.store_id,
            user_id: customUser.id,
            feature: 'homepage_generator',
            prompt,
            output: null,
            tokens_input: 0,
            tokens_output: 0,
            credits_used: 0,
            model: adapter.model || null,
            provider: adapter.provider,
            latency_ms: Date.now() - startedAt,
            status: 'failed',
            error_message: 'AI provider request failed',
        });
        return c.json({ error: { code: 'AI_PROVIDER_FAILED', message: 'AI homepage generation could not be completed.' } }, 502);
    }

    const creditsUsed = Math.min(balance, Math.max(1, generation.creditsUsed));
    const draft = buildHomepageTemplate({
        storeId: body.store_id,
        themeSlug,
        prompt,
        aiOutput: generation.output,
        sectionCount: body.section_count,
        templateConfig: baseTemplate,
    });

    const { data: usage, error: usageError } = await db
        .from('ai_usage')
        .insert({
            store_id: body.store_id,
            user_id: customUser.id,
            feature: 'homepage_generator',
            prompt,
            output: draft.summary,
            tokens_input: generation.tokensInput,
            tokens_output: generation.tokensOutput,
            credits_used: creditsUsed,
            model: generation.model,
            provider: generation.provider,
            latency_ms: Number(generation.metadata.latency_ms || Date.now() - startedAt),
            status: 'completed',
            error_message: null,
        })
        .select()
        .single();

    if (usageError) {
        return c.json({ error: { code: 'DB_ERROR', message: 'AI homepage generation could not be saved.' } }, 500);
    }

    return c.json(success({
        ...draft,
        usage,
        provider: generation.provider,
        provider_mode: generation.providerMode,
        model: generation.model,
    }), 201);
});

// POST /ai/operator — Plan bounded store-operator tool calls
router.post('/operator', async (c) => {
    const auth = c.get('auth');
    const rawBody = await c.req.json() as Record<string, unknown>;
    const parsed = AiOperatorCommandSchema.safeParse(rawBody);
    const db = getSupabaseAdmin(c);

    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id and message are required' } }, 400);
    }

    const body = parsed.data;
    const customUser = await resolveAuthorizedUser(db, auth.user, body.store_id);
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const adapter = createAiGenerationAdapter({
        mode: c.env.AI_PROVIDER_MODE,
        provider: c.env.AI_PROVIDER,
        apiKey: c.env.AI_PROVIDER_API_KEY,
        baseUrl: c.env.AI_PROVIDER_BASE_URL,
        model: c.env.AI_PROVIDER_MODEL,
        environment: c.env.ENVIRONMENT,
        appEnv: c.env.APP_ENV,
        nodeEnv: c.env.NODE_ENV,
    });
    if (!adapter.available) {
        return c.json(genericAiOperatorUnavailable(), 503);
    }

    const message = body.message.trim();
    const store = await loadOperatorStore(db, body.store_id);
    const calls: AiOperatorToolCall[] = [];

    if (wantsMetrics(message) || (!wantsProduct(message) && !wantsDiscount(message) && !wantsThemeSection(message))) {
        calls.push(await buildMetricsTool(db, body.store_id));
    }
    if (wantsProduct(message)) calls.push(buildProductTool(body.store_id, message));
    if (wantsDiscount(message)) calls.push(buildDiscountTool(body.store_id, message));
    if (wantsThemeSection(message)) calls.push(buildThemeTool(body.store_id, message, store));

    const responseMessage = operatorSummary(calls);
    const conversationId = textValue(body.conversation_id, `operator_${crypto.randomUUID()}`);
    const response = {
        store_id: body.store_id,
        conversation_id: conversationId,
        message: responseMessage,
        tool_calls: calls,
        created_at: new Date().toISOString(),
    };

    const { error } = await db
        .from('ai_usage')
        .insert({
            store_id: body.store_id,
            user_id: customUser.id,
            feature: 'store_operator',
            prompt: message,
            output: responseMessage,
            tokens_input: Math.max(1, Math.ceil(message.length / 4)),
            tokens_output: Math.max(1, Math.ceil(responseMessage.length / 4)),
            credits_used: 1,
            model: adapter.model || null,
            provider: adapter.provider,
            latency_ms: 0,
            status: 'completed',
            error_message: null,
        })
        .select('id')
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'AI operator request could not be saved.' } }, 500);
    }

    return c.json(success(response), 201);
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

// POST /ai/credits/purchase — B6 Form B: route retired; returns 501 until ARB approves money design.
// featureFlags.ts:25 fails open in non-prod when the flag is unset, so FEATURE_AI_CREDIT_PURCHASE
// is explicitly set to "false" in every wrangler.toml env block (not left unset).
// Re-enable after ARB closes SKIP-B6-AI-CREDIT-DESIGN-ARB and a canonical ledger path is implemented.
router.post('/credits/purchase', async (c) => {
    const flagValue = ((c.env as unknown as Record<string, string | undefined>).FEATURE_AI_CREDIT_PURCHASE ?? '').trim().toLowerCase();
    if (!['1', 'true', 'on', 'enabled', 'yes'].includes(flagValue)) {
        return c.json({
            error: {
                code: 'AI_CREDIT_PURCHASE_NOT_AVAILABLE',
                message: 'AI credit purchase is not available (deferred to ARB — see SKIP-B6-AI-CREDIT-DESIGN-ARB).',
            },
        }, 501);
    }
    return c.json({
        error: {
            code: 'AI_CREDIT_PURCHASE_NOT_AVAILABLE',
            message: 'AI credit purchase requires the ARB-approved canonical ledger implementation.',
        },
    }, 501);
});

export default router;
