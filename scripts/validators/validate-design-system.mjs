#!/usr/bin/env node
/**
 * validate-design-system.mjs — the design-system governance gate.
 *
 * This is the CI-enforced complement to the @letbuyy/ui ESLint plugin (which
 * governs .ts/.tsx) and the dormant stylelint config (which governs .css once a
 * human installs the stylelint binary — see docs/governance/skipped-human-decisions.md).
 * It is dependency-free (pure Node) so it runs under `pnpm install --frozen-lockfile`
 * without a lockfile change.
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
 *   go DOWN; any increase fails CI). These cover the pre-existing CSS drift that is
 *   being burned down (raw hex / naked rgb()/hsl() / Tailwind-palette classes /
 *   app-local --lb-* redefinitions / raw px font-size / raw px spacing).
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
const BASELINE_PATH = join(ROOT, 'scripts', 'validators', 'design-system-baseline.json');
const UPDATE = process.argv.includes('--update');

/** Directories that are allowed to declare raw values (the token source-of-truth). */
const TOKEN_LAYER = [
    'packages/typescript/ui',
    'config/tailwind',
];

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
const isMobileMerchant = false; // web only

// ── Collect target files ──────────────────────────────────────────────────────
const cssFiles = walk(APPS_DIR, ['.css']);
const tsxFiles = walk(APPS_DIR, ['.tsx', '.ts']);
const layoutFiles = tsxFiles.filter((f) => /\/app\/layout\.tsx$/.test(rel(f)));

// ── Regexes ───────────────────────────────────────────────────────────────────
const HEX = /(^|[^\w-])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/;
const TAILWIND_PALETTE = /\b(?:bg|text|border|ring|ring-offset|divide|outline|fill|stroke|from|via|to|placeholder|caret|accent|decoration|shadow)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-(?:50|100|200|300|400|500|600|700|800|900|950))?\b/;
const NAKED_RGB = /(?:color|background(?:-color)?|border(?:-[a-z]+)?|box-shadow|fill|stroke|outline(?:-color)?)\s*:\s*[^;{}]*\b(?:rgba?|hsla?)\(/;
const LB_REDEFINE = /--lb-[a-z0-9-]+\s*:/i;
const PX_FONT = /font-size\s*:\s*\d+px/;
const PX_SPACE = /\b(?:padding|margin|gap)(?:-(?:top|right|bottom|left|inline|block))?\s*:\s*\d+px/;

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
const legacyKeyHits = countMatches(tsxFiles, /letbuyy_theme|theme-marketplace-theme/);
if (legacyKeyHits.n > 0) hard.push(`legacy theme storage key(s) found (${legacyKeyHits.n}) e.g. ${legacyKeyHits.samples.join(', ')} — use the canonical "letbuyy-theme" via @letbuyy/ui useTheme()`);
const bespokeProviders = tsxFiles.filter((f) => /theme-?provider/i.test(rel(f)) && /createContext/.test(readFileSync(f, 'utf8')));
for (const f of bespokeProviders) hard.push(`${rel(f)}: bespoke theme provider — the single provider is @letbuyy/ui LetbuyyThemeProvider`);

// ── RATCHET metrics ─────────────────────────────────────────────────────────--
const metrics = {
    appCssRawHex: countMatches(cssFiles, HEX).n,
    appCssNakedRgbHsl: countMatches(cssFiles, NAKED_RGB).n,
    tailwindPaletteClasses: countMatches([...cssFiles, ...tsxFiles], TAILWIND_PALETTE).n,
    appLocalLbTokenRedefs: countMatches(cssFiles, LB_REDEFINE).n,
    rawPxFontSize: countMatches(cssFiles, PX_FONT).n,
    rawPxSpacing: countMatches(cssFiles, PX_SPACE).n,
};

if (UPDATE) {
    writeFileSync(
        BASELINE_PATH,
        JSON.stringify(
            { _comment: 'Design-system drift ratchet. Counts may only DECREASE. Regenerate with --update only when intentionally lowering.', generatedAt: new Date().toISOString().slice(0, 10), metrics },
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
