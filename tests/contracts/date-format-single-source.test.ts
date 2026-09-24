import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    formatDisplayDate,
    formatIndiaDate,
    formatIndiaDateTime,
    formatIndiaDateWithTime,
    formatIndiaDayMonthTime,
    formatUsLongDate,
    formatUsShortDate,
} from '../../packages/typescript/ui/src/formatting';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function read(relativePath: string): string {
    const absolutePath = join(repoRoot, relativePath);
    assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
    return readFileSync(absolutePath, 'utf8');
}

test('ui formatting owns shared date display behavior', () => {
    const value = '2026-06-06T12:34:00.000Z';

    assert.equal(formatIndiaDate(value), '6 Jun 2026');
    assert.equal(formatUsShortDate(value), 'Jun 6, 2026');
    assert.equal(formatUsLongDate(value), 'June 6, 2026');
    assert.equal(formatIndiaDate(null, { emptyValue: 'No expiry' }), 'No expiry');
    assert.equal(formatDisplayDate('not-a-date', { invalidValue: 'Invalid' }), 'Invalid');
    assert.match(formatIndiaDateWithTime(value), /6 Jun 2026/);
    assert.match(formatIndiaDayMonthTime(value), /6 Jun/);
    assert.match(formatIndiaDateTime(value), /6 Jun 2026/);
});

test('apps do not declare local date display formatter helpers', () => {
    const offenders = [
        'apps/merchant/web/src/app/[store]/orders/page.tsx',
        'apps/merchant/web/src/app/[store]/settings/billing/page.tsx',
        'apps/merchant/web/src/app/[store]/settings/plan/page.tsx',
        'apps/internal/console/src/lib/console-api.ts',
        'apps/frozen/operations-portal/src/app/(dashboard)/operations/onboarding/page.tsx',
        'apps/frozen/app-store/src/app/(store)/apps/[slug]/page.tsx',
    ].filter((file) => /\b(?:function|const)\s+format(?:Short)?Date(?:Time)?\b/.test(read(file)));

    assert.deepEqual(offenders, []);
});

test('date format validator is wired into governance', () => {
    const validator = read('scripts/validators/date-format-validator.mjs');
    const governanceRunner = read('scripts/validate-governance.mjs');

    assert.match(validator, /formatDisplayDate/);
    assert.match(validator, /localDateFormatterOffenders/);
    assert.match(governanceRunner, /date-format-validator\.mjs/);
});
