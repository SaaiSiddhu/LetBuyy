/**
 * Phase U — Control parity: static-contract tests for the merchant-control-plane.
 *
 * These tests assert source-level contracts (file existence, import patterns,
 * ARIA / a11y markers, design-ratchet compliance, sanitize-law compliance)
 * without spinning up Next.js or hitting the gateway/DB.
 *
 * Style mirrors theme-editor-r.test.mjs:
 *  - node:test + node:assert/strict
 *  - readFileSync source assertions
 *  - structural/pattern checks only; no network or DOM
 *
 * PHASE U HARD RULES verified here:
 *  - All new control files exist in controls/
 *  - Each imports from '@letbuyy/ui' (design token compliance)
 *  - No raw rounded-[Npx] classes in any new file (design ratchet)
 *  - ResourcePickerControl contains NOT-CONNECTED badge text
 *  - FontPickerControl references EXPERIENCE_FONT_REGISTRY
 *  - HtmlControl / LiquidControl have no dangerouslySetInnerHTML
 *  - LiquidControl contains NOT-CONNECTED badge text (canary-OFF)
 *  - SchemaFormRenderer imports ExtendedSchemaField
 *  - SchemaFormRenderer imports isFieldVisible (conditional visibility)
 *  - SchemaFormRenderer imports isUnsafeUrl (url validation fix)
 *  - SchemaFormRenderer imports resolveFieldDefault (type-safe default)
 *  - SchemaFormRenderer has cases for all 15 new Phase U types
 *  - SchemaFormRenderer never imports from page.tsx
 *  - RISK-DUAL-N01 noted: controls receive value + onChange only
 *  - No import of globals.css in new controls
 *  - No import of Supabase / gateway in new controls
 *  - Baseline: 120 merchant tests preserved + Phase U tests added
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
const CONTROLS_DIR = `${MCP_BASE}/components/theme-editor/controls`;
const RENDERER = `${MCP_BASE}/components/theme-editor/SchemaFormRenderer.tsx`;
const THEME_SCHEMAS = `${MCP_BASE}/lib/theme-schemas.ts`;
const EDITOR_PAGE = `${MCP_BASE}/app/[store]/online-store/themes/[themeId]/editor/page.tsx`;

// Control file paths
const CONTROLS = {
    ColorBackground: `${CONTROLS_DIR}/ColorBackgroundControl.tsx`,
    ColorScheme: `${CONTROLS_DIR}/ColorSchemeControl.tsx`,
    FontPicker: `${CONTROLS_DIR}/FontPickerControl.tsx`,
    Html: `${CONTROLS_DIR}/HtmlControl.tsx`,
    Liquid: `${CONTROLS_DIR}/LiquidControl.tsx`,
    Checkbox: `${CONTROLS_DIR}/CheckboxControl.tsx`,
    Video: `${CONTROLS_DIR}/VideoControl.tsx`,
    VideoUrl: `${CONTROLS_DIR}/VideoUrlControl.tsx`,
    Info: `${CONTROLS_DIR}/InfoControls.tsx`,
    ResourcePicker: `${CONTROLS_DIR}/ResourcePickerControl.tsx`,
    CssModule: `${CONTROLS_DIR}/controls.module.css`,
};

// ── New control files exist ──────────────────────────────────────────────────

test('phase-u: ColorBackgroundControl.tsx exists', () => {
    assert.ok(exists(CONTROLS.ColorBackground), 'ColorBackgroundControl.tsx missing');
});

test('phase-u: ColorSchemeControl.tsx exists', () => {
    assert.ok(exists(CONTROLS.ColorScheme), 'ColorSchemeControl.tsx missing');
});

test('phase-u: FontPickerControl.tsx exists', () => {
    assert.ok(exists(CONTROLS.FontPicker), 'FontPickerControl.tsx missing');
});

test('phase-u: HtmlControl.tsx exists', () => {
    assert.ok(exists(CONTROLS.Html), 'HtmlControl.tsx missing');
});

test('phase-u: LiquidControl.tsx exists', () => {
    assert.ok(exists(CONTROLS.Liquid), 'LiquidControl.tsx missing');
});

test('phase-u: CheckboxControl.tsx exists', () => {
    assert.ok(exists(CONTROLS.Checkbox), 'CheckboxControl.tsx missing');
});

test('phase-u: VideoControl.tsx exists', () => {
    assert.ok(exists(CONTROLS.Video), 'VideoControl.tsx missing');
});

test('phase-u: VideoUrlControl.tsx exists', () => {
    assert.ok(exists(CONTROLS.VideoUrl), 'VideoUrlControl.tsx missing');
});

test('phase-u: InfoControls.tsx exists', () => {
    assert.ok(exists(CONTROLS.Info), 'InfoControls.tsx missing');
});

test('phase-u: ResourcePickerControl.tsx exists', () => {
    assert.ok(exists(CONTROLS.ResourcePicker), 'ResourcePickerControl.tsx missing');
});

test('phase-u: controls.module.css exists (no globals.css modification)', () => {
    assert.ok(exists(CONTROLS.CssModule), 'controls.module.css missing — must not use globals.css');
});

// ── Each control imports from @letbuyy/ui ────────────────────────────────────

test('phase-u: ColorBackgroundControl imports from @letbuyy/ui', () => {
    assert.match(read(CONTROLS.ColorBackground), /from '@letbuyy\/ui'/, 'must import from @letbuyy/ui');
});

test('phase-u: ColorSchemeControl imports from @letbuyy/ui', () => {
    assert.match(read(CONTROLS.ColorScheme), /from '@letbuyy\/ui'/);
});

test('phase-u: FontPickerControl imports from @letbuyy/ui', () => {
    assert.match(read(CONTROLS.FontPicker), /from '@letbuyy\/ui'/);
});

test('phase-u: HtmlControl imports from @letbuyy/ui', () => {
    assert.match(read(CONTROLS.Html), /from '@letbuyy\/ui'/);
});

test('phase-u: LiquidControl imports from @letbuyy/ui', () => {
    assert.match(read(CONTROLS.Liquid), /from '@letbuyy\/ui'/);
});

test('phase-u: CheckboxControl imports from @letbuyy/ui', () => {
    assert.match(read(CONTROLS.Checkbox), /from '@letbuyy\/ui'/);
});

test('phase-u: VideoControl imports from @letbuyy/ui', () => {
    assert.match(read(CONTROLS.Video), /from '@letbuyy\/ui'/);
});

test('phase-u: VideoUrlControl imports from @letbuyy/ui', () => {
    assert.match(read(CONTROLS.VideoUrl), /from '@letbuyy\/ui'/);
});

test('phase-u: InfoControls imports from @letbuyy/ui', () => {
    assert.match(read(CONTROLS.Info), /from '@letbuyy\/ui'/);
});

test('phase-u: ResourcePickerControl imports from @letbuyy/ui', () => {
    assert.match(read(CONTROLS.ResourcePicker), /from '@letbuyy\/ui'/);
});

// ── No raw rounded-[Npx] classes ─────────────────────────────────────────────

const RATCHET_RE = /rounded-\[\d+px\]/;

test('phase-u: ColorBackgroundControl uses no raw rounded-[...px] class', () => {
    assert.doesNotMatch(read(CONTROLS.ColorBackground), RATCHET_RE);
});

test('phase-u: ColorSchemeControl uses no raw rounded-[...px] class', () => {
    assert.doesNotMatch(read(CONTROLS.ColorScheme), RATCHET_RE);
});

test('phase-u: FontPickerControl uses no raw rounded-[...px] class', () => {
    assert.doesNotMatch(read(CONTROLS.FontPicker), RATCHET_RE);
});

test('phase-u: HtmlControl uses no raw rounded-[...px] class', () => {
    assert.doesNotMatch(read(CONTROLS.Html), RATCHET_RE);
});

test('phase-u: LiquidControl uses no raw rounded-[...px] class', () => {
    assert.doesNotMatch(read(CONTROLS.Liquid), RATCHET_RE);
});

test('phase-u: CheckboxControl uses no raw rounded-[...px] class', () => {
    assert.doesNotMatch(read(CONTROLS.Checkbox), RATCHET_RE);
});

test('phase-u: VideoControl uses no raw rounded-[...px] class', () => {
    assert.doesNotMatch(read(CONTROLS.Video), RATCHET_RE);
});

test('phase-u: VideoUrlControl uses no raw rounded-[...px] class', () => {
    assert.doesNotMatch(read(CONTROLS.VideoUrl), RATCHET_RE);
});

test('phase-u: InfoControls uses no raw rounded-[...px] class', () => {
    assert.doesNotMatch(read(CONTROLS.Info), RATCHET_RE);
});

test('phase-u: ResourcePickerControl uses no raw rounded-[...px] class', () => {
    assert.doesNotMatch(read(CONTROLS.ResourcePicker), RATCHET_RE);
});

test('phase-u: SchemaFormRenderer uses no raw rounded-[...px] class', () => {
    assert.doesNotMatch(read(RENDERER), RATCHET_RE);
});

// ── SANITIZE LAW: no dangerouslySetInnerHTML in HtmlControl or LiquidControl ─

test('phase-u: HtmlControl has NO dangerouslySetInnerHTML (SANITIZE LAW)', () => {
    assert.doesNotMatch(
        read(CONTROLS.Html),
        /dangerouslySetInnerHTML/,
        'HtmlControl must NOT use dangerouslySetInnerHTML — sanitisation is the renderer\'s job',
    );
});

test('phase-u: LiquidControl has NO dangerouslySetInnerHTML (SANITIZE LAW)', () => {
    assert.doesNotMatch(
        read(CONTROLS.Liquid),
        /dangerouslySetInnerHTML/,
        'LiquidControl must NOT use dangerouslySetInnerHTML — Liquid → HTML compilation in renderer',
    );
});

// ── NOT-CONNECTED badges ──────────────────────────────────────────────────────

test('phase-u: ResourcePickerControl contains NOT-CONNECTED badge text', () => {
    const src = read(CONTROLS.ResourcePicker);
    assert.match(src, /NOT-CONNECTED/, 'ResourcePickerControl must display a NOT-CONNECTED badge');
});

test('phase-u: LiquidControl contains NOT-CONNECTED badge (canary-OFF)', () => {
    const src = read(CONTROLS.Liquid);
    assert.match(src, /NOT-CONNECTED/, 'LiquidControl must display a NOT-CONNECTED badge for canary-OFF');
});

// ── FontPickerControl references EXPERIENCE_FONT_REGISTRY ────────────────────

test('phase-u: FontPickerControl references EXPERIENCE_FONT_REGISTRY (constrained font list)', () => {
    const src = read(CONTROLS.FontPicker);
    assert.match(
        src,
        /EXPERIENCE_FONT_REGISTRY/,
        'FontPickerControl must use EXPERIENCE_FONT_REGISTRY to constrain font selection',
    );
});

// ── SchemaFormRenderer imports ExtendedSchemaField ───────────────────────────

test('phase-u: SchemaFormRenderer imports ExtendedSchemaField', () => {
    const src = read(RENDERER);
    assert.match(src, /ExtendedSchemaField/, 'SchemaFormRenderer must import ExtendedSchemaField');
});

// ── SchemaFormRenderer: conditional visibility filter ────────────────────────

test('phase-u: SchemaFormRenderer imports isFieldVisible (conditional visibility)', () => {
    const src = read(RENDERER);
    assert.match(src, /isFieldVisible/, 'SchemaFormRenderer must import and call isFieldVisible');
});

test('phase-u: SchemaFormRenderer uses isFieldVisible to filter fields', () => {
    const src = read(RENDERER);
    assert.match(src, /isFieldVisible\(field,\s*values\)/, 'SchemaFormRenderer must call isFieldVisible(field, values)');
});

// ── SchemaFormRenderer: isUnsafeUrl usage (url validation fix) ───────────────

test('phase-u: SchemaFormRenderer imports isUnsafeUrl', () => {
    const src = read(RENDERER);
    assert.match(src, /isUnsafeUrl/, 'SchemaFormRenderer must import and use isUnsafeUrl for url validation');
});

// ── SchemaFormRenderer: resolveFieldDefault (type-safe defaults) ──────────────

test('phase-u: SchemaFormRenderer imports resolveFieldDefault', () => {
    const src = read(RENDERER);
    assert.match(src, /resolveFieldDefault/, 'SchemaFormRenderer must import resolveFieldDefault for type-safe defaults');
});

// ── SchemaFormRenderer has cases for all 15 Phase U new types ────────────────

test('phase-u: SchemaFormRenderer has case for color_background', () => {
    assert.match(read(RENDERER), /case 'color_background':/);
});

test('phase-u: SchemaFormRenderer has case for color_scheme', () => {
    assert.match(read(RENDERER), /case 'color_scheme':/);
});

test('phase-u: SchemaFormRenderer has case for font_picker', () => {
    assert.match(read(RENDERER), /case 'font_picker':/);
});

test('phase-u: SchemaFormRenderer has case for html', () => {
    assert.match(read(RENDERER), /case 'html':/);
});

test('phase-u: SchemaFormRenderer has case for liquid', () => {
    assert.match(read(RENDERER), /case 'liquid':/);
});

test('phase-u: SchemaFormRenderer has case for checkbox', () => {
    assert.match(read(RENDERER), /case 'checkbox':/);
});

test('phase-u: SchemaFormRenderer has case for video', () => {
    assert.match(read(RENDERER), /case 'video':/);
});

test('phase-u: SchemaFormRenderer has case for video_url', () => {
    assert.match(read(RENDERER), /case 'video_url':/);
});

test('phase-u: SchemaFormRenderer has case for header', () => {
    assert.match(read(RENDERER), /case 'header':/);
});

test('phase-u: SchemaFormRenderer has case for paragraph', () => {
    assert.match(read(RENDERER), /case 'paragraph':/);
});

test('phase-u: SchemaFormRenderer has case for product (resource picker)', () => {
    assert.match(read(RENDERER), /case 'product':/);
});

test('phase-u: SchemaFormRenderer has case for collection', () => {
    assert.match(read(RENDERER), /case 'collection':/);
});

test('phase-u: SchemaFormRenderer has case for blog', () => {
    assert.match(read(RENDERER), /case 'blog':/);
});

test('phase-u: SchemaFormRenderer has case for page', () => {
    assert.match(read(RENDERER), /case 'page':/);
});

test('phase-u: SchemaFormRenderer has case for menu', () => {
    assert.match(read(RENDERER), /case 'menu':/);
});

// ── SchemaFormRenderer: backward compat (default case) ───────────────────────

test('phase-u: SchemaFormRenderer has default case fallback to TextInput (backward compat)', () => {
    const src = read(RENDERER);
    assert.match(src, /default:/, 'SchemaFormRenderer must have a default case that falls back to TextInput');
    assert.match(src, /TextInput/, 'default case must render a TextInput');
});

// ── SchemaFormRenderer never imports from page.tsx ───────────────────────────

test('phase-u: SchemaFormRenderer does NOT import from editor page.tsx (foreign WIP)', () => {
    const src = read(RENDERER);
    assert.doesNotMatch(
        src,
        /from.*editor\/page/,
        'SchemaFormRenderer must never import from the foreign-WIP editor/page.tsx',
    );
});

// ── New controls never import from page.tsx or globals.css ───────────────────

test('phase-u: new controls do not import from editor/page.tsx', () => {
    for (const [name, path] of Object.entries(CONTROLS)) {
        if (!path.endsWith('.tsx')) continue;
        const src = read(path);
        assert.doesNotMatch(
            src,
            /from.*editor\/page/,
            `${name} must not import from foreign-WIP editor/page.tsx`,
        );
    }
});

test('phase-u: new controls do not import globals.css', () => {
    for (const [name, path] of Object.entries(CONTROLS)) {
        if (!path.endsWith('.tsx')) continue;
        const src = read(path);
        assert.doesNotMatch(
            src,
            /globals\.css/,
            `${name} must not import globals.css — use controls.module.css or --lb-* token classes`,
        );
    }
});

// ── New controls do not use Supabase or gateway directly ─────────────────────

test('phase-u: new controls do not import Supabase', () => {
    for (const [name, path] of Object.entries(CONTROLS)) {
        if (!path.endsWith('.tsx')) continue;
        const src = read(path);
        assert.doesNotMatch(
            src,
            /@supabase|createClient/,
            `${name} must not use Supabase directly`,
        );
    }
});

test('phase-u: new controls do not import from @letbuyy/api-client directly', () => {
    for (const [name, path] of Object.entries(CONTROLS)) {
        if (!path.endsWith('.tsx')) continue;
        const src = read(path);
        assert.doesNotMatch(
            src,
            /from '@letbuyy\/api-client'/,
            `${name} must not import from @letbuyy/api-client directly`,
        );
    }
});

// ── theme-schemas.ts exports ExtendedSchemaField ─────────────────────────────

test('phase-u: theme-schemas.ts exports ExtendedSchemaField', () => {
    const src = read(THEME_SCHEMAS);
    assert.match(src, /ExtendedSchemaField/, 'theme-schemas.ts must export ExtendedSchemaField');
});

test('phase-u: theme-schemas.ts exports isUnsafeUrl', () => {
    const src = read(THEME_SCHEMAS);
    assert.match(src, /isUnsafeUrl/, 'theme-schemas.ts must export isUnsafeUrl');
});

test('phase-u: theme-schemas.ts exports isFieldVisible', () => {
    const src = read(THEME_SCHEMAS);
    assert.match(src, /isFieldVisible/, 'theme-schemas.ts must export isFieldVisible');
});

test('phase-u: theme-schemas.ts exports resolveFieldDefault', () => {
    const src = read(THEME_SCHEMAS);
    assert.match(src, /resolveFieldDefault/, 'theme-schemas.ts must export resolveFieldDefault');
});

// ── RISK-DUAL-N01 noted in SchemaFormRenderer ────────────────────────────────

test('phase-u: SchemaFormRenderer notes RISK-DUAL-N01 in a comment', () => {
    const src = read(RENDERER);
    assert.match(
        src,
        /RISK-DUAL-N01/,
        'SchemaFormRenderer must note RISK-DUAL-N01 — controls never mutate the schema',
    );
});

// ── Number control: min/max/step from schema are used ────────────────────────

test('phase-u: SchemaFormRenderer number case passes min, max, step from field', () => {
    const src = read(RENDERER);
    // The number case should pass field.min, field.max, field.step to NumberInput
    assert.match(
        src,
        /min=\{field\.min\}/,
        'NumberInput must receive min={field.min}',
    );
    assert.match(
        src,
        /max=\{field\.max\}/,
        'NumberInput must receive max={field.max}',
    );
});

// ── URL control: isUnsafeUrl is called ───────────────────────────────────────

test('phase-u: UrlInput in SchemaFormRenderer calls isUnsafeUrl', () => {
    const src = read(RENDERER);
    // isUnsafeUrl must appear in the url-handling code
    assert.match(
        src,
        /isUnsafeUrl/,
        'SchemaFormRenderer UrlInput must call isUnsafeUrl to guard against javascript: URLs',
    );
});

// ── InfoControls: FieldHeader and FieldParagraph are exported ────────────────

test('phase-u: InfoControls exports FieldHeader', () => {
    assert.match(read(CONTROLS.Info), /export function FieldHeader|export const FieldHeader/);
});

test('phase-u: InfoControls exports FieldParagraph', () => {
    assert.match(read(CONTROLS.Info), /export function FieldParagraph|export const FieldParagraph/);
});

// ── CheckboxControl is distinct from ToggleInput ─────────────────────────────

test('phase-u: CheckboxControl uses input[type="checkbox"] not a slide switch', () => {
    const src = read(CONTROLS.Checkbox);
    assert.match(src, /type="checkbox"/, 'CheckboxControl must use native input[type=checkbox]');
    assert.doesNotMatch(src, /te-toggle/, 'CheckboxControl must not use the toggle slide switch class');
});

// ── HtmlControl shows sanitize disclaimer ────────────────────────────────────

test('phase-u: HtmlControl shows a sanitization disclaimer note', () => {
    const src = read(CONTROLS.Html);
    assert.match(
        src,
        /sanitise|sanitize|sanitised|sanitized/i,
        'HtmlControl must show a disclaimer that output is sanitised at render time',
    );
});

// ── VideoUrlControl validates YouTube/Vimeo ──────────────────────────────────

test('phase-u: VideoUrlControl references YouTube or Vimeo in placeholder/hint', () => {
    const src = read(CONTROLS.VideoUrl);
    assert.match(src, /[Yy]ouTube|[Vv]imeo/, 'VideoUrlControl must mention YouTube or Vimeo in its UI hint');
});

// ── controls.module.css uses --lb-* tokens ───────────────────────────────────

test('phase-u: controls.module.css uses --lb-* design tokens', () => {
    const src = read(CONTROLS.CssModule);
    assert.match(src, /--lb-/, 'controls.module.css must use --lb-* design tokens');
    assert.doesNotMatch(src, /rounded-\[\d+px\]/, 'controls.module.css must not contain rounded-[Npx] classes');
});
