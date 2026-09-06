import { Hono, type Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser } from '../lib/auth-user';
import { assertStaffPermission } from '../middleware/staff-permission';
import { emailProviderConfigured, escapeHtml } from '../lib/customer-email';
import { customerCursorPage, orderCustomerSummaries } from '../lib/customer-pagination';
import { cursorPaginated, getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { resolveOwnedStoreScope } from '../lib/tenant-context';
import { validate } from '../middleware/validation';
import {
    CreateCustomerSchema,
    CreateCustomerSegmentSchema,
    CreateCustomerNoteSchema,
    CreateCustomerAddressSchema,
    ListCustomerSegmentsQuery,
    ListCustomersQuery,
    MergeCustomerSchema,
    PreviewCustomerSegmentSchema,
    SendCustomerEmailSchema,
    UpdateCustomerSegmentSchema,
    UpdateCustomerSchema,
    UpdateCustomerTagsSchema,
} from '../schemas/customer.schema';
import {
    buildCustomerSummaries,
    matchesCustomerSearch,
    type CustomerOrderRecord,
    type StoreCustomerRecord,
} from '@letbuyy/commerce-core';
import {
    CustomerSegmentRulesSchema,
    type Customer,
    type CustomerSegment,
    type CustomerSegmentRules,
} from '@letbuyy/shared-types';
import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';
import { dispatchStoreAppComplianceWebhook } from './app-store/compliance-routes';
import type { z } from 'zod';

import {
    applySegmentRules,
    customerSummaryPayload,
    matchesSegmentRules,
    segmentPayload,
    segmentRulesPayload,
    splitCustomerName,
    type CustomerSegmentRow,
} from '../lib/customer-segments';

const router = new Hono<{ Bindings: Env }>();
type CustomerRouteContext = Context<{ Bindings: Env }>;

type ListCustomersQueryInput = z.infer<typeof ListCustomersQuery>;
type ListCustomerSegmentsInput = z.infer<typeof ListCustomerSegmentsQuery>;
type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
type CreateCustomerSegmentInput = z.infer<typeof CreateCustomerSegmentSchema>;
type UpdateCustomerSegmentInput = z.infer<typeof UpdateCustomerSegmentSchema>;
type PreviewCustomerSegmentInput = z.infer<typeof PreviewCustomerSegmentSchema>;
type MergeCustomerInput = z.infer<typeof MergeCustomerSchema>;
type CreateCustomerNoteInput = z.infer<typeof CreateCustomerNoteSchema>;
type CreateCustomerAddressInput = z.infer<typeof CreateCustomerAddressSchema>;
type SendCustomerEmailInput = z.infer<typeof SendCustomerEmailSchema>;
type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
type UpdateCustomerTagsInput = z.infer<typeof UpdateCustomerTagsSchema>;

interface AddressOwnerRow {
    store_id?: string | null;
}

interface StoreCustomerOwnerRow {
    id?: string | null;
    store_id?: string | null;
    email?: string | null;
}

interface StoreCustomerExportRow extends StoreCustomerOwnerRow {
    full_name?: string | null;
    phone?: string | null;
    status?: string | null;
    total_orders?: number | null;
    total_spent?: string | number | null;
    accepts_marketing?: boolean | null;
    tags?: string[] | null;
    notes?: string | null;
    last_order_at?: string | null;
    last_login_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
}

interface CustomerNoteRow {
    id?: string | null;
    store_id?: string | null;
    customer_email?: string | null;
    note?: string | null;
    created_by?: string | null;
    updated_by?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}


type DatabaseErrorLike = { code?: string; message?: string; details?: string; hint?: string } | null | undefined;

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

function isMissingTableError(error: DatabaseErrorLike, tableName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(tableName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

async function loadStoreCustomerRows(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
) {
    const buildQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
            .from('store_customers')
            .select('id,email,full_name,phone,status,total_orders,total_spent,accepts_marketing,tags,created_at,last_order_at')
            .eq('store_id', storeId)
            .order('last_order_at', { ascending: false, nullsFirst: false })
            .limit(5000);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        return query;
    };

    let { data, error } = await buildQuery(true);
    if (isMissingColumnError(error, 'deleted_at')) {
        ({ data, error } = await buildQuery(false));
    }

    if (isMissingTableError(error, 'store_customers')) {
        return { data: [] as StoreCustomerRecord[], error: null };
    }

    return { data: (data || []) as StoreCustomerRecord[], error };
}

async function loadCustomerOrderRows(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
) {
    const buildQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
            .from('orders')
            .select('id,customer_email,customer_name,customer_phone,total,created_at')
            .eq('store_id', storeId)
            .order('created_at', { ascending: false })
            .limit(5000);

        if (includeDeletedAtFilter) query = query.is('deleted_at', null);
        return query;
    };

    let { data, error } = await buildQuery(true);
    if (isMissingColumnError(error, 'deleted_at')) {
        ({ data, error } = await buildQuery(false));
    }

    return { data: (data || []) as CustomerOrderRecord[], error };
}

async function hasOwnedStoreScope(c: CustomerRouteContext, storeId: string): Promise<boolean> {
    try {
        await resolveOwnedStoreScope(c, storeId);
        return true;
    } catch {
        return false;
    }
}

function normalizeCustomerEmail(value: string): string {
    return decodeURIComponent(value).trim().toLowerCase();
}

function normalizeTags(tags: readonly string[] | undefined): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const tag of tags || []) {
        const value = tag.trim();
        const key = value.toLowerCase();
        if (!value || seen.has(key)) continue;
        seen.add(key);
        normalized.push(value);
    }

    return normalized;
}

