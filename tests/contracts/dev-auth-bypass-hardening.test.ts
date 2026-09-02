import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    canUseIdentityDevAuthBypass,
    isProductionIdentityRuntime,
} from '../../apps/identity-platform/src/lib/dev-auth-bypass';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const signupRoutePath = join(repoRoot, 'apps/identity-platform/src/app/api/auth/signup/route.ts');
const identityDevBypassPath = join(repoRoot, 'apps/identity-platform/src/lib/dev-auth-bypass.ts');
const identityTurnstilePath = join(repoRoot, 'apps/identity-platform/src/lib/turnstile.ts');
const turnstileWidgetPath = join(repoRoot, 'apps/identity-platform/src/components/TurnstileWidget.tsx');
const consoleAuthPath = join(repoRoot, 'apps/admin_web/src/lib/console-auth-server.ts');
const nextTemplatePath = join(repoRoot, 'config/env/templates/next-app.env.example');
const nextSchemaPath = join(repoRoot, 'config/env/schemas/next-app.schema.json');
const securityGovernancePath = join(repoRoot, 'docs/governance/security-operations-governance.md');
const validatorPath = join(repoRoot, 'scripts/validators/dev-auth-bypass-validator.mjs');
const governanceRunnerPath = join(repoRoot, 'scripts/validate-governance.mjs');

function read(path: string): string {
    assert.equal(existsSync(path), true, `${path} must exist`);
    return readFileSync(path, 'utf8');
}

test('identity signup dev OTP echo requires explicit development-only bypass flag', () => {
    const source = read(signupRoutePath);
    const helper = read(identityDevBypassPath);

    assert.equal(canUseIdentityDevAuthBypass({
        NODE_ENV: 'development',
        LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'true',
    }), true);
    assert.equal(canUseIdentityDevAuthBypass({
        NODE_ENV: 'production',
        LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'true',
    }), false);
    assert.equal(canUseIdentityDevAuthBypass({
        NODE_ENV: 'development',
        APP_ENV: 'production',
        LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'true',
    }), false);
    assert.equal(isProductionIdentityRuntime({
        NODE_ENV: 'development',
        VERCEL_ENV: 'production',
    }), true);

    assert.match(source, /canUseIdentityDevAuthBypass\(process\.env\)/);
    assert.match(helper, /LETBUYY_ENABLE_DEV_AUTH_BYPASS/);
    assert.match(helper, /NODE_ENV\) === 'development'/);
    assert.match(helper, /isProductionIdentityRuntime/);
    assert.doesNotMatch(source, /process\.env\.NODE_ENV !== 'production'[\s\S]{0,120}devOtp/);
});

test('identity Turnstile dev token and missing-secret path fail closed outside explicit dev bypass', () => {
    const server = read(identityTurnstilePath);
    const client = read(turnstileWidgetPath);

    assert.match(server, /canUseIdentityDevAuthBypass\(process\.env\)/);
    assert.match(server, /token === 'dev-bypass-token'[\s\S]{0,120}canUseIdentityDevAuthBypass/);
    assert.doesNotMatch(server, /TURNSTILE_SECRET_KEY not set[\s\S]{0,160}return true/);
    assert.match(client, /canUseClientDevAuthBypass\(\)/);
    assert.match(client, /NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS/);
    assert.doesNotMatch(client, /if \(!siteKey\) \{\s*onVerifyRef\.current\('dev-bypass-token'\)/);
});

test('platform console dev MFA bypass requires explicit development-only flag', () => {
    const source = read(consoleAuthPath);

    assert.match(source, /canUseConsoleDevMfaBypass\(\)/);
    assert.match(source, /LETBUYY_ENABLE_DEV_AUTH_BYPASS/);
    assert.doesNotMatch(source, /process\.env\.NODE_ENV !== 'production' && devCode/);
});

test('dev auth bypass is documented and validator-guarded', () => {
    const template = read(nextTemplatePath);
    const schema = read(nextSchemaPath);
    const governance = read(securityGovernancePath);
    const validator = read(validatorPath);
    const runner = read(governanceRunnerPath);

    assert.match(template, /LETBUYY_ENABLE_DEV_AUTH_BYPASS=false/);
    assert.match(template, /NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS=false/);
    assert.match(schema, /"LETBUYY_ENABLE_DEV_AUTH_BYPASS"/);
    assert.match(schema, /"NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS"/);
    assert.match(governance, /LETBUYY_ENABLE_DEV_AUTH_BYPASS/);
    assert.match(validator, /devOtp/);
    assert.match(validator, /dev-bypass-token/);
    assert.match(runner, /dev-auth-bypass-validator\.mjs/);
});
