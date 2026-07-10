// ──────────────────────────────────────────────────────────────────────────────
// Phase X — Cross-tenant isolation tests for the media-library route, upload
// MIME allowlist, and SVG policy enforcement.
//
// TESTING APPROACH: two-tier
//   A) Source-inspection (readFileSync) — proves tenancy + structural properties
//      without requiring a Cloudflare Worker runtime. Matches the established
//      pattern from resource-search-w.test.ts and tenant-isolation.test.ts.
//   B) Unit tests for validateUploadMime — pure function, no runtime needed.
//
// COVERAGE
//   X-T01: resolveCustomUser called before any media table query (merchant gate)
//   X-T02: verifySiteOwnership called before any media table query (tenancy gate)
//   X-T03: null customUser → 403 FORBIDDEN (customer token rejection)
//   X-T04: false verifySiteOwnership → 403 FORBIDDEN (cross-tenant rejection)
//   X-T05: media table query always carries .eq('store_id', storeId) — no cross-site leak
//   X-T06: no literal UUID used as store_id in table queries
//   X-T07: missing store_id fails closed (400 VALIDATION_ERROR — uuid parse failure)
//   X-T08: type filter restricts query with .eq('media_type', type) for non-'all' types
//   X-T09: search param uses ilike on filename and original_name
//   X-T10: authMiddleware registered for /media-library in themes.ts before slug routes
//   X-T11: mediaLibraryRouter imported and mounted via router.route in themes.ts
//   X-T12: route is read-only (no insert, update, delete, rpc)
//   X-T13: MIME validation — image/svg+xml rejected (SVG policy)
//   X-T14: MIME validation — image/svg rejected (SVG policy, alternate form)
//   X-T15: MIME validation — text/html rejected (script/HTML block)
//   X-T16: MIME validation — application/javascript rejected (script block)
//   X-T17: MIME validation — empty MIME type rejected (fail-closed)
//   X-T18: MIME validation — application/octet-stream rejected (not on allowlist)
//   X-T19: MIME validation — image/jpeg accepted
//   X-T20: MIME validation — image/png accepted
//   X-T21: MIME validation — image/webp accepted
//   X-T22: MIME validation — image/gif accepted
//   X-T23: MIME validation — video/mp4 accepted
//   X-T24: MIME validation — video/webm accepted
//   X-T25: MIME validation — video/quicktime accepted
//   X-T26: MIME validation — model/gltf-binary accepted
//   X-T27: upload.ts imports validateUploadMime and calls it before size check
//   X-T28: upload.ts returns MIME_NOT_ALLOWED on rejection (source-inspection)
// ──────────────────────────────────────────────────────────────────────────────

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import path from 'node:path';
import { validateUploadMime } from '../lib/upload-mime';

// ── Source fixtures ────────────────────────────────────────────────────────────

const MEDIA_LIB_SRC = readFileSync(
    path.resolve(__dirname, '../routes/themes/media-library.ts'),
    'utf8',
);

const THEMES_SRC = readFileSync(
    path.resolve(__dirname, '../routes/themes.ts'),
    'utf8',
);

const UPLOAD_SRC = readFileSync(
    path.resolve(__dirname, '../routes/upload.ts'),
    'utf8',
);

// Helper: return the GET route handler body (everything after router.get('/', ...))
function routeHandlerBody(): string {
    const marker = "router.get('/', async (c) =>";
    const idx = MEDIA_LIB_SRC.indexOf(marker);
    assert.ok(idx !== -1, `Could not find route handler marker: ${marker}`);
    return MEDIA_LIB_SRC.slice(idx);
}

// ── TENANCY: resolveCustomUser before any data access ─────────────────────────

test('X-T01: resolveCustomUser is called before any media table query (merchant gate)', () => {
    const handler = routeHandlerBody();

    const resolveIdx = handler.indexOf('resolveCustomUser(');
    assert.ok(resolveIdx !== -1, 'resolveCustomUser must be called inside the route handler');

    const tableIdx = handler.indexOf("from('media')");
    assert.ok(tableIdx !== -1, "from('media') must appear in the handler");

    assert.ok(
        resolveIdx < tableIdx,
        'resolveCustomUser must precede the media table query in the handler',
    );
});

// ── TENANCY: verifySiteOwnership before any data access ───────────────────────

