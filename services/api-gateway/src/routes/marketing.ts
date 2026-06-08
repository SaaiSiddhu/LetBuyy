import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import {
    CreateEmailCampaignSchema,
    GetEmailCampaignQuery,
    ListEmailCampaignsQuery,
    PreviewEmailCampaignAudienceSchema,
    SendEmailCampaignSchema,
    UpdateEmailCampaignSchema,
    type CreateEmailCampaignInput,
    type GetEmailCampaignInput,
    type ListEmailCampaignsInput,
    type PreviewEmailCampaignAudienceInput,
    type SendEmailCampaignInput,
    type UpdateEmailCampaignInput,
} from '../schemas/marketing.schema';
import { buildCustomerSummaries, type CustomerOrderRecord, type StoreCustomerRecord } from '@letbuyy/commerce-core';
import {
    CustomerSegmentRulesSchema,
    type Customer,
    type CustomerSegmentRules,
    type MarketingEmailAudience,
    type MarketingEmailCampaign,
    type MarketingEmailRecipient,
} from '@letbuyy/shared-types';
import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';

const router = new Hono<{ Bindings: Env }>();

type Db = ReturnType<typeof getSupabaseAdmin>;
type CustomerSummary = ReturnType<typeof buildCustomerSummaries>[number];

interface CampaignRow {
    id?: string | null;
    store_id?: string | null;
    name?: string | null;
    subject?: string | null;
    preview_text?: string | null;
    body_text?: string | null;
    body_html?: string | null;
    status?: string | null;
    audience_type?: string | null;
    audience_segment_id?: string | null;
    audience_rules?: unknown;
    manual_recipients?: string[] | null;
    recipient_count?: number | null;
    sent_count?: number | null;
    failed_count?: number | null;
    delivery_mode?: string | null;
    provider?: string | null;
    last_send_idempotency_key?: string | null;
    scheduled_at?: string | null;
    sent_at?: string | null;
    created_by?: string | null;
    updated_by?: string | null;
    deleted_by?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
    metadata?: unknown;
}

interface RecipientRow {
    id?: string | null;
    campaign_id?: string | null;
    store_id?: string | null;
    customer_email?: string | null;
    customer_id?: string | null;
    status?: string | null;
    provider?: string | null;
    provider_message_id?: string | null;
    error_code?: string | null;
    error_message?: string | null;
    sent_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
    metadata?: unknown;
}

function configuredValue(value: string | undefined): boolean {
    const normalized = String(value || '').toLowerCase();
    return Boolean(normalized)
        && !normalized.includes('placeholder')
        && !normalized.includes('replace-with')
        && !normalized.includes('skip_needs_human')
        && !normalized.includes('dev-only');
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function normalizeEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const email = value.trim().toLowerCase();
    return email.includes('@') ? email : null;
}

function normalizeEmailList(values: readonly string[] | undefined): string[] {
    const seen = new Set<string>();
    const emails: string[] = [];
    for (const value of values || []) {
        const email = normalizeEmail(value);
        if (!email || seen.has(email)) continue;
        seen.add(email);
        emails.push(email);
    }
    return emails;
}

function rulesPayload(value: unknown): CustomerSegmentRules {
    const parsed = CustomerSegmentRulesSchema.safeParse(value || {});
    return parsed.success ? parsed.data : { tags_any: [] };
}

function campaignPayload(row: CampaignRow): MarketingEmailCampaign {
    return {
        id: row.id || '',
        store_id: row.store_id || '',
        name: row.name || 'Email campaign',
        subject: row.subject || '',
        preview_text: row.preview_text || null,
        body_text: row.body_text || '',
        body_html: row.body_html || null,
        status: (row.status || 'draft') as MarketingEmailCampaign['status'],
        audience_type: (row.audience_type || 'all_marketing') as MarketingEmailCampaign['audience_type'],
        audience_segment_id: row.audience_segment_id || null,
        audience_rules: rulesPayload(row.audience_rules),
        manual_recipients: normalizeEmailList(row.manual_recipients || []),
        recipient_count: Number(row.recipient_count || 0),
        sent_count: Number(row.sent_count || 0),
        failed_count: Number(row.failed_count || 0),
        delivery_mode: (row.delivery_mode || 'sandbox') as MarketingEmailCampaign['delivery_mode'],
        provider: row.provider || 'letbuyy_sandbox',
        last_send_idempotency_key: row.last_send_idempotency_key || null,
        scheduled_at: row.scheduled_at || null,
        sent_at: row.sent_at || null,
        metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
        created_by: row.created_by || null,
        updated_by: row.updated_by || null,
        deleted_by: row.deleted_by || null,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || row.created_at || new Date().toISOString(),
        deleted_at: row.deleted_at || null,
    };
}

