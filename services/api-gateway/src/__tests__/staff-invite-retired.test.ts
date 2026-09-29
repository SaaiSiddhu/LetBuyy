// Phase N3 retired staff self-service invites. The gateway keeps the route so an old client gets an
// honest answer instead of a 404 that looks like a transient fault, and so nothing can mistake the
// retired capability for a working one (ANTI-R9). Owners add staff directly with POST /employees.
//
// This is the behaviour behind tests/launch/lb-phase5-commerce.test.mjs's "5C Invite acceptance"
// source-contract test, which used to pin the removed accept-invite endpoint and now pins the retired
// flow's honesty; that test cannot show what the router actually answers, this one does.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import employeeRouter from '../routes/employee';

test('POST /employees/invite is an explicit 503 STAFF_INVITE_UNAVAILABLE and never touches the network', async (t) => {
    const originalFetch = globalThis.fetch;
    let networkCalls = 0;
    globalThis.fetch = (async () => {
        networkCalls += 1;
        throw new Error('the retired invite route must not reach a database or provider');
    }) as typeof globalThis.fetch;
    t.after(() => { globalThis.fetch = originalFetch; });

    const app = new Hono<{ Bindings: Env }>();
    app.route('/employees', employeeRouter);
    const response = await app.request('/employees/invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'invitee@example.test', store_id: '00000000-0000-4000-8000-000000000001' }),
    }, {} as Env);

    assert.equal(response.status, 503);
    const body = await response.json() as { error: { code: string; message: string } };
    assert.equal(body.error.code, 'STAFF_INVITE_UNAVAILABLE');
    assert.match(body.error.message, /not available/i);
    assert.equal(networkCalls, 0);
});
