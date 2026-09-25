// D2 (SUSTAINED-J, migration 260) — the buyer's own address book, shared across every store and the
// marketplace. Deliberately separate from customer-address-routes.ts's per-store customer_addresses
// (D-ONE-BUYER: store_customers rows are merchant-scoped relationships, not the buyer's own data) —
// same field shape and the same CHECK constraints, reused on purpose, but a different table with a
// different ownership key: buyer_account_id from a VERIFIED SESSION, never a request parameter,
// exactly the rule buyer-realm-wiring.ts's own file header states for every buyer-owned table.

import type { Hono } from 'hono';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import { requireBuyerSession } from '../../middleware/buyer-session';
import type { AppContext } from './customer-engagement-routes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BuyerAddressRow {
    id: string;
    buyer_account_id: string;
    label: string;
    full_name: string;
    phone: string | null;
    address_line1: string;
    address_line2: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    landmark: string | null;
    is_default: boolean;
    gstin: string | null;
    state_code: string | null;
    created_at: string;
    updated_at: string;
}

export interface BuyerAddressInput {
    label?: string;
    full_name: string;
    phone?: string | null;
    address_line1: string;
    address_line2?: string | null;
    city: string;
    state: string;
    postal_code: string;
    country?: string;
    landmark?: string | null;
    is_default?: boolean;
    gstin?: string | null;
    state_code?: string | null;
}

export interface BuyerAddressRoutesDeps {
    listAddresses: (c: AppContext, buyerAccountId: string) => Promise<{ data: BuyerAddressRow[] | null; error: unknown }>;
    /// Both operations of the unset-then-set default switch (customer-address-routes.ts's own
    /// established, already-accepted pattern — see migration 260's own header) live behind one
    /// injected function so a route can never call one half without the other.
    createAddress: (
        c: AppContext,
        input: { buyerAccountId: string; address: BuyerAddressInput },
    ) => Promise<{ data: BuyerAddressRow | null; error: unknown }>;
    updateAddress: (
        c: AppContext,
        input: { buyerAccountId: string; addressId: string; address: Partial<BuyerAddressInput> },
    ) => Promise<{ data: BuyerAddressRow | null; error: unknown; notFound?: boolean }>;
    deleteAddress: (
        c: AppContext,
        input: { buyerAccountId: string; addressId: string },
    ) => Promise<{ error: unknown; notFound?: boolean }>;
}

const failure = (code: string, message: string) => ({ success: false, error: { code, message } });

const ADDRESS_FIELDS = [
    'label', 'full_name', 'phone', 'address_line1', 'address_line2',
    'city', 'state', 'postal_code', 'country', 'landmark', 'is_default', 'gstin', 'state_code',
] as const;

function pickAddressFields(body: Record<string, unknown>): Partial<BuyerAddressInput> {
    const picked: Record<string, unknown> = {};
    for (const key of ADDRESS_FIELDS) {
        if (body[key] !== undefined) picked[key] = body[key];
    }
    return picked as Partial<BuyerAddressInput>;
}

function validateRequiredFields(input: Partial<BuyerAddressInput>): string | null {
    for (const key of ['full_name', 'address_line1', 'city', 'state', 'postal_code'] as const) {
        const value = input[key];
        if (typeof value !== 'string' || value.trim().length === 0) {
            return `${key} is required`;
        }
    }
    return null;
}

export function registerBuyerAddressRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: BuyerAddressRoutesDeps,
): void {
    const { listAddresses, createAddress, updateAddress, deleteAddress } = deps;

    router.get('/buyer/addresses', requireBuyerSession, async (c) => {
        const session = c.get('buyerSession');
        if (!session) return c.json(failure('UNAUTHORIZED', 'A buyer session is required.'), 401);

        const { data, error } = await listAddresses(c, session.buyerAccountId);
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success({ addresses: data ?? [] }));
    });

    router.post('/buyer/addresses', requireBuyerSession, async (c) => {
        const session = c.get('buyerSession');
        if (!session) return c.json(failure('UNAUTHORIZED', 'A buyer session is required.'), 401);

        const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) return c.json(failure('VALIDATION', 'A JSON body is required'), 400);

        const picked = pickAddressFields(body);
        const validationError = validateRequiredFields(picked);
        if (validationError) return c.json(failure('VALIDATION', validationError), 400);

        const { data, error } = await createAddress(c, {
            buyerAccountId: session.buyerAccountId,
            address: picked as BuyerAddressInput,
        });
        if (error || !data) return c.json(dbFailureBody(), 500);
        return c.json(success({ address: data }), 201);
    });

    router.patch('/buyer/addresses/:id', requireBuyerSession, async (c) => {
        const session = c.get('buyerSession');
        if (!session) return c.json(failure('UNAUTHORIZED', 'A buyer session is required.'), 401);

        const addressId = c.req.param('id');
        if (!UUID.test(addressId)) return c.json(failure('VALIDATION', 'Invalid address id'), 400);

        const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) return c.json(failure('VALIDATION', 'A JSON body is required'), 400);
        const picked = pickAddressFields(body);
        if (Object.keys(picked).length === 0) {
            return c.json(failure('VALIDATION', 'At least one address field is required'), 400);
        }

        const { data, error, notFound } = await updateAddress(c, {
            buyerAccountId: session.buyerAccountId,
            addressId,
            address: picked,
        });
        if (notFound) return c.json(failure('NOT_FOUND', 'Address not found.'), 404);
        if (error || !data) return c.json(dbFailureBody(), 500);
        return c.json(success({ address: data }));
    });

    router.delete('/buyer/addresses/:id', requireBuyerSession, async (c) => {
        const session = c.get('buyerSession');
        if (!session) return c.json(failure('UNAUTHORIZED', 'A buyer session is required.'), 401);

        const addressId = c.req.param('id');
        if (!UUID.test(addressId)) return c.json(failure('VALIDATION', 'Invalid address id'), 400);

        const { error, notFound } = await deleteAddress(c, { buyerAccountId: session.buyerAccountId, addressId });
        if (notFound) return c.json(failure('NOT_FOUND', 'Address not found.'), 404);
        if (error) return c.json(dbFailureBody(), 500);
        return c.json(success({ deleted: true }));
    });
}
