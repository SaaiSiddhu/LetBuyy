import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const merchantSlugFiles = [
    'apps/merchant-control-plane/src/app/[store]/posts/page.tsx',
    'apps/merchant-control-plane/src/app/[store]/pages/page.tsx',
    'apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx',
];

function read(path: string): string {
    assert.equal(existsSync(path), true, `${path} must exist`);
    return readFileSync(path, 'utf8');
}

test('cms-core owns the canonical merchant CMS slug helper', () => {
    const cmsCore = read(join(repoRoot, 'packages/cms-core/src/index.ts'));

    assert.match(cmsCore, /export function slugifyCmsTitle/);
    assert.equal(
        cmsCore.includes("replace(/[^a-z0-9]+/g, '-')"),
        true,
    );
});

test('merchant CMS pages import slugifyCmsTitle instead of declaring local slugify helpers', () => {
    for (const file of merchantSlugFiles) {
        const source = read(join(repoRoot, file));

        assert.match(source, /import \{ slugifyCmsTitle as slugify \} from '@letbuyy\/cms-core'/);
        assert.doesNotMatch(source, /\b(?:function|const)\s+slugify\b/);
    }
});

test('merchant package and runtime manifest declare cms-core authority', () => {
    const packageJson = JSON.parse(read(join(repoRoot, 'apps/merchant-control-plane/package.json')));
    const runtimeManifest = JSON.parse(read(join(repoRoot, 'apps/merchant-control-plane/runtime.manifest.json')));

    assert.equal(packageJson.dependencies['@letbuyy/cms-core'], 'workspace:*');
    assert.equal(runtimeManifest.allowedDependencies.workspacePackages.includes('@letbuyy/cms-core'), true);
});

test('cms slugify validator is wired into governance', () => {
    const validator = read(join(repoRoot, 'scripts/validators/cms-slugify-validator.mjs'));
    const governanceRunner = read(join(repoRoot, 'scripts/validate-governance.mjs'));

    assert.match(validator, /slugifyCmsTitle/);
    assert.match(validator, /localSlugifyOffenders/);
    assert.match(governanceRunner, /cms-slugify-validator\.mjs/);
});
