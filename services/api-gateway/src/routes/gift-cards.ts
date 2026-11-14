import type { Context, Hono } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import {
    CreateGiftCardSchema,
    GiftCardBalanceQuerySchema,
    GiftCardStatusUpdateSchema,
    StoreScopedQuerySchema,
    generateGiftCardCodeFromBytes,
    type CreateGiftCardInput,
    type GiftCardBalanceQueryInput,
    type GiftCardStatusUpdateInput,
    type StoreScopedQueryInput,
} from '@letbuyy/commerce-core';
import { enqueueGiftCardIssuedEmail } from '../lib/gift-card-email';

// LB-11 — gift card lifecycle on the canonical model (gift_card_accounts +
// gift_card_ledger_entries + gift_card_redemptions). Every mutation routes through
// a SECURITY DEFINER RPC (issue_gift_card / set_gift_card_status) — the gateway
// never writes the canonical ledger tables directly, matching the money architecture
// and the canonical-ledger-only validator. Balance is always the ledger projection.
//
// These routes attach to the products router, so the public paths are unchanged:
//   GET  /products/gift-cards                     list (projected balances)
//   POST /products/gift-cards                     issue (returns the code once)
//   GET  /products/gift-cards/balance             validate by code
//   GET  /products/gift-cards/:id/transactions    audit trail
//   POST /products/gift-cards/:id/status          fraud hold / disable / reactivate

type GiftCardRouter = Hono<{ Bindings: Env }>;

function requestIdOf(c: Context<{ Bindings: Env }>): string | null {
    return c.req.header('x-request-id') || c.req.header('x-correlation-id') || null;
}

