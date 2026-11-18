import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const architecture = readFileSync(new URL('../../.github/workflows/architecture-governance.yml', import.meta.url), 'utf8');
function job(name) {
    const rest = workflow.split(`  ${name}:\n`)[1];
    assert.ok(rest, `Missing required job: ${name}`);
    return rest.split(/\n  [a-z][a-z0-9-]*:\n/)[0];
}
const unit = job('unit-tests');
const merge = job('merge-safety-gate');
const header = merge.split('    steps:\n')[0];
const guard = merge.match(/      - name: Require successful full behavioral and unit gates\n([\s\S]*?)(?=\n      - )/)?.[1];

test('Merge requires the complete same-workflow Unit gate and always evaluates its result', () => {
    assert.match(header, /^    needs: \[unit-tests\]$/m);
    assert.ok(header.split('\n').some(line => line.trim() === 'if: ${{ always() }}'));
    assert.ok(guard, 'The required check needs an explicit rejecting guard');
    assert.ok(guard.split('\n').some(line => line.trim() === 'if: ${{ always() }}'));
    assert.ok(guard.includes('UNIT_JOB_RESULT: ${{ needs.unit-tests.result }}'));
    assert.doesNotMatch(unit.split('    steps:\n')[0], /merge-safety-gate/);
});

test('the complete behavioral inventory remains mandatory in Unit and Architecture', () => {
    const step = unit.match(/      - name: Run behavioral gate\n([\s\S]*?)(?=\n      - )/)?.[1];
    assert.ok(step);
    assert.match(step, /run: pnpm run test:behavioral/);
    assert.doesNotMatch(step, /^\s+if:/m);
    assert.match(architecture, /run: pnpm run test\s*\n/);
    assert.match(merge, /run: pnpm run test:contracts/);
    assert.match(merge, /run: flutter analyze/);
    assert.match(merge, /run: flutter test/);
});

for (const result of ['success', 'failure', 'cancelled', 'skipped', 'timed_out', '', 'success; exit 0']) {
    test(`actual Merge shell guard accepts only success: ${result || '(missing)'}`, () => {
        assert.ok(guard);
        const command = guard.match(/^        run: (.+)$/m)?.[1];
        assert.ok(command);
        const child = spawnSync('/bin/sh', ['-c', command], {
            encoding: 'utf8', env: { ...process.env, UNIT_JOB_RESULT: result }, timeout: 2000,
        });
        assert.equal(child.error, undefined);
        assert.equal(child.signal, null);
        assert.equal(child.status === 0, result === 'success');
    });
}
