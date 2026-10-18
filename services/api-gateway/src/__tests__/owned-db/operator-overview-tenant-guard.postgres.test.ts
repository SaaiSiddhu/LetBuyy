// Operator overview read paths through the production worker and owned Postgres.
// This reproduction verifies active super-admin authorization, mounted route wiring, and the
// application tenant-query guard. Service-role PostgREST bypasses RLS, so this is not an RLS proof.
import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import {
    Gateway,
    gatewayEnv,
    newIdentityKeys,
    signedIdentityHeaders,
    type IdentityKeys,
} from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
const { psql } = owned;
let keys: IdentityKeys;
let gateway: Gateway;
const admin = { id: crypto.randomUUID(), email: `syn-overview-${crypto.randomUUID()}@example.invalid` };
const stranger = { id: crypto.randomUUID(), email: `syn-overview-stranger-${crypto.randomUUID()}@example.invalid` };
const fixture = {
    outboxId: crypto.randomUUID(),
    deadLetterId: crypto.randomUUID(),
    riskScoreId: crypto.randomUUID(),
    trustSafetyCaseId: crypto.randomUUID(),
};

before(async () => {
    keys = await newIdentityKeys();
    psql(`INSERT INTO users_custom (id, email, email_verified) VALUES
            ('${admin.id}', '${admin.email}', true),
            ('${stranger.id}', '${stranger.email}', true);
          INSERT INTO super_admin_allowlist (user_id, email, full_name, is_active)
          VALUES ('${admin.id}', '${admin.email}', 'Synthetic overview admin', true);
          INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, idempotency_key, status)
          VALUES ('${fixture.outboxId}', 'synthetic', 'operator-overview', 'synthetic.overview', 'overview:${fixture.outboxId}', 'queued');
          INSERT INTO outbox_dead_letters (id, outbox_event_id, event_id, event_type, aggregate_type, aggregate_id, failure_reason, idempotency_key)
          VALUES ('${fixture.deadLetterId}', '${fixture.outboxId}', gen_random_uuid(), 'synthetic.overview', 'synthetic', 'operator-overview', 'synthetic fixture', 'overview-dead:${fixture.deadLetterId}');
          INSERT INTO risk_scores (id, entity_type, entity_id, score, band, status)
          VALUES ('${fixture.riskScoreId}', 'site', 'synthetic-operator-overview', 12, 'low', 'open');
          INSERT INTO ts_cases (id, subject_type, subject_id, category, title, summary)
          VALUES ('${fixture.trustSafetyCaseId}', 'custom', 'synthetic-operator-overview', 'other', 'Synthetic overview case', 'Synthetic fixture');`);
    gateway = new Gateway(gatewayEnv(owned, keys));
});

test('permission-gated risk and Trust & Safety overviews read cross-site data without weakening operator denial', async () => {
    for (const path of [
        '/v1/operations/outbox?limit=10',
        '/v1/operations/outbox/dead-letters?limit=10',
        '/v1/operations/risk/overview',
        '/v1/operations/trust-safety/overview',
    ]) {
        const response = await gateway.request(path, { headers: await signedIdentityHeaders(admin.id, admin.email) });
        assert.equal(response.status, 200, `${path}: ${response.text}`);
        assert.equal(response.json?.success, true);
        if (path.startsWith('/v1/operations/outbox?')) {
            assert.equal(response.json?.data?.events?.[0]?.id, fixture.outboxId);
        } else if (path.startsWith('/v1/operations/outbox/dead-letters?')) {
            assert.equal(response.json?.data?.dead_letters?.[0]?.id, fixture.deadLetterId);
        } else if (path.endsWith('/risk/overview')) {
            assert.equal(response.json?.data?.recent_scores?.[0]?.id, fixture.riskScoreId);
        } else {
            assert.equal(response.json?.data?.recent_cases?.[0]?.id, fixture.trustSafetyCaseId);
        }

        const denied = await gateway.request(path, { headers: await signedIdentityHeaders(stranger.id, stranger.email) });
        assert.equal(denied.status, 403, `${path}: ${denied.text}`);
    }

    assert.equal(psql(`SELECT count(*) FROM audit_logs WHERE actor_id='${admin.id}' AND action IN ('risk.overview.read','trust_safety.overview.read');`), '2');
});
