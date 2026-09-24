/**
 * ART-22 / ART-16 / NEVER-R3 — the UI half of the fail-closed app-platform kill
 * switch (Component B).
 *
 * The gateway gates (services/api-gateway/src/middleware/appPlatformKillSwitch.ts,
 * proven in app-platform-killswitch.test.ts for the /v1/app-store + /v1/app mounts and
 * in app-platform-seam-killswitch.test.ts for the storefront + operator seams) are
 * load-bearing. This file proves the UIs do not *present* the frozen capability either:
 *   - merchant-web: the three App Bridge / marketplace entry pages
 *   - admin-web: marketplace-governance (app listing approval) and the developer
 *     back office (moderation, partner payouts, disputes)
 * all 404 unless the same explicit positive opt-in is set.
 *
 * Offline and dependency-free: the flag modules are transpiled and executed in a vm
 * sandbox; the pages are asserted at source level. No network, no database.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const FLAG_SOURCE = 'apps/merchant/web/src/lib/app-platform-flag.ts';
const CONSOLE_FLAG_SOURCE = 'apps/internal/console/src/lib/app-platform-flag.ts';
const FLAG_SOURCES = [FLAG_SOURCE, CONSOLE_FLAG_SOURCE];
const GUARDED_PAGES = [
    'apps/merchant/web/src/app/[store]/apps/page.tsx',
    'apps/merchant/web/src/app/[store]/apps/[installationId]/page.tsx',
    'apps/merchant/web/src/app/[store]/settings/apps/page.tsx',
];
// The OPERATOR plane of the same frozen seam. These drive
// /v1/operations/marketplace-reviews (writes marketplace_apps.status = published) and
// /v1/operations/developers (app_developers moderation, partner payout release), both of
// which the gateway now 404s.
const CONSOLE_GUARDED_PAGES = [
    'apps/internal/console/src/app/(dashboard)/marketplace-governance/page.tsx',
    'apps/internal/console/src/app/(dashboard)/developers/page.tsx',
];
const DEPLOY_WORKFLOWS = [
    '.github/workflows/production-deploy.yml',
    '.github/workflows/staging-deploy.yml',
];

function loadFlagModule(env, source = FLAG_SOURCE) {
    const transpiled = ts.transpileModule(readFileSync(source, 'utf8'), {
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

    for (const source of FLAG_SOURCES) {
        for (const env of denied) {
            const { isAppPlatformEnabled } = loadFlagModule(env, source);
            assert.equal(
                isAppPlatformEnabled(),
                false,
                `${source}: env ${JSON.stringify(env)} must leave the app platform DISABLED`,
            );
        }
    }
});

test('the merchant UI flag opens only on an explicit positive opt-in', () => {
    for (const source of FLAG_SOURCES) {
        for (const value of ['1', 'true', 'TRUE', ' true ', 'on', 'enabled', 'yes', 'YES']) {
            const { isAppPlatformEnabled } = loadFlagModule({ FEATURE_APP_PLATFORM: value }, source);
            assert.equal(isAppPlatformEnabled(), true, `${source}: "${value}" must be accepted as a positive opt-in`);
        }
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

test('the admin-web operator pages guard before they fetch or render', () => {
    for (const page of CONSOLE_GUARDED_PAGES) {
        const source = readFileSync(page, 'utf8');
        assert.match(
            source,
            /import \{ isAppPlatformEnabled \} from '@\/lib\/app-platform-flag'/,
            `${page} must import the fail-closed app-platform flag`,
        );
        assert.match(
            source,
            /if \(!isAppPlatformEnabled\(\)\) notFound\(\)/,
            `${page} must 404 when the app platform is disabled`,
        );
        assert.match(source, /import \{ notFound \} from 'next\/navigation'/, `${page} must import notFound`);

        const guardIndex = source.indexOf('if (!isAppPlatformEnabled()) notFound()');
        const fetchIndex = source.indexOf('fetchConsoleApi');
        const exportIndex = source.indexOf('export default async function');
        assert.ok(guardIndex > exportIndex, `${page} must place the guard inside the page component`);
        // The guard must precede the first fetch that occurs after the component starts.
        const fetchAfterExport = source.indexOf('fetchConsoleApi', exportIndex);
        if (fetchAfterExport > -1) {
            assert.ok(
                guardIndex < fetchAfterExport,
                `${page} must run the app-platform guard before calling the gateway`,
            );
        }
        assert.ok(fetchIndex > -1, `${page} is expected to talk to the gated operator API`);
    }
});

test('the admin-web flag is an exact mirror of the merchant one', () => {
    const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
    assert.equal(
        strip(readFileSync(CONSOLE_FLAG_SOURCE, 'utf8')),
        strip(readFileSync(FLAG_SOURCE, 'utf8')),
        'the two UI flag modules must have identical executable semantics — divergence is how a fail-open branch returns',
    );
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
    for (const flagSource of FLAG_SOURCES) {
        const source = readFileSync(flagSource, 'utf8');
        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        assert.doesNotMatch(code, /NODE_ENV|APP_ENV|ENVIRONMENT|VERCEL_ENV/, flagSource);
        assert.doesNotMatch(code, /FEATURE_EXTENSIONS/, flagSource);
    }
});
