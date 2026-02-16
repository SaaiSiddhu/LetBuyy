import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// GET /customers — List unique customers for a store (derived from orders)
router.get('/', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const search = c.req.query('search');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
    const offset = (page - 1) * limit;
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

    // Aggregate customer data from orders
    let query = db
        .from('orders')
        .select('customer_email, customer_name, customer_phone, created_at', { count: 'exact' })
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (search) {
        query = query.or(`customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // Deduplicate by email
    const seen = new Set<string>();
    const customers = (data || []).filter((row) => {
        if (!row.customer_email || seen.has(row.customer_email)) return false;
        seen.add(row.customer_email);
        return true;
    });

    return c.json(paginated(customers, count || 0, page, limit));
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
    const { data: store } = await db
        .from('stores')
        .select('id')
        .eq('id', storeId)
        .eq('user_id', auth.user.id)
        .single();

    if (!store) {
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
router.post('/:email/addresses', async (c) => {
    const auth = c.get('auth');
    const email = decodeURIComponent(c.req.param('email'));
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    if (!body.store_id || !body.full_name || !body.address_line1 || !body.city || !body.state || !body.postal_code) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id, full_name, address_line1, city, state, postal_code are required' } }, 400);
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
    const addressId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    const allowed = ['label', 'full_name', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country', 'landmark', 'is_default'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
        if (body[key] !== undefined) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'No valid fields to update' } }, 400);
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
    const addressId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { error } = await db.from('customer_addresses').delete().eq('id', addressId);

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json({ data: { deleted: true } });
});

export default router;
