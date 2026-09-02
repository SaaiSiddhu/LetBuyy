import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

const envFiles = [
    'config/env/staging.env.example',
    'config/env/production.env.example',
    'config/env/staging.env.template',
    'config/env/production.env.template',
] as const;

const stagingProjectIds = [
    'STAGING_MARKETING_PROJECT_ID',
    'STAGING_IDENTITY_PROJECT_ID',
    'STAGING_MERCHANT_PROJECT_ID',
    'STAGING_STOREFRONT_PROJECT_ID',
    'STAGING_APP_MARKETPLACE_PROJECT_ID',
    'STAGING_DEVELOPER_PORTAL_PROJECT_ID',
    'STAGING_THEME_MARKETPLACE_PROJECT_ID',
    'STAGING_PLATFORM_CONSOLE_PROJECT_ID',
    'STAGING_PLATFORM_OPERATIONS_PORTAL_PROJECT_ID',
] as const;

const productionProjectIds = stagingProjectIds.map((name) =>
    name.replace('STAGING_', 'PRODUCTION_'),
);

function path(relativePath: string): string {
    return join(repoRoot, relativePath);
}

function read(relativePath: string): string {
    const absolutePath = path(relativePath);
    assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
    return readFileSync(absolutePath, 'utf8');
}

test('env templates do not advertise orphaned VERCEL_PROJECT_ID names', () => {
    for (const file of envFiles) {
        assert.doesNotMatch(read(file), /\bVERCEL_PROJECT_ID_[A-Z0-9_]+\b/);
    }
});

test('env templates document the current staging and production Vercel project secret names', () => {
    for (const file of ['config/env/staging.env.example', 'config/env/staging.env.template']) {
        const source = read(file);
        for (const name of stagingProjectIds) assert.match(source, new RegExp(`\\b${name}\\b`));
    }

    for (const file of ['config/env/production.env.example', 'config/env/production.env.template']) {
        const source = read(file);
        for (const name of productionProjectIds) assert.match(source, new RegExp(`\\b${name}\\b`));
    }
});

test('empty codex route proof directories are absent from active app source', () => {
    assert.equal(existsSync(path('apps/merchant_web/src/app/codex-theme-editor-empty-proof')), false);
    assert.equal(existsSync(path('apps/merchant_web/src/app/__codex-theme-editor-empty-proof')), false);
});

test('dead residue validator is wired into governance', () => {
    assert.match(read('scripts/validators/dead-residue-validator.mjs'), /orphaned env names and empty route residue/);
    assert.match(read('scripts/validate-governance.mjs'), /dead-residue-validator\.mjs/);
});