function recipientPayload(row: RecipientRow): MarketingEmailRecipient {
    return {
        id: row.id || '',
        campaign_id: row.campaign_id || '',
        store_id: row.store_id || '',
        customer_email: normalizeEmail(row.customer_email) || '',
        customer_id: row.customer_id || null,
        status: (row.status || 'queued') as MarketingEmailRecipient['status'],
        provider: row.provider || 'letbuyy_sandbox',
        provider_message_id: row.provider_message_id || null,
        error_code: row.error_code || null,
        error_message: row.error_message || null,
        sent_at: row.sent_at || null,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || row.created_at || new Date().toISOString(),
        deleted_at: row.deleted_at || null,
        metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
    };
}

function customerPayload(summary: CustomerSummary, storeId: string): Customer {
    const displayName = summary.customer_name || summary.full_name || summary.customer_email;
    return {
        id: summary.id,
        store_id: storeId,
        email: summary.customer_email,
        phone: summary.customer_phone,
        first_name: null,
        last_name: null,
        display_name: displayName,
        status: (summary.status || 'active') as Customer['status'],
        accepts_marketing: summary.accepts_marketing,
        tags: summary.tags,
        notes: null,
        default_address_id: null,
        addresses: [],
        order_count: summary.total_orders,
        total_spent: summary.total_spent,
        last_order_at: summary.last_order_at,
        metadata: {},
        created_by: null,
        updated_by: null,
        deleted_by: null,
        created_at: summary.created_at || new Date().toISOString(),
        updated_at: summary.last_order_at || summary.created_at || new Date().toISOString(),
        deleted_at: null,
    };
}

async function verifyStoreOwnership(db: Db, storeId: string, authUser: WorkerAuthUser): Promise<boolean> {
    const customUser = await resolveCustomUser(db, authUser);
    return customUser ? verifySiteOwnership(db, storeId, customUser.id, authUser.storeId) : false;
}

