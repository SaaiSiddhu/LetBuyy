import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    ACTIVE_SITE_TYPES,
    LEGACY_SITE_TYPES,
    isActiveSiteType,
    isLegacySiteType,
    legacySiteTypeCreationEnabled,
} from '../../packages/tenant-core/src/index';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function read(path: string): string {
    assert.equal(existsSync(path), true, `${path} must exist`);
    return readFileSync(path, 'utf8');
}

test('tenant-core classifies portfolio and resume as legacy site types', () => {
    assert.deepEqual(ACTIVE_SITE_TYPES, ['store', 'blog', 'landing']);
    assert.deepEqual(LEGACY_SITE_TYPES, ['portfolio', 'resume']);
    assert.equal(isActiveSiteType('store'), true);
    assert.equal(isActiveSiteType('portfolio'), false);
    assert.equal(isLegacySiteType('portfolio'), true);
    assert.equal(isLegacySiteType('resume'), true);
    assert.equal(isLegacySiteType('store'), false);
    assert.equal(legacySiteTypeCreationEnabled(undefined), false);
    assert.equal(legacySiteTypeCreationEnabled('false'), false);
    assert.equal(legacySiteTypeCreationEnabled('true'), true);
    assert.equal(legacySiteTypeCreationEnabled('1'), true);
});

test('gateway and identity creation paths fail closed for legacy site types by default', () => {
    const gatewayStores = read(join(repoRoot, 'services/api-gateway/src/routes/stores.ts'));
    const gatewayOnboarding = read(join(repoRoot, 'services/api-gateway/src/routes/onboarding.ts'));
    const identityCreateStore = read(join(repoRoot, 'apps/identity-platform/src/app/api/auth/create-store/route.ts'));

    assert.match(gatewayStores, /isLegacySiteType\(body\.site_type\)[\s\S]{0,140}legacySiteTypeCreationAllowed/);
    assert.match(gatewayStores, /LEGACY_SITE_TYPE_DISABLED/);
    assert.match(gatewayOnboarding, /isLegacySiteType\(body\.site_type\)[\s\S]{0,140}legacySiteTypeCreationAllowed/);
    assert.match(gatewayOnboarding, /isLegacySiteType\(nextSiteType\)[\s\S]{0,160}legacySiteTypeCreationAllowed/);
    assert.match(gatewayOnboarding, /isLegacySiteType\(attemptSiteType\)[\s\S]{0,160}legacySiteTypeCreationAllowed/);
    assert.match(gatewayOnboarding, /isLegacySiteType\(siteType\)[\s\S]{0,160}success\(\[\]\)/);
    assert.match(identityCreateStore, /ACTIVE_SITE_TYPES = \['store', 'landing', 'blog'\]/);
    assert.match(identityCreateStore, /LEGACY_SITE_TYPES = \['portfolio', 'resume'\]/);
    assert.match(identityCreateStore, /legacySiteTypesEnabled/);
});

test('public acquisition surfaces hide portfolio and resume unless the legacy flag is enabled', () => {
    const identityOnboarding = read(join(repoRoot, 'apps/identity-platform/src/app/onboarding/page.tsx'));
    const marketingCreate = read(join(repoRoot, 'apps/marketing-site/src/app/create/page.tsx'));
    const marketingSiteTypes = read(join(repoRoot, 'apps/marketing-site/src/components/SiteTypes.tsx'));

    const defaultIdentityTypes = identityOnboarding.match(/const SITE_TYPES:[\s\S]*?\]\n\nconst LEGACY_SITE_TYPES/);
    assert.ok(defaultIdentityTypes);
    assert.doesNotMatch(defaultIdentityTypes[0], /portfolio|resume/);
    assert.match(identityOnboarding, /NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES/);
    assert.match(identityOnboarding, /ACQUISITION_SITE_TYPES/);

    const marketingCreateFlagIndex = marketingCreate.indexOf('NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES');
    assert.notEqual(marketingCreateFlagIndex, -1);
    assert.ok(marketingCreate.indexOf('portfolio') > marketingCreateFlagIndex);
    assert.ok(marketingCreate.indexOf('resume') > marketingCreateFlagIndex);

    const siteTypesFlagIndex = marketingSiteTypes.indexOf('NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES');
    assert.notEqual(siteTypesFlagIndex, -1);
    assert.ok(marketingSiteTypes.indexOf("id: 'portfolio'") > siteTypesFlagIndex);
    assert.ok(marketingSiteTypes.indexOf("id: 'resume'") > siteTypesFlagIndex);
});

test('legacy site-type status is documented and validator-guarded', () => {
    const featureFlagGovernance = read(join(repoRoot, 'docs/governance/feature-flag-governance.md'));
    const domainGovernance = read(join(repoRoot, 'docs/governance/domain-governance.md'));
    const developerSurface = read(join(repoRoot, 'apps/developer-portal/src/lib/developer-surface.ts'));
    const validator = read(join(repoRoot, 'scripts/validators/legacy-site-type-validator.mjs'));
    const governanceRunner = read(join(repoRoot, 'scripts/validate-governance.mjs'));

    assert.match(featureFlagGovernance, /LETBUYY_ENABLE_LEGACY_SITE_TYPES/);
    assert.match(domainGovernance, /Legacy Site-Type Rule/);
    assert.match(developerSurface, /legacy site types only/);
    assert.match(validator, /Default marketing source must not advertise legacy portfolio\/resume acquisition/);
    assert.match(governanceRunner, /legacy-site-type-validator\.mjs/);
});
