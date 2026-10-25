import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'validators', 'design-system-baseline.json');

function runNode(args, env = {}) {
    return spawnSync(process.execPath, args, {
        cwd: ROOT,
        env: { ...process.env, ...env },
        encoding: 'utf8',
    });
}

test('Wave 5 design and mobile token gates pass with the committed baseline', () => {
    const design = runNode(['scripts/validators/validate-design-system.mjs']);
    assert.equal(design.status, 0, design.stderr || design.stdout);

    const mobile = runNode(['scripts/generators/generate-mobile-tokens.mjs', '--check']);
    assert.equal(mobile.status, 0, mobile.stderr || mobile.stdout);
});

test('Wave 5 ratchet fails on new arbitrary-radius drift', () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

    const stricter = {
        ...baseline,
        metrics: {
            ...baseline.metrics,
            tsxArbitraryRadius: -1,
        },
    };
    const tempBaseline = join(mkdtempSync(join(tmpdir(), 'letbuyy-wave5-design-')), 'baseline.json');
    writeFileSync(tempBaseline, JSON.stringify(stricter, null, 2));

    const result = runNode(['scripts/validators/validate-design-system.mjs'], {
        LETBUYY_DESIGN_SYSTEM_BASELINE_PATH: tempBaseline,
    });

    assert.notEqual(result.status, 0, 'validator should fail when current arbitrary-radius count exceeds baseline');
    assert.match(result.stderr, /RATCHET regression: tsxArbitraryRadius/);
});

test('Wave 5 scope exiles marketing and forbids local workspace implementations', () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    assert.deepEqual(baseline.scope.exiledApps, ['apps/marketing/web']);

    for (const file of [
        'apps/internal/console/src/components/_local-ui/console-workspace.tsx',
        'apps/frozen/operations-portal/src/components/_local-ui/ops-workspace.tsx',
    ]) {
        const text = readFileSync(join(ROOT, file), 'utf8');
        assert.match(text, /InternalWorkspace/);
        assert.doesNotMatch(text, /<(?:main|article|section)\s+className=/);
    }
});

test('identity-platform stays light-only: the validator refuses an unforced layout or a wired theme control (D-AUTH-LIGHT)', () => {
    // A copy of the validator runs against a scratch root, so the real tree is never edited. Only the
    // light-only lines are read: the scratch root lacks every other surface, which the validator also reports.
    const scratch = mkdtempSync(join(tmpdir(), 'letbuyy-light-only-'));
    const validator = join(scratch, 'scripts', 'validators', 'validate-design-system.mjs');
    const layoutPath = join(scratch, 'apps', 'platform', 'identity', 'src', 'app', 'layout.tsx');
    const pagePath = join(scratch, 'apps', 'platform', 'identity', 'src', 'app', 'login', 'page.tsx');
    mkdirSync(dirname(validator), { recursive: true });
    mkdirSync(dirname(pagePath), { recursive: true });
    copyFileSync(join(ROOT, 'scripts', 'validators', 'validate-design-system.mjs'), validator);
    copyFileSync(join(ROOT, 'scripts', 'validators', 'governance-common.mjs'), join(dirname(validator), 'governance-common.mjs'));
    const committedLayout = readFileSync(join(ROOT, 'apps', 'platform', 'identity', 'src', 'app', 'layout.tsx'), 'utf8');
    const quietPage = 'export default function Login() { return null }\n';
    const lightOnlyFailures = (layout, page) => {
        writeFileSync(layoutPath, layout);
        writeFileSync(pagePath, page);
        const result = spawnSync(process.execPath, [validator], { cwd: scratch, encoding: 'utf8' });
        return result.stderr.split('\n').filter((line) => line.includes('D-AUTH-LIGHT'));
    };
    const unforce = (layout, element) => {
        const planted = layout.replace(new RegExp(`(<${element}\\b[^>]*?)\\s+forcedTheme=["']light["']`), '$1');
        assert.notEqual(planted, layout, `the committed layout no longer passes forcedTheme="light" to <${element}>`);
        return planted;
    };

    assert.deepEqual(lightOnlyFailures(committedLayout, quietPage), []);

    for (const element of ['ThemeScript', 'LetbuyyThemeProvider']) {
        const failures = lightOnlyFailures(unforce(committedLayout, element), quietPage);
        assert.equal(failures.length, 1, failures.join('\n'));
        assert.match(failures[0], new RegExp(`<${element}> must pass forcedTheme="light"`));
    }

    const proseOnly = unforce(committedLayout, 'LetbuyyThemeProvider')
        .replace('<body', '{/* <LetbuyyThemeProvider forcedTheme="light"> */}\n      <body');
    assert.equal(lightOnlyFailures(proseOnly, quietPage).length, 1, 'a comment naming the prop must not satisfy the check');

    const wiredToggle = "import { useTheme } from '@letbuyy/ui'\nexport default function Login() { const { setTheme } = useTheme(); return <button onClick={() => setTheme('dark')} /> }\n";
    const toggleFailures = lightOnlyFailures(committedLayout, wiredToggle);
    assert.equal(toggleFailures.length, 1, toggleFailures.join('\n'));
    assert.match(toggleFailures[0], /login\/page\.tsx: wires a theme control/);

    assert.deepEqual(lightOnlyFailures(committedLayout, '// setTheme( and useAuthTheme were removed\n' + quietPage), []);
});

