/**
 * Phase Z — Theme Markets & Localization: static-contract tests for Lane B
 * (merchant-control-plane translation editor UI).
 *
 * Verifies source-level contracts (file existence, import patterns, ARIA/a11y
 * markers, design-ratchet compliance, India-first invariants, RISK-DUAL-N01
 * isolation, tenancy, translation write path) without spinning up Next.js
 * or hitting the gateway/DB.
 *
 * Test style mirrors theme-editor-r/s/t/u/v/w/x/y.test.mjs:
 *  - node:test + node:assert/strict
 *  - readFileSync source assertions
 *  - structural/pattern checks only; no network, no DOM, no React render
 *
 * PHASE Z HARD RULES verified here (Lane B only — theme-engine Lane A is tested
 * separately in tests/localization/theme-localization.test.mjs):
 *
 * ── India-first law ───────────────────────────────────────────────────────────
 *  - LocaleSwitcher exports DEFAULT_ADMIN_LOCALE = 'en-IN'
 *  - TranslationEditorClient initialises selectedLocale to DEFAULT_ADMIN_LOCALE
 *  - LocaleSwitcher lists SUPPORTED_ADMIN_LOCALES (en-IN is the first/default)
 *  - TranslationKeyList uses DEFAULT_ADMIN_LOCALE as reference for missing-key detection
 *  - Missing-key indicator: key in en-IN but absent in selected locale
 *
 * ── RISK-DUAL-N01 ────────────────────────────────────────────────────────────
 *  - TranslationValueEditor writes to resource_type: 'theme' only
 *  - TranslationValueEditor NEVER writes to section_definitions
 *  - TranslationEditorClient NEVER assigns to section_definitions
 *  - TranslationKeyList onEdit always passes resource_type: 'theme'
 *  - Default locale cannot be removed (guard documented)
 *
 * ── Tenancy law ──────────────────────────────────────────────────────────────
 *  - Translation POST proxy imports resolveOwnedStoreId
 *  - Translation PATCH/DELETE proxy imports resolveOwnedStoreId
 *  - Both proxies use createMerchantApiClient (not direct Supabase)
 *
 * ── Design ratchet ────────────────────────────────────────────────────────────
 *  - All new components import from @letbuyy/ui
 *  - All new components have no raw rounded-[Npx] Tailwind classes
 *  - CSS module uses --lb-* tokens
 *
 * ── Foreign WIP isolation ─────────────────────────────────────────────────────
 *  - No component imports from editor/page.tsx
 *  - No component imports from globals.css
 *  - No component imports from @letbuyy/api-client directly
 *  - No component imports from ExperiencePicker
 *
 * ── A11y ──────────────────────────────────────────────────────────────────────
 *  - LocaleSwitcher has aria-label / role="region"
 *  - TranslationKeyList has role="list" + aria-label
 *  - TranslationValueEditor has aria-label on save/cancel buttons
 *  - TranslationValueEditor responds to Escape key
 *  - Missing-key Badge has aria-label
 *
 * ── package.json ──────────────────────────────────────────────────────────────
 *  - theme-editor-z.test.mjs included in test command
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const ROOT = new URL('../../..', import.meta.url).pathname;

function read(rel) {
    return readFileSync(`${ROOT}/${rel}`, 'utf8');
}
function exists(rel) {
    return existsSync(`${ROOT}/${rel}`);
}

const MCP_BASE = 'apps/merchant-control-plane/src';

const LOCALE_SWITCHER        = `${MCP_BASE}/components/theme-locale/LocaleSwitcher.tsx`;
const TRANSLATION_KEY_LIST   = `${MCP_BASE}/components/theme-locale/TranslationKeyList.tsx`;
const TRANSLATION_VALUE_ED   = `${MCP_BASE}/components/theme-locale/TranslationValueEditor.tsx`;
const TRANSLATION_ED_CLIENT  = `${MCP_BASE}/app/[store]/online-store/themes/[themeId]/editor/translations/TranslationEditorClient.tsx`;
const TRANSLATIONS_PAGE      = `${MCP_BASE}/app/[store]/online-store/themes/[themeId]/editor/translations/page.tsx`;
const PROXY_TRANSLATIONS     = `${MCP_BASE}/app/api/stores/[store]/localization/translations/route.ts`;
const PROXY_TRANSLATION_ID   = `${MCP_BASE}/app/api/stores/[store]/localization/translations/[translationId]/route.ts`;
const CSS_MODULE             = `${MCP_BASE}/components/theme-locale/theme-locale.module.css`;
const PKG_JSON               = 'apps/merchant-control-plane/package.json';

// Foreign WIP files — must NOT be touched.
const EDITOR_PAGE_TSX        = `${MCP_BASE}/app/[store]/online-store/themes/[themeId]/editor/page.tsx`;

// ═══════════════════════════════════════════════════════════════════════════════
// FILE EXISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-z: LocaleSwitcher.tsx exists in theme-locale components', () => {
    assert.ok(exists(LOCALE_SWITCHER), 'LocaleSwitcher.tsx missing from components/theme-locale/');
});

test('phase-z: TranslationKeyList.tsx exists in theme-locale components', () => {
    assert.ok(exists(TRANSLATION_KEY_LIST), 'TranslationKeyList.tsx missing from components/theme-locale/');
});

test('phase-z: TranslationValueEditor.tsx exists in theme-locale components', () => {
    assert.ok(exists(TRANSLATION_VALUE_ED), 'TranslationValueEditor.tsx missing from components/theme-locale/');
});

test('phase-z: TranslationEditorClient.tsx exists alongside translations/page.tsx', () => {
    assert.ok(exists(TRANSLATION_ED_CLIENT), 'TranslationEditorClient.tsx missing from editor/translations/');
});

test('phase-z: translations/page.tsx exists as sibling route to editor/page.tsx', () => {
    assert.ok(exists(TRANSLATIONS_PAGE), 'translations/page.tsx missing — must be a sibling route to editor/page.tsx');
});

test('phase-z: editor/page.tsx is NOT modified (foreign WIP isolation)', () => {
    // The file must still exist and must not import TranslationEditorClient.
    assert.ok(exists(EDITOR_PAGE_TSX), 'editor/page.tsx must still exist');
    assert.doesNotMatch(
        read(EDITOR_PAGE_TSX),
        /TranslationEditorClient|TranslationKeyList|LocaleSwitcher/,
        'foreign-WIP editor/page.tsx must not reference Phase Z components',
    );
});

test('phase-z: translation POST proxy route exists', () => {
    assert.ok(exists(PROXY_TRANSLATIONS), 'translations/route.ts POST proxy missing');
});

test('phase-z: translation PATCH/DELETE proxy route exists', () => {
    assert.ok(exists(PROXY_TRANSLATION_ID), 'translations/[translationId]/route.ts missing');
});

test('phase-z: theme-locale.module.css exists', () => {
    assert.ok(exists(CSS_MODULE), 'theme-locale.module.css missing from components/theme-locale/');
});

// ═══════════════════════════════════════════════════════════════════════════════
// INDIA-FIRST LAW
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-z: LocaleSwitcher re-exports DEFAULT_ADMIN_LOCALE (en-IN is the default)', () => {
    assert.match(
        read(LOCALE_SWITCHER),
        /DEFAULT_ADMIN_LOCALE/,
        'LocaleSwitcher must reference DEFAULT_ADMIN_LOCALE (en-IN)',
    );
});

test('phase-z: LocaleSwitcher re-exports SUPPORTED_ADMIN_LOCALES (locale list)', () => {
    assert.match(
        read(LOCALE_SWITCHER),
        /SUPPORTED_ADMIN_LOCALES/,
        'LocaleSwitcher must reference SUPPORTED_ADMIN_LOCALES',
    );
});

test('phase-z: TranslationEditorClient initialises selectedLocale to DEFAULT_ADMIN_LOCALE (India-first)', () => {
    const src = read(TRANSLATION_ED_CLIENT);
    assert.match(
        src,
        /DEFAULT_ADMIN_LOCALE/,
        'TranslationEditorClient must use DEFAULT_ADMIN_LOCALE as the initial locale',
    );
    assert.match(
        src,
        /useState.*DEFAULT_ADMIN_LOCALE|DEFAULT_ADMIN_LOCALE.*useState/,
        'TranslationEditorClient must pass DEFAULT_ADMIN_LOCALE as the initial value to useState',
    );
});

test('phase-z: TranslationKeyList uses DEFAULT_ADMIN_LOCALE as default reference locale', () => {
    assert.match(
        read(TRANSLATION_KEY_LIST),
        /DEFAULT_ADMIN_LOCALE/,
        'TranslationKeyList must use DEFAULT_ADMIN_LOCALE as the reference for missing-key detection',
    );
});

test('phase-z: TranslationEditorClient passes defaultLocale=DEFAULT_ADMIN_LOCALE to TranslationKeyList', () => {
    assert.match(
        read(TRANSLATION_ED_CLIENT),
        /defaultLocale.*DEFAULT_ADMIN_LOCALE|DEFAULT_ADMIN_LOCALE.*defaultLocale/,
        'TranslationEditorClient must pass defaultLocale=DEFAULT_ADMIN_LOCALE to TranslationKeyList',
    );
});

test('phase-z: admin-locales.ts defines DEFAULT_ADMIN_LOCALE as en-IN', () => {
    assert.match(
        read('apps/merchant-control-plane/src/lib/i18n/admin-locales.ts'),
        /DEFAULT_ADMIN_LOCALE\s*=\s*['"]en-IN['"]/,
        'admin-locales.ts must define DEFAULT_ADMIN_LOCALE as en-IN',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// MISSING-KEY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-z: TranslationKeyList detects missing keys (key in default but absent in selected locale)', () => {
    const src = read(TRANSLATION_KEY_LIST);
    assert.match(src, /isMissing/, 'TranslationKeyList must compute isMissing for untranslated keys');
});

test('phase-z: TranslationKeyList shows a Missing badge for absent keys', () => {
    const src = read(TRANSLATION_KEY_LIST);
    assert.match(src, /Missing/, 'TranslationKeyList must show "Missing" for keys absent in selected locale');
    assert.match(src, /Badge/, 'Missing indicator must use the Badge component from @letbuyy/ui');
});

test('phase-z: TranslationKeyList missing badge has aria-label (a11y)', () => {
    assert.match(
        read(TRANSLATION_KEY_LIST),
        /aria-label.*[Mm]issing|[Mm]issing.*aria-label/,
        'Missing badge must have aria-label for screen readers',
    );
});

test('phase-z: TranslationKeyList buildLocaleMap scopes to resource_type = theme', () => {
    assert.match(
        read(TRANSLATION_KEY_LIST),
        /resource_type.*===.*['"]theme['"]|['"]theme['"].*===.*resource_type/,
        'buildLocaleMap must filter to resource_type === "theme"',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// RISK-DUAL-N01 — TRANSLATION WRITE PATH (instance data only)
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-z: TranslationValueEditor documents RISK-DUAL-N01', () => {
    assert.match(
        read(TRANSLATION_VALUE_ED),
        /RISK-DUAL-N01/,
        'TranslationValueEditor must reference RISK-DUAL-N01',
    );
});

test('phase-z: TranslationEditorClient documents RISK-DUAL-N01', () => {
    assert.match(
        read(TRANSLATION_ED_CLIENT),
        /RISK-DUAL-N01/,
        'TranslationEditorClient must reference RISK-DUAL-N01',
    );
});

test('phase-z: TranslationKeyList documents RISK-DUAL-N01', () => {
    assert.match(
        read(TRANSLATION_KEY_LIST),
        /RISK-DUAL-N01/,
        'TranslationKeyList must reference RISK-DUAL-N01',
    );
});

test('phase-z: TranslationValueEditor writes resource_type: theme (never section_definitions)', () => {
    const src = read(TRANSLATION_VALUE_ED);
    // Matches `resource_type: 'theme'` or `resource_type: entry.resource_type as 'theme'`
    assert.match(
        src,
        /resource_type.*:.*['"]theme['"]/,
        'TranslationValueEditor write payload must set resource_type: "theme"',
    );
});

test('phase-z: TranslationValueEditor does not assign to section_definitions (RISK-DUAL-N01)', () => {
    assert.doesNotMatch(
        read(TRANSLATION_VALUE_ED),
        /section_definitions\s*=/,
        'TranslationValueEditor must never assign to section_definitions',
    );
});

test('phase-z: TranslationEditorClient does not assign to section_definitions (RISK-DUAL-N01)', () => {
    assert.doesNotMatch(
        read(TRANSLATION_ED_CLIENT),
        /section_definitions\s*=/,
        'TranslationEditorClient must never assign to section_definitions',
    );
});

test('phase-z: TranslationKeyList onEdit always passes resource_type: theme (RISK-DUAL-N01)', () => {
    assert.match(
        read(TRANSLATION_KEY_LIST),
        /resource_type.*:.*['"]theme['"]/,
        'TranslationKeyList onEdit must pass resource_type: "theme" always',
    );
});

test('phase-z: translation POST proxy documents RISK-DUAL-N01', () => {
    assert.match(
        read(PROXY_TRANSLATIONS),
        /RISK-DUAL-N01/,
        'translations/route.ts must document RISK-DUAL-N01',
    );
});

test('phase-z: translation PATCH/DELETE proxy documents RISK-DUAL-N01', () => {
    assert.match(
        read(PROXY_TRANSLATION_ID),
        /RISK-DUAL-N01/,
        'translations/[translationId]/route.ts must document RISK-DUAL-N01',
    );
});

// Default locale guard: en-IN cannot be deleted from the locale list.
// The gateway already enforces this (is_default guard in stores-localization.ts).
// The editor must also document this constraint.
test('phase-z: default locale cannot be deleted — guard documented in TranslationEditorClient or LocaleSwitcher', () => {
    const src = read(TRANSLATION_ED_CLIENT) + read(LOCALE_SWITCHER);
    assert.ok(
        /default.*locale.*cannot|cannot.*delete.*default|DEFAULT_ADMIN_LOCALE.*delete|delete.*DEFAULT_ADMIN_LOCALE|India-first/i.test(src),
        'Default locale guard must be documented in TranslationEditorClient or LocaleSwitcher',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// TENANCY LAW
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-z: translation POST proxy imports resolveOwnedStoreId (tenancy law)', () => {
    assert.match(
        read(PROXY_TRANSLATIONS),
        /resolveOwnedStoreId/,
        'translations/route.ts must import resolveOwnedStoreId for tenancy',
    );
});

test('phase-z: translation PATCH/DELETE proxy imports resolveOwnedStoreId (tenancy law)', () => {
    assert.match(
        read(PROXY_TRANSLATION_ID),
        /resolveOwnedStoreId/,
        'translations/[translationId]/route.ts must import resolveOwnedStoreId for tenancy',
    );
});

test('phase-z: translation POST proxy uses createMerchantApiClient (typed client, not raw Supabase)', () => {
    assert.match(
        read(PROXY_TRANSLATIONS),
        /createMerchantApiClient/,
        'must use createMerchantApiClient to forward to gateway — no direct Supabase',
    );
});

test('phase-z: translation PATCH/DELETE proxy uses createMerchantApiClient', () => {
    assert.match(
        read(PROXY_TRANSLATION_ID),
        /createMerchantApiClient/,
        'must use createMerchantApiClient to forward to gateway',
    );
});

test('phase-z: translation POST proxy uses resolved.storeId (not browser-supplied param)', () => {
    assert.match(
        read(PROXY_TRANSLATIONS),
        /resolved\.storeId/,
        'must use resolved.storeId — never trust a browser-supplied store_id',
    );
});

test('phase-z: translation PATCH/DELETE proxy uses resolved.storeId', () => {
    assert.match(
        read(PROXY_TRANSLATION_ID),
        /resolved\.storeId/,
        'must use resolved.storeId — never trust a browser-supplied store_id',
    );
});

test('phase-z: proxy routes do not import Supabase directly', () => {
    assert.doesNotMatch(read(PROXY_TRANSLATIONS), /@supabase|createClient/, 'POST proxy must not use Supabase directly');
    assert.doesNotMatch(read(PROXY_TRANSLATION_ID), /@supabase|createClient/, 'PATCH/DELETE proxy must not use Supabase directly');
});

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN TOKEN COMPLIANCE
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-z: LocaleSwitcher imports from @letbuyy/ui (design token compliance)', () => {
    assert.match(read(LOCALE_SWITCHER), /from '@letbuyy\/ui'/, 'LocaleSwitcher must import from @letbuyy/ui');
});

test('phase-z: TranslationKeyList imports from @letbuyy/ui', () => {
    assert.match(read(TRANSLATION_KEY_LIST), /from '@letbuyy\/ui'/, 'TranslationKeyList must import from @letbuyy/ui');
});

test('phase-z: TranslationValueEditor imports from @letbuyy/ui', () => {
    assert.match(read(TRANSLATION_VALUE_ED), /from '@letbuyy\/ui'/, 'TranslationValueEditor must import from @letbuyy/ui');
});

test('phase-z: TranslationEditorClient imports from @letbuyy/ui', () => {
    assert.match(read(TRANSLATION_ED_CLIENT), /from '@letbuyy\/ui'/, 'TranslationEditorClient must import from @letbuyy/ui');
});

test('phase-z: LocaleSwitcher has no raw rounded-[Npx] Tailwind classes (design ratchet)', () => {
    assert.doesNotMatch(read(LOCALE_SWITCHER), /rounded-\[\d+px\]/, 'LocaleSwitcher: no raw rounded-[Npx]');
});

test('phase-z: TranslationKeyList has no raw rounded-[Npx] Tailwind classes', () => {
    assert.doesNotMatch(read(TRANSLATION_KEY_LIST), /rounded-\[\d+px\]/, 'TranslationKeyList: no raw rounded-[Npx]');
});

test('phase-z: TranslationValueEditor has no raw rounded-[Npx] Tailwind classes', () => {
    assert.doesNotMatch(read(TRANSLATION_VALUE_ED), /rounded-\[\d+px\]/, 'TranslationValueEditor: no raw rounded-[Npx]');
});

test('phase-z: TranslationEditorClient has no raw rounded-[Npx] Tailwind classes', () => {
    assert.doesNotMatch(read(TRANSLATION_ED_CLIENT), /rounded-\[\d+px\]/, 'TranslationEditorClient: no raw rounded-[Npx]');
});

test('phase-z: theme-locale.module.css uses --lb-* design tokens', () => {
    assert.match(
        read(CSS_MODULE),
        /--lb-/,
        'theme-locale.module.css must use --lb-* design tokens',
    );
});

test('phase-z: theme-locale.module.css has no raw rounded-[Npx] values', () => {
    assert.doesNotMatch(read(CSS_MODULE), /rounded-\[\d+px\]/, 'no raw rounded-[Npx] in CSS module');
});

test('phase-z: CSS module defines localeSwitcherRoot class', () => {
    assert.match(read(CSS_MODULE), /localeSwitcherRoot/, 'CSS module must define localeSwitcherRoot');
});

test('phase-z: CSS module defines translationKeyList class', () => {
    assert.match(read(CSS_MODULE), /translationKeyList/, 'CSS module must define translationKeyList');
});

test('phase-z: CSS module defines translationEditorRoot class', () => {
    assert.match(read(CSS_MODULE), /translationEditorRoot/, 'CSS module must define translationEditorRoot');
});

test('phase-z: CSS module defines translationValueEditorRoot class', () => {
    assert.match(read(CSS_MODULE), /translationValueEditorRoot/, 'CSS module must define translationValueEditorRoot');
});

// ═══════════════════════════════════════════════════════════════════════════════
// FOREIGN WIP ISOLATION
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-z: LocaleSwitcher does not import from editor/page.tsx (foreign WIP)', () => {
    assert.doesNotMatch(read(LOCALE_SWITCHER), /from.*editor\/page|editor\/page.*from/, 'must not import from editor/page.tsx');
});

test('phase-z: TranslationKeyList does not import from editor/page.tsx', () => {
    assert.doesNotMatch(read(TRANSLATION_KEY_LIST), /from.*editor\/page/, 'must not import from editor/page.tsx');
});

test('phase-z: TranslationValueEditor does not import from editor/page.tsx', () => {
    assert.doesNotMatch(read(TRANSLATION_VALUE_ED), /from.*editor\/page/, 'must not import from editor/page.tsx');
});

test('phase-z: TranslationEditorClient does not import from editor/page.tsx', () => {
    assert.doesNotMatch(read(TRANSLATION_ED_CLIENT), /from.*editor\/page/, 'must not import from editor/page.tsx');
});

test('phase-z: no component imports globals.css (foreign WIP)', () => {
    const files = [LOCALE_SWITCHER, TRANSLATION_KEY_LIST, TRANSLATION_VALUE_ED, TRANSLATION_ED_CLIENT, TRANSLATIONS_PAGE];
    for (const f of files) {
        assert.doesNotMatch(read(f), /globals\.css/, `${f} must not import globals.css`);
    }
});

test('phase-z: no component imports from @letbuyy/api-client directly (foreign WIP)', () => {
    const files = [LOCALE_SWITCHER, TRANSLATION_KEY_LIST, TRANSLATION_VALUE_ED, TRANSLATION_ED_CLIENT];
    for (const f of files) {
        assert.doesNotMatch(read(f), /from '@letbuyy\/api-client'/, `${f} must not import @letbuyy/api-client directly`);
    }
});

test('phase-z: no component imports ExperiencePicker (foreign WIP)', () => {
    const files = [LOCALE_SWITCHER, TRANSLATION_KEY_LIST, TRANSLATION_VALUE_ED, TRANSLATION_ED_CLIENT, TRANSLATIONS_PAGE];
    for (const f of files) {
        assert.doesNotMatch(read(f), /ExperiencePicker/, `${f} must not import ExperiencePicker`);
    }
});

test('phase-z: proxy routes do not import from api-client/src/index directly', () => {
    assert.doesNotMatch(read(PROXY_TRANSLATIONS), /api-client\/src\/index/, 'POST proxy must not import api-client/src/index directly');
    assert.doesNotMatch(read(PROXY_TRANSLATION_ID), /api-client\/src\/index/, 'PATCH/DELETE proxy must not import api-client/src/index directly');
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACCESSIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-z: LocaleSwitcher has role="region" + aria-label (a11y)', () => {
    const src = read(LOCALE_SWITCHER);
    assert.match(src, /role="region"/, 'LocaleSwitcher must have role="region"');
    assert.match(src, /aria-label/, 'LocaleSwitcher must have aria-label');
});

test('phase-z: TranslationKeyList has role="list" + aria-label on the list (a11y)', () => {
    const src = read(TRANSLATION_KEY_LIST);
    assert.match(src, /role="list"/, 'TranslationKeyList must have role="list"');
    assert.match(src, /aria-label.*[Tt]ranslation|[Tt]ranslation.*aria-label/, 'TranslationKeyList must have descriptive aria-label');
});

test('phase-z: TranslationKeyList edit/add button has aria-label (a11y)', () => {
    assert.match(
        read(TRANSLATION_KEY_LIST),
        /aria-label.*[Ee]dit|aria-label.*[Aa]dd/,
        'TranslationKeyList Edit/Add buttons must have aria-label',
    );
});

test('phase-z: TranslationValueEditor save button has aria-label (a11y)', () => {
    assert.match(
        read(TRANSLATION_VALUE_ED),
        /aria-label.*[Ss]ave/,
        'Save button must have aria-label',
    );
});

test('phase-z: TranslationValueEditor cancel button has aria-label (a11y)', () => {
    assert.match(
        read(TRANSLATION_VALUE_ED),
        /aria-label.*[Cc]ancel/,
        'Cancel button must have aria-label',
    );
});

test('phase-z: TranslationValueEditor handles Escape key to cancel editing (a11y)', () => {
    assert.match(
        read(TRANSLATION_VALUE_ED),
        /Escape/,
        'TranslationValueEditor must handle the Escape key to close/cancel',
    );
});

test('phase-z: TranslationEditorClient has aria-label on root container (a11y)', () => {
    assert.match(
        read(TRANSLATION_ED_CLIENT),
        /aria-label.*[Tt]ranslation|[Tt]ranslation.*aria-label/,
        'Root container must have descriptive aria-label',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING / ERROR / EMPTY STATES
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-z: TranslationKeyList has a loading state (aria-busy)', () => {
    assert.match(
        read(TRANSLATION_KEY_LIST),
        /loading|Loading|aria-busy/,
        'TranslationKeyList must have a loading state',
    );
});

test('phase-z: TranslationKeyList has an error state (role="alert")', () => {
    assert.match(
        read(TRANSLATION_KEY_LIST),
        /role="alert"/,
        'TranslationKeyList must have an error state with role="alert"',
    );
});

test('phase-z: TranslationKeyList has an empty state', () => {
    const src = read(TRANSLATION_KEY_LIST);
    assert.ok(
        /[Nn]o.*translation|translationEmpty/.test(src),
        'TranslationKeyList must have an empty state',
    );
});

test('phase-z: TranslationEditorClient has an error state (role="alert")', () => {
    assert.match(
        read(TRANSLATION_ED_CLIENT),
        /role="alert"/,
        'TranslationEditorClient must render an error state with role="alert"',
    );
});

test('phase-z: TranslationEditorClient has a loading state (aria-busy)', () => {
    assert.match(
        read(TRANSLATION_ED_CLIENT),
        /aria-busy/,
        'TranslationEditorClient must render a loading state with aria-busy',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// SANDBOX / INJECTION SAFETY
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-z: TranslationValueEditor has no dangerouslySetInnerHTML (SANDBOX LAW)', () => {
    assert.doesNotMatch(
        read(TRANSLATION_VALUE_ED),
        /dangerouslySetInnerHTML/,
        'SANDBOX LAW: translation strings must not be injected as raw HTML',
    );
});

test('phase-z: TranslationEditorClient has no dangerouslySetInnerHTML', () => {
    assert.doesNotMatch(
        read(TRANSLATION_ED_CLIENT),
        /dangerouslySetInnerHTML/,
        'SANDBOX LAW: must not inject translated content as raw HTML',
    );
});

test('phase-z: TranslationKeyList has no dangerouslySetInnerHTML', () => {
    assert.doesNotMatch(
        read(TRANSLATION_KEY_LIST),
        /dangerouslySetInnerHTML/,
        'SANDBOX LAW: translation keys must not be rendered as raw HTML',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROXY ROUTES: HTTP VERBS
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-z: translation POST proxy exports POST handler', () => {
    assert.match(
        read(PROXY_TRANSLATIONS),
        /export async function POST/,
        'translations/route.ts must export POST handler',
    );
});

test('phase-z: translation PATCH proxy exports PATCH handler', () => {
    assert.match(
        read(PROXY_TRANSLATION_ID),
        /export async function PATCH/,
        'translations/[translationId]/route.ts must export PATCH handler',
    );
});

test('phase-z: translation DELETE proxy exports DELETE handler', () => {
    assert.match(
        read(PROXY_TRANSLATION_ID),
        /export async function DELETE/,
        'translations/[translationId]/route.ts must export DELETE handler',
    );
});

test('phase-z: translation POST proxy calls createTranslation on the api-client (gateway proxy)', () => {
    assert.match(
        read(PROXY_TRANSLATIONS),
        /createTranslation/,
        'POST proxy must call stores.localization.createTranslation',
    );
});

test('phase-z: translation PATCH proxy calls updateTranslation on the api-client', () => {
    assert.match(
        read(PROXY_TRANSLATION_ID),
        /updateTranslation/,
        'PATCH proxy must call stores.localization.updateTranslation',
    );
});

test('phase-z: translation DELETE proxy calls deleteTranslation on the api-client', () => {
    assert.match(
        read(PROXY_TRANSLATION_ID),
        /deleteTranslation/,
        'DELETE proxy must call stores.localization.deleteTranslation',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSLATIONS PAGE (SERVER COMPONENT)
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-z: translations/page.tsx is NOT a client component (server component wrapper)', () => {
    assert.doesNotMatch(
        read(TRANSLATIONS_PAGE),
        /^'use client'/m,
        'translations/page.tsx must be a server component — no "use client" directive at module level',
    );
});

test('phase-z: translations/page.tsx renders TranslationEditorClient', () => {
    assert.match(
        read(TRANSLATIONS_PAGE),
        /TranslationEditorClient/,
        'translations/page.tsx must render TranslationEditorClient',
    );
});

test('phase-z: translations/page.tsx fetches from /api/stores (same-origin proxy, not gateway direct)', () => {
    assert.match(
        read(TRANSLATIONS_PAGE),
        /\/api\/stores\//,
        'translations/page.tsx must fetch from the same-origin /api/stores/ proxy',
    );
});

test('phase-z: translations/page.tsx does not touch money ledger (canonical ledger untouched)', () => {
    const src = read(TRANSLATIONS_PAGE);
    assert.doesNotMatch(src, /create_checkout_order|confirm_order_payment|payment_transactions|payouts/, 'must not touch canonical money ledger');
});

// ═══════════════════════════════════════════════════════════════════════════════
// MONEY SAFETY — display only, no ledger touch
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-z: TranslationValueEditor does not reference the canonical money ledger', () => {
    const src = read(TRANSLATION_VALUE_ED);
    assert.doesNotMatch(src, /create_checkout_order|payment_transactions|confirm_order_payment/, 'must not touch money ledger');
});

test('phase-z: TranslationEditorClient does not reference the canonical money ledger', () => {
    const src = read(TRANSLATION_ED_CLIENT);
    assert.doesNotMatch(src, /create_checkout_order|payment_transactions|confirm_order_payment/, 'must not touch money ledger');
});

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGE.JSON
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-z: package.json test command includes theme-editor-z.test.mjs', () => {
    assert.match(
        read(PKG_JSON),
        /theme-editor-z\.test\.mjs/,
        'package.json test command must include theme-editor-z.test.mjs',
    );
});
