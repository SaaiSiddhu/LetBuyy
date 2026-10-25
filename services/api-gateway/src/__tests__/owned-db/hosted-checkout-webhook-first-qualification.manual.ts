// Explicit proposal-aware qualification only. Never auto-discovered by the DB
// lane and never applied to an ambient database or emitted as a migration.
import assert from 'node:assert/strict';
import { before } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
const path = 'docs/implementation/niche-theme-programme/completion-2026-10-24/shared-integration01/cart-edit03.qualified-up.proposal.sql';
const admission = JSON.parse(readFileSync('docs/implementation/niche-theme-programme/completion-2026-10-24/SHARED_RUNTIME_ADMISSION.json', 'utf8')) as {
    status: string; upProposals: Array<{ path: string; sha256: string }>;
};
assert.equal(admission.status, 'ROOT_QUALIFIED_SHARED_PROPOSALS_FOR_OWNED_BROWSER_FIXTURE');
const expected = admission.upProposals.find(proposal => proposal.path === path);
assert.ok(expected);
const sql = readFileSync(path, 'utf8');
assert.equal(createHash('sha256').update(sql).digest('hex'), expected.sha256);
owned.scriptLarge(sql);

before(async () => {
    const env = owned.restEnv(), deadline = Date.now() + 10000;
    for (;;) {
        const response = await fetch(env.SUPABASE_URL + '/rest/v1/rpc/write_storefront_cart', {
            method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_site_id: null, p_cart_id: null, p_cart_token: null, p_expected_updated_at: null, p_payload: null }),
        });
        const body = await response.json() as { code?: string };
        if (response.status === 400 && body.code === '22023') break;
        assert.equal(body.code, 'PGRST202');
        assert.ok(Date.now() < deadline, 'Admitted cart RPC did not reach the owned REST schema cache');
        await new Promise(resolve => setTimeout(resolve, 100));
    }
});

require('./hosted-checkout-buyer-ownership.postgres.test');
