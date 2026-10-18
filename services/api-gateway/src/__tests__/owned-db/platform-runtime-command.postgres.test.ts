// Safety boundary of the currently unimplemented generic runtime controller.
// Accepted V1 recovery/incident delivery remains open; this suite never calls
// a provider, activates workflow machinery or treats a queued row as an effect.
import assert from 'node:assert/strict';
import test from 'node:test';
import { consoleFixture } from './console-session-fixture';
import { signedIdentityHeaders, tapRest } from './gateway-harness';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
async function fixture() {
    const f = await consoleFixture(owned), maker = await f.actor('super'), checker = await f.actor('super');
    const command = 'syn-runtime-' + crypto.randomUUID();
    const body = { command_id: command, operation: 'invalidate-cache', target_type: 'cache', target_id: 'synthetic-cache',
        reason: 'Synthetic privileged runtime command', secondary_approver_id: checker.id };
    const send = async () => f.gateway.request('/v1/operations/runtime/control-commands', { method: 'POST',
        headers: await signedIdentityHeaders(maker.id, maker.email), body: JSON.stringify(body) });
    return { ...f, maker, checker, command, body, send };
}
test('a typed eligible second-person ID cannot create an accepted runtime command or approval claim', async () => {
    const j = await fixture(), result = await j.send();
    console.info('OWNED_RUNTIME_TYPED_ID ' + JSON.stringify({ status: result.status,
        rows: owned.psql(`SELECT count(*) FROM runtime_control_commands WHERE command_id='${j.command}';`) }));
    assert.ok([401,403,428,503].includes(result.status), result.text);
    assert.equal(owned.psql(`SELECT count(*) FROM runtime_control_commands WHERE command_id='${j.command}';`), '0');
});
test('an unavailable audit cannot leave an accepted unapproved runtime command behind', async () => {
    const j = await fixture(), tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'audit_logs' && call.method === 'POST'
        ? new Response(JSON.stringify({ code: 'SYNTHETIC_AUDIT_FAULT', message: 'Synthetic audit fault' }),
            { status: 503, headers: { 'content-type': 'application/json' } }) : forward());
    try {
        const result = await j.send(); assert.ok([401,403,428,503].includes(result.status), result.text);
        assert.equal(owned.psql(`SELECT count(*) FROM runtime_control_commands WHERE command_id='${j.command}';`), '0');
    } finally { tap.restore(); }
});
test('a tenant database role cannot claim global operational commands through the legacy definer', () => {
    const command = 'syn-private-claim-' + crypto.randomUUID();
    owned.psql(`INSERT INTO runtime_control_commands(command_id,operation,target_type,target_id,reason,correlation_id)
        VALUES('${command}','invalidate-cache','cache','synthetic-cache','Synthetic retained legacy command','${command}');`);
    const error = owned.psqlExpectError(`BEGIN; SET LOCAL ROLE app_tenant;
        SELECT count(*) FROM public.claim_operational_control_command('synthetic-tenant-claim',100); ROLLBACK;`);
    assert.match(error, /permission denied/);
    assert.equal(owned.psql(`SELECT status FROM runtime_control_commands WHERE command_id='${command}';`), 'accepted');
});
