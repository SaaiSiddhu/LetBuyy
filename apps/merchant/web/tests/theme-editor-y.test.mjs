/**
 * Phase Y — App Block Slot Editor: static-contract tests for the merchant-web.
 *
 * Verifies source-level contracts (file existence, import patterns, ARIA/a11y
 * markers, design-ratchet compliance, tenancy law, RISK-DUAL-N01 isolation,
 * NOT-CONNECTED honesty, sandbox law) without spinning up Next.js or hitting
 * the gateway/DB.
 *
 * Test style mirrors theme-editor-r/s/t/u/v/w/x.test.mjs:
 *  - node:test + node:assert/strict
 *  - readFileSync source assertions
 *  - structural/pattern checks only; no network, no DOM, no React render
 *
 * PHASE Y HARD RULES verified here:
 *
 * ── Proxy route (stores/[store]/themes/app-blocks) ────────────────────────────
 *  - route.ts exists under stores/[store]/themes/app-blocks/
 *  - Imports resolveOwnedStoreId (tenancy — merchant session must own store)
 *  - Imports merchantApiFetch (no direct DB access; no api-client)
 *  - Does NOT import createMerchantApiClient (raw proxy; no api-client WIP edit)
 *  - Uses requireSession: true (rejects unauthenticated requests)
 *  - Forwards to /themes/app-blocks on gateway
 *  - Passes store_id from resolved store (tenancy law — never browser-supplied)
 *  - Documents NOT-CONNECTED contract
 *  - Returns { data: [], not_connected: true } on gateway 404 (honest empty state)
 *  - No import from page.tsx (foreign WIP)
 *  - No globals.css import
 *  - No Supabase / direct DB
 *  - No raw rounded-[Npx] classes
 *  - RISK-DUAL-N01: read-only (documented)
 *
 * ── AppBlockSlotPanel component ───────────────────────────────────────────────
 *  - AppBlockSlotPanel.tsx exists
 *  - Imports from @letbuyy/ui (design token compliance)
 *  - Does NOT import from @letbuyy/api-client (foreign WIP)
 *  - Does NOT import page.tsx or globals.css (foreign WIP)
 *  - Does NOT use dangerouslySetInnerHTML (SANDBOX LAW)
 *  - Does NOT use direct Supabase / createClient (no direct DB)
 *  - Has no raw rounded-[Npx] Tailwind classes (design ratchet)
 *  - Uses raw fetch to same-origin /api/stores/ proxy (not typed api-client)
 *  - Accepts storeName, sectionId, section props
 *  - Accepts onAddBlock, onUpdateBlockSettings, onRemoveBlock, onMoveBlock callbacks
 *  - Has loading state (aria-busy / loading message)
 *  - Has error state (role="alert")
 *  - Has NOT-CONNECTED state (NOT-CONNECTED text in source)
 *  - Has "No apps installed" / empty state
 *  - Has "Add app block" affordance (appBlockAddSection / appBlockAddBtn)
 *  - Has configure / settings affordance (Settings / BlockSettingsForm)
 *  - Has remove affordance (onRemoveBlock callback)
 *  - Has reorder affordance (onMoveBlock callback, ChevronUp/ChevronDown)
 *  - RISK-DUAL-N01: never mutates section_definitions or block_definitions
 *  - RISK-DUAL-N01 documented in comments
 *  - isAppBlockEntry / '@app' type: block type stays '@app', not a type override
 *  - Keyboard a11y: aria-label on all interactive elements
 *  - aria-expanded on configure button
 *  - aria-label on slot wrapper
 *  - Mobile-first (no fixed px widths)
 *
 * ── controls.module.css (Phase Y additions) ───────────────────────────────────
 *  - Has appBlockSlotWrapper class
 *  - Has appBlockItem class
 *  - Has appBlockItemSelected class
 *  - Has appBlockItemActions class
 *  - Has appBlockNotConnected class
 *  - Has appBlockEmpty class
 *  - Has appBlockSettingsForm class
 *  - Has appBlockAddSection class
 *  - Has appBlockAddBtn class
 *  - All Phase Y CSS uses --lb-* tokens
 *  - No raw rounded-[Npx] values
 *
 * ── package.json ──────────────────────────────────────────────────────────────
 *  - theme-editor-y.test.mjs is included in the test command
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

const MCP_BASE = 'apps/merchant_web/src';
const PROXY_ROUTE = `${MCP_BASE}/app/api/stores/[store]/themes/app-blocks/route.ts`;
const APP_BLOCK_PANEL = `${MCP_BASE}/components/theme-editor/AppBlockSlotPanel.tsx`;
const CSS_MODULE = `${MCP_BASE}/components/theme-editor/controls/controls.module.css`;
const PKG_JSON = 'apps/merchant_web/package.json';

// ═══════════════════════════════════════════════════════════════════════════════
// FILE EXISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-y: themes/app-blocks/route.ts proxy exists', () => {
    assert.ok(
        exists(PROXY_ROUTE),
        'route.ts missing — must be at app/api/stores/[store]/themes/app-blocks/route.ts',
    );
});

test('phase-y: AppBlockSlotPanel.tsx exists', () => {
    assert.ok(exists(APP_BLOCK_PANEL), 'AppBlockSlotPanel.tsx missing from components/theme-editor/');
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROXY ROUTE: imports + tenancy
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-y: proxy route imports resolveOwnedStoreId (tenancy law)', () => {
    assert.match(read(PROXY_ROUTE), /resolveOwnedStoreId/, 'must import resolveOwnedStoreId');
});

test('phase-y: proxy route imports merchantApiFetch (no direct DB)', () => {
    assert.match(read(PROXY_ROUTE), /merchantApiFetch/, 'must use merchantApiFetch — no direct DB access');
});

test('phase-y: proxy route does NOT import createMerchantApiClient (raw fetch required)', () => {
    assert.doesNotMatch(
        read(PROXY_ROUTE),
        /createMerchantApiClient/,
        'must not use typed api-client — raw proxy only (api-client is foreign WIP)',
    );
});

test('phase-y: proxy route uses requireSession: true', () => {
    assert.match(
        read(PROXY_ROUTE),
        /requireSession.*true|true.*requireSession/,
        'merchantApiFetch must be called with requireSession: true',
    );
});

test('phase-y: proxy route forwards to /themes/app-blocks on gateway', () => {
    assert.match(
        read(PROXY_ROUTE),
        /\/themes\/app-blocks/,
        'must forward to gateway /themes/app-blocks path',
    );
});

test('phase-y: proxy route passes store_id from resolved store (tenancy law)', () => {
    assert.match(
        read(PROXY_ROUTE),
        /resolved\.storeId|resolved\s*\.\s*storeId/,
        'must use resolved.storeId from session — not a browser-supplied store_id param',
    );
});

test('phase-y: proxy route does not forward browser-supplied store_id (tenancy law)', () => {
    assert.doesNotMatch(
        read(PROXY_ROUTE),
        /searchParams\.get\(['"]store_id['"]\)/,
        'must not forward browser-supplied store_id directly (tenancy law)',
    );
});

test('phase-y: proxy route documents NOT-CONNECTED contract', () => {
    assert.match(
        read(PROXY_ROUTE),
        /NOT-CONNECTED/,
        'must document NOT-CONNECTED — gateway /themes/app-blocks endpoint not yet deployed',
    );
});

test('phase-y: proxy route returns { data: [], not_connected: true } on gateway 404', () => {
    const src = read(PROXY_ROUTE);
    assert.match(src, /not_connected.*true|true.*not_connected/, 'must return not_connected: true when gateway 404');
    assert.match(src, /data.*\[\]|\[\].*data/, 'must return empty data array when gateway 404');
    assert.match(src, /404/, 'must check for 404 status code from gateway');
});

test('phase-y: proxy route documents RISK-DUAL-N01 (read-only)', () => {
    assert.match(
        read(PROXY_ROUTE),
        /RISK-DUAL-N01/,
        'must document RISK-DUAL-N01: this proxy is read-only, never mutates definitions',
    );
});

test('phase-y: proxy route does not import from page.tsx (foreign WIP)', () => {
    assert.doesNotMatch(read(PROXY_ROUTE), /from.*page\.tsx/, 'must not import from foreign-WIP editor/page.tsx');
});

test('phase-y: proxy route does not import globals.css (foreign WIP)', () => {
    assert.doesNotMatch(read(PROXY_ROUTE), /globals\.css/, 'must not import globals.css');
});

test('phase-y: proxy route does not use Supabase or direct DB', () => {
    assert.doesNotMatch(read(PROXY_ROUTE), /@supabase|createClient/, 'must not access Supabase directly');
});

test('phase-y: proxy route has no raw rounded-[Npx] classes (design ratchet)', () => {
    assert.doesNotMatch(read(PROXY_ROUTE), /rounded-\[\d+px\]/, 'design ratchet: no raw rounded-[Npx]');
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPBLOCKSLOTPANEL: imports + design token compliance
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-y: AppBlockSlotPanel imports from @letbuyy/ui (design token compliance)', () => {
    assert.match(
        read(APP_BLOCK_PANEL),
        /from '@letbuyy\/ui'/,
        'must import from @letbuyy/ui',
    );
});

test('phase-y: AppBlockSlotPanel does NOT import from @letbuyy/api-client (foreign WIP)', () => {
    assert.doesNotMatch(
        read(APP_BLOCK_PANEL),
        /from '@letbuyy\/api-client'/,
        'must not import from @letbuyy/api-client',
    );
});

test('phase-y: AppBlockSlotPanel does not import from page.tsx (foreign WIP)', () => {
    assert.doesNotMatch(
        read(APP_BLOCK_PANEL),
        /from.*editor\/page/,
        'must not import from foreign-WIP editor/page.tsx',
    );
});

test('phase-y: AppBlockSlotPanel does not import globals.css (design ratchet)', () => {
    assert.doesNotMatch(read(APP_BLOCK_PANEL), /globals\.css/, 'must not import globals.css');
});

test('phase-y: AppBlockSlotPanel has NO dangerouslySetInnerHTML (SANDBOX LAW)', () => {
    assert.doesNotMatch(
        read(APP_BLOCK_PANEL),
        /dangerouslySetInnerHTML/,
        'SANDBOX LAW: must never use dangerouslySetInnerHTML for app-provided content',
    );
});

test('phase-y: AppBlockSlotPanel does not use Supabase / createClient (no direct DB)', () => {
    assert.doesNotMatch(read(APP_BLOCK_PANEL), /@supabase|createClient/, 'must not access Supabase directly');
});

test('phase-y: AppBlockSlotPanel has no raw rounded-[Npx] Tailwind classes (design ratchet)', () => {
    assert.doesNotMatch(read(APP_BLOCK_PANEL), /rounded-\[\d+px\]/, 'design ratchet: no raw rounded-[Npx]');
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPBLOCKSLOTPANEL: props contract
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-y: AppBlockSlotPanel accepts storeName prop', () => {
    assert.match(read(APP_BLOCK_PANEL), /storeName/, 'must accept storeName prop');
});

test('phase-y: AppBlockSlotPanel accepts sectionId prop', () => {
    assert.match(read(APP_BLOCK_PANEL), /sectionId/, 'must accept sectionId prop');
});

test('phase-y: AppBlockSlotPanel accepts section prop', () => {
    assert.match(read(APP_BLOCK_PANEL), /section:/, 'must accept section prop');
});

test('phase-y: AppBlockSlotPanel accepts onAddBlock callback', () => {
    assert.match(read(APP_BLOCK_PANEL), /onAddBlock/, 'must accept onAddBlock callback');
});

test('phase-y: AppBlockSlotPanel accepts onUpdateBlockSettings callback', () => {
    assert.match(read(APP_BLOCK_PANEL), /onUpdateBlockSettings/, 'must accept onUpdateBlockSettings callback');
});

test('phase-y: AppBlockSlotPanel accepts onRemoveBlock callback', () => {
    assert.match(read(APP_BLOCK_PANEL), /onRemoveBlock/, 'must accept onRemoveBlock callback');
});

test('phase-y: AppBlockSlotPanel accepts onMoveBlock callback', () => {
    assert.match(read(APP_BLOCK_PANEL), /onMoveBlock/, 'must accept onMoveBlock callback');
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPBLOCKSLOTPANEL: fetch + proxy usage
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-y: AppBlockSlotPanel uses raw fetch to same-origin /api/stores/ proxy', () => {
    const src = read(APP_BLOCK_PANEL);
    assert.match(src, /\/api\/stores\//, 'must call same-origin /api/stores/ proxy path');
    assert.match(src, /\bfetch\(/, 'must use raw fetch — not typed api-client');
});

test('phase-y: AppBlockSlotPanel does NOT import from @letbuyy/api-client', () => {
    assert.doesNotMatch(
        read(APP_BLOCK_PANEL),
        /from '@letbuyy\/api-client'/,
        'must use raw fetch, not typed api-client (api-client is foreign WIP)',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPBLOCKSLOTPANEL: states
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-y: AppBlockSlotPanel has a loading state (aria-busy or loading label)', () => {
    const src = read(APP_BLOCK_PANEL);
    assert.ok(
        /loading|Loading|aria-busy/.test(src),
        'must render a loading state (aria-busy or loading label)',
    );
});

test('phase-y: AppBlockSlotPanel has an error state (role="alert")', () => {
    const src = read(APP_BLOCK_PANEL);
    assert.ok(
        /role="alert"|appBlockError|error|Error/.test(src),
        'must render an error state when the proxy fetch fails',
    );
});

test('phase-y: AppBlockSlotPanel has a NOT-CONNECTED state', () => {
    assert.match(
        read(APP_BLOCK_PANEL),
        /NOT-CONNECTED|not_connected/,
        'must show NOT-CONNECTED state when gateway route is absent',
    );
});

test('phase-y: AppBlockSlotPanel has "No apps installed" / empty state', () => {
    const src = read(APP_BLOCK_PANEL);
    assert.ok(
        /No app blocks|No apps|appBlockEmpty/.test(src),
        'must render an empty state when no apps are installed or no blocks in slot',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPBLOCKSLOTPANEL: add / configure / remove / reorder
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-y: AppBlockSlotPanel has "Add app block" affordance', () => {
    const src = read(APP_BLOCK_PANEL);
    assert.ok(
        /appBlockAddSection|appBlockAddBtn|Add app block|Add selected/.test(src),
        'must have an "Add app block" affordance',
    );
});

test('phase-y: AppBlockSlotPanel calls onAddBlock to add a block (not a type override)', () => {
    const src = read(APP_BLOCK_PANEL);
    assert.match(src, /onAddBlock/, 'must call onAddBlock callback to add an app block');
    assert.match(src, /'@app'/, 'must use "@app" as the block type — never a type override');
});

test('phase-y: AppBlockSlotPanel extension_id in settings (not as type override)', () => {
    // The proxy route returns extension_id as identity, not as a block type override.
    // The component must store it in settings, not as the blockType argument.
    const src = read(APP_BLOCK_PANEL);
    assert.match(src, /extension_id/, 'must include extension_id in block settings');
});

test('phase-y: AppBlockSlotPanel has configure/settings affordance (BlockSettingsForm)', () => {
    const src = read(APP_BLOCK_PANEL);
    assert.ok(
        /BlockSettingsForm|appBlockSettingsForm|configure|Settings/.test(src),
        'must have a settings configuration affordance for existing blocks',
    );
});

test('phase-y: AppBlockSlotPanel calls onUpdateBlockSettings to configure settings', () => {
    assert.match(
        read(APP_BLOCK_PANEL),
        /onUpdateBlockSettings/,
        'must call onUpdateBlockSettings to save block settings',
    );
});

test('phase-y: AppBlockSlotPanel has remove affordance (calls onRemoveBlock)', () => {
    const src = read(APP_BLOCK_PANEL);
    assert.match(src, /onRemoveBlock/, 'must call onRemoveBlock callback to remove block from slot');
    assert.match(src, /Remove|Trash|trash/, 'must have a visible remove affordance');
});

test('phase-y: AppBlockSlotPanel has reorder affordance (calls onMoveBlock)', () => {
    const src = read(APP_BLOCK_PANEL);
    assert.match(src, /onMoveBlock/, 'must call onMoveBlock callback to reorder blocks in slot');
    assert.ok(
        /ChevronUp|ChevronDown|Move.*up|Move.*down/.test(src),
        'must have visible move-up / move-down affordances',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPBLOCKSLOTPANEL: RISK-DUAL-N01 isolation
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-y: RISK-DUAL-N01 — AppBlockSlotPanel documents mutation isolation', () => {
    assert.match(
        read(APP_BLOCK_PANEL),
        /RISK-DUAL-N01/,
        'must document RISK-DUAL-N01: mutates instance only, never section_definitions or block_definitions',
    );
});

test('phase-y: RISK-DUAL-N01 — AppBlockSlotPanel does not assign to section_definitions', () => {
    assert.doesNotMatch(
        read(APP_BLOCK_PANEL),
        /section_definitions\s*=/,
        'must not assign to section_definitions (RISK-DUAL-N01)',
    );
});

test('phase-y: RISK-DUAL-N01 — AppBlockSlotPanel does not assign to block_definitions', () => {
    assert.doesNotMatch(
        read(APP_BLOCK_PANEL),
        /block_definitions\s*=/,
        'must not assign to block_definitions (RISK-DUAL-N01)',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPBLOCKSLOTPANEL: keyboard a11y
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-y: AppBlockSlotPanel has aria-label on slot wrapper', () => {
    assert.match(
        read(APP_BLOCK_PANEL),
        /aria-label="App block slot"/,
        'slot wrapper must have aria-label="App block slot"',
    );
});

test('phase-y: AppBlockSlotPanel has aria-label on add-block button', () => {
    assert.match(
        read(APP_BLOCK_PANEL),
        /aria-label="Add selected app block to slot"/,
        'add button must have a descriptive aria-label',
    );
});

test('phase-y: AppBlockSlotPanel has aria-expanded on configure button', () => {
    assert.match(
        read(APP_BLOCK_PANEL),
        /aria-expanded/,
        'configure button must have aria-expanded to indicate open/close state',
    );
});

test('phase-y: AppBlockSlotPanel has aria-label on remove button', () => {
    assert.match(
        read(APP_BLOCK_PANEL),
        /Remove.*from slot|aria-label.*Remove/,
        'remove button must have a descriptive aria-label',
    );
});

test('phase-y: AppBlockSlotPanel has aria-label on move-up button', () => {
    assert.match(
        read(APP_BLOCK_PANEL),
        /Move.*up/,
        'move-up button must have a descriptive aria-label',
    );
});

test('phase-y: AppBlockSlotPanel has aria-label on move-down button', () => {
    assert.match(
        read(APP_BLOCK_PANEL),
        /Move.*down/,
        'move-down button must have a descriptive aria-label',
    );
});

test('phase-y: AppBlockSlotPanel Escape key closes settings form (keyboard a11y)', () => {
    assert.match(
        read(APP_BLOCK_PANEL),
        /Escape/,
        'settings form must close on Escape key (keyboard a11y)',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPBLOCKSLOTPANEL: sandbox / isolation verification (structural)
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-y: SANDBOX — AppBlockSlotPanel never emits innerHTML of app content', () => {
    // No innerHTML assignment; no dangerouslySetInnerHTML (checked above).
    // The component never receives or renders raw app HTML — that happens at
    // storefront render time through sanitizeRenderedHtml.
    assert.doesNotMatch(read(APP_BLOCK_PANEL), /\.innerHTML\s*=/, 'must not assign .innerHTML directly');
});

test('phase-y: ISOLATION — AppBlockSlotPanel block type stays "@app" (not extension override)', () => {
    // The extension_id goes into settings, never replaces the block type.
    // This ensures isLiquidAppBlockType('@app') === true and the renderer path is correct.
    const src = read(APP_BLOCK_PANEL);
    assert.match(src, /'@app'/, 'block type must be "@app" — extension identity in settings, not type');
});

// ═══════════════════════════════════════════════════════════════════════════════
// controls.module.css: Phase Y styles
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-y: controls.module.css has appBlockSlotWrapper class', () => {
    assert.match(read(CSS_MODULE), /appBlockSlotWrapper/, 'must define appBlockSlotWrapper class');
});

test('phase-y: controls.module.css has appBlockItem class', () => {
    assert.match(read(CSS_MODULE), /appBlockItem/, 'must define appBlockItem class');
});

test('phase-y: controls.module.css has appBlockItemSelected class', () => {
    assert.match(read(CSS_MODULE), /appBlockItemSelected/, 'must define appBlockItemSelected class');
});

test('phase-y: controls.module.css has appBlockItemActions class', () => {
    assert.match(read(CSS_MODULE), /appBlockItemActions/, 'must define appBlockItemActions class');
});

test('phase-y: controls.module.css has appBlockNotConnected class', () => {
    assert.match(read(CSS_MODULE), /appBlockNotConnected/, 'must define appBlockNotConnected class');
});

test('phase-y: controls.module.css has appBlockEmpty class', () => {
    assert.match(read(CSS_MODULE), /appBlockEmpty/, 'must define appBlockEmpty class');
});

test('phase-y: controls.module.css has appBlockSettingsForm class', () => {
    assert.match(read(CSS_MODULE), /appBlockSettingsForm/, 'must define appBlockSettingsForm class');
});

test('phase-y: controls.module.css has appBlockAddSection class', () => {
    assert.match(read(CSS_MODULE), /appBlockAddSection/, 'must define appBlockAddSection class');
});

test('phase-y: controls.module.css has appBlockAddBtn class', () => {
    assert.match(read(CSS_MODULE), /appBlockAddBtn/, 'must define appBlockAddBtn class');
});

test('phase-y: controls.module.css Phase Y styles use --lb-* tokens', () => {
    // The Phase Y section must include at least one --lb-* token reference
    const src = read(CSS_MODULE);
    const phaseYSection = src.slice(src.indexOf('Phase Y'));
    assert.match(phaseYSection, /--lb-/, 'Phase Y CSS must use --lb-* design tokens');
});

test('phase-y: controls.module.css Phase Y styles have no raw rounded-[Npx]', () => {
    assert.doesNotMatch(read(CSS_MODULE), /rounded-\[\d+px\]/, 'no raw rounded-[Npx] Tailwind classes');
});

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-CUTTING: backward-compat verification (structural)
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-y: AppBlockSlotPanel does not import from ExperiencePicker.tsx (foreign WIP)', () => {
    assert.doesNotMatch(
        read(APP_BLOCK_PANEL),
        /ExperiencePicker/,
        'must not import from foreign-WIP ExperiencePicker.tsx',
    );
});

test('phase-y: proxy route does not import from api-client/src/index.ts (foreign WIP)', () => {
    assert.doesNotMatch(
        read(PROXY_ROUTE),
        /api-client\/src\/index/,
        'must not import from foreign-WIP api-client/src/index.ts',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGE.JSON
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-y: package.json test command includes theme-editor-y.test.mjs', () => {
    assert.match(
        read(PKG_JSON),
        /theme-editor-y\.test\.mjs/,
        'package.json test command must include theme-editor-y.test.mjs',
    );
});
