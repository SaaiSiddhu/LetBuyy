// The exact52-line BEFORE is archived in production358/source-before.
// AFTER adds only named read-fault/reload and normal durable logout controls.
// Normal local Identity magic-link + configured TOTP, Console SSR/BFF, real
// Gateway/PostgREST/owned PostgreSQL. The existing helper owns every process.
// Synthetic pre-provisioned rotation records; no on-call assignment or provider proof.
import assert from 'node:assert/strict';
import test from 'node:test';
import { expect } from '@playwright/test';
import { tapRest, restJson } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { withConsoleBrowser } from '../../services/api-gateway/src/__tests__/owned-db/console-browser-fixture';

const owned = requireOwnedDatabase();
const legacyPath = '/v1/operations/oncall/current';
const canonicalPath = '/v1/internal/console/operations/oncall/current';

test('normal MFA super admin sees the existing current rotation instead of a false empty card', { timeout: 300000 }, async () => {
    const suffix = crypto.randomUUID();
    const team = 'synthetic-oncall-' + suffix;
    const rotation = 'Synthetic current rotation ' + suffix;
    const marker = 'synthetic-private-oncall-metadata-' + suffix;
    owned.script(`INSERT INTO oncall_schedules
        (team_name, rotation_name, starts_at, ends_at, active, paging_adapter, metadata, deleted_at) VALUES
        ('${team}', '${rotation}', now()-interval '10 minutes', now()+interval '1 day', true, 'dry_run', jsonb_build_object('private_marker','${marker}'), NULL),
        ('${team}', 'Synthetic inactive rotation', now()-interval '1 minute', NULL, false, 'dry_run', '{}'::jsonb, NULL),
        ('${team}', 'Synthetic future rotation', now()+interval '1 day', NULL, true, 'dry_run', '{}'::jsonb, NULL),
        ('${team}', 'Synthetic expired rotation', now()-interval '1 minute', now()-interval '1 second', true, 'dry_run', '{}'::jsonb, NULL),
        ('${team}', 'Synthetic deleted rotation', now()-interval '30 seconds', NULL, true, 'dry_run', '{}'::jsonb, now());`);
    const digest = () => owned.psql(`SELECT encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(s) ORDER BY id)::text,'[]'),'sha256'),'hex') FROM oncall_schedules s WHERE team_name='${team}';`);
    const before = digest();
    await withConsoleBrowser(owned, async ({ origin, identityOrigin, actors: [operator], login, calls }) => {
        const signedIn = await login(operator);
        try {
            await signedIn.page.goto(origin + '/operations');
            assert.ok(calls.some(call => call.path === '/v1/internal/console/sessions/current' && call.status === 200), 'the real canonical operator session is current');
            assert.ok(calls.some(call => call.path === '/v1/internal/console/platform-jobs' && call.status === 200), 'the same signed-in operator reaches an existing private operations read');
            await expect(signedIn.page.getByText(team + ' | ' + rotation, { exact: true })).toBeVisible();
            await expect(signedIn.page.getByText('No active on-call schedule', { exact: true })).toHaveCount(0);
            assert.ok(calls.some(call => call.path === canonicalPath && call.status === 200), 'the read uses the canonical private Console perimeter');
            assert.doesNotMatch(await signedIn.page.locator('body').innerText(), new RegExp(marker));
            const readBeforeFault = calls.filter(call => call.path === canonicalPath && call.status === 200).length;
            let faults = 0;
            const outage = tapRest(owned.restUrl, async (call, forward) => {
                if (call.resource === 'rpc/read_console_current_oncall_v1') {
                    faults += 1;
                    return restJson(503, { message: 'synthetic-private-oncall-read-fault' });
                }
                return forward();
            });
            try {
                await signedIn.page.reload();
                await expect(signedIn.page.getByText('Current rotation unavailable.', { exact: true })).toBeVisible();
                await expect(signedIn.page.getByText('No active on-call schedule', { exact: true })).toHaveCount(0);
                await expect(signedIn.page.getByText(team + ' | ' + rotation, { exact: true })).toHaveCount(0);
                assert.ok(faults > 0, 'the real private read must reach the named negative fault');
                assert.doesNotMatch(await signedIn.page.locator('body').innerText(), /synthetic-private-oncall-read-fault|synthetic-private-oncall-metadata/);
                assert.equal(digest(), before);
            } finally { outage.restore(); }
            await signedIn.page.getByRole('link', { name: 'Reload current rotation', exact: true }).click();
            await expect(signedIn.page.getByText(team + ' | ' + rotation, { exact: true })).toBeVisible();
            await expect(signedIn.page.getByText('Current rotation unavailable.', { exact: true })).toHaveCount(0);
            assert.ok(calls.filter(call => call.path === canonicalPath && call.status === 200).length > readBeforeFault);
            assert.equal(digest(), before);
            const sessionId = owned.psql(`SELECT s.id FROM sessions_v2 s JOIN principals p ON p.id=s.principal_id
                WHERE p.legacy_user_id='${operator.id}' AND s.realm='admin' AND s.status='active'
                AND s.metadata->>'protocol'='platform-console-v1' AND s.metadata->>'mfa_verified_at' IS NOT NULL
                ORDER BY s.issued_at DESC LIMIT 1;`);
            assert.match(sessionId, /^[0-9a-f-]{36}$/);
            await signedIn.page.getByRole('button', { name: 'Logout', exact: true }).click();
            await signedIn.page.waitForURL(url => url.pathname === '/login');
            assert.equal(owned.psql(`SELECT status FROM sessions_v2 WHERE id='${sessionId}';`), 'revoked', 'normal Console logout durably revokes the actual MFA session');
            const afterLogout = calls.length;
            await signedIn.page.goto(origin + '/operations');
            await signedIn.page.waitForURL(url => url.origin === identityOrigin && url.pathname === '/lookup');
            assert.equal(calls.slice(afterLogout).filter(call => call.path === canonicalPath && call.status === 200).length, 0);
            await expect(signedIn.page.getByText(team + ' | ' + rotation, { exact: true })).toHaveCount(0);
            assert.equal(digest(), before);

        } catch (error) {
            process.stdout.write(JSON.stringify({
                observation: 'current-oncall-normal-browser',
                calls: calls.filter(call => [legacyPath, canonicalPath, '/v1/internal/console/sessions/current', '/v1/internal/console/platform-jobs'].includes(call.path)),
                falseEmptyVisible: await signedIn.page.getByText('No active on-call schedule', { exact: true }).isVisible().catch(() => false),
                expectedRotationVisible: await signedIn.page.getByText(team + ' | ' + rotation, { exact: true }).isVisible().catch(() => false),
                syntheticScheduleRowsConserved: digest() === before,
            }) + '\n');
            throw error;
        } finally {
            assert.equal(digest(), before, 'a read must conserve every synthetic rotation row, including inactive, expired, future and deleted records');
        }
    }, { makerRole: 'super' });
});