export function registerGiftCardRoutes(router: GiftCardRouter): void {
    // GET /products/gift-cards — list the store's gift cards with projected balances.
    router.get('/gift-cards', validate('query', StoreScopedQuerySchema), async (c) => {
        const auth = c.get('auth');
        const query = c.get('validatedQuery') as StoreScopedQueryInput;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }
        const ownsStore = await verifySiteOwnership(db, query.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const { data, error } = await db.rpc('list_gift_cards', { p_store_id: query.store_id });
        if (error) {
            if (isMissingRpc(error, 'list_gift_cards')) return c.json(success([]));
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }
        return c.json(success(Array.isArray(data) ? data : []));
    });

    // POST /products/gift-cards — issue a gift card into the canonical model.
    router.post('/gift-cards', validate('json', CreateGiftCardSchema), async (c) => {
        const auth = c.get('auth');
        const body = c.get('validatedBody') as CreateGiftCardInput;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }
        const ownsStore = await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const requestId = requestIdOf(c);
        const recipient = {
            recipient_email: body.recipient_email || undefined,
            recipient_name: body.recipient_name || undefined,
            note: body.note || undefined,
        };

        // Issue with a fresh random code; retry once on the (astronomically rare) hash collision.
        let issued: Record<string, unknown> | null = null;
        let lastError: { message: string } | null = null;
        for (let attempt = 0; attempt < 2 && !issued; attempt++) {
            const code = generateGiftCardCodeFromBytes(crypto.getRandomValues(new Uint8Array(16)));
            const idempotencyKey = `gift_card.issue:${body.store_id}:${crypto.randomUUID()}`;
            const { data, error } = await db.rpc('issue_gift_card', {
                p_store_id: body.store_id,
                p_code: code,
                p_initial_value: body.initial_value,
                p_currency: body.currency || 'INR',
                p_expires_at: body.expires_at || null,
                p_recipient: recipient,
                p_actor_id: customUser.id,
                p_request_id: requestId,
                p_idempotency_key: idempotencyKey,
            });
            if (!error && data && typeof data === 'object') {
                issued = { ...(data as Record<string, unknown>), code };
                break;
            }
            lastError = error;
            if (error && isMissingRpc(error, 'issue_gift_card')) {
                return c.json({ error: { code: 'GIFT_CARD_SCHEMA_MISSING', message: 'Gift cards are not available in this environment.' } }, 503);
            }
            if (error && !/code collision/i.test(error.message)) break;
        }

        if (!issued) {
            return c.json({ error: { code: 'DB_ERROR', message: lastError?.message || 'Unable to issue gift card' } }, 500);
        }

        // Best-effort recipient email (never blocks issuance). The code is only ever
        // returned/emailed at issuance time; it is not persisted by the gateway.
        if (body.recipient_email) {
            try {
                const { data: site } = await db.from('sites').select('name').eq('id', body.store_id).maybeSingle();
                await enqueueGiftCardIssuedEmail(c.env, {
                    storeId: body.store_id,
                    requestId: requestId || '',
                    accountId: String(issued.id || ''),
                    code: String(issued.code || ''),
                    recipientEmail: body.recipient_email,
                    recipientName: body.recipient_name,
                    senderNote: body.note,
                    value: body.initial_value,
                    currency: body.currency || 'INR',
                    storeName: (site as { name?: string } | null)?.name || null,
                    expiresAt: body.expires_at || null,
                });
            } catch (emailError) {
                console.warn(JSON.stringify({
                    level: 'warn',
                    event: 'gift_card_issued_email_enqueue_failed',
                    store_id: body.store_id,
                    error: String(emailError),
                }));
            }
        }

        return c.json(success(issued), 201);
    });

    // GET /products/gift-cards/balance — validate a card by code (masked).
    router.get('/gift-cards/balance', validate('query', GiftCardBalanceQuerySchema), async (c) => {
        const auth = c.get('auth');
        const query = c.get('validatedQuery') as GiftCardBalanceQueryInput;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }
        const ownsStore = await verifySiteOwnership(db, query.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const { data, error } = await db.rpc('check_gift_card_balance', {
            p_store_id: query.store_id,
            p_code: query.code,
        });
        if (error) {
            if (isMissingRpc(error, 'check_gift_card_balance')) return c.json(success({ found: false }));
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }
        return c.json(success(data || { found: false }));
    });

    // GET /products/gift-cards/:id/transactions — ledger + redemption audit trail.
    router.get('/gift-cards/:id/transactions', validate('query', StoreScopedQuerySchema), async (c) => {
        const auth = c.get('auth');
        const accountId = c.req.param('id');
        const query = c.get('validatedQuery') as StoreScopedQueryInput;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }
        const ownsStore = await verifySiteOwnership(db, query.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const { data, error } = await db.rpc('gift_card_transactions', {
            p_store_id: query.store_id,
            p_account_id: accountId,
        });
        if (error) {
            if (isMissingRpc(error, 'gift_card_transactions')) return c.json(success({ found: false }));
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }
        return c.json(success(data || { found: false }));
    });

    // POST /products/gift-cards/:id/status — fraud control (hold / disable / reactivate).
    router.post('/gift-cards/:id/status', validate('json', GiftCardStatusUpdateSchema), async (c) => {
        const auth = c.get('auth');
        const accountId = c.req.param('id');
        const body = c.get('validatedBody') as GiftCardStatusUpdateInput;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }
        const ownsStore = await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }

        const { data, error } = await db.rpc('set_gift_card_status', {
            p_store_id: body.store_id,
            p_account_id: accountId,
            p_status: body.status,
            p_reason: body.reason || null,
            p_actor_id: customUser.id,
            p_request_id: requestIdOf(c),
        });
        if (error) {
            if (/not found/i.test(error.message)) {
                return c.json({ error: { code: 'NOT_FOUND', message: 'Gift card not found' } }, 404);
            }
            return c.json({ error: { code: 'DB_ERROR', message: error.message } }, 500);
        }
        return c.json(success(data));
    });
}

function isMissingRpc(error: { message?: string | null; code?: string | null } | null, fn: string): boolean {
    if (!error) return false;
    const message = (error.message || '').toLowerCase();
    return (
        error.code === 'PGRST202'
        || (message.includes(fn) && (message.includes('does not exist') || message.includes('could not find') || message.includes('schema cache')))
    );
}
