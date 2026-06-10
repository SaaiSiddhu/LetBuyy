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

test('repository intelligence generator is retired and cannot write governance authority', () => {
    const generator = read('scripts/generate-repository-intelligence.mjs');

    assert.match(generator, /RETIRED_REPOSITORY_INTELLIGENCE_GENERATOR/);
    assert.match(generator, /process\.exit\(1\)/);
    assert.match(generator, /Root AGENTS\.md is hand-authored law/);
    assert.doesNotMatch(generator, /writeFile\(["']AGENTS\.md["']/);
    assert.doesNotMatch(generator, /master-system-intelligence\.md/);
});

test('root AGENTS is hand-authored AGENTS_V2 law, not generated scan output', () => {
    const agents = read('AGENTS.md');

    assert.match(agents, /# LETBUYY_AGENTS_V2/);
    assert.match(agents, /HAND-AUTHORED LAW\. NOT GENERATED\./);
    assert.match(agents, /one modular monolith \(`api-gateway`\) \+ four satellites/);
    assert.match(agents, /The 8 canonical runtimes/);
    assert.match(agents, /`@letbuyy\/shared-types` is the canonical cross-runtime domain contract/);
    assert.doesNotMatch(agents, /Current source scan:/);
    assert.doesNotMatch(agents, /After significant architecture changes, regenerate `docs\/architecture\/master-system-intelligence\.md`/);
    assert.doesNotMatch(agents, /Distributed Runtime: `packages\/distributed-runtime`/);
});

test('generated intelligence artifacts remain archived or absent from active authority', () => {
    assert.equal(existsSync(path('docs/architecture/master-system-intelligence.md')), false);
    assert.equal(existsSync(path('docs/architecture/repository-intelligence-report.json')), true);

    for (const forbidden of [
        'CODEX_FOUNDATION_HARDENING_MISSION_V2.md',
        'LETBUYY_CUSTOM_DOMAIN_V2.md',
        'LETBUYY_PRODUCTION_AUDIT_2026-06-06.md',
        'docs/mobile-migration-blueprint',
    ]) {
        const agents = read('AGENTS.md');
        assert.doesNotMatch(agents, new RegExp(forbidden.replaceAll('.', '\\.')));
    }
});

test('repository intelligence validator is wired into governance', () => {
    assert.match(read('scripts/validators/repository-intelligence-validator.mjs'), /AGENTS_V2 promotion and generator retirement checked/);
    assert.match(read('scripts/validate-governance.mjs'), /repository-intelligence-validator\.mjs/);
});
