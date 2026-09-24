import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// F-ARCHIVEPATH-1. The `docs/archive/dead-code/storefront-runtime` segment below is PROVENANCE, not a
// current app path: it records which runtime this dead code was cut from at the time it was cut.
// Phase M Stage 6's commit af492f21 rewrote these strings to a post-rename app name while renaming
// no archive file, and this guard pointed at a directory that has never existed from then until
// F-ARCHIVEPATH-1. Do not 'fix' these paths in a rename sweep — assert against the archive as it is.

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

const archivedFiles = [
    [
        'apps/commerce/web/src/app/store/[subdomain]/product/[productId]/add-to-cart-button.tsx',
        'docs/archive/dead-code/storefront-runtime/app/product/add-to-cart-button.tsx',
    ],
    [
        'apps/commerce/web/src/components/ui/reveal.tsx',
        'docs/archive/dead-code/storefront-runtime/components/ui/reveal.tsx',
    ],
    [
        'apps/commerce/web/src/components/ui/badge.tsx',
        'docs/archive/dead-code/storefront-runtime/components/ui/badge.tsx',
    ],
    [
        'apps/commerce/web/src/components/policy-page.tsx',
        'docs/archive/dead-code/storefront-runtime/components/policy-page.tsx',
    ],
    [
        'apps/commerce/web/src/components/layout/floating-header.tsx',
        'docs/archive/dead-code/storefront-runtime/components/layout/floating-header.tsx',
    ],
    [
        'apps/commerce/web/src/components/cart-icon.tsx',
        'docs/archive/dead-code/storefront-runtime/components/cart-icon.tsx',
    ],
    [
        'apps/commerce/web/src/components/wishlist/wishlist-button.tsx',
        'docs/archive/dead-code/storefront-runtime/components/wishlist/wishlist-button.tsx',
    ],
    [
        'apps/commerce/web/src/components/coming-soon/components/shared/email-signup.tsx',
        'docs/archive/dead-code/storefront-runtime/components/coming-soon/shared/email-signup.tsx',
    ],
    [
        'apps/commerce/web/src/components/coming-soon/components/shared/powered-by.tsx',
        'docs/archive/dead-code/storefront-runtime/components/coming-soon/shared/powered-by.tsx',
    ],
    [
        'apps/commerce/web/src/components/coming-soon/components/shared/animated-background.tsx',
        'docs/archive/dead-code/storefront-runtime/components/coming-soon/shared/animated-background.tsx',
    ],
    [
        'apps/commerce/web/src/components/coming-soon/components/shared/countdown-timer.tsx',
        'docs/archive/dead-code/storefront-runtime/components/coming-soon/shared/countdown-timer.tsx',
    ],
    [
        'apps/merchant/web/src/components/plans/PlanBillingTimeline.tsx',
        'docs/archive/dead-code/merchant-control-plane/components/plans/PlanBillingTimeline.tsx',
    ],
    [
        'apps/merchant/web/src/components/plans/PlanCard.tsx',
        'docs/archive/dead-code/merchant-control-plane/components/plans/PlanCard.tsx',
    ],
    [
        'apps/merchant/web/src/components/plans/ComparePlans.tsx',
        'docs/archive/dead-code/merchant-control-plane/components/plans/ComparePlans.tsx',
    ],
    [
        'apps/merchant/web/src/components/WelcomeScreen.tsx',
        'docs/archive/dead-code/merchant-control-plane/components/WelcomeScreen.tsx',
    ],
    [
        'apps/merchant/web/src/components/SettingsSidebar.tsx',
        'docs/archive/dead-code/merchant-control-plane/components/SettingsSidebar.tsx',
    ],
    [
        'apps/frozen/app-store/src/components/HeroSection.tsx',
        'docs/archive/dead-code/app-marketplace/components/HeroSection.tsx',
    ],
    [
        'services/api-gateway/src/schemas/product.schema.ts',
        'docs/archive/dead-code/api-gateway/schemas/product.schema.ts',
    ],
    [
        'services/api-gateway/src/schemas/common.schema.ts',
        'docs/archive/dead-code/api-gateway/schemas/common.schema.ts',
    ],
    [
        'services/api-gateway/src/schemas/shipping.schema.ts',
        'docs/archive/dead-code/api-gateway/schemas/shipping.schema.ts',
    ],
] as const;

function path(relativePath: string): string {
    return join(repoRoot, relativePath);
}

function read(relativePath: string): string {
    const absolutePath = path(relativePath);
    assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
    return readFileSync(absolutePath, 'utf8');
}

test('verified TypeScript dead-source files are archived outside active source', () => {
    for (const [activePath, archivePath] of archivedFiles) {
        assert.equal(existsSync(path(activePath)), false, `${activePath} must not remain active`);
        assert.equal(existsSync(path(archivePath)), true, `${archivePath} must preserve archive provenance`);
    }
});

test('active replacements remain available after the archive move', () => {
    assert.equal(
        existsSync(path('apps/merchant/web/src/components/settings/SettingsShell.tsx')),
        true,
    );
    assert.equal(
        existsSync(path('apps/commerce/web/src/app/store/[subdomain]/product/[productId]/product-details-client.tsx')),
        true,
    );
    assert.equal(existsSync(path('services/api-gateway/src/routes/products.ts')), true);
});

test('TypeScript dead-source validator is wired into governance', () => {
    const validator = read('scripts/validators/typescript-dead-source-validator.mjs');
    const domainBoundaryValidator = read('scripts/validators/domain-boundary-validator.mjs');
    const governanceRunner = read('scripts/validate-governance.mjs');

    assert.match(validator, /verified TypeScript dead-source files/);
    assert.match(validator, /SettingsShell/);
    assert.match(validator, /product-details-client/);
    assert.match(domainBoundaryValidator, /archivedSchemaFacades/);
    assert.match(domainBoundaryValidator, /Dead schema facade must stay archived outside active source/);
    assert.match(governanceRunner, /typescript-dead-source-validator\.mjs/);
});