test('X-T02: verifySiteOwnership is called before any media table query (tenancy gate)', () => {
    const handler = routeHandlerBody();

    const verifyIdx = handler.indexOf('verifySiteOwnership(');
    assert.ok(verifyIdx !== -1, 'verifySiteOwnership must be called inside the route handler');

    const tableIdx = handler.indexOf("from('media')");
    assert.ok(
        verifyIdx < tableIdx,
        'verifySiteOwnership must precede the media table query in the handler',
    );
});

// ── TENANCY: customer token rejection (403) ────────────────────────────────────

test('X-T03: null customUser result produces 403 FORBIDDEN (customer HS256 token rejection)', () => {
    assert.match(
        MEDIA_LIB_SRC,
        /if\s*\(\s*!customUser\s*\)/,
        'null customUser check must be present',
    );
    assert.match(
        MEDIA_LIB_SRC,
        /FORBIDDEN.*User profile not found/,
        '403 FORBIDDEN response for null customUser must be present',
    );
});

// ── TENANCY: cross-site rejection (403) ───────────────────────────────────────

test('X-T04: false verifySiteOwnership result produces 403 FORBIDDEN (cross-tenant rejection)', () => {
    assert.match(
        MEDIA_LIB_SRC,
        /if\s*\(\s*!ownsStore\s*\)/,
        '!ownsStore check must be present',
    );
    assert.match(
        MEDIA_LIB_SRC,
        /FORBIDDEN.*Not authorized/,
        '403 FORBIDDEN response for cross-tenant access must be present',
    );
});

// ── TENANCY: store_id scoping on media table ──────────────────────────────────

