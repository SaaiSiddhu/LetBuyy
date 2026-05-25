import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership, type WorkerAuthUser } from '../lib/auth-user';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import { ListCustomersQuery, CreateCustomerAddressSchema } from '../schemas/customer.schema';
import type { z } from 'zod';

const router = new Hono<{ Bindings: Env }>();

type ListCustomersQueryInput = z.infer<typeof ListCustomersQuery>;
type CreateCustomerAddressInput = z.infer<typeof CreateCustomerAddressSchema>;

interface AddressOwnerRow {
    store_id?: string | null;
}

interface CustomerSummary {
    id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    full_name: string;
    email: string;
    phone: string | null;
    total_orders: number;
    total_spent: number;
    status: string;
    created_at: string | null;
    first_order_at: string | null;
    last_order_at: string | null;
    last_order_id: string | null;
}

interface StoreCustomerRow {
    id: string;
    email: string;
    full_name?: string | null;
    phone?: string | null;
    status?: string | null;
    total_orders?: number | string | null;
    total_spent?: number | string | null;
    created_at?: string | null;
    last_order_at?: string | null;
}

interface CustomerOrderRow {
    id: string;
    customer_email?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    total?: number | string | null;
    created_at?: string | null;
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

function isMissingTableError(error: DatabaseErrorLike, tableName: string): boolean {
    const text = databaseErrorText(error);
    return text.includes(tableName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function asNumber(value: unknown, fallback = 0): number {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeEmail(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function matchesCustomerSearch(customer: CustomerSummary, search: string | undefined) {
    if (!search) return true;
    const needle = search.trim().toLowerCase();
    if (!needle) return true;

    return (
        customer.customer_email.toLowerCase().includes(needle) ||
        customer.customer_name.toLowerCase().includes(needle) ||
        (customer.customer_phone || '').toLowerCase().includes(needle)
    );
}

function upsertCustomerSummary(
    customers: Map<string, CustomerSummary>,
    email: string,
    seed: Partial<CustomerSummary>
) {
    const existing = customers.get(email);
    const summary: CustomerSummary = existing || {
        id: email,
        customer_name: '',
        customer_email: email,
        customer_phone: null,
        full_name: '',
        email,
        phone: null,
        total_orders: 0,
        total_spent: 0,
        status: 'active',
        created_at: null,
        first_order_at: null,
        last_order_at: null,
        last_order_id: null,
    };

    customers.set(email, {
        ...summary,
        ...seed,
        customer_email: email,
        email,
        full_name: seed.customer_name ?? seed.full_name ?? summary.customer_name,
        phone: seed.customer_phone ?? seed.phone ?? summary.customer_phone,
    });

    return customers.get(email)!;
}

async function loadStoreCustomerRows(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
) {
    const buildQuery = (includeDeletedAtFilter: boolean) => {
        let query = db
            .from('store_customers')
            .select('id,email,full_name,phone,status,total_orders,total_spent,created_at,last_order_at')
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
        return { data: [] as StoreCustomerRow[], error: null };
    }

    return { data: (data || []) as StoreCustomerRow[], error };
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

    return { data: (data || []) as CustomerOrderRow[], error };
}

async function verifyStoreOwnership(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    authUser: WorkerAuthUser
) {
    const customUser = await resolveCustomUser(db, authUser);
    return customUser ? verifySiteOwnership(db, storeId, customUser.id, authUser.storeId) : false;
}

// GET /customers — List unique customers for a store (derived from orders)
router.get('/', validate('query', ListCustomersQuery), async (c) => {
    const auth = c.get('auth');
    const q = c.get('validatedQuery') as ListCustomersQueryInput;
    const offset = (q.page - 1) * q.limit;
    const db = getSupabaseAdmin(c);
    const storeId = q.store_id;

    if (!storeId) {
        return c.json({ success: false, error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    // Verify store ownership
    if (!(await verifyStoreOwnership(db, storeId, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const [storeCustomersResult, ordersResult] = await Promise.all([
        loadStoreCustomerRows(db, storeId),
        loadCustomerOrderRows(db, storeId),
    ]);

    if (storeCustomersResult.error) {
        return c.json({ error: { code: 'DB_ERROR', message: storeCustomersResult.error.message } }, 500);
    }

    if (ordersResult.error) {
        return c.json({ error: { code: 'DB_ERROR', message: ordersResult.error.message } }, 500);
    }

    const customers = new Map<string, CustomerSummary>();

    for (const row of storeCustomersResult.data) {
        const email = normalizeEmail(row.email);
        if (!email) continue;

        upsertCustomerSummary(customers, email, {
            id: row.id || email,
            customer_name: row.full_name || '',
            customer_phone: row.phone || null,
            total_orders: asNumber(row.total_orders),
            total_spent: asNumber(row.total_spent),
            status: row.status || 'active',
            created_at: row.created_at || null,
            last_order_at: row.last_order_at || null,
        });
    }

    const orderStats = new Map<string, { totalOrders: number; totalSpent: number; firstOrderAt: string | null; lastOrderAt: string | null; lastOrderId: string | null }>();

    for (const order of ordersResult.data) {
        const email = normalizeEmail(order.customer_email);
        if (!email) continue;

        const stats = orderStats.get(email) || {
            totalOrders: 0,
            totalSpent: 0,
            firstOrderAt: null,
            lastOrderAt: null,
            lastOrderId: null,
        };
        const createdAt = order.created_at || null;
        stats.totalOrders += 1;
        stats.totalSpent += asNumber(order.total);
        if (createdAt && (!stats.lastOrderAt || createdAt > stats.lastOrderAt)) {
            stats.lastOrderAt = createdAt;
            stats.lastOrderId = order.id;
        }
        if (createdAt && (!stats.firstOrderAt || createdAt < stats.firstOrderAt)) {
            stats.firstOrderAt = createdAt;
        }
        orderStats.set(email, stats);

        const existing = customers.get(email);
        upsertCustomerSummary(customers, email, {
            id: existing?.id || email,
            customer_name: existing?.customer_name || order.customer_name || '',
            customer_phone: existing?.customer_phone || order.customer_phone || null,
            created_at: existing?.created_at || createdAt,
            status: existing?.status || 'active',
        });
    }

    for (const [email, stats] of orderStats) {
        const customer = customers.get(email);
        if (!customer) continue;
        customers.set(email, {
            ...customer,
            total_orders: stats.totalOrders,
            total_spent: stats.totalSpent,
            first_order_at: stats.firstOrderAt,
            last_order_at: stats.lastOrderAt,
            last_order_id: stats.lastOrderId,
        });
    }

    const summaries = [...customers.values()]
        .filter((customer) => matchesCustomerSearch(customer, q.search))
        .filter((customer) => q.has_orders === undefined || (q.has_orders ? customer.total_orders > 0 : customer.total_orders === 0))
        .sort((a, b) => {
            const aDate = a.last_order_at || a.created_at || '';
            const bDate = b.last_order_at || b.created_at || '';
            return bDate.localeCompare(aDate);
        });

    return c.json(paginated(summaries.slice(offset, offset + q.limit), summaries.length, q.page, q.limit));
});

// GET /customers/:email — Get customer profile + order history
router.get('/:email', async (c) => {
    const auth = c.get('auth');
    const email = decodeURIComponent(c.req.param('email'));
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    // Verify store ownership
    if (!(await verifyStoreOwnership(db, storeId, auth.user))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    // Fetch orders for this customer
    const { data: orders, error } = await db
        .from('orders')
        .select('*')
        .eq('store_id', storeId)
        .eq('customer_email', email)
        .order('created_at', { ascending: false });

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Fetch saved addresses
    const { data: addresses } = await db
        .from('customer_addresses')
        .select('*')
        .eq('store_id', storeId)
        .eq('customer_email', email)
        .order('is_default', { ascending: false });

    const totalSpent = (orders || []).reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

    return c.json(success({
        email,
        name: orders?.[0]?.customer_name || null,
        phone: orders?.[0]?.customer_phone || null,
        order_count: orders?.length || 0,
        total_spent: totalSpent,
        first_order: orders?.[orders.length - 1]?.created_at || null,
        last_order: orders?.[0]?.created_at || null,
        orders: orders || [],
        addresses: addresses || [],
    }));
});

// GET /customers/:email/addresses — List saved addresses
router.get('/:email/addresses', async (c) => {
    const auth = c.get('auth');
    const email = decodeURIComponent(c.req.param('email'));
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);

    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }

    if (!(await verifyStoreOwnership(db, storeId, auth.user))) {
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

// POST /customers/:email/addresses — Add a new address
router.post('/:email/addresses', validate('json', CreateCustomerAddressSchema), async (c) => {
    const auth = c.get('auth');
    const email = decodeURIComponent(c.req.param('email'));
    const body = c.get('validatedBody') as CreateCustomerAddressInput;
    const db = getSupabaseAdmin(c);

    if (!(await verifyStoreOwnership(db, body.store_id, auth.user))) {
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

// PATCH /customers/:email/addresses/:id — Update an address
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
    if (!customUser || !ownedAddress?.store_id || !(await verifySiteOwnership(db, ownedAddress.store_id, customUser.id, auth.user.storeId))) {
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

// DELETE /customers/:email/addresses/:id — Delete an address
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
    if (!customUser || !ownedAddress?.store_id || !(await verifySiteOwnership(db, ownedAddress.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { error } = await db.from('customer_addresses').delete().eq('id', addressId);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

export default router;
