// ============================================================
// EXPORT / IMPORT — CSV export of products & orders, CSV import for products
// Routes: GET /export/products, GET /export/orders, POST /export/import-products
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { ProductExecutionAdapter } from '../execution/product-execution.adapter';

const router = new Hono<{ Bindings: Env }>();

type ProductExportRow = {
    id: string;
    name: string;
    description?: string | null;
    price?: number | string | null;
    compare_price?: number | string | null;
    category?: string | null;
    stock?: number | null;
    is_active?: boolean | null;
    is_featured?: boolean | null;
    tags?: string[] | null;
    images?: string[] | null;
    created_at?: string | null;
};

type OrderExportRow = {
    order_number?: string | null;
    status?: string | null;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    subtotal?: number | string | null;
    shipping_cost?: number | string | null;
    discount?: number | string | null;
    total?: number | string | null;
    payment_method?: string | null;
    payment_status?: string | null;
    tracking_number?: string | null;
    carrier?: string | null;
    created_at?: string | null;
};

// ── Helpers ─────────────────────────────────────────────
function toCsvRow(values: (string | number | boolean | null | undefined)[]): string {
    return values
        .map(v => {
            if (v == null) return '';
            const s = String(v);
            return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"`
                : s;
        })
        .join(',');
}

function parseCsv(text: string): string[][] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    return lines.map(line => {
        const result: string[] = [];
        let currentField = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') { currentField += '"'; i++; }
                else if (ch === '"') { inQuotes = false; }
                else { currentField += ch; }
            } else {
                if (ch === '"') { inQuotes = true; }
                else if (ch === ',') { result.push(currentField.trim()); currentField = ''; }
                else { currentField += ch; }
            }
        }
        result.push(currentField.trim());
        return result;
    });
}

// ── GET /export/products ────────────────────────────────
router.get('/products', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = storeId
        ? [storeId]
        : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);

    if (storeId) {
        const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }
    }

    if (ownedStoreIds.length === 0) {
        return new Response(toCsvRow(['id', 'name', 'description', 'price', 'compare_price', 'category', 'stock', 'is_active', 'is_featured', 'tags', 'images', 'created_at']), {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`,
            },
        });
    }

    const query = db
        .from('products')
        .select('*')
        .in('store_id', ownedStoreIds)
        .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);

    const products = data || [];
    const headers = ['id', 'name', 'description', 'price', 'compare_price', 'category', 'stock', 'is_active', 'is_featured', 'tags', 'images', 'created_at'];

    const rows = [
        toCsvRow(headers),
        ...(products as ProductExportRow[]).map((p) =>
            toCsvRow([p.id, p.name, p.description, p.price, p.compare_price, p.category, p.stock, p.is_active, p.is_featured, (p.tags || []).join(';'), (p.images || []).join(';'), p.created_at])
        ),
    ];

    return new Response(rows.join('\n'), {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
    });
});

// ── GET /export/orders ──────────────────────────────────
router.get('/orders', async (c) => {
    const auth = c.get('auth');
    const storeId = c.req.query('store_id');
    const status = c.req.query('status');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const ownedStoreIds = storeId
        ? [storeId]
        : await listOwnedStoreIds(db, customUser.id, auth.user.storeId);

    if (storeId) {
        const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }
    }

    if (ownedStoreIds.length === 0) {
        return new Response(toCsvRow([
            'order_number', 'status', 'customer_name', 'customer_email', 'customer_phone',
            'subtotal', 'shipping_cost', 'discount', 'total', 'payment_method', 'payment_status',
            'tracking_number', 'carrier', 'created_at',
        ]), {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
            },
        });
    }

    let query = db
        .from('orders')
        .select('*')
        .in('store_id', ownedStoreIds)
        .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);

    const orders = data || [];
    const headers = [
        'order_number', 'status', 'customer_name', 'customer_email', 'customer_phone',
        'subtotal', 'shipping_cost', 'discount', 'total', 'payment_method', 'payment_status',
        'tracking_number', 'carrier', 'created_at',
    ];

    const rows = [
        toCsvRow(headers),
        ...(orders as OrderExportRow[]).map((o) =>
            toCsvRow([o.order_number, o.status, o.customer_name, o.customer_email, o.customer_phone, o.subtotal, o.shipping_cost, o.discount, o.total, o.payment_method, o.payment_status, o.tracking_number, o.carrier, o.created_at])
        ),
    ];

    return new Response(rows.join('\n'), {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
    });
});

// ── POST /export/import-products — CSV import for products ─
router.post('/import-products', async (c) => {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    const body = await c.req.json();
    const { store_id, csv } = body;

    if (!store_id || !csv) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id and csv string required' } }, 400);
    }

    const ownsStore = await verifySiteOwnership(db, store_id, customUser.id, auth.user.storeId);
    if (!ownsStore) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const rows = parseCsv(csv);
    if (rows.length < 2) {
        return c.json({ error: { code: 'VALIDATION', message: 'CSV must have headers + at least one row' } }, 400);
    }

    const headers = rows[0].map(h => h.toLowerCase().trim());
    const nameIdx = headers.indexOf('name');
    const priceIdx = headers.indexOf('price');
    const descIdx = headers.indexOf('description');
    const categoryIdx = headers.indexOf('category');
    const stockIdx = headers.indexOf('stock');
    const tagsIdx = headers.indexOf('tags');
    const imagesIdx = headers.indexOf('images');

    if (nameIdx === -1) {
        return c.json({ error: { code: 'VALIDATION', message: 'CSV must have a "name" column' } }, 400);
    }

    const service = new ProductExecutionAdapter(db);
    const imported = [];

    for (const row of rows.slice(1)) {
        const product = await service.createProduct({
            store_id,
            name: row[nameIdx] || 'Unnamed Product',
            description: descIdx >= 0 ? row[descIdx] || '' : '',
            price: priceIdx >= 0 ? parseFloat(row[priceIdx]) || 0 : 0,
            category: categoryIdx >= 0 ? row[categoryIdx] || undefined : undefined,
            stock: stockIdx >= 0 ? parseInt(row[stockIdx]) || 0 : 0,
            tags: tagsIdx >= 0 && row[tagsIdx] ? row[tagsIdx].split(';').map(t => t.trim()).filter(Boolean) : [],
            images: imagesIdx >= 0 && row[imagesIdx] ? row[imagesIdx].split(';').map(u => u.trim()).filter(Boolean) : [],
            is_active: true,
        }, customUser.id, auth.user.storeId);
        imported.push({ id: product.id, name: product.name });
    }

    return c.json(success({ imported: imported.length, products: imported }), 201);
});

async function listOwnedStoreIds(
    db: ReturnType<typeof getSupabaseAdmin>,
    userId: string,
    sessionStoreId?: string
) {
    let query = db
        .from('sites')
        .select('id')
        .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`)
        .is('deleted_at', null);

    if (sessionStoreId) query = query.eq('id', sessionStoreId);

    const { data, error } = await query;
    if (error) throw new Error(`Store ownership lookup failed: ${error.message}`);

    return (data || []).map((store) => store.id as string);
}

export default router;
