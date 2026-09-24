/**
 * Phase X — Media Library + Image/Video Picker Wiring: static-contract tests.
 *
 * Verifies source-level contracts (file existence, import patterns, ARIA/a11y
 * markers, design-ratchet compliance, tenancy law, upload safety, RISK-DUAL-N01
 * isolation) without spinning up Next.js or hitting the gateway/DB.
 *
 * Test style mirrors theme-editor-r/s/t/u/v/w.test.mjs:
 *  - node:test + node:assert/strict
 *  - readFileSync source assertions
 *  - structural/pattern checks only; no network, no DOM, no React render
 *
 * PHASE X HARD RULES verified here:
 * ── Proxy route (themes/media-library) ───────────────────────────────────────
 *  - route.ts exists under stores/[store]/themes/media-library/
 *  - Imports resolveOwnedStoreId (tenancy — merchant session must own store)
 *  - Imports merchantApiFetch (no direct DB access; no api-client)
 *  - Does NOT import createMerchantApiClient (raw proxy, no api-client WIP edit)
 *  - Has VALID_MEDIA_TYPES enum guard (rejects unknown types)
 *  - Returns 400 for invalid type
 *  - Forwards to /themes/media-library on gateway
 *  - Passes store_id (resolved, never browser-supplied)
 *  - Clamps limit (max 100)
 *  - Documents NOT-CONNECTED contract
 *  - No import from page.tsx or globals.css
 *  - No Supabase / direct DB
 *  - No raw rounded-[Npx] classes
 *
 * ── MediaLibrary component ───────────────────────────────────────────────────
 *  - MediaLibrary.tsx exists and imports from @letbuyy/ui
 *  - Accepts storeName, mediaType, onSelect, onClose props
 *  - role="dialog" + aria-modal on dialog element
 *  - Labelled via aria-labelledby (titleId)
 *  - role="grid" on thumbnail grid
 *  - role="gridcell" on individual cells
 *  - Arrow key navigation: ArrowRight, ArrowLeft, ArrowDown, ArrowUp
 *  - Enter / Space to select focused cell
 *  - Escape to close (via onClose)
 *  - Focus trap (Tab handling inside dialog)
 *  - Loading state present
 *  - Empty state present
 *  - Error state present
 *  - NOT-CONNECTED graceful state present
 *  - Upload affordance: file input posting to /api/stores/{storeName}/upload
 *  - MIME allowlist enforced client-side (SVG rejected; image/* + video/* specific)
 *  - SVG explicitly rejected (UPLOAD-SAFETY LAW)
 *  - Size validation: MAX_IMAGE_BYTES + MAX_VIDEO_BYTES constants
 *  - Progress bar during upload
 *  - Raw fetch to same-origin proxy (no api-client import)
 *  - No dangerouslySetInnerHTML
 *  - No import from page.tsx, globals.css, @letbuyy/api-client, @supabase
 *  - No raw rounded-[Npx] classes (design ratchet)
 *  - RISK-DUAL-N01: onSelect emits URL only; comment documents this
 *
 * ── ImagePickerControl ───────────────────────────────────────────────────────
 *  - ImagePickerControl.tsx exists and imports from @letbuyy/ui
 *  - Imports MediaLibrary
 *  - Accepts label, value, onChange, storeName, helpText props
 *  - Has URL text input (backward compat)
 *  - Has cloud_upload file button (backward compat)
 *  - Has Browse Library button (Phase X addition)
 *  - Opens MediaLibrary via isLibraryOpen state
 *  - onSelect calls onChange with URL (RISK-DUAL-N01)
 *  - No api-client import; no Supabase; no page.tsx / globals.css
 *  - No dangerouslySetInnerHTML
 *  - RISK-DUAL-N01 documented
 *
 * ── VideoControl (Phase X patch) ─────────────────────────────────────────────
 *  - Still renders URL input + upload button (backward compat)
 *  - Phase X: imports MediaLibrary
 *  - Has Browse Library button (video_library icon / "Browse library" label)
 *  - Opens MediaLibrary with mediaType="video"
 *  - onSelect handles library selection (RISK-DUAL-N01)
 *  - No dangerouslySetInnerHTML
 *
 * ── SchemaFormRenderer (Phase X patch) ───────────────────────────────────────
 *  - Imports ImagePickerControl
 *  - case 'image': renders ImagePickerControl (not inline ImageInput)
 *  - Passes storeName to ImagePickerControl
 *
 * ── controls.module.css ──────────────────────────────────────────────────────
 *  - Defines browseLibraryBtn class (--lb-* tokens)
 *  - Defines mediaLibraryOverlay class
 *  - Defines mediaLibraryDialog class
 *  - Defines mediaGrid class
 *  - Defines mediaGridItem class
 *  - Defines mediaProgressBar class
 *  - Defines mediaNotConnected class
 *  - All Phase X CSS uses --lb-* tokens
 *
 * ── package.json ─────────────────────────────────────────────────────────────
 *  - theme-editor-x.test.mjs is included in the test command
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

const PROXY_ROUTE = `${MCP_BASE}/app/api/stores/[store]/themes/media-library/route.ts`;
const MEDIA_LIBRARY = `${CONTROLS_DIR}/MediaLibrary.tsx`;
const IMAGE_PICKER = `${CONTROLS_DIR}/ImagePickerControl.tsx`;
const VIDEO_CONTROL = `${CONTROLS_DIR}/VideoControl.tsx`;
const CSS_MODULE = `${CONTROLS_DIR}/controls.module.css`;
const PKG_JSON = 'apps/merchant/web/package.json';

// ═══════════════════════════════════════════════════════════════════════════════
// FILE EXISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: themes/media-library/route.ts proxy exists', () => {
    assert.ok(exists(PROXY_ROUTE), 'route.ts missing — must be at app/api/stores/[store]/themes/media-library/route.ts');
});

test('phase-x: MediaLibrary.tsx exists', () => {
    assert.ok(exists(MEDIA_LIBRARY), 'MediaLibrary.tsx missing');
});

test('phase-x: ImagePickerControl.tsx exists', () => {
    assert.ok(exists(IMAGE_PICKER), 'ImagePickerControl.tsx missing');
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROXY ROUTE: imports + tenancy
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: proxy route imports resolveOwnedStoreId (tenancy law)', () => {
    assert.match(read(PROXY_ROUTE), /resolveOwnedStoreId/, 'must import resolveOwnedStoreId');
});

test('phase-x: proxy route imports merchantApiFetch (no direct DB)', () => {
    assert.match(read(PROXY_ROUTE), /merchantApiFetch/, 'must use merchantApiFetch — no direct DB access');
});

test('phase-x: proxy route does NOT import createMerchantApiClient (raw fetch required)', () => {
    assert.doesNotMatch(
        read(PROXY_ROUTE),
        /createMerchantApiClient/,
        'must not use typed api-client — raw fetch only (api-client is foreign WIP)',
    );
});

test('phase-x: proxy route has VALID_MEDIA_TYPES enum (rejects unknown types)', () => {
    assert.match(read(PROXY_ROUTE), /VALID_MEDIA_TYPES/, 'must define VALID_MEDIA_TYPES constant');
});

test('phase-x: proxy route lists image, video, all as valid types', () => {
    const src = read(PROXY_ROUTE);
    assert.match(src, /image/, 'must list "image" as a valid type');
    assert.match(src, /video/, 'must list "video" as a valid type');
    assert.match(src, /['"]all['"]/, 'must list "all" as a valid type');
});

test('phase-x: proxy route returns 400 for invalid type', () => {
    assert.match(
        read(PROXY_ROUTE),
        /status.*400|400.*status/,
        'must return HTTP 400 for invalid/missing media type',
    );
});

test('phase-x: proxy route forwards to /themes/media-library on gateway', () => {
    assert.match(read(PROXY_ROUTE), /\/themes\/media-library/, 'must forward to gateway /themes/media-library path');
});

test('phase-x: proxy route passes store_id from resolved store (tenancy)', () => {
    assert.match(read(PROXY_ROUTE), /store_id.*resolved|resolved.*storeId/, 'must use resolved storeId, not browser-supplied value');
});

test('phase-x: proxy route enforces limit max (clamps or rejects oversized limits)', () => {
    assert.match(
        read(PROXY_ROUTE),
        /Math\.min|limit.*100|100.*limit/,
        'must clamp limit to a maximum of 100',
    );
});

test('phase-x: proxy route documents NOT-CONNECTED contract', () => {
    assert.match(read(PROXY_ROUTE), /NOT-CONNECTED/, 'must document NOT-CONNECTED — depends on gateway route');
});

test('phase-x: proxy route does not import from page.tsx (foreign WIP)', () => {
    assert.doesNotMatch(read(PROXY_ROUTE), /from.*page\.tsx/, 'must not import from foreign-WIP editor/page.tsx');
});

test('phase-x: proxy route does not import globals.css', () => {
    assert.doesNotMatch(read(PROXY_ROUTE), /globals\.css/, 'must not import globals.css');
});

test('phase-x: proxy route does not use Supabase or direct DB', () => {
    assert.doesNotMatch(read(PROXY_ROUTE), /@supabase|createClient/, 'must not access Supabase directly');
});

test('phase-x: proxy route has no raw rounded-[Npx] classes', () => {
    assert.doesNotMatch(read(PROXY_ROUTE), /rounded-\[\d+px\]/, 'design ratchet: no raw rounded-[Npx]');
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA LIBRARY COMPONENT: imports + props
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: MediaLibrary imports from @letbuyy/ui (design token compliance)', () => {
    assert.match(read(MEDIA_LIBRARY), /from '@letbuyy\/ui'/, 'must import from @letbuyy/ui');
});

test('phase-x: MediaLibrary accepts storeName prop', () => {
    assert.match(read(MEDIA_LIBRARY), /storeName/, 'must accept storeName prop');
});

test('phase-x: MediaLibrary accepts mediaType prop', () => {
    assert.match(read(MEDIA_LIBRARY), /mediaType/, 'must accept mediaType prop');
});

test('phase-x: MediaLibrary accepts onSelect prop', () => {
    assert.match(read(MEDIA_LIBRARY), /onSelect/, 'must accept onSelect prop');
});

test('phase-x: MediaLibrary accepts onClose prop', () => {
    assert.match(read(MEDIA_LIBRARY), /onClose/, 'must accept onClose prop');
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA LIBRARY COMPONENT: ARIA / dialog pattern
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: MediaLibrary has role="dialog" (modal dialog pattern)', () => {
    assert.match(read(MEDIA_LIBRARY), /role="dialog"/, 'must have role="dialog" on the modal element');
});

test('phase-x: MediaLibrary has aria-modal="true"', () => {
    assert.match(read(MEDIA_LIBRARY), /aria-modal="true"/, 'must have aria-modal="true"');
});

test('phase-x: MediaLibrary has aria-labelledby (dialog title)', () => {
    assert.match(read(MEDIA_LIBRARY), /aria-labelledby/, 'must have aria-labelledby pointing to the dialog title');
});

test('phase-x: MediaLibrary has aria-label on close button', () => {
    assert.match(
        read(MEDIA_LIBRARY),
        /aria-label="Close media library"/,
        'close button must have aria-label="Close media library"',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA LIBRARY COMPONENT: grid + keyboard navigation
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: MediaLibrary has role="grid" on the thumbnail grid', () => {
    assert.match(read(MEDIA_LIBRARY), /role="grid"/, 'must have role="grid" on the thumbnail grid container');
});

test('phase-x: MediaLibrary has role="gridcell" on individual cells', () => {
    assert.match(read(MEDIA_LIBRARY), /role="gridcell"/, 'must have role="gridcell" on each thumbnail cell');
});

test('phase-x: MediaLibrary handles ArrowRight key (grid navigation)', () => {
    assert.match(read(MEDIA_LIBRARY), /ArrowRight/, 'must handle ArrowRight key');
});

test('phase-x: MediaLibrary handles ArrowLeft key (grid navigation)', () => {
    assert.match(read(MEDIA_LIBRARY), /ArrowLeft/, 'must handle ArrowLeft key');
});

test('phase-x: MediaLibrary handles ArrowDown key (grid navigation)', () => {
    assert.match(read(MEDIA_LIBRARY), /ArrowDown/, 'must handle ArrowDown key');
});

test('phase-x: MediaLibrary handles ArrowUp key (grid navigation)', () => {
    assert.match(read(MEDIA_LIBRARY), /ArrowUp/, 'must handle ArrowUp key');
});

test('phase-x: MediaLibrary handles Enter key to select focused cell', () => {
    assert.match(
        read(MEDIA_LIBRARY),
        /key === 'Enter'|key==='Enter'|'Enter'/,
        'must handle Enter key to select the focused grid cell',
    );
});

test('phase-x: MediaLibrary handles Escape key to close (onClose called)', () => {
    assert.match(read(MEDIA_LIBRARY), /Escape/, 'must handle Escape key to close the dialog');
});

test('phase-x: MediaLibrary has focus trap (Tab handling)', () => {
    assert.match(read(MEDIA_LIBRARY), /Tab/, 'must trap focus within the dialog (Tab key handling)');
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA LIBRARY COMPONENT: states
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: MediaLibrary has a loading state', () => {
    assert.match(read(MEDIA_LIBRARY), /loading|Loading/, 'must render a loading state');
});

test('phase-x: MediaLibrary has an empty state', () => {
    assert.match(read(MEDIA_LIBRARY), /No media|empty|Empty/, 'must render an empty state when no media exists');
});

test('phase-x: MediaLibrary has an error state', () => {
    assert.match(read(MEDIA_LIBRARY), /error|Error/, 'must render an error state when the fetch fails');
});

test('phase-x: MediaLibrary has a NOT-CONNECTED graceful state', () => {
    assert.match(read(MEDIA_LIBRARY), /NOT-CONNECTED/, 'must show NOT-CONNECTED state when gateway route is absent');
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA LIBRARY COMPONENT: upload
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: MediaLibrary upload posts to /api/stores/{storeName}/upload (existing proxy)', () => {
    assert.match(
        read(MEDIA_LIBRARY),
        /\/api\/stores\/.*upload/,
        'must upload to the same-origin /api/stores/{store}/upload proxy',
    );
});

test('phase-x: MediaLibrary has progress bar during upload', () => {
    assert.match(
        read(MEDIA_LIBRARY),
        /progressbar|progress/i,
        'must render a progress indicator during upload',
    );
});

test('phase-x: MediaLibrary shows MIME/size errors', () => {
    assert.match(read(MEDIA_LIBRARY), /uploadError|upload.*error|MIME/i, 'must display upload errors (MIME/size)');
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA LIBRARY COMPONENT: upload safety — MIME allowlist + SVG rejection
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: MediaLibrary has IMAGE_MIME_ALLOWLIST (upload safety law)', () => {
    assert.match(read(MEDIA_LIBRARY), /IMAGE_MIME_ALLOWLIST/, 'must define IMAGE_MIME_ALLOWLIST constant');
});

test('phase-x: MediaLibrary has VIDEO_MIME_ALLOWLIST (upload safety law)', () => {
    assert.match(read(MEDIA_LIBRARY), /VIDEO_MIME_ALLOWLIST/, 'must define VIDEO_MIME_ALLOWLIST constant');
});

test('phase-x: MediaLibrary allowlist includes image/jpeg, image/png, image/webp, image/gif', () => {
    const src = read(MEDIA_LIBRARY);
    assert.match(src, /image\/jpeg/, 'allowlist must include image/jpeg');
    assert.match(src, /image\/png/, 'allowlist must include image/png');
    assert.match(src, /image\/webp/, 'allowlist must include image/webp');
    assert.match(src, /image\/gif/, 'allowlist must include image/gif');
});

test('phase-x: MediaLibrary allowlist includes video/mp4, video/webm, video/quicktime', () => {
    const src = read(MEDIA_LIBRARY);
    assert.match(src, /video\/mp4/, 'allowlist must include video/mp4');
    assert.match(src, /video\/webm/, 'allowlist must include video/webm');
    assert.match(src, /video\/quicktime/, 'allowlist must include video/quicktime');
});

test('phase-x: UPLOAD-SAFETY — MediaLibrary explicitly rejects SVG (image/svg+xml)', () => {
    assert.match(
        read(MEDIA_LIBRARY),
        /svg\+xml|image\/svg/,
        'must explicitly check for and reject SVG uploads (script-bearing; UPLOAD-SAFETY LAW)',
    );
});

test('phase-x: MediaLibrary has MAX_IMAGE_BYTES size limit constant', () => {
    assert.match(read(MEDIA_LIBRARY), /MAX_IMAGE_BYTES/, 'must define MAX_IMAGE_BYTES size limit');
});

test('phase-x: MediaLibrary has MAX_VIDEO_BYTES size limit constant', () => {
    assert.match(read(MEDIA_LIBRARY), /MAX_VIDEO_BYTES/, 'must define MAX_VIDEO_BYTES size limit');
});

test('phase-x: MediaLibrary image size limit is 10 MB', () => {
    assert.match(read(MEDIA_LIBRARY), /10\s*\*\s*1024\s*\*\s*1024/, 'image size limit must be 10 MB');
});

test('phase-x: MediaLibrary video size limit is 100 MB', () => {
    assert.match(read(MEDIA_LIBRARY), /100\s*\*\s*1024\s*\*\s*1024/, 'video size limit must be 100 MB');
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA LIBRARY COMPONENT: no forbidden patterns
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: MediaLibrary uses raw fetch to same-origin proxy (no api-client)', () => {
    const src = read(MEDIA_LIBRARY);
    assert.match(src, /\/api\/stores\//, 'must call same-origin /api/stores/ proxy');
    assert.match(src, /\bfetch\(/, 'must use raw fetch');
});

test('phase-x: MediaLibrary does not import from @letbuyy/api-client (no api-client WIP edit)', () => {
    assert.doesNotMatch(
        read(MEDIA_LIBRARY),
        /from '@letbuyy\/api-client'/,
        'must not import from @letbuyy/api-client',
    );
});

test('phase-x: MediaLibrary has no dangerouslySetInnerHTML (sanitize law)', () => {
    assert.doesNotMatch(read(MEDIA_LIBRARY), /dangerouslySetInnerHTML/, 'must not use dangerouslySetInnerHTML');
});

test('phase-x: MediaLibrary does not import from page.tsx (foreign WIP)', () => {
    assert.doesNotMatch(read(MEDIA_LIBRARY), /from.*editor\/page/, 'must not import from foreign-WIP editor/page.tsx');
});

test('phase-x: MediaLibrary does not import globals.css (design ratchet)', () => {
    assert.doesNotMatch(read(MEDIA_LIBRARY), /globals\.css/, 'must not import globals.css');
});

test('phase-x: MediaLibrary does not use Supabase (no direct DB)', () => {
    assert.doesNotMatch(read(MEDIA_LIBRARY), /@supabase|createClient/, 'must not access Supabase directly');
});

test('phase-x: MediaLibrary has no raw rounded-[Npx] classes (design ratchet)', () => {
    assert.doesNotMatch(read(MEDIA_LIBRARY), /rounded-\[\d+px\]/, 'no raw rounded-[Npx] Tailwind classes');
});

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA LIBRARY COMPONENT: RISK-DUAL-N01
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: RISK-DUAL-N01 — MediaLibrary onSelect emits URL only (documented)', () => {
    assert.match(
        read(MEDIA_LIBRARY),
        /RISK-DUAL-N01/,
        'must document RISK-DUAL-N01: onSelect emits URL only, never touches section_definitions',
    );
});

test('phase-x: RISK-DUAL-N01 — MediaLibrary does not write to section_definitions', () => {
    assert.doesNotMatch(
        read(MEDIA_LIBRARY),
        /section_definitions\s*=\s*[^>]/,
        'must not assign to section_definitions',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE PICKER CONTROL
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: ImagePickerControl imports from @letbuyy/ui', () => {
    assert.match(read(IMAGE_PICKER), /from '@letbuyy\/ui'/, 'must import from @letbuyy/ui');
});

test('phase-x: ImagePickerControl imports MediaLibrary', () => {
    assert.match(read(IMAGE_PICKER), /import.*MediaLibrary/, 'must import MediaLibrary component');
});

test('phase-x: ImagePickerControl has URL text input (backward compat)', () => {
    assert.match(
        read(IMAGE_PICKER),
        /Image URL|type="text"|image.*url/i,
        'must have a URL text input for backward compat',
    );
});

test('phase-x: ImagePickerControl has cloud_upload file button (backward compat)', () => {
    assert.match(
        read(IMAGE_PICKER),
        /cloud_upload/,
        'must retain the cloud_upload file upload button (backward compat)',
    );
});

test('phase-x: ImagePickerControl has Browse Library button (Phase X addition)', () => {
    assert.match(
        read(IMAGE_PICKER),
        /Browse library|Browse Library|photo_library/,
        'must have a Browse Library button that opens MediaLibrary',
    );
});

test('phase-x: ImagePickerControl opens MediaLibrary on Browse click (isLibraryOpen state)', () => {
    assert.match(
        read(IMAGE_PICKER),
        /isLibraryOpen/,
        'must use isLibraryOpen state to conditionally render MediaLibrary',
    );
});

test('phase-x: ImagePickerControl does not import from @letbuyy/api-client', () => {
    assert.doesNotMatch(
        read(IMAGE_PICKER),
        /from '@letbuyy\/api-client'/,
        'must not import from @letbuyy/api-client',
    );
});

test('phase-x: ImagePickerControl has no dangerouslySetInnerHTML', () => {
    assert.doesNotMatch(read(IMAGE_PICKER), /dangerouslySetInnerHTML/);
});

test('phase-x: ImagePickerControl does not import from page.tsx or globals.css', () => {
    const src = read(IMAGE_PICKER);
    assert.doesNotMatch(src, /from.*editor\/page/, 'must not import from foreign-WIP page.tsx');
    assert.doesNotMatch(src, /globals\.css/, 'must not import globals.css');
});

test('phase-x: ImagePickerControl documents RISK-DUAL-N01', () => {
    assert.match(
        read(IMAGE_PICKER),
        /RISK-DUAL-N01/,
        'must document RISK-DUAL-N01: onChange emits URL only',
    );
});

test('phase-x: ImagePickerControl has no raw rounded-[Npx] classes', () => {
    assert.doesNotMatch(read(IMAGE_PICKER), /rounded-\[\d+px\]/);
});

// ═══════════════════════════════════════════════════════════════════════════════
// VIDEO CONTROL: Phase X patch (additive)
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: VideoControl imports MediaLibrary (Phase X addition)', () => {
    assert.match(read(VIDEO_CONTROL), /import.*MediaLibrary/, 'must import MediaLibrary component');
});

test('phase-x: VideoControl still has URL input (backward compat)', () => {
    assert.match(read(VIDEO_CONTROL), /type="url"/, 'must retain URL input for backward compat');
});

test('phase-x: VideoControl still has video upload button (backward compat)', () => {
    assert.match(read(VIDEO_CONTROL), /video_call|Upload video/, 'must retain video upload button for backward compat');
});

test('phase-x: VideoControl has Browse Library button for video (Phase X addition)', () => {
    assert.match(
        read(VIDEO_CONTROL),
        /video_library|Browse library|Browse Library/,
        'must have a Browse Library button that opens MediaLibrary with mediaType="video"',
    );
});

test('phase-x: VideoControl opens MediaLibrary with mediaType="video"', () => {
    assert.match(
        read(VIDEO_CONTROL),
        /mediaType="video"|mediaType.*video/,
        'must open MediaLibrary with mediaType="video"',
    );
});

test('phase-x: VideoControl has no dangerouslySetInnerHTML', () => {
    assert.doesNotMatch(read(VIDEO_CONTROL), /dangerouslySetInnerHTML/);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEMA FORM RENDERER: Phase X patch
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: SchemaFormRenderer imports ImagePickerControl', () => {
    assert.match(
        read(RENDERER),
        /import.*ImagePickerControl/,
        'SchemaFormRenderer must import ImagePickerControl',
    );
});

test('phase-x: SchemaFormRenderer case "image" renders ImagePickerControl (not inline ImageInput)', () => {
    assert.match(
        read(RENDERER),
        /ImagePickerControl/,
        'case "image": must use ImagePickerControl component',
    );
});

test('phase-x: SchemaFormRenderer passes storeName to ImagePickerControl', () => {
    assert.match(
        read(RENDERER),
        /ImagePickerControl[\s\S]{0,300}storeName/,
        'SchemaFormRenderer must pass storeName to ImagePickerControl',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// controls.module.css: Phase X styles
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: controls.module.css has browseLibraryBtn class', () => {
    assert.match(read(CSS_MODULE), /browseLibraryBtn/, 'must define browseLibraryBtn class');
});

test('phase-x: controls.module.css has mediaLibraryOverlay class', () => {
    assert.match(read(CSS_MODULE), /mediaLibraryOverlay/, 'must define mediaLibraryOverlay class');
});

test('phase-x: controls.module.css has mediaLibraryDialog class', () => {
    assert.match(read(CSS_MODULE), /mediaLibraryDialog/, 'must define mediaLibraryDialog class');
});

test('phase-x: controls.module.css has mediaGrid class', () => {
    assert.match(read(CSS_MODULE), /mediaGrid/, 'must define mediaGrid class for the thumbnail grid');
});

test('phase-x: controls.module.css has mediaGridItem class', () => {
    assert.match(read(CSS_MODULE), /mediaGridItem/, 'must define mediaGridItem class for each cell');
});

test('phase-x: controls.module.css has mediaProgressBar class', () => {
    assert.match(read(CSS_MODULE), /mediaProgressBar/, 'must define mediaProgressBar class');
});

test('phase-x: controls.module.css has mediaNotConnected class', () => {
    assert.match(read(CSS_MODULE), /mediaNotConnected/, 'must define mediaNotConnected class');
});

test('phase-x: controls.module.css Phase X styles use --lb-* tokens', () => {
    assert.match(read(CSS_MODULE), /--lb-/, 'Phase X CSS must use --lb-* design tokens');
});

test('phase-x: controls.module.css Phase X styles have no raw rounded-[Npx]', () => {
    assert.doesNotMatch(read(CSS_MODULE), /rounded-\[\d+px\]/);
});

// ═══════════════════════════════════════════════════════════════════════════════
// CROSS-TENANT ISOLATION CONTRACT (logic-level; no DB)
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: proxy route resolves store_id from session (not query param) — tenancy contract', () => {
    // The store_id forwarded to the gateway must come from resolveOwnedStoreId,
    // not from a browser-supplied query parameter.
    const src = read(PROXY_ROUTE);
    // resolveOwnedStoreId returns { storeId }, which is then used in the gateway URL
    assert.match(
        src,
        /resolved\.storeId|resolved\s*\.\s*storeId/,
        'must use resolved.storeId (from session) — not a browser-supplied store_id param',
    );
    // Must NOT blindly forward a browser-supplied store_id query param
    assert.doesNotMatch(
        src,
        /searchParams\.get\(['"]store_id['"]\)/,
        'must not forward browser-supplied store_id query param directly (tenancy law)',
    );
});

test('phase-x: proxy route uses requireSession: true when calling merchantApiFetch', () => {
    assert.match(
        read(PROXY_ROUTE),
        /requireSession.*true|true.*requireSession/,
        'merchantApiFetch must be called with requireSession: true so unauthenticated requests are rejected',
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGE.JSON
// ═══════════════════════════════════════════════════════════════════════════════

test('phase-x: package.json test command includes theme-editor-x.test.mjs', () => {
    assert.match(
        read(PKG_JSON),
        /theme-editor-x\.test\.mjs/,
        'package.json test command must include theme-editor-x.test.mjs',
    );
});
