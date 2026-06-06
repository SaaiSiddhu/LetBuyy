import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const webApps = [
    'apps/app-marketplace',
    'apps/identity-platform',
    'apps/marketing-site',
    'apps/merchant-control-plane',
    'apps/platform-console',
    'apps/platform-operations-portal',
    'apps/storefront-runtime',
    'apps/theme-marketplace',
];

function read(path: string): string {
    assert.equal(existsSync(path), true, `${path} must exist`);
    return readFileSync(path, 'utf8');
}

test('web app manifests no longer depend on retired @letbuyy/utils', () => {
    for (const appRoot of webApps) {
        const packageJson = JSON.parse(read(join(repoRoot, appRoot, 'package.json')));
        const manifest = JSON.parse(read(join(repoRoot, appRoot, 'runtime.manifest.json')));

        for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
            assert.equal(
                packageJson[field]?.['@letbuyy/utils'],
                undefined,
                `${appRoot}/package.json must not declare @letbuyy/utils in ${field}`,
            );
        }
        assert.equal(
            manifest.allowedDependencies.workspacePackages.includes('@letbuyy/utils'),
            false,
            `${appRoot}/runtime.manifest.json must not allow @letbuyy/utils`,
        );
    }
});

test('retired utils package is archived, not active workspace source', () => {
    assert.equal(existsSync(join(repoRoot, 'packages/typescript/utils/package.json')), false);
    assert.equal(existsSync(join(repoRoot, 'packages/typescript/utils/src/supabase.ts')), false);
    assert.match(
        read(join(repoRoot, 'docs/archive/legacy-packages/typescript-utils/AGENTS.md')),
        /Retired TypeScript Utils Package/,
    );
});

test('validator guards the app service-role package edge', () => {
    const validator = read(join(repoRoot, 'scripts/validators/app-utils-service-role-edge-validator.mjs'));
    const governanceRunner = read(join(repoRoot, 'scripts/validate-governance.mjs'));
    const governanceCommon = read(join(repoRoot, 'scripts/validators/governance-common.mjs'));
    const intelligenceGenerator = read(join(repoRoot, 'scripts/generate-repository-intelligence.mjs'));

    assert.match(validator, /@letbuyy\/utils/);
    assert.match(validator, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(validator, /createSupabaseServiceClient/);
    assert.match(governanceRunner, /app-utils-service-role-edge-validator\.mjs/);
    assert.doesNotMatch(governanceCommon, /packages\/typescript\/utils/);
    assert.doesNotMatch(intelligenceGenerator, /packages\/typescript\/utils/);
});
