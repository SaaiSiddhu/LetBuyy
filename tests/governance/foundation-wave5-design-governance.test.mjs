import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
    assert.deepEqual(baseline.scope.exiledApps, ['apps/marketing-site']);

    for (const file of [
        'apps/admin_web/src/components/_local-ui/console-workspace.tsx',
        'apps/platform-operations-portal/src/components/_local-ui/ops-workspace.tsx',
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
    const layoutPath = join(scratch, 'apps', 'identity-platform', 'src', 'app', 'layout.tsx');
    const pagePath = join(scratch, 'apps', 'identity-platform', 'src', 'app', 'login', 'page.tsx');
    mkdirSync(dirname(validator), { recursive: true });
    mkdirSync(dirname(pagePath), { recursive: true });
    copyFileSync(join(ROOT, 'scripts', 'validators', 'validate-design-system.mjs'), validator);
    const committedLayout = readFileSync(join(ROOT, 'apps', 'identity-platform', 'src', 'app', 'layout.tsx'), 'utf8');
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
