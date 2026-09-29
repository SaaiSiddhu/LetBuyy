import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

const deployableWorkspaces = [
    'apps/frozen/app-store',
    'apps/frozen/developer-portal',
    'apps/platform/identity',
    'apps/marketing/web',
    'apps/merchant/web',
    'apps/internal/console',
    'apps/frozen/operations-portal',
    'apps/commerce/web',
    'apps/frozen/theme-store',
    'services/api-gateway',
    'services/queue-workers',
    'services/webhook-service',
];

function readPackageJson(workspace: string) {
    return JSON.parse(readFileSync(join(repoRoot, workspace, 'package.json'), 'utf8')) as {
        scripts?: Record<string, string>
    };
}

test('deployable workspaces run real test commands instead of no-op placeholders', () => {
    for (const workspace of deployableWorkspaces) {
        const testScript = readPackageJson(workspace).scripts?.test || '';
        assert.notEqual(testScript, '', `${workspace} must define a test script`);
        assert.doesNotMatch(testScript, /No tests yet|echo\s+['"]?No tests|exit\s+0/i, `${workspace} test script must not be a no-op`);
        assert.match(testScript, /node --test|tsx --test|pnpm exec tsx --test/, `${workspace} test script must invoke a real test runner`);
    }
});

test('root and governance runners include workspace and TypeScript contract tests', () => {
    const rootPackageJson = readPackageJson('.');
    // The root `test` script runs the behavioral wrapper AND the contract tests, and always both: the
    // wrapper takes `--with-contracts` instead of the old `a && b` chain, which never ran the contract
    // tests once the first part had failed and so hid a whole lane behind the first red.
    assert.match(rootPackageJson.scripts?.test || '', /node scripts\/governance\/test-behavioral\.mjs --with-contracts/);
    assert.doesNotMatch(rootPackageJson.scripts?.test || '', /&&/, 'a short-circuiting chain hides every part after the first failure');
    // SUSTAINED-J: test:behavioral delegates to scripts/governance/test-behavioral.mjs; the next test
    // checks that wrapper covers the full tests/*/*.test.mjs surface.
    assert.match(rootPackageJson.scripts?.['test:behavioral'] || '', /node scripts\/governance\/test-behavioral\.mjs/);
    assert.match(rootPackageJson.scripts?.['test:workspaces'] || '', /turbo test/);
    assert.equal(rootPackageJson.scripts?.['test:contracts'], 'tsx --test tests/contracts/*.test.ts');
});

test('the test:behavioral wrapper runs the full tests/*/*.test.mjs surface, each suite in exactly one environment', async () => {
    const { discoverSuites } = await import('../../scripts/governance/test-suite-catalog.mjs');
    const { all, pure, postgres, live } = discoverSuites(repoRoot) as Record<string, string[]>;
    // The surface `tests/*/*.test.mjs` would glob, computed without the catalog.
    const globbed = readdirSync(join(repoRoot, 'tests'), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .flatMap((dir) => readdirSync(join(repoRoot, 'tests', dir.name)).filter((name) => name.endsWith('.test.mjs')).map((name) => `tests/${dir.name}/${name}`))
        .sort();
    assert.deepEqual(all, globbed);
    assert.deepEqual([...pure, ...postgres, ...live].sort(), globbed, 'every suite runs, none twice');

    const wrapper = readFileSync(join(repoRoot, 'scripts/governance/test-behavioral.mjs'), 'utf8');
    assert.match(wrapper, /'node', \['--test', '--test-concurrency=1', \.\.\.pure, \.\.\.live\]/, 'database-free suites keep the sequential node --test invocation');
    assert.match(wrapper, /scripts\/governance\/run-executable-suites\.mjs/, 'Postgres-backed suites go through the owned-cluster runner');
    assert.doesNotMatch(wrapper, /foundation-ephemeral-postgres/, 'the shared fixture is not part of the gate');
});

test('main CI runs the behavioral gate before filtered workspace tests', () => {
    const workflow = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
    const behavioralIndex = workflow.indexOf('pnpm run test:behavioral');
    const filteredWorkspaceIndex = workflow.indexOf('pnpm turbo test --filter="...[HEAD^1]"');

    assert.notEqual(behavioralIndex, -1, 'CI must run the root behavioral gate');
    assert.notEqual(filteredWorkspaceIndex, -1, 'CI must run filtered workspace tests');
    assert.ok(
        behavioralIndex < filteredWorkspaceIndex,
        'behavioral gate must run before filtered workspace tests so root tests are not skipped by workspace filters',
    );
});
