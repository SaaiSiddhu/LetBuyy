import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureServiceKeyLifetimeSeconds, signJwtHs256 } from '../../scripts/governance/executable-pg-fixture.mjs';

test('short owned suites retain the existing two-hour credential lifetime', () => {
    assert.equal(fixtureServiceKeyLifetimeSeconds(600_000), 7200);
});

test('a long browser review credential covers the runner deadline and provisioning margin', () => {
    const timeoutMs = 28_800_000;
    const issuedAt = 1_800_000_000;
    const key = signJwtHs256('synthetic-owned-fixture-secret', {
        iat: issuedAt, exp: issuedAt + fixtureServiceKeyLifetimeSeconds(timeoutMs),
    });
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    assert.equal(claims.exp - claims.iat, 29_100);
    assert.ok(claims.exp > issuedAt + timeoutMs / 1000);
});

test('unbounded or invalid fixture deadlines cannot mint a credential', () => {
    for (const timeout of [0, -1, NaN, Infinity]) {
        assert.throws(() => fixtureServiceKeyLifetimeSeconds(timeout), RangeError);
    }
});
