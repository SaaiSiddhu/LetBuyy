import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    assert.match(rootPackageJson.scripts?.test || '', /node --test --test-concurrency=1 tests\/\*\/\*\.test\.mjs/);
    assert.match(rootPackageJson.scripts?.test || '', /test:contracts/);
    // SUSTAINED-J: test:behavioral no longer inlines the raw `node --test` invocation -- it
    // delegates to scripts/governance/test-behavioral.mjs, which routes the destructive-guard
    // suites through their own dedicated disposable Postgres container/database (each throws at
    // module load under the bare invocation, unconditionally, regardless of code changes) and
    // still runs every other suite with the exact same `node --test --test-concurrency=1`
    // invocation this test used to check for directly. The next assertion checks the wrapper
    // itself still covers the full tests/*/*.test.mjs surface, so this isn't just a narrower check.
    assert.match(rootPackageJson.scripts?.['test:behavioral'] || '', /node scripts\/governance\/test-behavioral\.mjs/);
    assert.match(rootPackageJson.scripts?.['test:workspaces'] || '', /turbo test/);
    assert.equal(rootPackageJson.scripts?.['test:contracts'], 'tsx --test tests/contracts/*.test.ts');
});

test('the test:behavioral wrapper still discovers and runs the full tests/*/*.test.mjs surface', () => {
    const wrapper = readFileSync(join(repoRoot, 'scripts/governance/test-behavioral.mjs'), 'utf8');
    // discoverAll() walks every immediate subdirectory of tests/ for *.test.mjs files -- the same
    // set `tests/*/*.test.mjs` would glob -- rather than a narrower, hand-picked list.
    assert.match(wrapper, /readdirSync\(join\(repoRoot, ['"]tests['"]\)/);
    assert.match(wrapper, /\.test\.mjs['"]\)/);
    // Every suite not in the destructive-guard allowlist still runs through the same real runner.
    assert.match(wrapper, /'node', \['--test', '--test-concurrency=1', \.\.\.rest\]/);
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
