import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'validators', 'design-system-baseline.json');

function runNode(args, env = {}) {
    return spawnSync(process.execPath, args, {
        cwd: ROOT,
        env: { ...process.env, ...env },
        encoding: 'utf8',
    });
}

test('Wave 5 design and mobile token gates pass with the committed baseline', () => {
    const design = runNode(['scripts/validators/validate-design-system.mjs']);
    assert.equal(design.status, 0, design.stderr || design.stdout);

    const mobile = runNode(['scripts/generators/generate-mobile-tokens.mjs', '--check']);
    assert.equal(mobile.status, 0, mobile.stderr || mobile.stdout);
});

test('Wave 5 ratchet fails on new arbitrary-radius drift', () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

    const stricter = {
        ...baseline,
        metrics: {
            ...baseline.metrics,
            tsxArbitraryRadius: -1,
        },
    };
    const tempBaseline = join(mkdtempSync(join(tmpdir(), 'letbuyy-wave5-design-')), 'baseline.json');
    writeFileSync(tempBaseline, JSON.stringify(stricter, null, 2));

    const result = runNode(['scripts/validators/validate-design-system.mjs'], {
        LETBUYY_DESIGN_SYSTEM_BASELINE_PATH: tempBaseline,
    });

    assert.notEqual(result.status, 0, 'validator should fail when current arbitrary-radius count exceeds baseline');
    assert.match(result.stderr, /RATCHET regression: tsxArbitraryRadius/);
});

test('Wave 5 scope exiles marketing and forbids local workspace implementations', () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    assert.deepEqual(baseline.scope.exiledApps, ['apps/marketing-site']);

    for (const file of [
        'apps/admin_web/src/components/_local-ui/console-workspace.tsx',
        'apps/platform-operations-portal/src/components/_local-ui/ops-workspace.tsx',
    ]) {
        const text = readFileSync(join(ROOT, file), 'utf8');
        assert.match(text, /InternalWorkspace/);
        assert.doesNotMatch(text, /<(?:main|article|section)\s+className=/);
    }
});
