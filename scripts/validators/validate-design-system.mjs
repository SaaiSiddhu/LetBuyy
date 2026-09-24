#!/usr/bin/env node
/**
 * validate-design-system.mjs — the design-system governance gate.
 *
 * This is the CI-enforced complement to the @letbuyy/ui ESLint plugin (which
 * governs .ts/.tsx) and stylelint (which governs .css through `pnpm run lint:css`).
 * It remains dependency-free (pure Node) so the governance gate can run even
 * before dependency installation.
 *
 * It enforces two classes of rule:
 *
 *   HARD invariants (must be ZERO — these are the guarantees Phase 1A/1B established):
 *     • apps must wrap their root in <LetbuyyThemeProvider>, never <DesignSystemRoot> directly
 *     • no theme="auto" in app layouts (the provider always feeds a resolved theme)
 *     • no legacy persistence keys: letbuyy_theme, theme-marketplace-theme, theme (bare)
 *     • no bespoke theme-provider files in apps (single provider lives in @letbuyy/ui)
 *
 *   RATCHET invariants (baselined in design-system-baseline.json — counts may only
 *   go DOWN; any increase fails CI). These cover the pre-existing CSS/TSX drift
 *   that is being burned down (raw hex / naked rgb()/hsl() / Tailwind-palette
 *   classes / app-local --lb-* redefinitions / raw px font-size / raw px spacing /
 *   inline styles / arbitrary radius-shadow classes).
 *
 * Scope:
 *   Themable surfaces are app source TS/TSX/CSS files, except apps/marketing/web,
 *   which is intentionally exiled from the Wave 5 score until a product-owned token
 *   migration decision is made.
 *
 * Usage:
 *   node scripts/validators/validate-design-system.mjs            # check (CI)
 *   node scripts/validators/validate-design-system.mjs --update   # refresh the ratchet baseline
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APPS_DIR = join(ROOT, 'apps');
const DEFAULT_BASELINE_PATH = join(ROOT, 'scripts', 'validators', 'design-system-baseline.json');
const BASELINE_PATH = process.env.LETBUYY_DESIGN_SYSTEM_BASELINE_PATH || DEFAULT_BASELINE_PATH;
const UPDATE = process.argv.includes('--update');

/** Directories that are allowed to declare raw values (the token source-of-truth). */
const TOKEN_LAYER = [
    'packages/typescript/ui',
    'config/tailwind',
];

const EXILED_APP_ROOTS = new Set(['apps/marketing/web']);
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'build', 'coverage', 'storybook-screenshots', '.git']);

function walk(dir, exts, out = []) {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir)) {
        if (SKIP_DIRS.has(entry)) continue;
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) walk(full, exts, out);
        else if (exts.some((e) => entry.endsWith(e))) out.push(full);
    }
    return out;
}

const rel = (p) => relative(ROOT, p).split('\\').join('/');
const isExiledAppFile = (filePath) => {
    const normalized = rel(filePath);
    return [...EXILED_APP_ROOTS].some((root) => normalized === root || normalized.startsWith(`${root}/`));
};