async function replaceCustomerTags(db: ReturnType<typeof getSupabaseAdmin>, storeId: string, email: string, tags: readonly string[], actorId: string | null) {
    const now = new Date().toISOString();
    const normalized = normalizeTags(tags);
    const { error: clearError } = await db
        .from('customer_tags')
        .update({ deleted_at: now, deleted_by: actorId, updated_by: actorId })
        .eq('store_id', storeId)
        .eq('customer_email', email)
        .is('deleted_at', null);
    if (clearError) return clearError;
    if (normalized.length === 0) return null;
    const { error } = await db.from('customer_tags').insert(normalized.map((tag) => ({ store_id: storeId, customer_email: email, tag, created_by: actorId, updated_by: actorId })));
    return error;
}


function buildCustomerFullName(input: UpdateCustomerInput, existing?: StoreCustomerExportRow | null): string | null | undefined {
    if (input.first_name === undefined && input.last_name === undefined) return undefined;
    const existingName = splitCustomerName(existing?.full_name);
    const firstName = input.first_name ?? existingName.firstName ?? '';
    const lastName = input.last_name ?? existingName.lastName ?? '';
    const fullName = [firstName, lastName].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
    return fullName || null;
}

function customerPayload(row: StoreCustomerExportRow, fallbackEmail?: string) {
    const nameParts = splitCustomerName(row.full_name);
    return {
        id: row.id,
        store_id: row.store_id,
        email: row.email || fallbackEmail || null,
        phone: row.phone || null,
        first_name: nameParts.firstName,
        last_name: nameParts.lastName,
        display_name: row.full_name || fallbackEmail || null,
        status: row.status || 'active',
        accepts_marketing: row.accepts_marketing ?? false,
        tags: row.tags || [],
        notes: row.notes || null,
        order_count: row.total_orders || 0,
        total_spent: Number(row.total_spent || 0),
        last_order_at: row.last_order_at || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: null,
        metadata: {},
    };
}





async function loadCustomerSummariesForStore(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
) {
    const [storeCustomersResult, ordersResult] = await Promise.all([
        loadStoreCustomerRows(db, storeId),
        loadCustomerOrderRows(db, storeId),
    ]);

    if (storeCustomersResult.error) return { summaries: [], error: storeCustomersResult.error };
    if (ordersResult.error) return { summaries: [], error: ordersResult.error };

    return {
        summaries: buildCustomerSummaries(storeCustomersResult.data, ordersResult.data),
        error: null,
    };
}


async function loadCustomerProfileRow(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    email: string,
) {
    const { data, error } = await db
        .from('store_customers')
        .select('id,store_id,email,full_name,phone,status,total_orders,total_spent,accepts_marketing,tags,notes,last_order_at,last_login_at,created_at,updated_at')
        .eq('store_id', storeId)
        .eq('email', email)
        .maybeSingle();

    return { data: data as StoreCustomerExportRow | null, error };
}

async function customerHasOrders(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    email: string,
) {
    const { data, error } = await db
        .from('orders')
        .select('id')
        .eq('store_id', storeId)
        .eq('customer_email', email)
        .limit(1);

    if (error) return { exists: false, error };
    return { exists: (data || []).length > 0, error: null };
}

async function recalculateCustomerOrderTotals(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    email: string,
) {
    const { data, error } = await db
        .from('orders')
        .select('id,total,created_at')
        .eq('store_id', storeId)
        .eq('customer_email', email)
        .order('created_at', { ascending: false });

    if (error) return { totalOrders: 0, totalSpent: 0, lastOrderAt: null as string | null, error };
    const rows = data || [];
    return {
        totalOrders: rows.length,
        totalSpent: rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
        lastOrderAt: rows[0]?.created_at || null,
        error: null,
    };
}