test('X-T05: media table query is scoped by .eq("store_id", storeId) — Site A cannot return Site B media', () => {
    const tableIdx = MEDIA_LIB_SRC.indexOf("from('media')");
    assert.ok(tableIdx !== -1, "from('media') must be present");

    const window = MEDIA_LIB_SRC.slice(tableIdx, tableIdx + 500);
    assert.ok(
        /\.eq\(\s*['"]store_id['"]\s*,\s*storeId\s*\)/.test(window),
        "media query must have .eq('store_id', storeId) within 500 chars of from() call",
    );
});

// ── TENANCY: no hardcoded store_id literals ───────────────────────────────────

test('X-T06: no literal UUID is used as store_id argument in table queries', () => {
    const literalUuidPattern = /\.eq\(\s*['"]store_id['"]\s*,\s*['"][0-9a-f-]{36}['"]\s*\)/i;
    assert.ok(
        !literalUuidPattern.test(MEDIA_LIB_SRC),
        'No literal UUID should appear as store_id in table queries (must use the verified variable)',
    );
});

// ── VALIDATION: missing store_id fails closed ─────────────────────────────────

test('X-T07: missing store_id fails closed — uuid validation rejects empty/missing value (400)', () => {
    // The schema uses z.string().uuid() for store_id. If store_id is absent or
    // not a valid UUID, safeParse fails → VALIDATION_ERROR 400 (not a 500 or 200).
    assert.match(
        MEDIA_LIB_SRC,
        /store_id\s*:\s*z\.string\(\)\.uuid\(\)/,
        'store_id must be validated as UUID via z.string().uuid()',
    );
    assert.match(
        MEDIA_LIB_SRC,
        /VALIDATION_ERROR/,
        'VALIDATION_ERROR must be returned when params are invalid',
    );
    assert.match(
        MEDIA_LIB_SRC,
        /\.safeParse\(/,
        'safeParse must be used (never parse — that would throw)',
    );
});

// ── FILTERING: type filter restricts results ──────────────────────────────────

test('X-T08: type filter restricts query to specific media_type rows via .eq("media_type", type)', () => {
    // The type filter must only apply when type !== 'all'.
    assert.match(
        MEDIA_LIB_SRC,
        /if\s*\(\s*type\s*!==\s*['"]all['"]\s*\)/,
        "type filter must be conditional on type !== 'all'",
    );
    assert.match(
        MEDIA_LIB_SRC,
        /\.eq\(\s*['"]media_type['"]\s*,\s*type\s*\)/,
        ".eq('media_type', type) must be used for the type filter",
    );
});

// ── FILTERING: search uses ilike on filename + original_name ─────────────────

test('X-T09: search param uses ilike on filename and original_name', () => {
    assert.match(
        MEDIA_LIB_SRC,
        /filename\.ilike\.\%/,
        'filename ilike pattern must be present in search query',
    );
    assert.match(
        MEDIA_LIB_SRC,
        /original_name\.ilike\.\%/,
        'original_name ilike pattern must be present in search query',
    );
    // Both filters must be in an .or() call (so they are OR-combined, not AND-combined)
    assert.match(
        MEDIA_LIB_SRC,
        /\.or\(/,
        '.or() must be used to combine filename and original_name ilike filters',
    );
});

// ── AUTH: authMiddleware registered for /media-library in themes.ts ───────────

test('X-T10: authMiddleware registered for /media-library in themes.ts before slug routes', () => {
    assert.match(
        THEMES_SRC,
        /router\.use\(\s*['"]\/media-library['"]\s*,\s*authMiddleware\s*\)/,
        "router.use('/media-library', authMiddleware) must be present in themes.ts",
    );

    // Verify it appears BEFORE the first /:slug catch-all middleware
    const mediaLibMiddlewareIdx = THEMES_SRC.indexOf("router.use('/media-library', authMiddleware)");
    const firstSlugMiddlewareIdx = THEMES_SRC.indexOf("router.use('/:slug/");
    assert.ok(
        mediaLibMiddlewareIdx < firstSlugMiddlewareIdx,
        '/media-library authMiddleware must be registered before /:slug/* middleware',
    );
});

// ── AUTH: mediaLibraryRouter mounted in themes.ts ─────────────────────────────

test('X-T11: mediaLibraryRouter imported and mounted via router.route in themes.ts', () => {
    assert.match(
        THEMES_SRC,
        /import\s+mediaLibraryRouter\s+from\s+['"]\.\/themes\/media-library['"]/,
        'mediaLibraryRouter must be imported from ./themes/media-library in themes.ts',
    );

    assert.match(
        THEMES_SRC,
        /router\.route\(\s*['"]\/media-library['"]\s*,\s*mediaLibraryRouter\s*\)/,
        "router.route('/media-library', mediaLibraryRouter) must be present in themes.ts",
    );
});

// ── READ-ONLY: no write operations in media-library.ts ───────────────────────

test('X-T12: media-library route is read-only (no insert, update, delete, rpc)', () => {
    assert.doesNotMatch(MEDIA_LIB_SRC, /\.insert\(/, 'media-library must not insert');
    assert.doesNotMatch(MEDIA_LIB_SRC, /\.update\(/, 'media-library must not update');
    assert.doesNotMatch(MEDIA_LIB_SRC, /\.delete\(/, 'media-library must not delete');
    assert.doesNotMatch(MEDIA_LIB_SRC, /db\.rpc\(/, 'media-library must not call RPCs');
    assert.doesNotMatch(MEDIA_LIB_SRC, /router\.post\(/, 'media-library must not register POST routes');
    assert.doesNotMatch(MEDIA_LIB_SRC, /router\.put\(/, 'media-library must not register PUT routes');
    assert.doesNotMatch(MEDIA_LIB_SRC, /router\.patch\(/, 'media-library must not register PATCH routes');
    assert.doesNotMatch(MEDIA_LIB_SRC, /router\.delete\(/, 'media-library must not register DELETE routes');
});

// ── MIME VALIDATION: SVG policy enforcement ───────────────────────────────────

test('X-T13: validateUploadMime rejects image/svg+xml (SVG policy)', () => {
    const result = validateUploadMime({ type: 'image/svg+xml' });
    assert.equal(result.ok, false, 'SVG should be rejected');
    assert.ok(
        !result.ok && result.error.toLowerCase().includes('svg'),
        'rejection message should mention SVG',
    );
});

test('X-T14: validateUploadMime rejects image/svg (alternate SVG MIME form)', () => {
    const result = validateUploadMime({ type: 'image/svg' });
    assert.equal(result.ok, false, 'image/svg should be rejected');
    assert.ok(
        !result.ok && result.error.toLowerCase().includes('svg'),
        'rejection message should mention SVG',
    );
});

// ── MIME VALIDATION: HTML and script type rejection ───────────────────────────

test('X-T15: validateUploadMime rejects text/html', () => {
    const result = validateUploadMime({ type: 'text/html' });
    assert.equal(result.ok, false, 'text/html should be rejected');
});

test('X-T16: validateUploadMime rejects application/javascript', () => {
    const result = validateUploadMime({ type: 'application/javascript' });
    assert.equal(result.ok, false, 'application/javascript should be rejected');
});

// ── MIME VALIDATION: empty / missing MIME type rejected ───────────────────────

test('X-T17: validateUploadMime rejects empty MIME type (fail-closed)', () => {
    const result = validateUploadMime({ type: '' });
    assert.equal(result.ok, false, 'empty MIME type should be rejected');
});

// ── MIME VALIDATION: application/octet-stream not on allowlist ───────────────

test('X-T18: validateUploadMime rejects application/octet-stream (not on allowlist)', () => {
    const result = validateUploadMime({ type: 'application/octet-stream' });
    assert.equal(result.ok, false, 'application/octet-stream should be rejected as it is not on the allowlist');
});

// ── MIME VALIDATION: allowed image types ─────────────────────────────────────

test('X-T19: validateUploadMime accepts image/jpeg', () => {
    const result = validateUploadMime({ type: 'image/jpeg' });
    assert.equal(result.ok, true, 'image/jpeg should be allowed');
    assert.ok(result.ok && result.mime === 'image/jpeg');
});

test('X-T20: validateUploadMime accepts image/png', () => {
    const result = validateUploadMime({ type: 'image/png' });
    assert.equal(result.ok, true, 'image/png should be allowed');
});

test('X-T21: validateUploadMime accepts image/webp', () => {
    const result = validateUploadMime({ type: 'image/webp' });
    assert.equal(result.ok, true, 'image/webp should be allowed');
});

test('X-T22: validateUploadMime accepts image/gif', () => {
    const result = validateUploadMime({ type: 'image/gif' });
    assert.equal(result.ok, true, 'image/gif should be allowed');
});

// ── MIME VALIDATION: allowed video types ─────────────────────────────────────

test('X-T23: validateUploadMime accepts video/mp4', () => {
    const result = validateUploadMime({ type: 'video/mp4' });
    assert.equal(result.ok, true, 'video/mp4 should be allowed');
});

test('X-T24: validateUploadMime accepts video/webm', () => {
    const result = validateUploadMime({ type: 'video/webm' });
    assert.equal(result.ok, true, 'video/webm should be allowed');
});

test('X-T25: validateUploadMime accepts video/quicktime', () => {
    const result = validateUploadMime({ type: 'video/quicktime' });
    assert.equal(result.ok, true, 'video/quicktime should be allowed');
});

// ── MIME VALIDATION: allowed model types ─────────────────────────────────────

test('X-T26: validateUploadMime accepts model/gltf-binary', () => {
    const result = validateUploadMime({ type: 'model/gltf-binary' });
    assert.equal(result.ok, true, 'model/gltf-binary should be allowed');
});

// ── UPLOAD.TS: MIME validation wired into the upload route ───────────────────

test('X-T27: upload.ts imports validateUploadMime from lib/upload-mime and calls it before the size check', () => {
    // Import present
    assert.match(
        UPLOAD_SRC,
        /import\s*\{[^}]*validateUploadMime[^}]*\}\s*from\s*['"]\.\.\/lib\/upload-mime['"]/,
        'validateUploadMime must be imported from ../lib/upload-mime in upload.ts',
    );

    // Called before file.size > sizeLimit check
    const mimeCheckIdx = UPLOAD_SRC.indexOf('validateUploadMime(file)');
    assert.ok(mimeCheckIdx !== -1, 'validateUploadMime(file) must be called in upload.ts');

    const sizeLimitIdx = UPLOAD_SRC.indexOf('file.size > sizeLimit');
    assert.ok(sizeLimitIdx !== -1, 'file.size > sizeLimit check must be present');

    assert.ok(
        mimeCheckIdx < sizeLimitIdx,
        'MIME validation must precede the size check in upload.ts',
    );
});

test('X-T28: upload.ts returns MIME_NOT_ALLOWED code when validateUploadMime rejects', () => {
    assert.match(
        UPLOAD_SRC,
        /MIME_NOT_ALLOWED/,
        'upload.ts must return MIME_NOT_ALLOWED error code when MIME is rejected',
    );
    assert.match(
        UPLOAD_SRC,
        /if\s*\(\s*!mimeCheck\.ok\s*\)/,
        'upload.ts must check !mimeCheck.ok and return early',
    );
});