// ── Collect target files ──────────────────────────────────────────────────────
const cssFiles = walk(APPS_DIR, ['.css']).filter((f) => !isExiledAppFile(f));
const appSourceFiles = walk(APPS_DIR, ['.tsx', '.ts']).filter((f) => !isExiledAppFile(f));
const tsxSurfaceFiles = appSourceFiles.filter((f) => f.endsWith('.tsx'));
const layoutFiles = appSourceFiles.filter((f) => /\/app\/layout\.tsx$/.test(rel(f)));
const localWorkspaceFiles = [
    // D-APP-LAYOUT paths. The first entry named 'admin-web' (a dash, a folder that never existed) from
    // Phase M until 2026-09-24, so existsSync dropped it and the console's workspace went unchecked.
    join(ROOT, 'apps', 'internal', 'console', 'src', 'components', '_local-ui', 'console-workspace.tsx'),
    join(ROOT, 'apps', 'frozen', 'operations-portal', 'src', 'components', '_local-ui', 'ops-workspace.tsx'),
].filter(existsSync);
const darkModeReachabilityTargets = [
    {
        surface: 'customer-web',
        files: ['apps/commerce/web/src/app/storefront-landing.tsx'],
        patterns: [/<ThemeToggleButton\b/],
    },
    {
        surface: 'marketing-site',
        files: ['apps/marketing/web/src/components/Header.tsx'],
        patterns: [/<ThemeToggleButton\b/],
    },
    {
        surface: 'app-marketplace',
        files: ['apps/frozen/app-store/src/components/Header.tsx'],
        patterns: [/<ThemeToggleButton\b/],
    },
    {
        surface: 'developer-portal',
        files: ['apps/frozen/developer-portal/src/components/PortalShell.tsx', 'apps/frozen/developer-portal/src/components/PortalChrome.tsx'],
        patterns: [/<ThemeToggleButton\b/],
    },
    {
        surface: 'theme-marketplace',
        files: ['apps/frozen/theme-store/src/components/layout/navbar.tsx'],
        patterns: [/function ThemeToggle\(/, /setTheme\(/],
    },
    {
        surface: 'admin-web',
        files: ['apps/internal/console/src/app/(dashboard)/layout.tsx'],
        patterns: [/<ThemeToggleButton\b/],
    },
    {
        surface: 'platform-operations-portal',
        files: ['apps/frozen/operations-portal/src/app/(dashboard)/layout.tsx'],
        patterns: [/<ThemeToggleButton\b/],
    },
];
// Light-only surfaces (OWNER_DECISION D-AUTH-LIGHT, 2026-09-23): identity-platform forces the light theme
// and offers no theme control, so it is the one canonical app outside UX-R13's dark-mode reachability.
// The root layout must force light on BOTH the pre-paint ThemeScript and the provider (either alone
// leaves a dark first paint or a dark tree under a dark OS preference), and no source may wire a theme
// control, which under a forced theme would be a button that does nothing. Comments are stripped first,
// so prose naming the props cannot satisfy the check.
const forcedLightSurfaces = [
    {
        surface: 'identity-platform',
        layout: 'apps/platform/identity/src/app/layout.tsx',
        sourceRoot: 'apps/platform/identity/src',
    },
];
const stripComments = (text) => text
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

// ── Regexes ───────────────────────────────────────────────────────────────────
const HEX = /(^|[^\w-])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/;
const TAILWIND_PALETTE = /\b(?:bg|text|border|ring|ring-offset|divide|outline|fill|stroke|from|via|to|placeholder|caret|accent|decoration|shadow)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-(?:50|100|200|300|400|500|600|700|800|900|950))?\b/;
const NAKED_RGB = /(?:color|background(?:-color)?|border(?:-[a-z]+)?|box-shadow|fill|stroke|outline(?:-color)?)\s*:\s*[^;{}]*\b(?:rgba?|hsla?)\(/;
const LB_REDEFINE = /--lb-[a-z0-9-]+\s*:/i;
const PX_FONT = /font-size\s*:\s*\d+px/;
const PX_SPACE = /\b(?:padding|margin|gap)(?:-(?:top|right|bottom|left|inline|block))?\s*:\s*\d+px/;
const INLINE_STYLE = /\bstyle\s*=\s*\{\s*\{/;
const ARBITRARY_RADIUS = /\brounded-\[[^\]]+\]/;
const ARBITRARY_SHADOW = /\bshadow-\[[^\]]+\]/;

function countMatches(files, re, perLine = true) {
    let n = 0;
    const samples = [];
    for (const f of files) {
        const text = readFileSync(f, 'utf8');
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
            const m = lines[i].match(g);
            if (m) {
                n += m.length;
                if (samples.length < 3) samples.push(`${rel(f)}:${i + 1}`);
            }
        }
    }
    return { n, samples };
}

// ── HARD invariants ─────────────────────────────────────────────────────────--
const hard = [];
for (const f of layoutFiles) {
    const t = readFileSync(f, 'utf8');
    if (/<DesignSystemRoot\b/.test(t)) hard.push(`${rel(f)}: app layout uses <DesignSystemRoot> directly — wrap in <LetbuyyThemeProvider> instead`);
    if (/theme=["']auto["']/.test(t)) hard.push(`${rel(f)}: theme="auto" found — the provider must feed a resolved theme`);
}
const legacyKeyHits = countMatches(appSourceFiles, /letbuyy_theme|theme-marketplace-theme/);
if (legacyKeyHits.n > 0) hard.push(`legacy theme storage key(s) found (${legacyKeyHits.n}) e.g. ${legacyKeyHits.samples.join(', ')} — use the canonical "letbuyy-theme" via @letbuyy/ui useTheme()`);
const bespokeProviders = appSourceFiles.filter((f) => /theme-?provider/i.test(rel(f)) && /createContext/.test(readFileSync(f, 'utf8')));
for (const f of bespokeProviders) hard.push(`${rel(f)}: bespoke theme provider — the single provider is @letbuyy/ui LetbuyyThemeProvider`);
const localWorkspaceImplementations = localWorkspaceFiles.filter((f) => {
    const t = readFileSync(f, 'utf8');
    return /<(?:main|article|section)\s+className=/.test(t);
});
for (const f of localWorkspaceImplementations) hard.push(`${rel(f)}: local workspace shell implementation found — use @letbuyy/ui internal workspace primitives`);
const sharedThemeToggle = join(ROOT, 'packages', 'typescript', 'ui', 'src', 'theme-toggle-button.tsx');
if (!existsSync(sharedThemeToggle)) {
    hard.push('packages/typescript/ui/src/theme-toggle-button.tsx: shared reachable dark-mode toggle is missing');
} else {
    const toggleText = readFileSync(sharedThemeToggle, 'utf8');
    if (!/aria-label=\{label\}/.test(toggleText)) hard.push('packages/typescript/ui/src/theme-toggle-button.tsx: toggle must expose an accessible aria-label');
    if (!/title=\{label\}/.test(toggleText)) hard.push('packages/typescript/ui/src/theme-toggle-button.tsx: toggle must expose a hover title');
    if (!/min-h-11/.test(toggleText) || !/min-w-11/.test(toggleText)) hard.push('packages/typescript/ui/src/theme-toggle-button.tsx: toggle must keep a 44px touch target');
}
for (const target of darkModeReachabilityTargets) {
    const texts = target.files
        .map((file) => join(ROOT, file))
        .filter(existsSync)
        .map((file) => readFileSync(file, 'utf8'))
        .join('\n');
    if (!texts) {
        hard.push(`${target.surface}: dark-mode reachability target file is missing`);
        continue;
    }
    const missing = target.patterns.filter((pattern) => !pattern.test(texts));
    if (missing.length > 0) {
        hard.push(`${target.surface}: dark mode must be reachable through the canonical provider toggle`);
    }
}
for (const target of forcedLightSurfaces) {
    const layoutPath = join(ROOT, target.layout);
    if (!existsSync(layoutPath)) {
        hard.push(`${target.surface}: light-only layout ${target.layout} is missing`);
        continue;
    }
    const layout = stripComments(readFileSync(layoutPath, 'utf8'));
    for (const element of ['ThemeScript', 'LetbuyyThemeProvider']) {
        if (!new RegExp(`<${element}\\b[^>]*\\bforcedTheme=["']light["']`).test(layout)) {
            hard.push(`${target.layout}: <${element}> must pass forcedTheme="light" — ${target.surface} is light-only (OWNER_DECISION D-AUTH-LIGHT)`);
        }
    }
    for (const file of walk(join(ROOT, target.sourceRoot), ['.tsx', '.ts'])) {
        if (/<ThemeToggleButton\b|\bsetTheme\(|\btoggleTheme\b|\buseAuthTheme\b/.test(stripComments(readFileSync(file, 'utf8')))) {
            hard.push(`${rel(file)}: wires a theme control, but ${target.surface} is light-only (OWNER_DECISION D-AUTH-LIGHT)`);
        }
    }
}

// ── RATCHET metrics ─────────────────────────────────────────────────────────--
const metrics = {
    appCssRawHex: countMatches(cssFiles, HEX).n,
    appCssNakedRgbHsl: countMatches(cssFiles, NAKED_RGB).n,
    tailwindPaletteClasses: countMatches([...cssFiles, ...appSourceFiles], TAILWIND_PALETTE).n,
    appLocalLbTokenRedefs: countMatches(cssFiles, LB_REDEFINE).n,
    rawPxFontSize: countMatches(cssFiles, PX_FONT).n,
    rawPxSpacing: countMatches(cssFiles, PX_SPACE).n,
    tsxInlineStyles: countMatches(tsxSurfaceFiles, INLINE_STYLE).n,
    tsxRawHex: countMatches(tsxSurfaceFiles, HEX).n,
    tsxArbitraryRadius: countMatches(tsxSurfaceFiles, ARBITRARY_RADIUS).n,
    tsxArbitraryShadow: countMatches(tsxSurfaceFiles, ARBITRARY_SHADOW).n,
    localWorkspaceImplementations: localWorkspaceImplementations.length,
};

if (UPDATE) {
    writeFileSync(
        BASELINE_PATH,
        JSON.stringify(
            {
                _comment: 'Design-system drift ratchet. Counts may only DECREASE. Regenerate with --update only when intentionally lowering.',
                generatedAt: new Date().toISOString().slice(0, 10),
                scope: {
                    themableSurfaces: 'apps/*/src/**/*.{ts,tsx,css}',
                    exiledApps: [...EXILED_APP_ROOTS],
                    inlineStyleCap: metrics.tsxInlineStyles,
                    ratchetPerWavePercent: 10,
                },
                metrics,
            },
            null,
            2,
        ) + '\n',
    );
    console.log('Updated design-system baseline:', JSON.stringify(metrics));
    process.exit(0);
}

const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).metrics : null;
const failures = [...hard];
if (!baseline) {
    failures.push('No design-system-baseline.json found. Run with --update to create it.');
} else {
    for (const [k, v] of Object.entries(metrics)) {
        const max = baseline[k] ?? 0;
        if (v > max) failures.push(`RATCHET regression: ${k} rose to ${v} (baseline ${max}). New design-system drift is not allowed; route values through --lb-* tokens.`);
    }
}

const improvements = baseline
    ? Object.entries(metrics).filter(([k, v]) => v < (baseline[k] ?? 0)).map(([k, v]) => `${k}: ${baseline[k]} → ${v}`)
    : [];

console.log('── Design-system governance ──');
console.log('HARD invariants:', hard.length === 0 ? 'OK' : `${hard.length} violation(s)`);
console.log('Ratchet metrics:', JSON.stringify(metrics));
if (improvements.length) console.log('Improvements since baseline:', improvements.join('; '));

if (failures.length) {
    console.error('\n✖ Design-system governance FAILED:');
    for (const f of failures) console.error('  - ' + f);
    console.error('\nIf you intentionally lowered drift, run: node scripts/validators/validate-design-system.mjs --update');
    process.exit(1);
}
console.log('\n✔ Design-system governance passed.');
process.exit(0);