router.get('/', validate('query', ListCustomersQuery), async (c) => {
    const q = c.get('validatedQuery') as ListCustomersQueryInput;
    const db = getSupabaseAdmin(c);
    const storeId = q.store_id;

    if (!storeId) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    // Verify store ownership
    if (!(await hasOwnedStoreScope(c, storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const summariesResult = await loadCustomerSummariesForStore(db, storeId);
    if (summariesResult.error) {
        return c.json({ error: { code: 'DB_ERROR', message: summariesResult.error.message } }, 500);
    }

    const tag = q.tag?.trim().toLowerCase();
    const summaries = orderCustomerSummaries(summariesResult.summaries
        .filter((customer) => matchesCustomerSearch(customer, q.search))
        .filter((customer) => !tag || customer.tags.some((value) => value.toLowerCase() === tag))
        .filter((customer) => q.has_orders === undefined || (q.has_orders ? customer.total_orders > 0 : customer.total_orders === 0)));

    const page = customerCursorPage(summaries, q);
    return c.json(cursorPaginated(page.rows.map((summary) => customerSummaryPayload(summary, storeId)), {
        page: q.page,
        limit: q.limit,
        total: q.withCount ? summaries.length : null,
        nextCursor: page.nextCursor,
    }));
});

router.post('/', validate('json', CreateCustomerSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateCustomerInput;
    const db = getSupabaseAdmin(c);
    const email = normalizeCustomerEmail(body.email);
    if (!(await hasOwnedStoreScope(c, body.store_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const customUser = await resolveCustomUser(db, auth.user);
    const actorId = customUser?.id || null;

    const staffBlock = await assertStaffPermission(c, body.store_id, actorId, 'customers:write');
    if (staffBlock) return staffBlock;

    const tags = normalizeTags(body.tags);
    const fullName = [body.first_name, body.last_name].map((part) => String(part || '').trim()).filter(Boolean).join(' ');
    const selectColumns = 'id,store_id,email,full_name,phone,status,total_orders,total_spent,accepts_marketing,tags,notes,last_order_at,last_login_at,created_at,updated_at,deleted_at';
    const { data: existing, error: existingError } = await db.from('store_customers').select(selectColumns).eq('store_id', body.store_id).eq('email', email).maybeSingle();
    if (existingError) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer' } }, 500);
    if ((existing as StoreCustomerExportRow | null)?.id && !(existing as StoreCustomerExportRow).deleted_at) {
        return c.json({ error: { code: 'CONFLICT', message: 'Customer already exists' } }, 409);
    }

    const payload = { email, full_name: fullName, phone: body.phone?.trim() || null, notes: body.notes?.trim() || null, tags, accepts_marketing: body.accepts_marketing, status: 'active', deleted_at: null, updated_at: new Date().toISOString() };
    const mutation = (existing as StoreCustomerExportRow | null)?.id
        ? db.from('store_customers').update(payload).eq('id', (existing as StoreCustomerExportRow).id).eq('store_id', body.store_id)
        : db.from('store_customers').insert({ store_id: body.store_id, ...payload });
    const { data, error } = await mutation.select(selectColumns).single();
    if (error) {
        const code = error.code === '23505' ? 'CONFLICT' : 'DB_ERROR';
        const message = error.code === '23505' ? 'Customer already exists' : 'Unable to create customer';
        return c.json({ error: { code, message } }, error.code === '23505' ? 409 : 500);
    }

    const tagError = await replaceCustomerTags(db, body.store_id, email, tags, actorId);
    if (tagError) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to save customer tags' } }, 500);
    return c.json(success(customerPayload(data as StoreCustomerExportRow, email)), 201);
});

router.get('/segments', validate('query', ListCustomerSegmentsQuery), async (c) => {
    const q = c.get('validatedQuery') as ListCustomerSegmentsInput;
    const db = getSupabaseAdmin(c);

    if (!(await hasOwnedStoreScope(c, q.store_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    let query = db
        .from('customer_segments')
        .select('id,store_id,name,description,rules,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at')
        .eq('store_id', q.store_id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

    if (q.search?.trim()) {
        query = query.ilike('name', `%${q.search.trim()}%`);
    }

    const [{ data, error }, summariesResult] = await Promise.all([
        query,
        loadCustomerSummariesForStore(db, q.store_id),
    ]);

    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer segments' } }, 500);
    if (summariesResult.error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to count customer segments' } }, 500);

    const segments = ((data || []) as CustomerSegmentRow[]).map((row) => {
        const rules = segmentRulesPayload(row.rules);
        return segmentPayload(row, applySegmentRules(summariesResult.summaries, rules).length);
    });

    return c.json(success(segments));
});

router.post('/segments', validate('json', CreateCustomerSegmentSchema), async (c) => {
    const auth = c.get('auth');
    const body = c.get('validatedBody') as CreateCustomerSegmentInput;
    const db = getSupabaseAdmin(c);

    if (!(await hasOwnedStoreScope(c, body.store_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const customUser = await resolveCustomUser(db, auth.user);
    const { data, error } = await db
        .from('customer_segments')
        .insert({
            store_id: body.store_id,
            name: body.name,
            description: body.description || null,
            rules: body.rules,
            created_by: customUser?.id || null,
            updated_by: customUser?.id || null,
        })
        .select('id,store_id,name,description,rules,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at')
        .single();

    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to save customer segment' } }, 500);

    const summariesResult = await loadCustomerSummariesForStore(db, body.store_id);
    const count = summariesResult.error ? 0 : applySegmentRules(summariesResult.summaries, body.rules).length;
    return c.json(success(segmentPayload(data as CustomerSegmentRow, count)), 201);
});

router.patch('/segments/:id', validate('json', UpdateCustomerSegmentSchema), async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    const body = c.get('validatedBody') as UpdateCustomerSegmentInput;
    const db = getSupabaseAdmin(c);

    const { data: existing, error: existingError } = await db
        .from('customer_segments')
        .select('id,store_id,rules')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

    if (existingError) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer segment' } }, 500);
    const existingSegment = existing as CustomerSegmentRow | null;
    if (!existingSegment?.store_id) return c.json({ error: { code: 'NOT_FOUND', message: 'Customer segment not found' } }, 404);
    if (!(await hasOwnedStoreScope(c, existingSegment.store_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const customUser = await resolveCustomUser(db, auth.user);
    const updates: Record<string, unknown> = {
        updated_by: customUser?.id || null,
        updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description || null;
    if (body.rules !== undefined) updates.rules = body.rules;

    const { data, error } = await db
        .from('customer_segments')
        .update(updates)
        .eq('id', id)
        .eq('store_id', existingSegment.store_id)
        .select('id,store_id,name,description,rules,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at')
        .single();

    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to update customer segment' } }, 500);

    const rules = segmentRulesPayload((data as CustomerSegmentRow).rules);
    const summariesResult = await loadCustomerSummariesForStore(db, existingSegment.store_id);
    const count = summariesResult.error ? 0 : applySegmentRules(summariesResult.summaries, rules).length;
    return c.json(success(segmentPayload(data as CustomerSegmentRow, count)));
});

router.post('/segments/preview', validate('json', PreviewCustomerSegmentSchema), async (c) => {
    const body = c.get('validatedBody') as PreviewCustomerSegmentInput;
    const db = getSupabaseAdmin(c);

    if (!(await hasOwnedStoreScope(c, body.store_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const summariesResult = await loadCustomerSummariesForStore(db, body.store_id);
    if (summariesResult.error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to preview customer segment' } }, 500);
    }

    const matches = applySegmentRules(summariesResult.summaries, body.rules);
    return c.json(success({
        store_id: body.store_id,
        rules: body.rules,
        customer_count: matches.length,
        sample_customers: matches.slice(0, 10).map((summary) => customerSummaryPayload(summary, body.store_id)),
    }));
});

router.get('/segments/:id/customers', async (c) => {
    const id = c.req.param('id');
    const storeId = c.req.query('store_id');
    const page = Math.max(Number(c.req.query('page') || 1), 1);
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 30), 1), 100);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    if (!storeId) return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    if (!(await hasOwnedStoreScope(c, storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('customer_segments')
        .select('id,store_id,rules')
        .eq('id', id)
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer segment' } }, 500);
    if (!data) return c.json({ error: { code: 'NOT_FOUND', message: 'Customer segment not found' } }, 404);

    const summariesResult = await loadCustomerSummariesForStore(db, storeId);
    if (summariesResult.error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to apply customer segment' } }, 500);

    const matches = applySegmentRules(summariesResult.summaries, segmentRulesPayload((data as CustomerSegmentRow).rules));
    const customers = matches.map((summary) => customerSummaryPayload(summary, storeId));
    return c.json(paginated(customers.slice(offset, offset + limit), customers.length, page, limit));
});

router.get('/:email/data-export', async (c) => {
    const auth = c.get('auth');
    const email = decodeURIComponent(c.req.param('email')).trim().toLowerCase();
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId || !email) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id and customer email are required' } }, 400);
    }

    if (!(await hasOwnedStoreScope(c, storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const [customerResult, ordersResult, addressesResult, credentialsResult] = await Promise.all([
        db
            .from('store_customers')
            .select('id,store_id,email,full_name,phone,status,total_orders,total_spent,accepts_marketing,tags,notes,last_order_at,last_login_at,created_at,updated_at')
            .eq('store_id', storeId)
            .eq('email', email)
            .maybeSingle(),
        db
            .from('orders')
            .select('id,order_number,status,payment_status,fulfillment_status,customer_email,customer_name,customer_phone,subtotal,shipping_cost,tax,discount,total,currency,created_at,updated_at')
            .eq('store_id', storeId)
            .eq('customer_email', email)
            .order('created_at', { ascending: false }),
        db
            .from('customer_addresses')
            .select('id,customer_email,customer_phone,label,full_name,address_line1,address_line2,city,state,postal_code,country,landmark,is_default,created_at,updated_at')
            .eq('store_id', storeId)
            .eq('customer_email', email)
            .order('is_default', { ascending: false }),
        db
            .from('customer_credentials')
            .select('id,email_or_phone,last_login_at,login_count,created_at,updated_at')
            .eq('store_id', storeId)
            .eq('email_or_phone', email)
            .maybeSingle(),
    ]);

    if (customerResult.error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer' } }, 500);
    }

    if (ordersResult.error || addressesResult.error || credentialsResult.error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to build customer export' } }, 500);
    }

    const customer = customerResult.data as StoreCustomerExportRow | null;
    const orders = ordersResult.data || [];
    if (!customer && orders.length === 0) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
    }

    return c.json(success({
        generated_at: new Date().toISOString(),
        store_id: storeId,
        customer: customer ? {
            id: customer.id,
            email: customer.email,
            full_name: customer.full_name,
            phone: customer.phone,
            status: customer.status,
            total_orders: customer.total_orders,
            total_spent: customer.total_spent,
            accepts_marketing: customer.accepts_marketing,
            tags: customer.tags || [],
            notes: customer.notes,
            last_order_at: customer.last_order_at,
            last_login_at: customer.last_login_at,
            created_at: customer.created_at,
            updated_at: customer.updated_at,
        } : null,
        orders,
        addresses: addressesResult.data || [],
        credentials: credentialsResult.data ? {
            id: credentialsResult.data.id,
            email_or_phone: credentialsResult.data.email_or_phone,
            last_login_at: credentialsResult.data.last_login_at,
            login_count: credentialsResult.data.login_count,
            created_at: credentialsResult.data.created_at,
            updated_at: credentialsResult.data.updated_at,
        } : null,
    }));
});

router.patch('/:email', validate('json', UpdateCustomerSchema), async (c) => {
    const auth = c.get('auth');
    const email = normalizeCustomerEmail(c.req.param('email'));
    const storeId = c.req.query('store_id');
    const body = c.get('validatedBody') as UpdateCustomerInput;
    const db = getSupabaseAdmin(c);

    if (!storeId || !email) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id and customer email are required' } }, 400);
    }

    if (!(await hasOwnedStoreScope(c, storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const customUser = await resolveCustomUser(db, auth.user);

    const staffBlock = await assertStaffPermission(c, storeId, customUser?.id, 'customers:write');
    if (staffBlock) return staffBlock;

    const existingResult = await loadCustomerProfileRow(db, storeId, email);
    if (existingResult.error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer' } }, 500);
    }

    if (!existingResult.data) {
        const orderCheck = await customerHasOrders(db, storeId, email);
        if (orderCheck.error) {
            return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer orders' } }, 500);
        }
        if (!orderCheck.exists) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
        }
    }

    const updates: Record<string, unknown> = {};
    const fullName = buildCustomerFullName(body, existingResult.data);
    if (fullName !== undefined) updates.full_name = fullName;
    if (body.phone !== undefined) updates.phone = body.phone?.trim() || null;
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
    if (body.tags !== undefined) updates.tags = normalizeTags(body.tags);
    if (body.accepts_marketing !== undefined) updates.accepts_marketing = body.accepts_marketing;

    if (Object.keys(updates).length === 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'No valid fields to update' } }, 400);
    }

    updates.updated_at = new Date().toISOString();

    const mutation = existingResult.data?.id
        ? db
            .from('store_customers')
            .update(updates)
            .eq('id', existingResult.data.id)
            .eq('store_id', storeId)
            .select('id,store_id,email,full_name,phone,status,total_orders,total_spent,accepts_marketing,tags,notes,last_order_at,last_login_at,created_at,updated_at')
            .single()
        : db
            .from('store_customers')
            .insert({
                store_id: storeId,
                email,
                full_name: updates.full_name ?? null,
                phone: updates.phone ?? null,
                notes: updates.notes ?? null,
                tags: updates.tags ?? [],
                accepts_marketing: updates.accepts_marketing ?? false,
                status: 'active',
            })
            .select('id,store_id,email,full_name,phone,status,total_orders,total_spent,accepts_marketing,tags,notes,last_order_at,last_login_at,created_at,updated_at')
            .single();

    const { data, error } = await mutation;
    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to update customer' } }, 500);
    }

    if (body.tags !== undefined) {
        const tagError = await replaceCustomerTags(db, storeId, email, body.tags, customUser?.id || null);
        if (tagError) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to update customer tags' } }, 500);
    }

    return c.json(success(customerPayload(data as StoreCustomerExportRow, email)));
});

router.get('/:email/notes', async (c) => {
    const auth = c.get('auth');
    const email = normalizeCustomerEmail(c.req.param('email'));
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId || !email) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id and customer email are required' } }, 400);
    }

    if (!(await hasOwnedStoreScope(c, storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('customer_notes')
        .select('id,store_id,customer_email,note,created_by,updated_by,created_at,updated_at')
        .eq('store_id', storeId)
        .eq('customer_email', email)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer notes' } }, 500);
    }

    return c.json(success((data || []) as CustomerNoteRow[]));
});

router.post('/:email/notes', validate('json', CreateCustomerNoteSchema), async (c) => {
    const auth = c.get('auth');
    const email = normalizeCustomerEmail(c.req.param('email'));
    const body = c.get('validatedBody') as CreateCustomerNoteInput;
    const db = getSupabaseAdmin(c);

    if (!(await hasOwnedStoreScope(c, body.store_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const existingResult = await loadCustomerProfileRow(db, body.store_id, email);
    if (existingResult.error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer' } }, 500);
    }
    if (!existingResult.data) {
        const orderCheck = await customerHasOrders(db, body.store_id, email);
        if (orderCheck.error) {
            return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer orders' } }, 500);
        }
        if (!orderCheck.exists) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
        }
    }

    const customUser = await resolveCustomUser(db, auth.user);
    const { data, error } = await db
        .from('customer_notes')
        .insert({
            store_id: body.store_id,
            customer_email: email,
            note: body.note,
            created_by: customUser?.id || null,
            updated_by: customUser?.id || null,
        })
        .select('id,store_id,customer_email,note,created_by,updated_by,created_at,updated_at')
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to save customer note' } }, 500);
    }

    const existingNotes = existingResult.data?.notes?.trim();
    const nextNotes = [existingNotes, body.note].filter(Boolean).join('\n');
    if (existingResult.data?.id) {
        await db
            .from('store_customers')
            .update({ notes: nextNotes, updated_at: new Date().toISOString() })
            .eq('id', existingResult.data.id)
            .eq('store_id', body.store_id);
    }

    return c.json(success(data as CustomerNoteRow), 201);
});

router.put('/:email/tags', validate('json', UpdateCustomerTagsSchema), async (c) => {
    const auth = c.get('auth');
    const email = normalizeCustomerEmail(c.req.param('email'));
    const body = c.get('validatedBody') as UpdateCustomerTagsInput;
    const db = getSupabaseAdmin(c);

    if (!(await hasOwnedStoreScope(c, body.store_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const updated = await db
        .from('store_customers')
        .update({ tags: normalizeTags(body.tags), updated_at: new Date().toISOString() })
        .eq('store_id', body.store_id)
        .eq('email', email)
        .select('id,store_id,email,full_name,phone,status,total_orders,total_spent,accepts_marketing,tags,notes,last_order_at,last_login_at,created_at,updated_at')
        .maybeSingle();

    if (updated.error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to update customer tags' } }, 500);
    }
    if (!updated.data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
    }

    const customUser = await resolveCustomUser(db, auth.user);
    const tagError = await replaceCustomerTags(db, body.store_id, email, body.tags, customUser?.id || null);
    if (tagError) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to save customer tags' } }, 500);

    return c.json(success(customerPayload(updated.data as StoreCustomerExportRow, email)));
});

router.post('/:email/email', validate('json', SendCustomerEmailSchema), async (c) => {
    const auth = c.get('auth');
    const email = normalizeCustomerEmail(c.req.param('email'));
    const body = c.get('validatedBody') as SendCustomerEmailInput;
    const db = getSupabaseAdmin(c);

    if (!(await hasOwnedStoreScope(c, body.store_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const existingResult = await loadCustomerProfileRow(db, body.store_id, email);
    if (existingResult.error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer' } }, 500);
    }
    if (!existingResult.data) {
        const orderCheck = await customerHasOrders(db, body.store_id, email);
        if (orderCheck.error) {
            return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer orders' } }, 500);
        }
        if (!orderCheck.exists) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
        }
    }

    if (!emailProviderConfigured(c.env.RESEND_API_KEY)) {
        return c.json({ error: { code: 'EMAIL_UNAVAILABLE', message: 'Customer email is temporarily unavailable' } }, 503);
    }

    const text = body.message;
    const html = `<p>${escapeHtml(body.message).replaceAll('\n', '<br>')}</p>`;
    const result = await sendResendEmail({
        apiKey: c.env.RESEND_API_KEY,
        from: `LetBuyy <${c.env.RESEND_FROM_EMAIL || 'noreply@letbuyy.com'}>`,
        to: email,
        subject: body.subject,
        html,
        text,
    });

    if (!result.success) {
        return c.json({ error: { code: 'EMAIL_FAILED', message: 'Customer email could not be sent' } }, 502);
    }

    return c.json(success({ success: true }));
});

router.post('/:email/merge', validate('json', MergeCustomerSchema), async (c) => {
    const auth = c.get('auth');
    const sourceEmail = normalizeCustomerEmail(c.req.param('email'));
    const body = c.get('validatedBody') as MergeCustomerInput;
    const targetEmail = body.target_email.trim().toLowerCase();
    const db = getSupabaseAdmin(c);

    if (sourceEmail === targetEmail) {
        return c.json({ error: { code: 'VALIDATION', message: 'Choose a different target customer' } }, 400);
    }

    if (!(await hasOwnedStoreScope(c, body.store_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const [sourceResult, targetResult, sourceOrderCheck] = await Promise.all([
        loadCustomerProfileRow(db, body.store_id, sourceEmail),
        loadCustomerProfileRow(db, body.store_id, targetEmail),
        customerHasOrders(db, body.store_id, sourceEmail),
    ]);

    if (sourceResult.error || targetResult.error || sourceOrderCheck.error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customers for merge' } }, 500);
    }
    if (!sourceResult.data && !sourceOrderCheck.exists) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Source customer not found' } }, 404);
    }

    const customUser = await resolveCustomUser(db, auth.user);
    let target = targetResult.data as StoreCustomerExportRow | null;

    if (!target?.id) {
        const { data, error } = await db
            .from('store_customers')
            .insert({
                store_id: body.store_id,
                email: targetEmail,
                full_name: sourceResult.data?.full_name || null,
                phone: sourceResult.data?.phone || null,
                accepts_marketing: sourceResult.data?.accepts_marketing ?? false,
                tags: [],
                status: 'active',
            })
            .select('id,store_id,email,full_name,phone,status,total_orders,total_spent,accepts_marketing,tags,notes,last_order_at,last_login_at,created_at,updated_at')
            .single();
        if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to create target customer' } }, 500);
        target = data as StoreCustomerExportRow;
    }

    const now = new Date().toISOString();
    const sourceTags = normalizeTags(sourceResult.data?.tags || []);
    const targetTags = normalizeTags(target.tags || []);
    const mergedTags = normalizeTags([...targetTags, ...sourceTags]);

    const mutations = [
        db.from('orders').update({ customer_email: targetEmail }).eq('store_id', body.store_id).eq('customer_email', sourceEmail),
        db.from('customer_addresses').update({ customer_email: targetEmail }).eq('store_id', body.store_id).eq('customer_email', sourceEmail),
        db.from('customer_notes').update({ customer_email: targetEmail, updated_by: customUser?.id || null }).eq('store_id', body.store_id).eq('customer_email', sourceEmail),
        db.from('wishlists').update({ customer_email: targetEmail }).eq('store_id', body.store_id).eq('customer_email', sourceEmail),
        db.from('customer_credentials').delete().eq('store_id', body.store_id).eq('email_or_phone', sourceEmail),
        db.from('customer_tags').update({ deleted_at: now, deleted_by: customUser?.id || null, updated_by: customUser?.id || null }).eq('store_id', body.store_id).eq('customer_email', sourceEmail).is('deleted_at', null),
    ];

    for (const mutation of mutations) {
        const { error } = await mutation;
        if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to merge customer records' } }, 500);
    }

    const existingTargetTags = new Set(targetTags.map((tag) => tag.toLowerCase()));
    const missingTagRows = mergedTags
        .filter((tag) => !existingTargetTags.has(tag.toLowerCase()))
        .map((tag) => ({
            store_id: body.store_id,
            customer_email: targetEmail,
            tag,
            created_by: customUser?.id || null,
            updated_by: customUser?.id || null,
        }));

    if (missingTagRows.length > 0) {
        const { error } = await db.from('customer_tags').insert(missingTagRows);
        if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to merge customer tags' } }, 500);
    }

    const totals = await recalculateCustomerOrderTotals(db, body.store_id, targetEmail);
    if (totals.error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to recalculate customer totals' } }, 500);
    }

    const sourceId = sourceResult.data?.id || `customer-${Date.now()}`;
    const redactedSourceEmail = `merged-${sourceId}@merged.invalid`;
    if (sourceResult.data?.id) {
        const { error } = await db
            .from('store_customers')
            .update({
                email: redactedSourceEmail,
                phone: null,
                full_name: null,
                accepts_marketing: false,
                tags: [],
                notes: null,
                status: 'disabled',
                deleted_at: now,
                updated_at: now,
            })
            .eq('id', sourceResult.data.id)
            .eq('store_id', body.store_id);
        if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Unable to close source customer' } }, 500);
    }

    const { data: updatedTarget, error: targetUpdateError } = await db
        .from('store_customers')
        .update({
            full_name: target.full_name || sourceResult.data?.full_name || null,
            phone: target.phone || sourceResult.data?.phone || null,
            accepts_marketing: target.accepts_marketing || sourceResult.data?.accepts_marketing || false,
            tags: mergedTags,
            total_orders: totals.totalOrders,
            total_spent: totals.totalSpent,
            last_order_at: totals.lastOrderAt,
            updated_at: now,
        })
        .eq('id', target.id)
        .eq('store_id', body.store_id)
        .select('id,store_id,email,full_name,phone,status,total_orders,total_spent,accepts_marketing,tags,notes,last_order_at,last_login_at,created_at,updated_at')
        .single();

    if (targetUpdateError) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to update target customer' } }, 500);
    }

    return c.json(success({
        merged: true,
        source_email: sourceEmail,
        target_email: targetEmail,
        customer: customerPayload(updatedTarget as StoreCustomerExportRow, targetEmail),
    }));
});

router.get('/:email', async (c) => {
    const auth = c.get('auth');
    const email = normalizeCustomerEmail(c.req.param('email'));
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    // Verify store ownership
    if (!(await hasOwnedStoreScope(c, storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const [profileResult, ordersResult, addressesResult] = await Promise.all([
        loadCustomerProfileRow(db, storeId, email),
        db
            .from('orders')
            .select('*')
            .eq('store_id', storeId)
            .eq('customer_email', email)
            .order('created_at', { ascending: false }),
        db
            .from('customer_addresses')
            .select('*')
            .eq('store_id', storeId)
            .eq('customer_email', email)
            .order('is_default', { ascending: false }),
    ]);

    if (profileResult.error || ordersResult.error || addressesResult.error) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer' } }, 500);
    }

    const profile = profileResult.data;
    const orders = ordersResult.data || [];
    if (!profile && orders.length === 0) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
    }
    const addresses = addressesResult.data || [];
    const totalSpent = (orders || []).reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const orderDerivedName = orders?.[0]?.customer_name || null;
    const orderDerivedPhone = orders?.[0]?.customer_phone || null;
    const nameParts = splitCustomerName(profile?.full_name || orderDerivedName);

    return c.json(success({
        id: profile?.id || `customer:${email}`,
        store_id: storeId,
        email,
        name: profile?.full_name || orderDerivedName,
        first_name: nameParts.firstName,
        last_name: nameParts.lastName,
        display_name: profile?.full_name || orderDerivedName || email,
        phone: profile?.phone || orderDerivedPhone,
        status: profile?.status || 'active',
        accepts_marketing: profile?.accepts_marketing ?? false,
        tags: profile?.tags || [],
        notes: profile?.notes || null,
        order_count: profile?.total_orders || orders?.length || 0,
        total_spent: Number(profile?.total_spent || totalSpent),
        first_order: orders?.[orders.length - 1]?.created_at || null,
        last_order: orders?.[0]?.created_at || null,
        last_order_at: profile?.last_order_at || orders?.[0]?.created_at || null,
        created_at: profile?.created_at || orders?.[orders.length - 1]?.created_at || new Date().toISOString(),
        updated_at: profile?.updated_at || profile?.last_order_at || orders?.[0]?.updated_at || new Date().toISOString(),
        deleted_at: null,
        metadata: {},
        orders: orders || [],
        addresses,
    }));
});

router.delete('/:email', async (c) => {
    const auth = c.get('auth');
    const email = decodeURIComponent(c.req.param('email')).trim().toLowerCase();
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId || !email) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id and customer email are required' } }, 400);
    }

    if (!(await hasOwnedStoreScope(c, storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data: existing, error: existingError } = await db
        .from('store_customers')
        .select('id, store_id, email')
        .eq('store_id', storeId)
        .eq('email', email)
        .maybeSingle();

    if (existingError) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to load customer' } }, 500);
    }

    const customer = existing as StoreCustomerOwnerRow | null;
    if (!customer?.id || !customer.email) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
    }

    const redactedAt = new Date().toISOString();
    const redactedEmail = `redacted-${customer.id}@redacted.invalid`;
    const { error: updateError } = await db
        .from('store_customers')
        .update({
            email: redactedEmail,
            password_hash: null,
            full_name: null,
            phone: null,
            status: 'disabled',
            accepts_marketing: false,
            tags: [],
            notes: null,
            deleted_at: redactedAt,
        })
        .eq('id', customer.id)
        .eq('store_id', storeId);

    if (updateError) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to redact customer' } }, 500);
    }

    const { error: addressDeleteError } = await db
        .from('customer_addresses')
        .delete()
        .eq('store_id', storeId)
        .eq('customer_email', customer.email);

    if (addressDeleteError) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to redact customer addresses' } }, 500);
    }

    const { error: credentialsDeleteError } = await db
        .from('customer_credentials')
        .delete()
        .eq('store_id', storeId)
        .eq('email_or_phone', customer.email.toLowerCase());

    if (credentialsDeleteError) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to remove customer credentials' } }, 500);
    }

    const { error: ordersRedactError } = await db
        .from('orders')
        .update({
            customer_email: redactedEmail,
            customer_name: 'Redacted customer',
            customer_phone: null,
        })
        .eq('store_id', storeId)
        .eq('customer_email', customer.email);

    if (ordersRedactError) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to redact order customer fields' } }, 500);
    }

    const { error: wishlistDeleteError } = await db
        .from('wishlists')
        .delete()
        .eq('store_id', storeId)
        .eq('customer_email', customer.email);

    if (wishlistDeleteError) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to remove customer wishlist data' } }, 500);
    }

    const { error: customerWishlistDeleteError } = await db
        .from('customer_wishlists')
        .delete()
        .eq('store_id', storeId)
        .eq('customer_id', customer.id);

    if (customerWishlistDeleteError) {
        return c.json({ error: { code: 'DB_ERROR', message: 'Unable to remove customer wishlist data' } }, 500);
    }

    const compliance = await dispatchStoreAppComplianceWebhook(c, {
        eventType: 'customers/redact',
        storeId,
        idempotencyKey: c.req.header('X-Idempotency-Key') || `customer-redact:${customer.id}`,
        triggerSource: 'merchant',
        actorId: auth.user.id,
        customerId: customer.id,
        customerEmail: customer.email,
        reason: 'customer_deleted',
        requestedAt: redactedAt,
        failClosed: false,
    });

    return c.json(success({
        deleted: true,
        customer_id: customer.id,
        compliance: compliance.ok
            ? {
                subscription_count: compliance.subscriptionCount,
                dispatched_count: compliance.dispatchedCount,
            }
            : {
                subscription_count: 0,
                dispatched_count: 0,
                status: compliance.code,
            },
    }));
});

router.get('/:email/addresses', async (c) => {
    const auth = c.get('auth');
    const email = decodeURIComponent(c.req.param('email'));
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    if (!(await hasOwnedStoreScope(c, storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('customer_addresses')
        .select('*')
        .eq('store_id', storeId)
        .eq('customer_email', email)
        .order('is_default', { ascending: false });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data || []));
});

router.post('/:email/addresses', validate('json', CreateCustomerAddressSchema), async (c) => {
    const auth = c.get('auth');
    const email = decodeURIComponent(c.req.param('email'));
    const body = c.get('validatedBody') as CreateCustomerAddressInput;
    const db = getSupabaseAdmin(c);

    if (!(await hasOwnedStoreScope(c, body.store_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // If is_default, unset other defaults first
    if (body.is_default) {
        await db
            .from('customer_addresses')
            .update({ is_default: false })
            .eq('store_id', body.store_id)
            .eq('customer_email', email);
    }

    const { data, error } = await db
        .from('customer_addresses')
        .insert({
            store_id: body.store_id,
            customer_email: email,
            customer_phone: body.customer_phone || null,
            label: body.label || 'home',
            full_name: body.full_name,
            address_line1: body.address_line1,
            address_line2: body.address_line2 || null,
            city: body.city,
            state: body.state,
            postal_code: body.postal_code,
            country: body.country || 'IN',
            landmark: body.landmark || null,
            is_default: body.is_default ?? false,
        })
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data), 201);
});

router.patch('/:email/addresses/:id', async (c) => {
    const auth = c.get('auth');
    const email = decodeURIComponent(c.req.param('email'));
    const addressId = c.req.param('id');
    const body = await c.req.json() as Record<string, unknown>;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await db
        .from('customer_addresses')
        .select('store_id')
        .eq('id', addressId)
        .eq('customer_email', email)
        .single();

    const ownedAddress = existing as AddressOwnerRow | null;
    if (!customUser || !ownedAddress?.store_id || !(await hasOwnedStoreScope(c, ownedAddress.store_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const allowed = ['label', 'full_name', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country', 'landmark', 'is_default'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'No valid fields to update' } }, 400);
    }

    if (updates.is_default === true) {
        await db
            .from('customer_addresses')
            .update({ is_default: false })
            .eq('store_id', ownedAddress.store_id)
            .eq('customer_email', email);
    }

    const { data, error } = await db
        .from('customer_addresses')
        .update(updates)
        .eq('id', addressId)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data));
});

router.delete('/:email/addresses/:id', async (c) => {
    const auth = c.get('auth');
    const email = decodeURIComponent(c.req.param('email'));
    const addressId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    const { data: existing } = await db
        .from('customer_addresses')
        .select('store_id')
        .eq('id', addressId)
        .eq('customer_email', email)
        .single();

    const ownedAddress = existing as AddressOwnerRow | null;
    if (!customUser || !ownedAddress?.store_id || !(await hasOwnedStoreScope(c, ownedAddress.store_id))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db.from('customer_addresses').delete().eq('id', addressId);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

export default router;
