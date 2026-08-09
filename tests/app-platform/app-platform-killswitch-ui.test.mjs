/**
 * ART-22 / ART-16 / NEVER-R3 — merchant-control-plane half of the fail-closed
 * app-platform kill switch (Component B).
 *
 * The gateway gate (services/api-gateway/src/middleware/appPlatformKillSwitch.ts,
 * proven in services/api-gateway/src/__tests__/app-platform-killswitch.test.ts) is
 * load-bearing. This file proves the merchant UI does not *present* the frozen
 * capability either: the three App Bridge / marketplace entry pages 404 unless the
 * same explicit positive opt-in is set.
 *
 * Offline and dependency-free: the flag module is transpiled and executed in a vm
 * sandbox; the pages are asserted at source level. No network, no database.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const FLAG_SOURCE = 'apps/merchant-control-plane/src/lib/app-platform-flag.ts';
const GUARDED_PAGES = [
    'apps/merchant-control-plane/src/app/[store]/apps/page.tsx',
    'apps/merchant-control-plane/src/app/[store]/apps/[installationId]/page.tsx',
    'apps/merchant-control-plane/src/app/[store]/settings/apps/page.tsx',
];
const DEPLOY_WORKFLOWS = [
    '.github/workflows/production-deploy.yml',
    '.github/workflows/staging-deploy.yml',
];

function loadFlagModule(env) {
    const transpiled = ts.transpileModule(readFileSync(FLAG_SOURCE, 'utf8'), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            esModuleInterop: true,
        },
    }).outputText;

    const module = { exports: {} };
    const sandbox = {
        module,
        exports: module.exports,
        process: { env },
        require() {
            throw new Error('the app-platform flag must not require anything');
        },
    };
    vm.createContext(sandbox);
    vm.runInContext(transpiled, sandbox);
    return module.exports;
}

test('the merchant UI flag is fail-closed for absent, empty and malformed values', () => {
    const denied = [
        {},
        { FEATURE_APP_PLATFORM: undefined },
        { FEATURE_APP_PLATFORM: '' },
        { FEATURE_APP_PLATFORM: '   ' },
        { FEATURE_APP_PLATFORM: 'false' },
        { FEATURE_APP_PLATFORM: 'FALSE' },
        { FEATURE_APP_PLATFORM: '0' },
        { FEATURE_APP_PLATFORM: 'off' },
        { FEATURE_APP_PLATFORM: 'disabled' },
        { FEATURE_APP_PLATFORM: 'no' },
        { FEATURE_APP_PLATFORM: 'maybe' },
        { FEATURE_APP_PLATFORM: 'truthy' },
        { FEATURE_APP_PLATFORM: 'trueish' },
        { FEATURE_APP_PLATFORM: '{}' },
        { FEATURE_APP_PLATFORM: 'null' },
        // Only the dedicated variable may open the seam; the fail-open flag must not.
        { FEATURE_EXTENSIONS: 'true', NODE_ENV: 'development' },
    ];

    for (const env of denied) {
        const { isAppPlatformEnabled } = loadFlagModule(env);
        assert.equal(
            isAppPlatformEnabled(),
            false,
            `env ${JSON.stringify(env)} must leave the app platform DISABLED`,
        );
    }
});

test('the merchant UI flag opens only on an explicit positive opt-in', () => {
    for (const value of ['1', 'true', 'TRUE', ' true ', 'on', 'enabled', 'yes', 'YES']) {
        const { isAppPlatformEnabled } = loadFlagModule({ FEATURE_APP_PLATFORM: value });
        assert.equal(isAppPlatformEnabled(), true, `"${value}" must be accepted as a positive opt-in`);
    }
});

test('every App Bridge / marketplace page guards before it does anything else', () => {
    for (const page of GUARDED_PAGES) {
        const source = readFileSync(page, 'utf8');
        assert.match(
            source,
            /import \{ isAppPlatformEnabled \} from '@\/lib\/app-platform-flag'/,
            `${page} must import the fail-closed app-platform flag`,
        );
        assert.match(
            source,
            /if \(!isAppPlatformEnabled\(\)\) (return )?notFound\(\)/,
            `${page} must 404 when the app platform is disabled`,
        );

        const guardIndex = source.indexOf('isAppPlatformEnabled()) ');
        const paramsIndex = source.indexOf('await params');
        const clientIndex = source.indexOf('createMerchantApiClient()');
        assert.ok(guardIndex > -1, `${page} must contain the guard`);
        assert.ok(
            guardIndex < paramsIndex,
            `${page} must run the app-platform guard before resolving route params`,
        );
        if (clientIndex > -1) {
            assert.ok(
                guardIndex < clientIndex,
                `${page} must run the app-platform guard before calling the gateway`,
            );
        }
    }
});

test('FEATURE_APP_PLATFORM is not declared in any deploy workflow (absence is the off state)', () => {
    for (const workflow of DEPLOY_WORKFLOWS) {
        const source = readFileSync(workflow, 'utf8');
        assert.equal(
            source.includes('FEATURE_APP_PLATFORM'),
            false,
            `${workflow} must NOT declare FEATURE_APP_PLATFORM — its absence is the fail-closed guarantee`,
        );
    }
});

test('the merchant UI flag does not fall back to the environment', () => {
    const source = readFileSync(FLAG_SOURCE, 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /NODE_ENV|APP_ENV|ENVIRONMENT|VERCEL_ENV/);
    assert.doesNotMatch(code, /FEATURE_EXTENSIONS/);
});
