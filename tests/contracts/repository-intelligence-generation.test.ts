import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function path(relativePath: string): string {
    return join(repoRoot, relativePath);
}

function read(relativePath: string): string {
    const absolutePath = path(relativePath);
    assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
    return readFileSync(absolutePath, 'utf8');
}

test('repository intelligence generator scans tracked files and includes developer portal topology', () => {
    const generator = read('scripts/generate-repository-intelligence.mjs');

    assert.match(generator, /execFileSync\("git", \["ls-files", "-z"\]/);
    assert.match(generator, /apps\/developer-portal\/AGENTS\.md/);
    assert.match(generator, /Developer documentation, API reference, SDK quick-starts/);
});

test('generated root AGENTS keeps current runtime and non-negotiable governance lines', () => {
    const agents = read('AGENTS.md');

    assert.match(agents, /Developer Portal: `apps\/developer-portal`/);
    assert.match(agents, /`services\/api-gateway` is the sole Commerce API backend/);
    assert.match(agents, /`@letbuyy\/shared-types` is the canonical cross-runtime domain contract/);
    assert.match(agents, /apps\/developer-portal`, `apps\/theme-marketplace`/);
    assert.match(agents, /Mobile runtimes: active `apps\/mobile\/merchant-app`; reserved\/not-implemented mobile roots `apps\/mobile\/shopper-app` and `apps\/mobile\/operator-app`/);
    assert.match(agents, /implemented `services\/api-gateway`, `services\/mobile-bff`, `services\/webhook-service`, and `services\/queue-workers`/);
    assert.match(agents, /reserved\/not-implemented service roots `services\/checkout-runtime`/);
    assert.match(agents, /Active replay chain: `000_baseline\.sql` plus additive forward migrations `073_\*\.sql` through `090_\*\.sql`/);
    assert.match(agents, /Baseline public tables detected: 237 `CREATE TABLE public\.\*` statements/);
});

test('generated intelligence excludes untracked local draft files', () => {
    const agents = read('AGENTS.md');
    const master = read('docs/architecture/master-system-intelligence.md');

    for (const forbidden of [
        'CODEX_FOUNDATION_HARDENING_MISSION_V2.md',
        'LETBUYY_CUSTOM_DOMAIN_V2.md',
        'LETBUYY_PRODUCTION_AUDIT_2026-06-06.md',
        'docs/mobile-migration-blueprint',
    ]) {
        assert.doesNotMatch(agents, new RegExp(forbidden.replaceAll('.', '\\.')));
        assert.doesNotMatch(master, new RegExp(forbidden.replaceAll('.', '\\.')));
    }
});

test('repository intelligence validator is wired into governance', () => {
    assert.match(read('scripts/validators/repository-intelligence-validator.mjs'), /generated AGENTS and master intelligence topology checked/);
    assert.match(read('scripts/validate-governance.mjs'), /repository-intelligence-validator\.mjs/);
});