async function loadCustomerSummaries(db: Db, storeId: string) {
    const [customersResult, ordersResult] = await Promise.all([
        db
            .from('store_customers')
            .select('id,email,full_name,phone,status,total_orders,total_spent,accepts_marketing,tags,created_at,last_order_at')
            .eq('store_id', storeId)
            .is('deleted_at', null)
            .limit(5000),
        db
            .from('orders')
            .select('id,customer_email,customer_name,customer_phone,total,created_at')
            .eq('store_id', storeId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(5000),
    ]);

    if (customersResult.error) return { summaries: [] as CustomerSummary[], error: customersResult.error };
    if (ordersResult.error) return { summaries: [] as CustomerSummary[], error: ordersResult.error };

    return {
        summaries: buildCustomerSummaries(
            (customersResult.data || []) as StoreCustomerRecord[],
            (ordersResult.data || []) as CustomerOrderRecord[],
        ),
        error: null,
    };
}

function matchesSegmentRules(summary: CustomerSummary, rules: CustomerSegmentRules): boolean {
    if (!summary.customer_email || !summary.accepts_marketing) return false;
    if (rules.status && summary.status !== rules.status) return false;
    if (rules.accepts_marketing !== null && rules.accepts_marketing !== undefined && summary.accepts_marketing !== rules.accepts_marketing) {
        return false;
    }

    const tagsAny = rules.tags_any || [];
    if (tagsAny.length > 0) {
        const tags = new Set(summary.tags.map((tag) => tag.toLowerCase()));
        if (!tagsAny.some((tag) => tags.has(tag.toLowerCase()))) return false;
    }

    if (rules.min_order_count !== null && rules.min_order_count !== undefined && summary.total_orders < rules.min_order_count) return false;
    if (rules.min_total_spent !== null && rules.min_total_spent !== undefined && summary.total_spent < rules.min_total_spent) return false;
    if (rules.last_order_after && (!summary.last_order_at || summary.last_order_at < rules.last_order_after)) return false;
    if (rules.last_order_before && summary.last_order_at && summary.last_order_at > rules.last_order_before) return false;
    return true;
}

async function resolveAudience(db: Db, storeId: string, audience: MarketingEmailAudience) {
    const summariesResult = await loadCustomerSummaries(db, storeId);
    if (summariesResult.error) {
        return { customers: [] as CustomerSummary[], rules: { tags_any: [] } as CustomerSegmentRules, error: summariesResult.error };
    }

    let rules = rulesPayload(audience.rules);
    if (audience.type === 'segment' && audience.segment_id) {
        const { data, error } = await db
            .from('customer_segments')
            .select('id,rules')
            .eq('store_id', storeId)
            .eq('id', audience.segment_id)
            .is('deleted_at', null)
            .maybeSingle();
        if (error) return { customers: [] as CustomerSummary[], rules, error };
        rules = rulesPayload((data as { rules?: unknown } | null)?.rules);
    }

    let customers = summariesResult.summaries.filter((summary) => (
        Boolean(summary.customer_email) && summary.accepts_marketing
    ));

    if (audience.type === 'segment') {
        customers = customers.filter((summary) => matchesSegmentRules(summary, rules));
    } else if (audience.type === 'manual') {
        const manual = new Set(normalizeEmailList(audience.recipients));
        customers = customers.filter((summary) => manual.has(summary.customer_email));
    }

    return { customers, rules, error: null };
}

function audienceStorage(input: MarketingEmailAudience, resolvedRules?: CustomerSegmentRules) {
    return {
        audience_type: input.type,
        audience_segment_id: input.type === 'segment' ? input.segment_id || null : null,
        audience_rules: input.type === 'segment' ? resolvedRules || rulesPayload(input.rules) : rulesPayload(input.rules),
        manual_recipients: input.type === 'manual' ? normalizeEmailList(input.recipients) : [],
    };
}

async function loadCampaign(db: Db, storeId: string, id: string) {
    const { data, error } = await db
        .from('marketing_email_campaigns')
        .select('*')
        .eq('store_id', storeId)
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();
    return { data: data as CampaignRow | null, error };
}

function campaignAudience(row: CampaignRow): MarketingEmailAudience {
    return {
        type: (row.audience_type || 'all_marketing') as MarketingEmailAudience['type'],
        segment_id: row.audience_segment_id || null,
        rules: rulesPayload(row.audience_rules),
        recipients: normalizeEmailList(row.manual_recipients || []),
    };
}

router.get('/email-campaigns', validate('query', ListEmailCampaignsQuery), async (c) => {
    const auth = c.get('auth');
    const query = c.get('validatedQuery') as ListEmailCampaignsInput;
    const db = getSupabaseAdmin(c);

    if (!(await verifyStoreOwnership(db, query.store_id, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    let campaignQuery = db
        .from('marketing_email_campaigns')
        .select('*', { count: 'exact' })
        .eq('store_id', query.store_id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .range((query.page - 1) * query.limit, query.page * query.limit - 1);

    if (query.status) campaignQuery = campaignQuery.eq('status', query.status);

    const { data, error, count } = await campaignQuery;
    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load campaigns' } }, 500);

    return c.json(paginated(((data || []) as CampaignRow[]).map(campaignPayload), count || 0, query.page, query.limit));
});

router.post('/email-campaigns/audience-preview', validate('json', PreviewEmailCampaignAudienceSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as PreviewEmailCampaignAudienceInput;
    const db = getSupabaseAdmin(c);

    if (!(await verifyStoreOwnership(db, body.store_id, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const audience = await resolveAudience(db, body.store_id, body.audience);
    if (audience.error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to resolve campaign audience' } }, 500);

    return c.json(success({
        store_id: body.store_id,
        audience: { ...body.audience, rules: audience.rules },
        customer_count: audience.customers.length,
        sample_customers: audience.customers.slice(0, 10).map((customer) => customerPayload(customer, body.store_id)),
    }));
});

router.post('/email-campaigns', validate('json', CreateEmailCampaignSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateEmailCampaignInput;
    const db = getSupabaseAdmin(c);

    if (!(await verifyStoreOwnership(db, body.store_id, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const customUser = await resolveCustomUser(db, auth.user);
    const audience = await resolveAudience(db, body.store_id, body.audience);
    if (audience.error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to resolve campaign audience' } }, 500);

    const { data, error } = await db
        .from('marketing_email_campaigns')
        .insert({
            store_id: body.store_id,
            name: body.name,
            subject: body.subject,
            preview_text: body.preview_text || null,
            body_text: body.body_text,
            body_html: body.body_html || null,
            status: body.scheduled_at ? 'scheduled' : 'draft',
            ...audienceStorage(body.audience, audience.rules),
            recipient_count: audience.customers.length,
            scheduled_at: body.scheduled_at || null,
            metadata: body.metadata || {},
            created_by: customUser?.id || null,
            updated_by: customUser?.id || null,
        })
        .select('*')
        .single();

    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to create campaign' } }, 500);
    return c.json(success(campaignPayload(data as CampaignRow)), 201);
});

router.get('/email-campaigns/:id', validate('query', GetEmailCampaignQuery), async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    const query = c.get('validatedQuery') as GetEmailCampaignInput;
    const db = getSupabaseAdmin(c);

    if (!(await verifyStoreOwnership(db, query.store_id, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const [campaignResult, recipientsResult] = await Promise.all([
        loadCampaign(db, query.store_id, id),
        db
            .from('marketing_email_recipients')
            .select('*')
            .eq('store_id', query.store_id)
            .eq('campaign_id', id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(100),
    ]);

    if (campaignResult.error || recipientsResult.error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load campaign' } }, 500);
    }
    if (!campaignResult.data) return c.json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } }, 404);

    return c.json(success({
        campaign: campaignPayload(campaignResult.data),
        recipients: ((recipientsResult.data || []) as RecipientRow[]).map(recipientPayload),
    }));
});

router.patch('/email-campaigns/:id', validate('json', UpdateEmailCampaignSchema), async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    const body = c.get('validatedBody') as UpdateEmailCampaignInput;
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId) return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    if (!(await verifyStoreOwnership(db, storeId, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const existing = await loadCampaign(db, storeId, id);
    if (existing.error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load campaign' } }, 500);
    if (!existing.data) return c.json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } }, 404);
    if (existing.data.status === 'sent') {
        return c.json({ error: { code: 'CAMPAIGN_LOCKED', message: 'Sent campaigns cannot be edited' } }, 409);
    }

    let audienceUpdate = {};
    let recipientCount: number | undefined;
    if (body.audience) {
        const audience = await resolveAudience(db, storeId, body.audience);
        if (audience.error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to resolve campaign audience' } }, 500);
        audienceUpdate = audienceStorage(body.audience, audience.rules);
        recipientCount = audience.customers.length;
    }

    const customUser = await resolveCustomUser(db, auth.user);
    const { data, error } = await db
        .from('marketing_email_campaigns')
        .update({
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.subject !== undefined ? { subject: body.subject } : {}),
            ...(body.preview_text !== undefined ? { preview_text: body.preview_text || null } : {}),
            ...(body.body_text !== undefined ? { body_text: body.body_text } : {}),
            ...(body.body_html !== undefined ? { body_html: body.body_html || null } : {}),
            ...(body.status !== undefined ? { status: body.status } : {}),
            ...(body.scheduled_at !== undefined ? { scheduled_at: body.scheduled_at || null } : {}),
            ...(body.metadata !== undefined ? { metadata: body.metadata || {} } : {}),
            ...audienceUpdate,
            ...(recipientCount !== undefined ? { recipient_count: recipientCount } : {}),
            updated_by: customUser?.id || null,
        })
        .eq('store_id', storeId)
        .eq('id', id)
        .is('deleted_at', null)
        .select('*')
        .single();

    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to update campaign' } }, 500);
    return c.json(success(campaignPayload(data as CampaignRow)));
});

router.post('/email-campaigns/:id/send', validate('json', SendEmailCampaignSchema), async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    const body = c.get('validatedBody') as SendEmailCampaignInput;
    const db = getSupabaseAdmin(c);

    if (!(await verifyStoreOwnership(db, body.store_id, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const existing = await loadCampaign(db, body.store_id, id);
    if (existing.error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load campaign' } }, 500);
    if (!existing.data) return c.json({ error: { code: 'NOT_FOUND', message: 'Campaign not found' } }, 404);
    if (existing.data.last_send_idempotency_key === body.idempotency_key && existing.data.status === 'sent') {
        const { data } = await db
            .from('marketing_email_recipients')
            .select('*')
            .eq('store_id', body.store_id)
            .eq('campaign_id', id)
            .is('deleted_at', null)
            .limit(100);
        const recipients = ((data || []) as RecipientRow[]).map(recipientPayload);
        return c.json(success({
            campaign: campaignPayload(existing.data),
            recipients,
            delivery_mode: existing.data.delivery_mode || 'sandbox',
            provider: existing.data.provider || 'letbuyy_sandbox',
            sandbox: existing.data.delivery_mode !== 'live',
            sent_count: Number(existing.data.sent_count || 0),
            failed_count: Number(existing.data.failed_count || 0),
        }));
    }
    if (existing.data.status === 'sent') {
        return c.json({ error: { code: 'CAMPAIGN_SENT', message: 'This campaign has already been sent' } }, 409);
    }

    const audience = await resolveAudience(db, body.store_id, campaignAudience(existing.data));
    if (audience.error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to resolve campaign audience' } }, 500);
    if (audience.customers.length === 0) {
        return c.json({ error: { code: 'EMPTY_AUDIENCE', message: 'No subscribed customers match this audience' } }, 422);
    }

    const now = new Date().toISOString();
    const liveEmail = configuredValue(c.env.RESEND_API_KEY);
    const deliveryMode = liveEmail ? 'live' : 'sandbox';
    const provider = liveEmail ? 'resend' : 'letbuyy_sandbox';
    const html = existing.data.body_html || `<p>${escapeHtml(existing.data.body_text || '').replaceAll('\n', '<br>')}</p>`;
    const from = c.env.RESEND_FROM_EMAIL || 'LetBuyy <noreply@letbuyy.store>';
    const recipients: RecipientRow[] = [];
    let sentCount = 0;
    let failedCount = 0;

    await db
        .from('marketing_email_recipients')
        .delete()
        .eq('store_id', body.store_id)
        .eq('campaign_id', id);

    for (const customer of audience.customers) {
        const email = normalizeEmail(customer.customer_email);
        if (!email) continue;

        let status: MarketingEmailRecipient['status'] = 'sandbox_sent';
        let errorMessage: string | null = null;
        if (liveEmail) {
            const result = await sendResendEmail({
                apiKey: c.env.RESEND_API_KEY,
                from,
                to: email,
                subject: existing.data.subject || '',
                text: existing.data.body_text || '',
                html,
            });
            status = result.success ? 'sent' : 'failed';
            errorMessage = result.success ? null : 'Campaign email could not be sent';
        }

        if (status === 'sent' || status === 'sandbox_sent') sentCount += 1;
        if (status === 'failed') failedCount += 1;
        recipients.push({
            campaign_id: id,
            store_id: body.store_id,
            customer_email: email,
            customer_id: customer.id,
            status,
            provider,
            sent_at: status === 'failed' ? null : now,
            error_code: status === 'failed' ? 'EMAIL_FAILED' : null,
            error_message: errorMessage,
            metadata: { source: 'marketing_campaign' },
        });
    }

    let savedRecipientRows: RecipientRow[] = [];
    if (recipients.length > 0) {
        const { data: recipientData, error: recipientError } = await db
            .from('marketing_email_recipients')
            .insert(recipients)
            .select('*');
        if (recipientError) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to save campaign recipients' } }, 500);
        savedRecipientRows = (recipientData || []) as RecipientRow[];
    }

    const { data, error } = await db
        .from('marketing_email_campaigns')
        .update({
            status: failedCount > 0 && sentCount === 0 ? 'failed' : 'sent',
            recipient_count: recipients.length,
            sent_count: sentCount,
            failed_count: failedCount,
            delivery_mode: deliveryMode,
            provider,
            last_send_idempotency_key: body.idempotency_key,
            sent_at: sentCount > 0 ? now : null,
        })
        .eq('store_id', body.store_id)
        .eq('id', id)
        .select('*')
        .single();

    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to update campaign status' } }, 500);
    return c.json(success({
        campaign: campaignPayload(data as CampaignRow),
        recipients: savedRecipientRows.map(recipientPayload),
        delivery_mode: deliveryMode,
        provider,
        sandbox: deliveryMode !== 'live',
        sent_count: sentCount,
        failed_count: failedCount,
    }));
});

export default router;
