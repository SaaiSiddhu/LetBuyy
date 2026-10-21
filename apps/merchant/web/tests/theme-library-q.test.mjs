/**
 * Phase Q — Theme Library workspace: static-contract tests for the merchant-web.
 *
 * These tests assert source-level contracts (file existence, import patterns,
 * proxy tenancy law, destructive-action guards, state handling) without
 * spinning up Next.js or hitting the gateway/DB.
 *
 * Test style mirrors tests/federation/web-app-contract-boundary.test.mjs:
 * - node:test + node:assert/strict
 * - readFileSync source assertions
 * - structural/pattern checks only
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

// ── Proxy route existence ──────────────────────────────────────────────────────

test('phase-q: all six new proxy route files exist', () => {
    assert.ok(exists(`${MCP_BASE}/app/api/themes/library/route.ts`), 'library GET route missing');
    assert.ok(exists(`${MCP_BASE}/app/api/themes/library/create/route.ts`), 'library/create POST route missing');
    assert.ok(exists(`${MCP_BASE}/app/api/themes/[themeId]/duplicate/route.ts`), 'duplicate POST route missing');
    assert.ok(exists(`${MCP_BASE}/app/api/themes/[themeId]/rename/route.ts`), 'rename PATCH route missing');
    assert.ok(exists(`${MCP_BASE}/app/api/themes/[themeId]/archive/route.ts`), 'archive POST route missing');
    assert.ok(exists(`${MCP_BASE}/app/api/themes/[themeId]/route.ts`), 'themeId DELETE route missing');
});

// ── Component existence ────────────────────────────────────────────────────────

test('phase-q: ThemeLibraryCard and ThemeLibraryWorkspace components exist', () => {
    assert.ok(
        exists(`${MCP_BASE}/components/theme-library/ThemeLibraryCard.tsx`),
        'ThemeLibraryCard.tsx missing'
    );
    assert.ok(
        exists(`${MCP_BASE}/components/theme-library/ThemeLibraryWorkspace.tsx`),
        'ThemeLibraryWorkspace.tsx missing'
    );
});

// ── Tenancy law: all proxies use resolveOwnedStoreId ──────────────────────────

test('phase-q: library GET proxy resolves store ownership server-side', () => {
    const src = read(`${MCP_BASE}/app/api/themes/library/route.ts`);
    assert.match(src, /resolveOwnedStoreId/, 'library route must call resolveOwnedStoreId');
    assert.match(src, /merchantApiFetch/, 'library route must use merchantApiFetch');
    assert.match(src, /requireSession.*true|true.*requireSession/, 'library route must require session');
    // Must NOT accept a browser-supplied store UUID directly
    assert.doesNotMatch(src, /searchParams\.get\('store_id'\)/, 'library route must not accept raw store_id from client');
});

test('phase-q: library create proxy resolves store ownership server-side', () => {
    const src = read(`${MCP_BASE}/app/api/themes/library/create/route.ts`);
    assert.match(src, /resolveOwnedStoreId/, 'create route must call resolveOwnedStoreId');
    assert.match(src, /merchantApiFetch/, 'create route must use merchantApiFetch');
    assert.match(src, /store_id.*resolved\.storeId|resolved\.storeId.*store_id/, 'create route must use resolved storeId');
});

test('phase-q: duplicate proxy resolves store ownership server-side', () => {
    const src = read(`${MCP_BASE}/app/api/themes/[themeId]/duplicate/route.ts`);
    assert.match(src, /resolveOwnedStoreId/, 'duplicate route must call resolveOwnedStoreId');
    assert.match(src, /merchantApiFetch/, 'duplicate route must use merchantApiFetch');
});

test('phase-q: rename proxy resolves store ownership server-side', () => {
    const src = read(`${MCP_BASE}/app/api/themes/[themeId]/rename/route.ts`);
    assert.match(src, /resolveOwnedStoreId/, 'rename route must call resolveOwnedStoreId');
    assert.match(src, /PATCH/, 'rename route must export PATCH handler');
    assert.match(src, /merchantApiFetch/, 'rename route must use merchantApiFetch');
});

test('phase-q: archive proxy resolves store ownership server-side', () => {
    const src = read(`${MCP_BASE}/app/api/themes/[themeId]/archive/route.ts`);
    assert.match(src, /resolveOwnedStoreId/, 'archive route must call resolveOwnedStoreId');
    assert.match(src, /merchantApiFetch/, 'archive route must use merchantApiFetch');
});

test('phase-q: delete proxy resolves store ownership server-side', () => {
    const src = read(`${MCP_BASE}/app/api/themes/[themeId]/route.ts`);
    assert.match(src, /resolveOwnedStoreId/, 'delete route must call resolveOwnedStoreId');
    assert.match(src, /DELETE/, 'delete route must export DELETE handler');
    assert.match(src, /merchantApiFetch/, 'delete route must use merchantApiFetch');
    // Calls gateway DELETE /themes/:slug/unpublished
    assert.match(src, /unpublished/, 'delete proxy must call gateway /unpublished endpoint');
});

// ── No direct DB access in any proxy ──────────────────────────────────────────

test('phase-q: no proxy route imports Supabase or writes to DB directly', () => {
    const routeFiles = [
        `${MCP_BASE}/app/api/themes/library/route.ts`,
        `${MCP_BASE}/app/api/themes/library/create/route.ts`,
        `${MCP_BASE}/app/api/themes/[themeId]/duplicate/route.ts`,
        `${MCP_BASE}/app/api/themes/[themeId]/rename/route.ts`,
        `${MCP_BASE}/app/api/themes/[themeId]/archive/route.ts`,
        `${MCP_BASE}/app/api/themes/[themeId]/route.ts`,
    ];
    for (const file of routeFiles) {
        const src = read(file);
        assert.doesNotMatch(src, /@supabase\/|createSupabase|supabaseAdmin/, `${file}: must not use Supabase directly`);
        assert.doesNotMatch(src, /\.from\(.*\)\.insert|\.from\(.*\)\.update/, `${file}: must not write to DB directly`);
    }
});

// ── Cross-site proxy contract: storeId from session, not client ───────────────

test('phase-q: proxy routes never trust a browser-supplied store UUID directly', () => {
    // The pattern "store_id" should only appear as the VALUE sent to the gateway
    // (i.e., the gateway body/query containing resolved.storeId), never as a
    // raw queryParam read from the browser. Each proxy must resolve through
    // resolveOwnedStoreId(storeName), not pass through a client-supplied UUID.
    const routeFiles = [
        `${MCP_BASE}/app/api/themes/library/create/route.ts`,
        `${MCP_BASE}/app/api/themes/[themeId]/duplicate/route.ts`,
        `${MCP_BASE}/app/api/themes/[themeId]/rename/route.ts`,
        `${MCP_BASE}/app/api/themes/[themeId]/archive/route.ts`,
    ];
    for (const file of routeFiles) {
        const src = read(file);
        // These body-reading proxies must read store_name from the body, not a raw UUID
        assert.match(src, /store_name/, `${file}: must require store_name from body`);
        assert.match(src, /resolveOwnedStoreId/, `${file}: must call resolveOwnedStoreId`);
    }
});

// ── Published-delete guard surfaced to the UI ─────────────────────────────────

test('phase-q: workspace surfaces published-delete guard as user-friendly message', () => {
    const src = read(`${MCP_BASE}/components/theme-library/ThemeLibraryWorkspace.tsx`);
    assert.match(
        src,
        /CANNOT_DELETE_PUBLISHED_THEME|Cannot delete the currently published/,
        'workspace must handle CANNOT_DELETE_PUBLISHED_THEME gateway error'
    );
    assert.match(
        src,
        /THEME_CURRENTLY_PUBLISHED|Cannot archive your current/,
        'workspace must handle THEME_CURRENTLY_PUBLISHED gateway error'
    );
});

// ── Theme limit error surfaced to the UI ──────────────────────────────────────

test('phase-q: workspace surfaces theme limit error as user-friendly message', () => {
    const src = read(`${MCP_BASE}/components/theme-library/ThemeLibraryWorkspace.tsx`);
    assert.match(src, /THEME_LIMIT_REACHED/, 'workspace must handle THEME_LIMIT_REACHED gateway error');
});

// ── Destructive actions gated by ConfirmDialog ────────────────────────────────

test('phase-q: workspace uses ConfirmDialog for archive and delete', () => {
    const src = read(`${MCP_BASE}/components/theme-library/ThemeLibraryWorkspace.tsx`);
    assert.match(src, /ConfirmDialog/, 'workspace must use ConfirmDialog for destructive actions');
    assert.match(src, /destructive/, 'ConfirmDialog must be marked destructive');
    assert.match(src, /archive/, 'ConfirmDialog must be used for archive action');
    assert.match(src, /delete|Delete/, 'ConfirmDialog must be used for delete action');
});

// ── Loading/empty/error states ────────────────────────────────────────────────

test('phase-q: workspace handles loading, empty, and error states', () => {
    const src = read(`${MCP_BASE}/components/theme-library/ThemeLibraryWorkspace.tsx`);
    assert.match(src, /Skeleton/, 'workspace must show Skeleton during loading');
    assert.match(src, /No themes installed|no.*theme|empty/i, 'workspace must show empty state');
    assert.match(src, /Banner.*critical|critical.*Banner|fetchError/, 'workspace must show error Banner on fetch failure');
    assert.match(src, /Retry/, 'workspace must offer retry on error');
});

// ── Mobile-first layout ───────────────────────────────────────────────────────

test('phase-q: workspace uses responsive grid classes for mobile-first layout', () => {
    const src = read(`${MCP_BASE}/components/theme-library/ThemeLibraryWorkspace.tsx`);
    // mobile-first: starts as single column, expands with sm: and lg: breakpoints
    assert.match(src, /grid-cols-[23]|sm:grid-cols|lg:grid-cols/, 'workspace must use responsive grid');
});

// ── Keyboard a11y: action menus use accessible markup ────────────────────────

test('phase-q: ThemeLibraryCard uses aria-label for action menu buttons', () => {
    const src = read(`${MCP_BASE}/components/theme-library/ThemeLibraryCard.tsx`);
    assert.match(src, /aria-label/, 'ThemeLibraryCard must include aria-label on action buttons');
    assert.match(src, /Dropdown/, 'ThemeLibraryCard must use Dropdown for action menu');
});

test('theme workspace exposes discovery and the library together as named regions', () => {
    const src = read(`${MCP_BASE}/components/theme-library/ThemeWorkspace.tsx`);
    assert.match(src, /aria-label=\{marketplace \? 'Theme marketplace catalog' : 'Discover themes'\}/);
    assert.match(src, /<ThemeLibraryWorkspace/);
    assert.doesNotMatch(src, /activeTab|role="tabpanel"/, 'discovery is no longer hidden behind a tab');
});

// ── Page imports ThemeLibraryWorkspace ───────────────────────────────────────

test('phase-q: themes page imports and renders ThemeLibraryWorkspace', () => {
    const src = read(`${MCP_BASE}/app/[store]/online-store/themes/page.tsx`);
    assert.match(src, /ThemeWorkspace/, 'themes page must import the shared workspace');
    assert.match(
        src,
        /from '@\/components\/theme-library\/ThemeWorkspace'/,
        'must import from correct path'
    );
    assert.match(read(`${MCP_BASE}/components/theme-library/ThemeWorkspace.tsx`), /<ThemeLibraryWorkspace/);
});

// ── en-IN date format ──────────────────────────────────────────────────────────

test('phase-q: ThemeLibraryCard uses en-IN date format', () => {
    const src = read(`${MCP_BASE}/components/theme-library/ThemeLibraryCard.tsx`);
    assert.match(src, /en-IN/, 'ThemeLibraryCard must use en-IN locale for dates');
});

// ── @letbuyy/ui design tokens only (no raw px/radius/color) ──────────────────

test('phase-q: new components use only --lb-* design tokens, no raw pixel values', () => {
    const files = [
        `${MCP_BASE}/components/theme-library/ThemeLibraryCard.tsx`,
        `${MCP_BASE}/components/theme-library/ThemeLibraryWorkspace.tsx`,
    ];
    for (const file of files) {
        const src = read(file);
        // Raw pixel sizing like "px-4" or "rounded-md" would violate the ratchet
        // (must use var(--lb-*) tokens). We check for the pattern of token usage.
        assert.match(src, /--lb-/, `${file}: must use --lb-* design tokens`);
        // Must not use raw hardcoded radius or px values outside token vars
        // (e.g. "rounded-[12px]" or "p-4" are non-compliant; "var(--lb-radius-md)" is fine)
        assert.doesNotMatch(src, /rounded-\[\d+px\]/, `${file}: must not use raw radius px`);
    }
});

// ── Proxy error passthrough: merchantApiErrorResponse used in all routes ──────

test('phase-q: all proxy routes use merchantApiErrorResponse for error handling', () => {
    const routeFiles = [
        `${MCP_BASE}/app/api/themes/library/route.ts`,
        `${MCP_BASE}/app/api/themes/library/create/route.ts`,
        `${MCP_BASE}/app/api/themes/[themeId]/duplicate/route.ts`,
        `${MCP_BASE}/app/api/themes/[themeId]/rename/route.ts`,
        `${MCP_BASE}/app/api/themes/[themeId]/archive/route.ts`,
        `${MCP_BASE}/app/api/themes/[themeId]/route.ts`,
    ];
    for (const file of routeFiles) {
        const src = read(file);
        assert.match(src, /merchantApiErrorResponse/, `${file}: must use merchantApiErrorResponse`);
        assert.match(src, /readMerchantApiJson/, `${file}: must use readMerchantApiJson`);
    }
});

// ── Create dialog gated by Modal + Input ─────────────────────────────────────

test('phase-q: workspace uses Modal for create and rename dialogs', () => {
    const src = read(`${MCP_BASE}/components/theme-library/ThemeLibraryWorkspace.tsx`);
    assert.match(src, /Modal/, 'workspace must use Modal for create/rename dialogs');
    assert.match(src, /Input/, 'workspace must use Input for name fields');
    assert.match(src, /maxLength.*120|120.*maxLength/, 'name inputs must enforce 120 char max');
});

// ── Workspace does NOT import Supabase ────────────────────────────────────────

test('phase-q: ThemeLibraryWorkspace has no direct Supabase or gateway imports', () => {
    const src = read(`${MCP_BASE}/components/theme-library/ThemeLibraryWorkspace.tsx`);
    assert.doesNotMatch(src, /@supabase\/|createSupabase/, 'workspace must not import Supabase');
    assert.doesNotMatch(src, /createMerchantApiClient|merchantApiFetch/, 'workspace must call /api/* proxies, not the gateway client directly');
});

// ── Hardening Q: handlePublish sends store_name as query parameter ────────────

test('phase-q-hardening: handlePublish sends store_name as URL query parameter, not JSON body', () => {
    const src = read(`${MCP_BASE}/components/theme-library/ThemeLibraryWorkspace.tsx`);

    // The proxy at /api/themes/[themeId]/editor reads store_name from searchParams,
    // not from the request body. The fetch URL must include store_name in the query string.
    assert.match(
        src,
        /\/editor\?store_name=/,
        'handlePublish must include store_name as a query parameter in the /editor URL',
    );
    // The authenticated BFF owns live publication; the client supplies its loaded
    // actor/store/revision context and a stable intent rather than inventing it.
    assert.match(
        read(`${MCP_BASE}/app/api/themes/[themeId]/editor/route.ts`),
        /make_store_live/,
        'the BFF must publish through the canonical gateway contract',
    );
    for (const field of ['actorId', 'storeId', 'baseVersion', 'idempotencyKey']) assert.ok(src.includes(field));
    // The editor fetch must NOT smuggle store_name as JSON body alongside the query param
    // (that would mean it appears in JSON.stringify body, not needed with query param)
    const handlePublishBlock = src.slice(src.indexOf('handlePublish'), src.indexOf('handleDuplicate'));
    // store_name should appear in the URL (as encodeURIComponent(store)) not in JSON.stringify body
    assert.doesNotMatch(
        handlePublishBlock,
        /JSON\.stringify\(.*store_name.*make_store_live|JSON\.stringify\(.*make_store_live.*store_name/s,
        'handlePublish body must not include store_name in JSON.stringify — it belongs in the query string',
    );
});
