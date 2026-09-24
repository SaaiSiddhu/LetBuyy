/**
 * Phase W — Dynamic Sources + Resource Search: static-contract tests for the
 * merchant-web.
 *
 * These tests assert source-level contracts (file existence, import patterns,
 * ARIA/a11y markers, design-ratchet compliance, tenancy law, debounce pattern,
 * RISK-DUAL-N01 isolation) without spinning up Next.js or hitting the gateway/DB.
 *
 * Test style mirrors theme-editor-r/s/t/u/v.test.mjs:
 *  - node:test + node:assert/strict
 *  - readFileSync source assertions
 *  - structural/pattern checks only; no network, no DOM, no React render
 *
 * PHASE W HARD RULES verified here:
 * ── Proxy route ─────────────────────────────────────────────────────────────
 *  - resource-search/route.ts exists under stores/[store]/
 *  - Imports resolveOwnedStoreId (tenancy — merchant session must own store)
 *  - Imports merchantApiFetch (no direct DB access)
 *  - Does NOT import from @letbuyy/api-client index directly as a typed client
 *  - Has VALID_RESOURCE_TYPES enum guard (rejects unknown types)
 *  - Returns 400 for invalid type
 *  - Forwards to /themes/resource-search on gateway
 *  - No import from page.tsx or globals.css
 *  - No raw rounded-[Npx] classes
 *
 * ── ResourcePickerControl ────────────────────────────────────────────────────
 *  - ResourcePickerControl.tsx exists and imports from @letbuyy/ui
 *  - Accepts storeName prop (Phase W addition)
 *  - Contains role="combobox" on the search input (WAI-ARIA 1.2 combobox)
 *  - Contains role="listbox" on the dropdown container
 *  - Contains role="option" on individual result items
 *  - Contains aria-activedescendant on the input
 *  - Contains aria-expanded on the combobox input
 *  - Debounces at 300ms (setTimeout pattern)
 *  - Calls /api/stores/ same-origin proxy via raw fetch (no api-client import)
 *  - Loading state is present (state === 'loading' or similar)
 *  - No-results / empty state is present
 *  - Error state is present
 *  - Clear button is present with aria-label
 *  - NOT-CONNECTED fallback present (for no-storeName mode — backward compat)
 *  - RISK-DUAL-N01: onChange emits id only; no section_definitions mutation
 *  - No dangerouslySetInnerHTML
 *  - No import from page.tsx, globals.css, @letbuyy/api-client, @supabase
 *  - No raw rounded-[Npx] classes (design ratchet)
 *
 * ── SchemaFormRenderer ───────────────────────────────────────────────────────
 *  - Passes storeName to ResourcePickerControl in resource picker cases
 *
 * ── CSS module ───────────────────────────────────────────────────────────────
 *  - controls.module.css has combobox styles using --lb-* tokens
 *
 * ── package.json ─────────────────────────────────────────────────────────────
 *  - theme-editor-w.test.mjs is included in the test command
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const ROOT = new URL('../../../..', import.meta.url).pathname;

function read(rel) {
    return readFileSync(`${ROOT}/${rel}`, 'utf8');
}
function exists(rel) {
    return existsSync(`${ROOT}/${rel}`);
}

const MCP_BASE = 'apps/merchant/web/src';
const CONTROLS_DIR = `${MCP_BASE}/components/theme-editor/controls`;
const RENDERER = `${MCP_BASE}/components/theme-editor/SchemaFormRenderer.tsx`;

const RESOURCE_PICKER = `${CONTROLS_DIR}/ResourcePickerControl.tsx`;
const CSS_MODULE = `${CONTROLS_DIR}/controls.module.css`;
const PROXY_ROUTE = `${MCP_BASE}/app/api/stores/[store]/resource-search/route.ts`;
const PKG_JSON = 'apps/merchant/web/package.json';

// ── File existence ─────────────────────────────────────────────────────────────

test('phase-w: resource-search/route.ts proxy exists under stores/[store]/', () => {
    assert.ok(exists(PROXY_ROUTE), 'resource-search/route.ts missing — must be at app/api/stores/[store]/resource-search/route.ts');
});

test('phase-w: ResourcePickerControl.tsx exists', () => {
    assert.ok(exists(RESOURCE_PICKER), 'ResourcePickerControl.tsx missing');
});

// ── Proxy route: imports ───────────────────────────────────────────────────────

test('phase-w: proxy route imports resolveOwnedStoreId (tenancy law)', () => {
    const src = read(PROXY_ROUTE);
    assert.match(
        src,
        /resolveOwnedStoreId/,
        'resource-search proxy must import resolveOwnedStoreId to verify merchant owns the store',
    );
});

test('phase-w: proxy route imports merchantApiFetch (no direct DB)', () => {
    const src = read(PROXY_ROUTE);
    assert.match(
        src,
        /merchantApiFetch/,
        'resource-search proxy must use merchantApiFetch — no direct DB access in merchant proxy',
    );
});

test('phase-w: proxy route does NOT import createMerchantApiClient (raw fetch required)', () => {
    const src = read(PROXY_ROUTE);
    // The proxy must use merchantApiFetch directly, not the typed api-client,
    // to avoid touching api-client/index.ts (foreign WIP).
    assert.doesNotMatch(
        src,
        /createMerchantApiClient/,
        'resource-search proxy must not use the typed api-client — use merchantApiFetch directly',
    );
});

// ── Proxy route: type validation ───────────────────────────────────────────────

test('phase-w: proxy route has VALID_RESOURCE_TYPES enum (rejects unknown types)', () => {
    const src = read(PROXY_ROUTE);
    assert.match(
        src,
        /VALID_RESOURCE_TYPES/,
        'must define VALID_RESOURCE_TYPES constant to guard against unknown type values',
    );
});

test('phase-w: proxy route lists all five resource types', () => {
    const src = read(PROXY_ROUTE);
    assert.match(src, /product/, 'must list "product" as a valid type');
    assert.match(src, /collection/, 'must list "collection" as a valid type');
    assert.match(src, /page/, 'must list "page" as a valid type');
    assert.match(src, /blog/, 'must list "blog" as a valid type');
    assert.match(src, /menu/, 'must list "menu" as a valid type');
});

test('phase-w: proxy route returns 400 for invalid type', () => {
    const src = read(PROXY_ROUTE);
    // Must have a 400 response when type is not in the valid set
    assert.match(
        src,
        /status.*400|400.*status/,
        'proxy must return HTTP 400 for invalid/missing resource type',
    );
});

// ── Proxy route: gateway forwarding ───────────────────────────────────────────

test('phase-w: proxy route forwards to /themes/resource-search on gateway', () => {
    const src = read(PROXY_ROUTE);
    assert.match(
        src,
        /\/themes\/resource-search/,
        'proxy must forward to gateway /themes/resource-search path',
    );
});

test('phase-w: proxy route passes store_id in gateway URL (tenant scoping)', () => {
    const src = read(PROXY_ROUTE);
    assert.match(
        src,
        /store_id/,
        'proxy must include store_id in the gateway query (tenancy)',
    );
});

// ── Proxy route: limit validation ──────────────────────────────────────────────

test('phase-w: proxy route enforces limit max (clamps or rejects oversized limits)', () => {
    const src = read(PROXY_ROUTE);
    assert.match(
        src,
        /Math\.min|limit.*50|50.*limit/,
        'proxy must clamp limit to a maximum of 50',
    );
});

// ── Proxy route: not-connected honesty ────────────────────────────────────────

test('phase-w: proxy route documents NOT-CONNECTED contract in a comment', () => {
    const src = read(PROXY_ROUTE);
    assert.match(
        src,
        /NOT-CONNECTED/,
        'proxy must document NOT-CONNECTED — it depends on the gateway resource-search route',
    );
});

// ── Proxy route: no forbidden imports ─────────────────────────────────────────

test('phase-w: proxy route does not import from page.tsx (foreign WIP)', () => {
    const src = read(PROXY_ROUTE);
    assert.doesNotMatch(src, /from.*page\.tsx/, 'must not import from foreign-WIP editor page.tsx');
});

test('phase-w: proxy route does not import globals.css', () => {
    const src = read(PROXY_ROUTE);
    assert.doesNotMatch(src, /globals\.css/, 'must not import globals.css');
});

test('phase-w: proxy route does not use Supabase', () => {
    const src = read(PROXY_ROUTE);
    assert.doesNotMatch(src, /@supabase|createClient/, 'must not access Supabase directly');
});

test('phase-w: proxy route has no raw rounded-[Npx] classes (design ratchet)', () => {
    assert.doesNotMatch(read(PROXY_ROUTE), /rounded-\[\d+px\]/);
});

// ── ResourcePickerControl: imports ────────────────────────────────────────────

test('phase-w: ResourcePickerControl imports from @letbuyy/ui (design token compliance)', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(src, /from '@letbuyy\/ui'/, 'must import from @letbuyy/ui');
});

// ── ResourcePickerControl: storeName prop ────────────────────────────────────

test('phase-w: ResourcePickerControl accepts storeName prop (Phase W addition)', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /storeName/,
        'ResourcePickerControl must accept storeName prop for live search',
    );
});

// ── ResourcePickerControl: ARIA combobox pattern ──────────────────────────────

test('phase-w: ResourcePickerControl has role="combobox" on the search input (WAI-ARIA 1.2)', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /role="combobox"/,
        'search input must have role="combobox" per WAI-ARIA 1.2 combobox pattern',
    );
});

test('phase-w: ResourcePickerControl has role="listbox" on the dropdown (WAI-ARIA 1.2)', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /role="listbox"/,
        'dropdown container must have role="listbox"',
    );
});

test('phase-w: ResourcePickerControl has role="option" on individual result items (WAI-ARIA 1.2)', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /role="option"/,
        'each result item must have role="option"',
    );
});

test('phase-w: ResourcePickerControl has aria-activedescendant on the combobox input', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /aria-activedescendant/,
        'combobox input must have aria-activedescendant for keyboard navigation',
    );
});

test('phase-w: ResourcePickerControl has aria-expanded on the combobox input', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(src, /aria-expanded/, 'combobox input must have aria-expanded');
});

test('phase-w: ResourcePickerControl has aria-haspopup="listbox" on combobox input', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(src, /aria-haspopup="listbox"/, 'combobox input must declare aria-haspopup="listbox"');
});

test('phase-w: ResourcePickerControl has aria-controls pointing at listbox id', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(src, /aria-controls/, 'combobox input must have aria-controls pointing at the listbox');
});

test('phase-w: ResourcePickerControl has aria-selected on option items', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(src, /aria-selected/, 'option items must have aria-selected');
});

test('phase-w: ResourcePickerControl has aria-autocomplete="list" on combobox input', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(src, /aria-autocomplete="list"/, 'combobox input must declare aria-autocomplete="list"');
});

// ── ResourcePickerControl: keyboard navigation ────────────────────────────────

test('phase-w: ResourcePickerControl handles ArrowDown key (keyboard navigation)', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(src, /ArrowDown/, 'must handle ArrowDown key for keyboard navigation');
});

test('phase-w: ResourcePickerControl handles ArrowUp key (keyboard navigation)', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(src, /ArrowUp/, 'must handle ArrowUp key for keyboard navigation');
});

test('phase-w: ResourcePickerControl handles Enter key to select active option', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(src, /key === 'Enter'|key==='Enter'/, 'must handle Enter key to select the active option');
});

test('phase-w: ResourcePickerControl handles Escape key to close dropdown', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(src, /Escape/, 'must handle Escape key to close the dropdown');
});

// ── ResourcePickerControl: debounce ───────────────────────────────────────────

test('phase-w: ResourcePickerControl debounces search at 300ms', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /300/,
        'must debounce search queries at 300ms',
    );
    assert.match(
        src,
        /setTimeout/,
        'must use setTimeout for the debounce implementation',
    );
});

test('phase-w: ResourcePickerControl clears the debounce timer on unmount/re-render', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /clearTimeout/,
        'must clear the debounce timer to prevent stale requests on unmount / query change',
    );
});

// ── ResourcePickerControl: raw fetch via same-origin proxy ────────────────────

test('phase-w: ResourcePickerControl calls /api/stores/ proxy via raw fetch (no api-client)', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /\/api\/stores\//,
        'must call the same-origin /api/stores/ proxy path',
    );
    assert.match(
        src,
        /\bfetch\(/,
        'must use raw fetch — not createMerchantApiClient',
    );
});

test('phase-w: ResourcePickerControl passes resource type in fetch URL', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /field\.type|type.*field/,
        'must include field.type in the search URL',
    );
});

// ── ResourcePickerControl: states ─────────────────────────────────────────────

test('phase-w: ResourcePickerControl has a loading state', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /loading|Loading/,
        'must render a loading state while the search request is in-flight',
    );
});

test('phase-w: ResourcePickerControl has a no-results state', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /no-results|no_results|No.*found|empty/,
        'must render a no-results / empty state when the search returns nothing',
    );
});

test('phase-w: ResourcePickerControl has an error state', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /error|Error/,
        'must render an error state when the search request fails',
    );
});

// ── ResourcePickerControl: clear button ───────────────────────────────────────

test('phase-w: ResourcePickerControl has a clear button for the selected value', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /clear|Clear/,
        'must have a clear button so the merchant can deselect the current resource',
    );
});

test('phase-w: ResourcePickerControl clear button has an aria-label', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /aria-label=.*[Cc]lear/,
        'clear button must have an aria-label for screen-reader users',
    );
});

// ── ResourcePickerControl: NOT-CONNECTED fallback ────────────────────────────

test('phase-w: ResourcePickerControl shows NOT-CONNECTED fallback when storeName is absent', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /NOT-CONNECTED/,
        'must show a NOT-CONNECTED state when storeName is not provided (Phase U backward compat)',
    );
});

// ── ResourcePickerControl: RISK-DUAL-N01 ────────────────────────────────────

test('phase-w: RISK-DUAL-N01 — notes onChange emits id only, never touches section_definitions', () => {
    const src = read(RESOURCE_PICKER);
    assert.match(
        src,
        /RISK-DUAL-N01/,
        'must document RISK-DUAL-N01: onChange emits resource id only, never touches section_definitions',
    );
});

test('phase-w: RISK-DUAL-N01 — no write to section_definitions in ResourcePickerControl', () => {
    const src = read(RESOURCE_PICKER);
    assert.doesNotMatch(
        src,
        /section_definitions\s*=\s*[^>]/,
        'must not assign to section_definitions (RISK-DUAL-N01)',
    );
});

// ── ResourcePickerControl: no forbidden patterns ──────────────────────────────

test('phase-w: ResourcePickerControl has no dangerouslySetInnerHTML (sanitize law)', () => {
    const src = read(RESOURCE_PICKER);
    assert.doesNotMatch(src, /dangerouslySetInnerHTML/, 'must not use dangerouslySetInnerHTML');
});

test('phase-w: ResourcePickerControl does not import from page.tsx (foreign WIP not touched)', () => {
    const src = read(RESOURCE_PICKER);
    assert.doesNotMatch(src, /from.*editor\/page/, 'must not import from foreign-WIP editor/page.tsx');
});

test('phase-w: ResourcePickerControl does not import globals.css (design ratchet)', () => {
    const src = read(RESOURCE_PICKER);
    assert.doesNotMatch(src, /globals\.css/, 'must not import globals.css — use controls.module.css or --lb-* tokens');
});

test('phase-w: ResourcePickerControl does not import from @letbuyy/api-client (no api-client edit)', () => {
    const src = read(RESOURCE_PICKER);
    assert.doesNotMatch(
        src,
        /from '@letbuyy\/api-client'/,
        'must not import from @letbuyy/api-client — use raw fetch to the same-origin proxy',
    );
});

test('phase-w: ResourcePickerControl does not use Supabase (no direct DB)', () => {
    const src = read(RESOURCE_PICKER);
    assert.doesNotMatch(src, /@supabase|createClient/, 'must not access Supabase directly');
});

test('phase-w: ResourcePickerControl has no raw rounded-[Npx] classes (design ratchet)', () => {
    assert.doesNotMatch(read(RESOURCE_PICKER), /rounded-\[\d+px\]/);
});

// ── SchemaFormRenderer: passes storeName to ResourcePickerControl ────────────

test('phase-w: SchemaFormRenderer passes storeName to ResourcePickerControl (Phase W wiring)', () => {
    const src = read(RENDERER);
    // The resource picker cases must now forward storeName to ResourcePickerControl
    assert.match(
        src,
        /ResourcePickerControl[\s\S]{0,200}storeName/,
        'SchemaFormRenderer must pass storeName={storeName} to ResourcePickerControl',
    );
});

// ── controls.module.css: combobox styles ──────────────────────────────────────

test('phase-w: controls.module.css has resourcePickerCombobox class', () => {
    const src = read(CSS_MODULE);
    assert.match(
        src,
        /resourcePickerCombobox/,
        'controls.module.css must define the resourcePickerCombobox class for Phase W',
    );
});

test('phase-w: controls.module.css has resourcePickerDropdown class', () => {
    const src = read(CSS_MODULE);
    assert.match(src, /resourcePickerDropdown/, 'must define resourcePickerDropdown class');
});

test('phase-w: controls.module.css has resourcePickerOption class', () => {
    const src = read(CSS_MODULE);
    assert.match(src, /resourcePickerOption/, 'must define resourcePickerOption class');
});

test('phase-w: controls.module.css Phase W styles use --lb-* tokens', () => {
    const src = read(CSS_MODULE);
    // Already verified by the phase-u test but confirmed again for Phase W additions
    assert.match(src, /--lb-/, 'Phase W CSS must use --lb-* design tokens');
});

// ── package.json: test command includes Phase W ───────────────────────────────

test('phase-w: package.json test command includes theme-editor-w.test.mjs', () => {
    const src = read(PKG_JSON);
    assert.match(
        src,
        /theme-editor-w\.test\.mjs/,
        'package.json test command must include theme-editor-w.test.mjs',
    );
});
