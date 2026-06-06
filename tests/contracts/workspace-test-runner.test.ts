import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

const deployableWorkspaces = [
    'apps/app-marketplace',
    'apps/developer-portal',
    'apps/identity-platform',
    'apps/marketing-site',
    'apps/merchant-control-plane',
    'apps/platform-console',
    'apps/platform-operations-portal',
    'apps/storefront-runtime',
    'apps/theme-marketplace',
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
    assert.match(rootPackageJson.scripts?.test || '', /test:contracts/);
    assert.match(rootPackageJson.scripts?.['test:workspaces'] || '', /turbo test/);
    assert.equal(rootPackageJson.scripts?.['test:contracts'], 'tsx --test tests/contracts/*.test.ts');
});
