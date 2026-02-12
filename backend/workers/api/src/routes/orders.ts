import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// GET /orders — List orders for the authenticated seller
router.get('/', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');  // query param stays the same
    const status = c.req.query('status');
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const offset = (page - 1) * limit;
    const db = getSupabaseAdmin(c);

    // Get orders for stores owned by this user
    let query = db
        .from('orders')
        .select('*, stores!inner(user_id, subdomain)', { count: 'exact' })
        .eq('stores.user_id', auth.user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (storeId) query = query.eq('store_id', storeId);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(paginated(data || [], count || 0, page, limit));
});

// GET /orders/:id
router.get('/:id', async (c) => {
    const auth = c.get('auth');
    const orderId = c.req.param('id');
    const db = getSupabaseAdmin(c);

    const { data, error } = await db
        .from('orders')
        .select('*, stores!inner(user_id, subdomain), order_items(*)')
        .eq('id', orderId)
        .eq('stores.user_id', auth.user.id)
        .single();

    if (error || !data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
    }

    return c.json(success(data));
});

// PATCH /orders/:id — Update order status
router.patch('/:id', async (c) => {
    const auth = c.get('auth');
    const orderId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    // Verify ownership
    const { data: order } = await db
        .from('orders')
        .select('id, stores!inner(user_id)')
        .eq('id', orderId)
        .single();

    if (!order || (order as any).stores?.user_id !== auth.user.id) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const updates: Record<string, unknown> = {};
    if (body.status) updates.status = body.status;
    if (body.tracking_number) updates.tracking_number = body.tracking_number;
    if (body.carrier) updates.carrier = body.carrier;
    if (body.notes) updates.notes = body.notes;
    if (body.status === 'delivered') updates.payment_status = 'paid';
    if (body.status === 'cancelled') updates.payment_status = 'refunded';

    const { data, error } = await db
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    return c.json(success(data));
});

// POST /orders — Create an order (checkout)
router.post('/', async (c) => {
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    const { store_id, customer_name, customer_email, customer_phone, shipping_address,
        items, subtotal, shipping_cost, discount, total, payment_method } = body;

    if (!store_id || !customer_email || !items || !Array.isArray(items) || items.length === 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id, customer_email, and items[] required' } }, 400);
    }

    // Generate order number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const orderNumber = `ORD-${dateStr}-${rand}`;

    const { data: order, error } = await db
        .from('orders')
        .insert({
            store_id,
            order_number: orderNumber,
            customer_name: customer_name || '',
            customer_email,
            customer_phone: customer_phone || '',
            shipping_address: shipping_address || {},
            items,
            subtotal: subtotal || 0,
            shipping_cost: shipping_cost || 0,
            discount: discount || 0,
            total: total || 0,
            payment_method: payment_method || 'cod',
            status: payment_method === 'cod' ? 'confirmed' : 'pending',
            payment_status: 'pending',
        })
        .select()
        .single();

    if (error || !order) {
        return c.json({ error: { code: 'DB_ERROR', message: error?.message || 'Failed to create order' } }, 500);
    }

    // Insert normalized order items
    const itemRows = items.map((item: any) => ({
        order_id: order.id,
        product_id: item.product_id || item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.quantity * item.price,
    }));

    await db.from('order_items').insert(itemRows);

    return c.json(success(order), 201);
});

// POST /orders/:id/fulfill — Mark order as shipped with tracking
router.post('/:id/fulfill', async (c) => {
    const auth = c.get('auth');
    const orderId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    // Verify ownership
    const { data: existing } = await db
        .from('orders')
        .select('id, status, stores!inner(user_id)')
        .eq('id', orderId)
        .single();

    if (!existing || (existing as any).stores?.user_id !== auth.user.id) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const updates: Record<string, unknown> = {
        status: 'shipped',
        fulfillment_status: 'fulfilled',
    };

    if (body.tracking_number) updates.tracking_number = body.tracking_number;
    if (body.carrier) updates.carrier = body.carrier;

    const { data, error } = await db
        .from('orders')
        .update(updates)
        .eq('id', orderId)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // TODO: Send shipping notification email via Resend

    return c.json(success(data));
});

// POST /orders/:id/refund — Cancel and refund order
router.post('/:id/refund', async (c) => {
    const auth = c.get('auth');
    const orderId = c.req.param('id');
    const body = await c.req.json();
    const db = getSupabaseAdmin(c);

    // Verify ownership
    const { data: existing } = await db
        .from('orders')
        .select('id, status, payment_status, stores!inner(user_id)')
        .eq('id', orderId)
        .single();

    if (!existing || (existing as any).stores?.user_id !== auth.user.id) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const { data, error } = await db
        .from('orders')
        .update({
            status: 'cancelled',
            payment_status: 'refunded',
            notes: body.reason || 'Refund processed',
        })
        .eq('id', orderId)
        .select()
        .single();

    if (error) {
        return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
    }

    // TODO: Process actual refund via Razorpay/Stripe API
    // TODO: Send refund notification email

    return c.json(success(data));
});

export default router;
