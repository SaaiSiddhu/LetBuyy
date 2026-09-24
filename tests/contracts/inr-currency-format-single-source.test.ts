import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { formatInrCurrency } from '../../packages/typescript/ui/src/formatting';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');
const currencyFiles = [
    'apps/merchant/web/src/app/[store]/customers/page.tsx',
    'apps/merchant/web/src/app/[store]/analytics/page.tsx',
    'apps/merchant/web/src/app/[store]/dashboard/page.tsx',
    'apps/merchant/web/src/app/[store]/dashboard/DashboardClient.tsx',
    'apps/merchant/web/src/app/[store]/products/gift-cards/page.tsx',
    'apps/frozen/app-store/src/app/(store)/apps/[slug]/page.tsx',
];

function read(path: string): string {
    assert.equal(existsSync(path), true, `${path} must exist`);
    return readFileSync(path, 'utf8');
}

test('ui formatting owns India-first INR currency display behavior', () => {
    assert.equal(formatInrCurrency(1234), '₹1,234.00');
    assert.equal(formatInrCurrency(1234, { maximumFractionDigits: 0 }), '₹1,234');
    assert.equal(formatInrCurrency(1234.5, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
        requirePositive: true,
        suffix: '/mo',
    }), '₹1,234.5/mo');
    assert.equal(formatInrCurrency(0, { requirePositive: true }), null);
    assert.equal(formatInrCurrency(Number.NaN, { emptyValue: '-' }), '-');
});

test('apps import formatInrCurrency instead of declaring local formatCurrency helpers', () => {
    for (const file of currencyFiles) {
        const source = read(join(repoRoot, file));

        assert.match(source, /formatInrCurrency/);
        assert.doesNotMatch(source, /\b(?:function|const)\s+formatCurrency\b/);
    }
});

test('formatting subpath and validator are wired into governance', () => {
    const packageJson = JSON.parse(read(join(repoRoot, 'packages/typescript/ui/package.json')));
    const validator = read(join(repoRoot, 'scripts/validators/inr-currency-format-validator.mjs'));
    const governanceRunner = read(join(repoRoot, 'scripts/validate-governance.mjs'));

    assert.equal(packageJson.exports['./formatting'], './src/formatting.ts');
    assert.match(validator, /formatInrCurrency/);
    assert.match(validator, /localCurrencyOffenders/);
    assert.match(governanceRunner, /inr-currency-format-validator\.mjs/);
});