test('Marketplace reachability accepts the real shared toggle and rejects a removed or bespoke control', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'letbuyy-marketplace-toggle-gate-'));
    const navbarRelative = 'apps/frozen/theme-store/src/components/layout/navbar.tsx';
    const navbarPath = join(scratch, navbarRelative);
    const layoutRelative = 'apps/frozen/theme-store/src/app/layout.tsx';
    const layoutPath = join(scratch, layoutRelative);
    const validator = join(scratch, 'scripts/validators/validate-design-system.mjs');
    const navbar = readFileSync(join(ROOT, navbarRelative), 'utf8');
    const layout = readFileSync(join(ROOT, layoutRelative), 'utf8');
    try {
        for (const relative of [
            'scripts/validators/validate-design-system.mjs',
            'scripts/validators/governance-common.mjs',
            'scripts/validators/design-system-baseline.json',
            'packages/typescript/ui/src/theme-toggle-button.tsx',
            'apps/frozen/theme-store/src/app/layout.tsx',
        ]) {
            const destination = join(scratch, relative);
            mkdirSync(dirname(destination), { recursive: true });
            copyFileSync(join(ROOT, relative), destination);
        }
        mkdirSync(dirname(navbarPath), { recursive: true });
        const marketplaceFailures = (contents, providerLayout = layout) => {
            writeFileSync(navbarPath, contents);
            writeFileSync(layoutPath, providerLayout);
            const result = spawnSync(process.execPath, [validator], { cwd: scratch, encoding: 'utf8' });
            assert.match(result.stdout, /Design-system governance/, 'the actual dependency-free gate must execute');
            // Other surfaces are deliberately absent in this source-only fixture.
            return result.stderr.split('\n').filter(line => line.includes('theme-marketplace:'));
        };

        assert.deepEqual(marketplaceFailures(navbar), [], 'the actual Marketplace canonical toggle must satisfy its gate');
        const removed = navbar.replace(/<ThemeToggleButton\b[^>]*\/>/, '');
        assert.notEqual(removed, navbar, 'remove the rendered control while retaining its import');
        assert.match(marketplaceFailures(removed).join('\n'), /dark mode must be reachable through the canonical provider toggle/);

        const bespoke = "function ThemeToggle() { const { setTheme } = useTheme(); return <button onClick={() => setTheme('dark')}>Theme</button>; }";
        assert.match(marketplaceFailures(bespoke).join('\n'), /dark mode must be reachable through the canonical provider toggle/);
        assert.match(marketplaceFailures('<button aria-label="Toggle color theme" />').join('\n'), /dark mode must be reachable through the canonical provider toggle/);

        const withoutProvider = layout.replace(/<LetbuyyThemeProvider\b[^>]*>/, '').replace('</LetbuyyThemeProvider>', '');
        assert.notEqual(withoutProvider, layout, 'remove the mounted provider while retaining its import');
        assert.match(marketplaceFailures(navbar, withoutProvider).join('\n'), /dark mode must be reachable through the canonical provider toggle/);

        unlinkSync(navbarPath);
        const missing = spawnSync(process.execPath, [validator], { cwd: scratch, encoding: 'utf8' });
        assert.match(missing.stderr, /theme-marketplace: dark mode must be reachable through the canonical provider toggle/);
        writeFileSync(navbarPath, navbar);
        unlinkSync(layoutPath);
        const missingLayout = spawnSync(process.execPath, [validator], { cwd: scratch, encoding: 'utf8' });
        assert.match(missingLayout.stderr, /theme-marketplace: dark mode must be reachable through the canonical provider toggle/);
        unlinkSync(navbarPath);
        const missingBoth = spawnSync(process.execPath, [validator], { cwd: scratch, encoding: 'utf8' });
        assert.match(missingBoth.stderr, /theme-marketplace: dark-mode reachability target file is missing/);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
});
