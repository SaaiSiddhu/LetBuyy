// ROUTE-1 — the shopper address book, extracted from customer-engagement-routes.ts.
//
// Not a mechanical line split: addresses are a self-contained CRUD domain that shares nothing with
// customer credentials, sessions, wishlists, orders or reviews beyond the Supabase helpers. The file
// it came from was at EXACTLY 1500 lines against route-line-count-validator's `<= 1500`, so it could
// not take one more line — and the next work that needs to touch it is customer auth, which is the
// one domain in there that must stay legible.
//
// This follows the pattern customer-registration.ts already set for the same budget, including
// taking its local-helper dependencies by injection rather than re-declaring them: a second
// normalizeEmail() in a second file is how two files start disagreeing about what an email is.

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, getSupabaseAdmin, success } from '../../lib/supabase';
import { getCustomerSession } from '../../middleware/customer-session';
import type {
    AppContext,
    CustomerAddressBody,
    VerifiedStoreCustomer,
} from './customer-engagement-routes';

export interface CustomerAddressRoutesDeps {
    /// Both are shared with customer-engagement-routes.ts by injection, never re-implemented here.
    normalizeEmail: (email: string) => string;
    /// The check that binds a session to THIS store and THIS customer. Injected rather than copied:
    /// a second implementation of a tenant-isolation check is a second one to get wrong, and the two
    /// would drift silently because nothing compares them.
    getVerifiedStoreCustomer: (
        c: AppContext,
        storeId: string,
        customerId: string,
    ) => Promise<VerifiedStoreCustomer | null>;
}

export function registerCustomerAddressRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: CustomerAddressRoutesDeps,
): void {
    const { normalizeEmail, getVerifiedStoreCustomer } = deps;

    router.get('/customer/addresses', async (c) => {
        const storeId = c.req.query('store_id');
        const customerId = getCustomerSession(c)?.customerId || c.req.query('customer_id');

        if (!customerId || !storeId) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id and store_id are required' } }, 400);
        }

        const customer = await getVerifiedStoreCustomer(c, storeId, customerId);
        if (!customer) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
        }

        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('customer_addresses')
            .select('*')
            .eq('store_id', storeId)
            .eq('customer_email', normalizeEmail(customer.email))
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            return c.json(dbFailureBody(), 500);
        }

        return c.json(success({ addresses: data || [] }));
    });

    router.post('/customer/addresses', async (c) => {
        const body = await c.req.json() as CustomerAddressBody;

        if (!body.customer_id || !body.store_id || !body.customer_email || !body.full_name || !body.address_line1 || !body.city || !body.state || !body.postal_code) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'Required address fields missing' } }, 400);
        }

        const customer = await getVerifiedStoreCustomer(c, body.store_id, body.customer_id);
        if (!customer) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
        }

        const { data, error } = await getSupabaseAdmin(c).rpc('mutate_store_customer_address', {
            p_store_id: body.store_id,
            p_customer_id: customer.id,
            p_customer_email: normalizeEmail(customer.email),
            p_address_id: null,
            p_address: body,
        });

        if (error) {
            return c.json(dbFailureBody(), 500);
        }
        if (!data) return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);

        return c.json(success({ address: data }), 201);
    });

    router.patch('/customer/addresses/:id', async (c) => {
        const addressId = c.req.param('id');
        const body = await c.req.json() as CustomerAddressBody;

        if (!body.customer_id || !body.store_id || !body.customer_email) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and customer_email are required' } }, 400);
        }

        const customer = await getVerifiedStoreCustomer(c, body.store_id, body.customer_id);
        if (!customer) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
        }

        const allowed = ['label', 'full_name', 'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country', 'landmark', 'is_default'];
        const updates: Record<string, unknown> = {};
        for (const key of allowed) {
            const value = body[key as keyof CustomerAddressBody];
            if (value !== undefined) updates[key] = value;
        }

        const { data, error } = await getSupabaseAdmin(c).rpc('mutate_store_customer_address', {
            p_store_id: body.store_id,
            p_customer_id: customer.id,
            p_customer_email: normalizeEmail(customer.email),
            p_address_id: addressId,
            p_address: updates,
        });

        if (error) {
            return c.json(dbFailureBody(), 500);
        }
        if (!data) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Address not found.' } }, 404);

        return c.json(success({ address: data }));
    });

    router.delete('/customer/addresses/:id', async (c) => {
        const addressId = c.req.param('id');
        const body = await c.req.json() as CustomerAddressBody;

        if (!body.customer_id || !body.store_id || !body.customer_email) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'customer_id, store_id and customer_email are required' } }, 400);
        }

        const customer = await getVerifiedStoreCustomer(c, body.store_id, body.customer_id);
        if (!customer) {
            return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Invalid customer session' } }, 403);
        }

        const db = getSupabaseAdmin(c);
        const { error } = await db
            .from('customer_addresses')
            .delete()
            .eq('id', addressId)
            .eq('store_id', body.store_id)
            .eq('customer_email', normalizeEmail(customer.email));

        if (error) {
            return c.json(dbFailureBody(), 500);
        }

        return c.json(success({ deleted: true }));
    });
}
