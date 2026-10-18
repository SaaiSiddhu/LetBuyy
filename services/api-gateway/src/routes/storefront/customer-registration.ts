import type { Hono } from 'hono';
import type { Env } from '../../index';

/** Per-store records are relationships; account creation belongs to the canonical buyer realm. */
export function registerCustomerRegistrationRoute(router: Hono<{ Bindings: Env }>): void {
    router.post('/customer/register', (c) => c.json({
        success: false,
        error: {
            code: 'CANONICAL_BUYER_ACCOUNT_REQUIRED',
            message: 'Create your LetBuyy account through the canonical sign-in flow.',
        },
    }, 410));
}
