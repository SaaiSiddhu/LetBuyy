import {operatorIdentityKeys,TrustedOperatorGateway as Gateway} from './operator-identity-fixture';
// N1.6: actual worker -> PostgREST -> owned PostgreSQL. A trusted console
// bridge is not independent approval by the UUID typed into its request body.
// Synthetic bridge/operator credentials are fixture facts, not normal console
// inbox/MFA/device acceptance. No hosted resource or real merchant is touched.
import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { createLetbuyyPlatformSessionToken } from './operator-identity-fixture';
import { gatewayEnv } from './gateway-harness';
import { fixtureConsoleFactorFingerprint,nextFixtureConsoleMfaCounter } from './console-session-fixture';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const bridgeToken = 'synthetic-console-approval-' + crypto.randomUUID();
const sessionSecret = 'synthetic-approval-regression-session-secret';
let requesterHeaders: Record<string, string>;
const requester = { id: crypto.randomUUID(), email: `syn-approval-requester-${crypto.randomUUID()}@example.invalid` };
const eligible = crypto.randomUUID(), inactive = crypto.randomUUID(), staff = crypto.randomUUID();
let gateway: Gateway;
before(async () => {
    for (const [id, label] of [[requester.id, 'requester'], [eligible, 'eligible'], [inactive, 'inactive'], [staff, 'staff']]) {
        const email = id === requester.id ? requester.email : `syn-approval-${label}-${id}@example.invalid`;
        owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES('${id}','${email}',true);`);
        if (id === staff) {
            owned.psql(`INSERT INTO employees(user_id,email,role,store_id,status,is_active)
                VALUES('${id}','${email}','manager',NULL,'active',true);`);
        } else {
            owned.psql(`INSERT INTO super_admin_allowlist(user_id,email,full_name,is_active)
                VALUES('${id}','${email}','Synthetic approver',${id !== inactive});`);
        }
    }
    gateway = new Gateway(gatewayEnv(owned, await operatorIdentityKeys(sessionSecret), {
        PLATFORM_CONSOLE_API_TOKEN: bridgeToken, PLATFORM_CONSOLE_SESSION_SECRET: sessionSecret,
    }));
    const initial = await createLetbuyyPlatformSessionToken({ email: requester.email, userId: requester.id, mfaVerified: false }, sessionSecret);
    const elevated = await createLetbuyyPlatformSessionToken({ email: requester.email, userId: requester.id, mfaVerified: true }, sessionSecret);
    assert.ok(initial && elevated);
    requesterHeaders = { Authorization: `Bearer ${bridgeToken}`, 'X-Platform-Console-Session': elevated, 'Content-Type': 'application/json' };
    for (const headers of [ { ...requesterHeaders, 'X-Platform-Console-Session': initial },
        { ...requesterHeaders, 'X-Platform-Console-Previous-Session': initial } ]) {
        const mfa='X-Platform-Console-Previous-Session' in headers;
        assert.equal((await gateway.request('/v1/internal/console/sessions/'+(mfa?'mfa':'register'), { method: 'POST', headers, body: mfa?JSON.stringify({counter:await nextFixtureConsoleMfaCounter(owned,requester.id),factor_fingerprint:fixtureConsoleFactorFingerprint(requester.id)}):'{}' })).status, 200);
    }
});

const cases = [
    ['unknown UUID', crypto.randomUUID()],
    ['inactive super admin', inactive],
    ['active ordinary platform staff', staff],
    ['eligible super admin UUID without their actual consent', eligible],
    ['requester self approval', requester.id],
] as const;

for (const [index, [label, secondId]] of cases.entries()) {
    test(`merchant suspension refuses ${label} before any effect`, async () => {
        const tenant = newSyntheticTenant(`approval-${index}`);
        seedSyntheticTenant(owned.psql, tenant);
        const response = await gateway.request(`/v1/internal/console/merchants/${tenant.siteId}/moderation`, {
            method: 'POST',
            headers: requesterHeaders,
            body: JSON.stringify({ actor_id: requester.id, actor_email: requester.email, action: 'suspend',
                secondary_approver_id: secondId, reason: 'Synthetic independent approval verification' }),
        });
        await gateway.settle();
        const status = owned.psql(`SELECT status FROM sites WHERE id='${tenant.siteId}';`);
        const audits = Number(owned.psql(`SELECT count(*) FROM audit_logs WHERE resource_id='${tenant.siteId}' AND action='merchant.suspend';`));
        console.info('OWNED_APPROVAL_OBSERVED ' + JSON.stringify({ label, response: response.status, siteStatus: status, suspensionAudits: audits }));
        assert.ok([403, 428].includes(response.status), `Independent consent is missing: status=${response.status}, siteStatus=${status}, audits=${audits}`);
        assert.equal(status, 'published');
        assert.equal(audits, 0);
    });
}

test('an untrusted caller cannot reach the console moderation path', async () => {
    const tenant = newSyntheticTenant('approval-untrusted');
    seedSyntheticTenant(owned.psql, tenant);
    const response = await gateway.request(`/v1/internal/console/merchants/${tenant.siteId}/moderation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_id: requester.id, action: 'suspend', secondary_approver_id: eligible,
            reason: 'Synthetic untrusted caller denial' }),
    });
    assert.equal(response.status, 401);
    assert.equal(owned.psql(`SELECT status FROM sites WHERE id='${tenant.siteId}';`), 'published');
});
