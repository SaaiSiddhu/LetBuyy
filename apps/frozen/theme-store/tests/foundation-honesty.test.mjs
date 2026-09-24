import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(testDir, '..', '..', '..', '..');
const appRoot = join(repoRoot, 'apps', 'frozen', 'theme-store');
const srcRoot = join(appRoot, 'src');

function walkSource(dir) {
    return readdirSync(dir).flatMap((entry) => {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) return walkSource(fullPath);
        return /\.(ts|tsx|js|jsx)$/.test(entry) ? [fullPath] : [];
    });
}

function readAppFile(pathFromAppRoot) {
    return readFileSync(join(appRoot, pathFromAppRoot), 'utf8');
}

test('shipped source has no known dead-link or fabricated metric markers', () => {
    const forbidden = [
        ['href="#"', /href=["']#["']/],
        ['SKIP marker', /\[SKIP|NEEDS BACKEND/i],
        ['fabricated 50+ metric', /50\+/],
        ['fabricated 10K+ metric', /10K\+/i],
        ['unsupported 24/7 support copy', /24\/7 support/i],
        ['unsupported 30-day refund copy', /30-day money-back/i],
    ];

    const failures = [];
    for (const file of walkSource(srcRoot)) {
        const source = readFileSync(file, 'utf8');
        for (const [label, pattern] of forbidden) {
            if (pattern.test(source)) {
                failures.push(`${relative(repoRoot, file)}: ${label}`);
            }
        }
    }

    assert.deepEqual(failures, []);
});

test('theme commerce and policy surfaces expose working dev defaults instead of pending placeholders', () => {
    const checkedFiles = [
        ...walkSource(srcRoot),
        join(repoRoot, 'services', 'api-gateway', 'src', 'routes', 'themes.ts'),
        join(repoRoot, 'services', 'api-gateway', 'src', 'lib', 'theme-marketplace-auxiliary-routes.ts'),
    ].filter((file) => existsSync(file));
    const forbidden = [
        ['pending storage marker', /pending_storage/i],
        ['pending scanner marker', /pending_live_scanner/i],
        ['pending human sign-off marker', /pending_human_sign_off/i],
        ['unconfigured theme payment copy', /Theme payments are not configured/i],
        ['unconfigured theme coupon copy', /Theme coupons are not configured/i],
        ['provider-confirmed tax copy', /Confirmed by provider/i],
        ['draft policy eyebrow', /Draft policy/i],
        ['legal approval blocker copy', /legal approval before production/i],
        ['receipt pending copy', /Receipt pending|Pending receipt issue/i],
    ];

    const failures = [];
    for (const file of checkedFiles) {
        const source = readFileSync(file, 'utf8');
        for (const [label, pattern] of forbidden) {
            if (pattern.test(source)) {
                failures.push(`${relative(repoRoot, file)}: ${label}`);
            }
        }
    }

    assert.deepEqual(failures, []);
});

test('footer routes exist for every newly wired legal and support destination', () => {
    const requiredRoutes = [
        'src/app/about/page.tsx',
        'src/app/support/page.tsx',
        'src/app/contact/page.tsx',
        'src/app/docs/page.tsx',
        'src/app/docs/api/page.tsx',
        'src/app/developer/page.tsx',
        'src/app/dashboard/favorites/page.tsx',
        'src/app/themes/compare/page.tsx',
        'src/app/legal/privacy/page.tsx',
        'src/app/legal/terms/page.tsx',
        'src/app/legal/refund/page.tsx',
        'src/app/legal/license/page.tsx',
    ];

    assert.deepEqual(
        requiredRoutes.filter((route) => !existsSync(join(appRoot, route))),
        [],
    );
});

test('navbar search submits to the real themes query and notification polling is not shipped', () => {
    const navbar = readAppFile('src/components/layout/navbar.tsx');

    assert.match(navbar, /\/themes\?q=/);
    assert.doesNotMatch(navbar, /api\/notifications\/count/);
    assert.match(navbar, /\/themes\?sort=popular/);
});

test('catalog page exposes backend-supported filters and keeps pagination URL-backed', () => {
    const catalog = readAppFile('src/app/themes/page.tsx');

    assert.match(catalog, /LAYOUT_OPTIONS/);
    assert.match(catalog, /price_min/);
    assert.match(catalog, /price_max/);
    assert.doesNotMatch(catalog, /unsupportedFilterCount/);
    assert.match(catalog, /offset/);
    assert.match(catalog, /pageNumbers/);
    assert.match(catalog, /Showing \{pageStart\}-\{pageEnd\} of \{themeTotal\} themes/);
});

test('preview, review, saved-search, report, refund, download, and developer controls are wired to real service methods', () => {
    const detail = readAppFile('src/app/themes/[slug]/page.tsx');
    const card = readAppFile('src/components/theme-card.tsx');
    const catalog = readAppFile('src/app/themes/page.tsx');
    const purchases = readAppFile('src/app/dashboard/purchases/page.tsx');
    const downloads = readAppFile('src/app/dashboard/downloads/page.tsx');
    const developer = readAppFile('src/app/developer/page.tsx');
    const service = readAppFile('src/lib/theme-service.ts');

    assert.match(detail, /createThemePreviewSession/);
    assert.match(detail, /Preview in your store/);
    assert.match(detail, /createThemeReview/);
    assert.match(detail, /reportTheme/);
    assert.match(catalog, /createSavedSearch/);
    assert.match(purchases, /requestThemeRefund/);
    assert.match(card, /ThemePreferenceActions/);
    assert.doesNotMatch(card, /Preview theme/);
    assert.match(card, /View details/);
    assert.match(downloads, /getThemeDownloads/);
    assert.match(developer, /createDeveloperListing/);
    assert.match(service, /getThemeReviews/);
    assert.match(service, /rollbackThemeRelease/);
    assert.match(service, /createSavedSearch/);
    assert.match(service, /reportTheme/);
    assert.match(service, /requestThemeRefund/);
});

test('UI completion routes and chrome avoid false affordances', () => {
    const requiredRoutes = [
        'src/app/preview/[token]/page.tsx',
        'src/app/themes/category/[category]/page.tsx',
        'src/app/developer/listings/new/page.tsx',
    ];
    const catalog = readAppFile('src/app/themes/page.tsx');
    const detail = readAppFile('src/app/themes/[slug]/page.tsx');

    assert.deepEqual(
        requiredRoutes.filter((route) => !existsSync(join(appRoot, route))),
        [],
    );
    assert.match(catalog, /data-testid="mobile-theme-filter-sheet"/);
    assert.doesNotMatch(catalog, /Open developer console/);
    assert.match(detail, /ThemeLiveDemoEmbed/);
    assert.match(detail, /ThemeQualityFacts/);

    for (const file of ['src/app/page.tsx', 'src/app/dashboard/page.tsx', 'src/components/layout/navbar.tsx']) {
        assert.doesNotMatch(readAppFile(file), /<img\b/);
    }
});

test('GA closure surfaces do not expose old preview or measurement placeholders', () => {
    const checkedFiles = [
        'src/components/theme-detail-experience.tsx',
        'src/app/page.tsx',
        'src/lib/theme-catalog.ts',
        'src/app/themes/page.tsx',
        'src/app/themes/[slug]/page.tsx',
        'src/app/collections/[slug]/page.tsx',
        'src/app/authors/[handle]/page.tsx',
    ].map((file) => join(appRoot, file));
    const seedFiles = [
        join(repoRoot, 'database', 'supabase', 'seeds', 'theme-marketplace-sample-catalog.sql'),
        join(repoRoot, 'database', 'supabase', 'seeds', 'urban-kicks-theme.sql'),
    ];
    const forbidden = [
        ['unmeasured score copy', /Not yet measured|Measurement awaits|measurement_required_in_ci/i],
        ['SVG preview reference', /\/previews\/[^'")\s]+\.svg/i],
        ['old shared banner preview', /\/images\/banners\/new-arrivals-1\.png/i],
        ['old urban demo route', /\/store\/urban-kicks-demo/i],
        ['old dev-default marker', /dev_default/i],
    ];
    const failures = [];

    for (const file of [...checkedFiles, ...seedFiles].filter((candidate) => existsSync(candidate))) {
        const source = readFileSync(file, 'utf8');
        for (const [label, pattern] of forbidden) {
            if (pattern.test(source)) {
                failures.push(`${relative(repoRoot, file)}: ${label}`);
            }
        }
    }

    assert.deepEqual(failures, []);
});
