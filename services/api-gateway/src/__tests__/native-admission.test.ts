import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { unstable_dev } from 'wrangler';

const fixture = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/native-admission.fixture.ts');
process.env.WRANGLER_SEND_METRICS = 'false';

async function nativeFixture(environment: 'production' | 'staging', delay = 0, outage = false) {
    const directory = await mkdtemp(join(tmpdir(), 'letbuyy-native-admission-test-'));
    const config = join(directory, 'wrangler.json');
    await writeFile(config, JSON.stringify({
        name: 'synthetic-native-admission',
        compatibility_date: '2026-05-25',
        compatibility_flags: ['nodejs_compat'],
        workers_dev: false,
        migrations: [{ tag: 'synthetic-only', new_sqlite_classes: ['SyntheticAdmissionCoordinator'] }],
        durable_objects: { bindings: [{ name: 'RUNTIME_COORDINATOR', class_name: 'SyntheticAdmissionCoordinator' }] },
        vars: {
            ENVIRONMENT: environment, APP_ENV: environment, NODE_ENV: 'production',
            SYNTHETIC_COORDINATOR_DELAY_MS: String(delay), SYNTHETIC_COORDINATOR_OUTAGE: String(outage),
        },
    }), { mode: 0o600 });
    const worker = await unstable_dev(fixture, {
        config, envFiles: [], local: true, ip: '127.0.0.1', port: 0, inspectorPort: 0,
        persist: false, logLevel: 'none',
        experimental: { forceLocal: true, disableDevRegistry: true, disableExperimentalWarning: true, watch: false, showInteractiveDevSession: false },
    }).catch(async (error: unknown) => { await rm(directory, { recursive: true }); throw error; });
    return {
        fetch: worker.fetch,
        async close() { await worker.stop(); await rm(directory, { recursive: true }); },
    };
}

test('native cold coordinator admits within its bounded grace and retains both atomic limits', { timeout: 90_000 }, async () => {
    const fixture = await nativeFixture('production', 3000);
    try {
        for (const path of ['/query', '/fixed']) {
            const first = await fixture.fetch(path);
            assert.equal(first.status, 200, path + ' must survive a three-second native coordinator cold start');
            assert.equal((await fixture.fetch(path)).status, 200);
            const excess = await fixture.fetch(path);
            assert.equal(excess.status, 429, path + ' must still deny excess requests');
            assert.ok(Number(excess.headers.get('Retry-After')) >= 1);
        }
        const concurrent = await Promise.all(Array.from({ length: 20 }, () => fixture.fetch('/query')));
        assert.equal(concurrent.filter(response => response.status === 200).length, 0, 'concurrent requests cannot refill or bypass the spent budget');
    } finally { await fixture.close(); }
});

for (const environment of ['production', 'staging'] as const) {
    test('native configured coordinator outage is typed unavailable in ' + environment, { timeout: 45_000 }, async () => {
        const fixture = await nativeFixture(environment, 0, true);
        try {
            const response = await fixture.fetch('/query');
            assert.equal(response.status, 503, 'an unavailable configured backend must not look like a spent client budget');
            const body = await response.json() as { error?: { code?: string } };
            assert.equal(body.error?.code, 'RATE_LIMIT_UNAVAILABLE');
        } finally { await fixture.close(); }
    });
}
