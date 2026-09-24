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

test('settings apps route renders the live client and the old content twin is archived', () => {
    const page = read('apps/merchant/web/src/app/[store]/settings/apps/page.tsx');

    assert.match(page, /AppsSettingsClient/);
    assert.equal(existsSync(path('apps/merchant/web/src/app/[store]/settings/apps/AppsSettingsContent.tsx')), false);
    assert.equal(
        existsSync(path('docs/archive/dead-code/merchant-control-plane/settings-apps/AppsSettingsContent.tsx')),
        true,
    );
});

test('active app platform audit names the live apps settings component', () => {
    const audit = read('docs/archive/historical-audits-2026-06-10/apps-platform/06-merchant-integration-audit.md');

    assert.match(audit, /AppsSettingsClient\.tsx/);
    assert.doesNotMatch(audit, /AppsSettingsContent\.tsx/);
});

test('settings apps dead twin validator is wired into governance', () => {
    const validator = read('scripts/validators/settings-apps-dead-twin-validator.mjs');
    const governanceRunner = read('scripts/validate-governance.mjs');

    assert.match(validator, /AppsSettingsContent/);
    assert.match(validator, /docs\/archive\/dead-code/);
    assert.match(governanceRunner, /settings-apps-dead-twin-validator\.mjs/);
});
