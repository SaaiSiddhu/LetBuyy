// APPID-P4a — the stand-in for buyer_accounts that requireBuyerSession reads, for route tests that
// run without a database.
//
// requireBuyerSession refuses a verified token unless the account is active and the token's session
// epoch matches the account's (migration 257), and it fails closed when it cannot read the account.
// A route test with no database would therefore get a 503 for every buyer request. This installs a
// fake read on the app, ahead of the routes, the way nothing in production ever does.
//
// Not a test file: it has no .test.ts suffix, so the unit runner does not execute it on its own.

import type { Hono } from 'hono';
import type { Env } from '../index';
import type { BuyerSessionState, BuyerSessionStateLoader } from '../middleware/buyer-session';

/// Every buyer active at epoch 1 unless `state` says otherwise. A token minted without an epoch
/// claim counts as epoch 1, which is what the existing route tests mint.
export function installBuyerSessionState(
    app: Hono<{ Bindings: Env }>,
    state: BuyerSessionStateLoader | Record<string, BuyerSessionState | null> = {},
): void {
    const loader: BuyerSessionStateLoader = typeof state === 'function'
        ? state
        : async (_c, buyerAccountId) => ({
              data: buyerAccountId in state ? state[buyerAccountId] : { status: 'active', session_epoch: 1 },
              error: null,
          });
    app.use('*', async (c, next) => {
        c.set('buyerSessionStateLoader', loader);
        await next();
    });
}
