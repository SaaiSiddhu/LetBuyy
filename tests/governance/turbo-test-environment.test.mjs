import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('strict Turbo test tasks preserve the owned database worker budget without forwarding undeclared variables', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'letbuyy-turbo-test-environment-'));
    try {
        const probe = join(fixture, 'packages', 'probe'), reports = join(fixture, 'reports');
        mkdirSync(probe, { recursive: true });
        mkdirSync(reports);
        writeFileSync(join(fixture, 'package.json'), JSON.stringify({ name: 'owned-turbo-environment', private: true, packageManager: 'pnpm@10.6.2' }));
        writeFileSync(join(fixture, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
        writeFileSync(join(fixture, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  packages/probe: {}\n");
        writeFileSync(join(fixture, 'turbo.json'), readFileSync(new URL('../../turbo.json', import.meta.url)));
        writeFileSync(join(probe, 'package.json'), JSON.stringify({ name: 'owned-environment-probe', version: '0.0.0', scripts: { test: 'node probe.cjs' } }));
        writeFileSync(join(probe, 'probe.cjs'), `require('node:fs').writeFileSync(require('node:path').join(process.env.LETBUYY_EXECUTABLE_REPORT_DIR, 'environment.json'), JSON.stringify({ workers: process.env.LETBUYY_EXECUTABLE_PG_JOBS ?? null, networkPool: process.env.LETBUYY_EXECUTABLE_NETWORK_POOL ?? null, unlisted: process.env.LETBUYY_UNDECLARED_CONTROL ?? null }));`);
        const env = { ...process.env, LETBUYY_EXECUTABLE_PG_JOBS: '3', LETBUYY_EXECUTABLE_REPORT_DIR: reports,
            LETBUYY_EXECUTABLE_NETWORK_POOL: '10.233.0.0/16', LETBUYY_UNDECLARED_CONTROL: 'unlisted-fixture-control', TURBO_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' };
        delete env.TURBO_TOKEN;
        delete env.TURBO_TEAM;
        delete env.NODE_TEST_CONTEXT;
        const result = spawnSync(fileURLToPath(new URL('../../node_modules/.bin/turbo', import.meta.url)),
            ['run', 'test', '--filter=owned-environment-probe', '--env-mode=strict', '--force'],
            { cwd: fixture, env, encoding: 'utf8', timeout: 60_000 });
        assert.equal(result.status, 0, `owned Turbo probe failed: ${result.stderr}\n${result.stdout}`);
        assert.deepEqual(JSON.parse(readFileSync(join(reports, 'environment.json'), 'utf8')), { workers: '3', networkPool: '10.233.0.0/16', unlisted: null });
    } finally {
        rmSync(fixture, { recursive: true, force: true });
    }
});
