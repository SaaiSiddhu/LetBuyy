import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

const deadTwins = [
    'Navbar.tsx',
    'HeroSection.tsx',
    'FeaturesSection.tsx',
    'PricingSection.tsx',
    'TestimonialsSection.tsx',
    'Testimonials.tsx',
    'CTASection.tsx',
    'SocialProof.tsx',
    'Capabilities.tsx',
];

function read(relativePath: string): string {
    const absolutePath = join(repoRoot, relativePath);
    assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
    return readFileSync(absolutePath, 'utf8');
}

test('marketing dead twin components are archived outside active source', () => {
    for (const file of deadTwins) {
        assert.equal(
            existsSync(join(repoRoot, 'apps/marketing-site/src/components', file)),
            false,
            `${file} must not exist under active marketing components`,
        );
        assert.equal(
            existsSync(join(repoRoot, 'docs/archive/dead-code/marketing-site/components', file)),
            true,
            `${file} must be preserved in the dead-code archive`,
        );
    }
});

test('marketing homepage keeps importing only the live component family', () => {
    const pagePath = existsSync(join(repoRoot, 'apps/marketing-site/src/app/[locale]/page.tsx'))
        ? 'apps/marketing-site/src/app/[locale]/page.tsx'
        : 'apps/marketing-site/src/app/page.tsx';
    const source = read(pagePath);

    for (const liveComponent of [
        'Header',
        'Hero',
        'CapabilityMap',
        'MerchantJourney',
        'Features',
        'Pricing',
        'FAQ',
        'EcosystemMap',
        'FinalCTA',
        'Footer',
    ]) {
        assert.match(source, new RegExp(`@/components/${liveComponent}`));
    }

    for (const deadComponent of [
        'Navbar',
        'HeroSection',
        'FeaturesSection',
        'PricingSection',
        'TestimonialsSection',
        'Testimonials',
        'CTASection',
        'SocialProof',
        'Capabilities',
    ]) {
        assert.doesNotMatch(source, new RegExp(`@/components/${deadComponent}`));
    }
});

test('marketing dead-twin validator is wired into governance', () => {
    const validator = read('scripts/validators/marketing-dead-twin-validator.mjs');
    const governanceRunner = read('scripts/validate-governance.mjs');

    assert.match(validator, /marketing-site dead twin components/);
    assert.match(governanceRunner, /marketing-dead-twin-validator\.mjs/);
});
