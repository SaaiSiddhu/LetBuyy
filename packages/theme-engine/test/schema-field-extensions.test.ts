/**
 * Phase U — Schema Field Extensions Tests
 *
 * Covers:
 *  - isUnsafeUrl: rejects javascript:, vbscript:, data:text/html, data:application/xhtml
 *  - validateFieldValue: number bounds, url safety, video_url pattern, font_picker registry,
 *    maxLength, required, info-control short-circuit, unknown-type graceful degradation
 *  - isFieldVisible: visible_if present/absent/match/no-match
 *  - resolveFieldDefault: explicit default, type fallbacks (boolean, numeric, info, text)
 *  - ExtendedSchemaField backward compat: all frozen SchemaField types accepted unchanged
 *  - Existing baseline: 1063 tests must remain passing (this file adds new tests on top)
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
    EXPERIENCE_FONT_REGISTRY,
    type ExtendedSchemaField,
    isFieldVisible,
    isUnsafeUrl,
    resolveFieldDefault,
    validateFieldValue,
} from '../src/index.ts';

// ---------------------------------------------------------------------------
// isUnsafeUrl
// ---------------------------------------------------------------------------

test('U isUnsafeUrl: rejects javascript: protocol (bare)', () => {
    assert.equal(isUnsafeUrl('javascript:alert(1)'), true);
});

test('U isUnsafeUrl: rejects javascript: with leading whitespace', () => {
    assert.equal(isUnsafeUrl('  javascript:void(0)'), true);
});

test('U isUnsafeUrl: rejects javascript: in uppercase (normalized)', () => {
    assert.equal(isUnsafeUrl('JAVASCRIPT:alert(1)'), true);
});

test('U isUnsafeUrl: rejects vbscript: protocol', () => {
    assert.equal(isUnsafeUrl('vbscript:MsgBox()'), true);
});

test('U isUnsafeUrl: rejects data:text/html URL', () => {
    assert.equal(isUnsafeUrl('data:text/html,<script>alert(1)</script>'), true);
});

test('U isUnsafeUrl: rejects data:application/xhtml URL', () => {
    assert.equal(isUnsafeUrl('data:application/xhtml+xml,<foo/>'), true);
});

test('U isUnsafeUrl: rejects data:image/svg+xml (SVG can carry inline script)', () => {
    assert.equal(isUnsafeUrl('data:image/svg+xml,<svg onload=alert(1)></svg>'), true);
});

test('U isUnsafeUrl: rejects data:text/javascript and data:application/javascript', () => {
    assert.equal(isUnsafeUrl('data:text/javascript,alert(1)'), true);
    assert.equal(isUnsafeUrl('data:application/javascript,alert(1)'), true);
});

test('U isUnsafeUrl: rejects blob: URLs', () => {
    assert.equal(isUnsafeUrl('blob:https://evil.example/deadbeef'), true);
});

test('U isUnsafeUrl: accepts a safe data:image/png (raster image, no script)', () => {
    assert.equal(isUnsafeUrl('data:image/png;base64,iVBORw0KGgo='), false);
});

test('U validateFieldValue: color_background rejects CSS-breakout / url() injection', () => {
    const field = { type: 'color_background', label: 'BG', key: 'bg' } as unknown as Parameters<typeof validateFieldValue>[0];
    assert.notEqual(validateFieldValue(field, 'red; } body { background: url(https://evil) } .x {'), null);
    assert.notEqual(validateFieldValue(field, 'linear-gradient(90deg,#fff,url(javascript:alert(1)))'), null);
    // legit values pass
    assert.equal(validateFieldValue(field, '#ff0000'), null);
    assert.equal(validateFieldValue(field, 'linear-gradient(90deg, #ffffff, #000000)'), null);
});

test('U isUnsafeUrl: accepts safe https URL', () => {
    assert.equal(isUnsafeUrl('https://example.com/page'), false);
});

test('U isUnsafeUrl: accepts relative URL', () => {
    assert.equal(isUnsafeUrl('/products/my-item'), false);
});

test('U isUnsafeUrl: accepts data:image (not xhtml/html)', () => {
    assert.equal(isUnsafeUrl('data:image/png;base64,iVBOR'), false);
});

test('U isUnsafeUrl: accepts empty string', () => {
    assert.equal(isUnsafeUrl(''), false);
});

// ---------------------------------------------------------------------------
// validateFieldValue — number / range
// ---------------------------------------------------------------------------

test('U validateFieldValue number: valid value within range returns null', () => {
    const field: ExtendedSchemaField = { type: 'number', label: 'Qty', min: 1, max: 10 };
    assert.equal(validateFieldValue(field, 5), null);
});

test('U validateFieldValue number: value below min returns error', () => {
    const field: ExtendedSchemaField = { type: 'number', label: 'Qty', min: 1, max: 10 };
    const err = validateFieldValue(field, 0);
    assert.ok(err !== null, 'expected an error');
    assert.match(err!, /at least 1/);
});

test('U validateFieldValue number: value above max returns error', () => {
    const field: ExtendedSchemaField = { type: 'number', label: 'Qty', min: 1, max: 10 };
    const err = validateFieldValue(field, 99);
    assert.ok(err !== null);
    assert.match(err!, /at most 10/);
});

test('U validateFieldValue number: NaN returns error', () => {
    const field: ExtendedSchemaField = { type: 'number', label: 'Qty' };
    assert.ok(validateFieldValue(field, 'notanumber') !== null);
});

test('U validateFieldValue number: empty string with no required is valid (unset)', () => {
    const field: ExtendedSchemaField = { type: 'number', label: 'Qty', min: 1, max: 10 };
    assert.equal(validateFieldValue(field, ''), null);
});

test('U validateFieldValue range: out of range returns error', () => {
    const field: ExtendedSchemaField = { type: 'range', label: 'Opacity', min: 0, max: 1, step: 0.1 };
    const err = validateFieldValue(field, 1.5);
    assert.ok(err !== null);
    assert.match(err!, /at most 1/);
});

test('U validateFieldValue range: at exact max is valid', () => {
    const field: ExtendedSchemaField = { type: 'range', label: 'Opacity', min: 0, max: 1, step: 0.1 };
    assert.equal(validateFieldValue(field, 1), null);
});

// ---------------------------------------------------------------------------
// validateFieldValue — url
// ---------------------------------------------------------------------------

test('U validateFieldValue url: javascript: URL returns error', () => {
    const field: ExtendedSchemaField = { type: 'url', label: 'Link URL' };
    const err = validateFieldValue(field, 'javascript:alert(1)');
    assert.ok(err !== null);
    assert.match(err!, /unsafe URL/);
});

test('U validateFieldValue url: safe https URL returns null', () => {
    const field: ExtendedSchemaField = { type: 'url', label: 'Link URL' };
    assert.equal(validateFieldValue(field, 'https://letbuyy.com'), null);
});

test('U validateFieldValue url: empty string returns null (not required)', () => {
    const field: ExtendedSchemaField = { type: 'url', label: 'Link URL' };
    assert.equal(validateFieldValue(field, ''), null);
});

test('U validateFieldValue url: vbscript: URL returns error', () => {
    const field: ExtendedSchemaField = { type: 'url', label: 'Link URL' };
    assert.ok(validateFieldValue(field, 'vbscript:foo()') !== null);
});

// ---------------------------------------------------------------------------
// validateFieldValue — video_url
// ---------------------------------------------------------------------------

test('U validateFieldValue video_url: YouTube URL returns null', () => {
    const field: ExtendedSchemaField = { type: 'video_url', label: 'Video URL' };
    assert.equal(validateFieldValue(field, 'https://www.youtube.com/watch?v=abc'), null);
});

test('U validateFieldValue video_url: youtu.be shortlink returns null', () => {
    const field: ExtendedSchemaField = { type: 'video_url', label: 'Video URL' };
    assert.equal(validateFieldValue(field, 'https://youtu.be/abc123'), null);
});

test('U validateFieldValue video_url: Vimeo URL returns null', () => {
    const field: ExtendedSchemaField = { type: 'video_url', label: 'Video URL' };
    assert.equal(validateFieldValue(field, 'https://vimeo.com/123456'), null);
});

test('U validateFieldValue video_url: arbitrary https URL returns error', () => {
    const field: ExtendedSchemaField = { type: 'video_url', label: 'Video URL' };
    const err = validateFieldValue(field, 'https://example.com/video.mp4');
    assert.ok(err !== null);
    assert.match(err!, /YouTube or Vimeo/);
});

test('U validateFieldValue video_url: javascript: URL returns unsafe error', () => {
    const field: ExtendedSchemaField = { type: 'video_url', label: 'Video URL' };
    const err = validateFieldValue(field, 'javascript:void(0)');
    assert.ok(err !== null);
    assert.match(err!, /unsafe URL/);
});

test('U validateFieldValue video_url: empty string returns null (not required)', () => {
    const field: ExtendedSchemaField = { type: 'video_url', label: 'Video URL' };
    assert.equal(validateFieldValue(field, ''), null);
});

// ---------------------------------------------------------------------------
// validateFieldValue — font_picker
// ---------------------------------------------------------------------------

test('U validateFieldValue font_picker: known font returns null', () => {
    const knownFont = Object.keys(EXPERIENCE_FONT_REGISTRY)[0]!;
    const field: ExtendedSchemaField = { type: 'font_picker', label: 'Body Font' };
    assert.equal(validateFieldValue(field, knownFont), null);
});

test('U validateFieldValue font_picker: all 6 registry fonts are valid', () => {
    const field: ExtendedSchemaField = { type: 'font_picker', label: 'Font' };
    for (const family of Object.keys(EXPERIENCE_FONT_REGISTRY)) {
        assert.equal(validateFieldValue(field, family), null, `expected ${family} to be valid`);
    }
    assert.equal(Object.keys(EXPERIENCE_FONT_REGISTRY).length, 6);
});

test('U validateFieldValue font_picker: arbitrary font string returns error', () => {
    const field: ExtendedSchemaField = { type: 'font_picker', label: 'Body Font' };
    const err = validateFieldValue(field, 'Comic Sans MS');
    assert.ok(err !== null);
    assert.match(err!, /known font family/);
});

test('U validateFieldValue font_picker: CSS injection via font name is rejected', () => {
    const field: ExtendedSchemaField = { type: 'font_picker', label: 'Font' };
    // Arbitrary font names that are not in the registry are always rejected,
    // preventing arbitrary CSS family injection.
    assert.ok(validateFieldValue(field, '"); background: red; font-family: ("') !== null);
});

test('U validateFieldValue font_picker: empty value returns null (not required)', () => {
    const field: ExtendedSchemaField = { type: 'font_picker', label: 'Font' };
    assert.equal(validateFieldValue(field, ''), null);
});

// ---------------------------------------------------------------------------
// validateFieldValue — maxLength on text types
// ---------------------------------------------------------------------------

test('U validateFieldValue text: within maxLength returns null', () => {
    const field: ExtendedSchemaField = { type: 'text', label: 'Heading', maxLength: 10 };
    assert.equal(validateFieldValue(field, 'Hello'), null);
});

test('U validateFieldValue text: exceeds maxLength returns error', () => {
    const field: ExtendedSchemaField = { type: 'text', label: 'Heading', maxLength: 5 };
    const err = validateFieldValue(field, 'TooLongValue');
    assert.ok(err !== null);
    assert.match(err!, /at most 5 characters/);
});

test('U validateFieldValue html: exceeds maxLength returns error', () => {
    const field: ExtendedSchemaField = { type: 'html', label: 'Content', maxLength: 10 };
    const err = validateFieldValue(field, '<p>longer than ten chars</p>');
    assert.ok(err !== null);
});

test('U validateFieldValue liquid: exceeds maxLength returns error', () => {
    const field: ExtendedSchemaField = { type: 'liquid', label: 'Template', maxLength: 5 };
    assert.ok(validateFieldValue(field, '{{ product.title | upcase }}') !== null);
});

// ---------------------------------------------------------------------------
// validateFieldValue — required
// ---------------------------------------------------------------------------

test('U validateFieldValue required: empty string returns error', () => {
    const field: ExtendedSchemaField = { type: 'text', label: 'Name', required: true };
    const err = validateFieldValue(field, '');
    assert.ok(err !== null);
    assert.match(err!, /required/);
});

test('U validateFieldValue required: null returns error', () => {
    const field: ExtendedSchemaField = { type: 'text', label: 'Name', required: true };
    assert.ok(validateFieldValue(field, null) !== null);
});

test('U validateFieldValue required: undefined returns error', () => {
    const field: ExtendedSchemaField = { type: 'text', label: 'Name', required: true };
    assert.ok(validateFieldValue(field, undefined) !== null);
});

test('U validateFieldValue required: non-empty value returns null', () => {
    const field: ExtendedSchemaField = { type: 'text', label: 'Name', required: true };
    assert.equal(validateFieldValue(field, 'LetBuyy'), null);
});

test('U validateFieldValue required: false boolean passes required check (valid explicit choice)', () => {
    const field: ExtendedSchemaField = { type: 'checkbox', label: 'Accept Terms', required: true };
    // false is a valid explicit choice — required only rejects absent/unset
    assert.equal(validateFieldValue(field, false), null);
});

// ---------------------------------------------------------------------------
// validateFieldValue — info controls (header / paragraph)
// ---------------------------------------------------------------------------

test('U validateFieldValue header: always returns null (no value)', () => {
    const field: ExtendedSchemaField = { type: 'header', label: 'Section', required: true };
    assert.equal(validateFieldValue(field, undefined), null);
    assert.equal(validateFieldValue(field, null), null);
    assert.equal(validateFieldValue(field, ''), null);
});

test('U validateFieldValue paragraph: always returns null (no value)', () => {
    const field: ExtendedSchemaField = { type: 'paragraph', label: 'Help text', required: true };
    assert.equal(validateFieldValue(field, undefined), null);
    assert.equal(validateFieldValue(field, ''), null);
});

// ---------------------------------------------------------------------------
// validateFieldValue — unknown / legacy field type graceful degradation
// ---------------------------------------------------------------------------

test('U validateFieldValue unknown type: degrades to no validation, returns null', () => {
    // Simulate a field type that was added in a future version or is a legacy alias.
    const field = { type: 'some_future_type', label: 'Mystery' } as unknown as ExtendedSchemaField;
    assert.equal(validateFieldValue(field, 'anything'), null);
    assert.equal(validateFieldValue(field, null), null);
});

test('U validateFieldValue unknown type: required check still fires even for unknown types', () => {
    const field = { type: 'some_future_type', label: 'Mystery', required: true } as unknown as ExtendedSchemaField;
    assert.ok(validateFieldValue(field, '') !== null);
});

// ---------------------------------------------------------------------------
// validateFieldValue — frozen SchemaField types: backward-compat smoke test
// ---------------------------------------------------------------------------

test('U validateFieldValue backward compat: all 11 frozen types accept valid values', () => {
    const cases: Array<[ExtendedSchemaField, unknown]> = [
        [{ type: 'text',     label: 'T', maxLength: 100 }, 'hello'],
        [{ type: 'textarea', label: 'T', maxLength: 500 }, 'multiline\ntext'],
        [{ type: 'richtext', label: 'T', maxLength: 2000 }, '<b>bold</b>'],
        [{ type: 'color',    label: 'T' }, '#FF0000'],
        [{ type: 'image',    label: 'T' }, 'https://cdn.example.com/img.jpg'],
        [{ type: 'select',   label: 'T', options: ['a', 'b'] }, 'a'],
        [{ type: 'toggle',   label: 'T' }, true],
        [{ type: 'range',    label: 'T', min: 0, max: 10, step: 1 }, 5],
        [{ type: 'number',   label: 'T', min: 0, max: 100 }, 42],
        [{ type: 'url',      label: 'T' }, 'https://letbuyy.com'],
        [{ type: 'radio',    label: 'T', options: ['x'] }, 'x'],
    ];
    for (const [field, value] of cases) {
        assert.equal(
            validateFieldValue(field, value),
            null,
            `expected null for type '${field.type}' with value ${JSON.stringify(value)}`,
        );
    }
});

// ---------------------------------------------------------------------------
// isFieldVisible
// ---------------------------------------------------------------------------

test('U isFieldVisible: no visible_if means always visible', () => {
    const field: ExtendedSchemaField = { type: 'text', label: 'Name' };
    assert.equal(isFieldVisible(field, {}), true);
    assert.equal(isFieldVisible(field, { anything: 'anything' }), true);
});

test('U isFieldVisible: visible_if matches → visible', () => {
    const field: ExtendedSchemaField = {
        type: 'text',
        label: 'Custom Label',
        visible_if: { field: 'layout', value: 'custom' },
    };
    assert.equal(isFieldVisible(field, { layout: 'custom' }), true);
});

test('U isFieldVisible: visible_if does not match → hidden', () => {
    const field: ExtendedSchemaField = {
        type: 'text',
        label: 'Custom Label',
        visible_if: { field: 'layout', value: 'custom' },
    };
    assert.equal(isFieldVisible(field, { layout: 'standard' }), false);
});

test('U isFieldVisible: visible_if referenced field absent → hidden', () => {
    const field: ExtendedSchemaField = {
        type: 'text',
        label: 'Custom Label',
        visible_if: { field: 'layout', value: 'custom' },
    };
    assert.equal(isFieldVisible(field, {}), false);
});

test('U isFieldVisible: visible_if uses strict equality (no coercion)', () => {
    const field: ExtendedSchemaField = {
        type: 'toggle',
        label: 'Advanced',
        visible_if: { field: 'mode', value: true },
    };
    // String 'true' is not === boolean true
    assert.equal(isFieldVisible(field, { mode: 'true' }), false);
    assert.equal(isFieldVisible(field, { mode: true }), true);
});

test('U isFieldVisible: visible_if with numeric value', () => {
    const field: ExtendedSchemaField = {
        type: 'color',
        label: 'Accent Color',
        visible_if: { field: 'columns', value: 3 },
    };
    assert.equal(isFieldVisible(field, { columns: 3 }), true);
    assert.equal(isFieldVisible(field, { columns: 4 }), false);
});

test('U isFieldVisible: visible_if with null value', () => {
    const field: ExtendedSchemaField = {
        type: 'text',
        label: 'Note',
        visible_if: { field: 'selected', value: null },
    };
    assert.equal(isFieldVisible(field, { selected: null }), true);
    assert.equal(isFieldVisible(field, { selected: '' }), false);
});

// ---------------------------------------------------------------------------
// resolveFieldDefault
// ---------------------------------------------------------------------------

test('U resolveFieldDefault: explicit default is returned as-is', () => {
    const field: ExtendedSchemaField = { type: 'text', label: 'T', default: 'Hello' };
    assert.equal(resolveFieldDefault(field), 'Hello');
});

test('U resolveFieldDefault: explicit boolean false default returned', () => {
    const field: ExtendedSchemaField = { type: 'toggle', label: 'T', default: false };
    assert.equal(resolveFieldDefault(field), false);
});

test('U resolveFieldDefault: explicit 0 default returned (not confused with falsy)', () => {
    const field: ExtendedSchemaField = { type: 'number', label: 'T', default: 0, min: 0, max: 10 };
    assert.equal(resolveFieldDefault(field), 0);
});

test('U resolveFieldDefault: toggle without default → false', () => {
    const field: ExtendedSchemaField = { type: 'toggle', label: 'T' };
    assert.equal(resolveFieldDefault(field), false);
});

test('U resolveFieldDefault: checkbox without default → false', () => {
    const field: ExtendedSchemaField = { type: 'checkbox', label: 'T' };
    assert.equal(resolveFieldDefault(field), false);
});

test('U resolveFieldDefault: number without default → field.min', () => {
    const field: ExtendedSchemaField = { type: 'number', label: 'T', min: 5, max: 100 };
    assert.equal(resolveFieldDefault(field), 5);
});

test('U resolveFieldDefault: number without default and no min → 0', () => {
    const field: ExtendedSchemaField = { type: 'number', label: 'T' };
    assert.equal(resolveFieldDefault(field), 0);
});

test('U resolveFieldDefault: range without default → field.min', () => {
    const field: ExtendedSchemaField = { type: 'range', label: 'T', min: 0, max: 1, step: 0.1 };
    assert.equal(resolveFieldDefault(field), 0);
});

test('U resolveFieldDefault: header → null (info control, no value)', () => {
    const field: ExtendedSchemaField = { type: 'header', label: 'Section' };
    assert.equal(resolveFieldDefault(field), null);
});

test('U resolveFieldDefault: paragraph → null (info control, no value)', () => {
    const field: ExtendedSchemaField = { type: 'paragraph', label: 'Help' };
    assert.equal(resolveFieldDefault(field), null);
});

test('U resolveFieldDefault: text without default → empty string', () => {
    const field: ExtendedSchemaField = { type: 'text', label: 'T' };
    assert.equal(resolveFieldDefault(field), '');
});

test('U resolveFieldDefault: url without default → empty string', () => {
    const field: ExtendedSchemaField = { type: 'url', label: 'T' };
    assert.equal(resolveFieldDefault(field), '');
});

test('U resolveFieldDefault: color_background without default → empty string', () => {
    const field: ExtendedSchemaField = { type: 'color_background', label: 'Background' };
    assert.equal(resolveFieldDefault(field), '');
});

test('U resolveFieldDefault: font_picker without default → empty string', () => {
    const field: ExtendedSchemaField = { type: 'font_picker', label: 'Font' };
    assert.equal(resolveFieldDefault(field), '');
});

test('U resolveFieldDefault: unknown type without default → empty string', () => {
    const field = { type: 'some_future_type', label: 'T' } as unknown as ExtendedSchemaField;
    assert.equal(resolveFieldDefault(field), '');
});

// ---------------------------------------------------------------------------
// ExtendedSchemaField — backward compat runtime checks
// ---------------------------------------------------------------------------

test('U ExtendedSchemaField: all 11 frozen SchemaField types are structurally valid', () => {
    // Every existing SchemaField object must be assignable to ExtendedSchemaField.
    // This is a compile-time guarantee enforced by the interface definition, but we
    // also verify it at runtime by confirming the types pass through validateFieldValue
    // without a crash (the function accepts ExtendedSchemaField).
    const frozenTypes: ExtendedSchemaField['type'][] = [
        'text', 'textarea', 'richtext', 'color', 'image',
        'select', 'toggle', 'range', 'number', 'url', 'radio',
    ];
    for (const t of frozenTypes) {
        const field: ExtendedSchemaField = { type: t, label: 'Test' };
        // Must not throw
        assert.doesNotThrow(() => validateFieldValue(field, ''));
        assert.doesNotThrow(() => resolveFieldDefault(field));
        assert.doesNotThrow(() => isFieldVisible(field, {}));
    }
});

test('U ExtendedSchemaField: all 15 Phase U types are structurally valid', () => {
    const phaseUTypes: ExtendedSchemaField['type'][] = [
        'color_background', 'color_scheme', 'font_picker',
        'html', 'liquid', 'checkbox', 'video', 'video_url',
        'header', 'paragraph',
        'product', 'collection', 'blog', 'page', 'menu',
    ];
    assert.equal(phaseUTypes.length, 15);
    for (const t of phaseUTypes) {
        const field: ExtendedSchemaField = { type: t, label: 'Test' };
        assert.doesNotThrow(() => validateFieldValue(field, ''));
        assert.doesNotThrow(() => resolveFieldDefault(field));
        assert.doesNotThrow(() => isFieldVisible(field, {}));
    }
});

test('U ExtendedSchemaField: required + visible_if + resource_type are optional (no-crash without them)', () => {
    // Fields without these optional Phase U properties are still valid
    const minimal: ExtendedSchemaField = { type: 'text', label: 'Minimal' };
    assert.ok(minimal.required === undefined);
    assert.ok(minimal.visible_if === undefined);
    assert.ok(minimal.resource_type === undefined);
    assert.equal(isFieldVisible(minimal, {}), true);
    assert.equal(validateFieldValue(minimal, 'ok'), null);
});

// ---------------------------------------------------------------------------
// Integration: visible_if filter scenario (mimics SchemaFormRenderer loop)
// ---------------------------------------------------------------------------

test('U integration: visible_if filter correctly gates a dependent field', () => {
    const schemaFields: Record<string, ExtendedSchemaField> = {
        layout: { type: 'select', label: 'Layout', options: ['grid', 'carousel'] },
        autoplay: { type: 'toggle', label: 'Autoplay', visible_if: { field: 'layout', value: 'carousel' } },
        columns: { type: 'number', label: 'Columns', min: 2, max: 5, visible_if: { field: 'layout', value: 'grid' } },
    };

    const settings: Record<string, unknown> = { layout: 'carousel' };

    const visibleKeys = Object.keys(schemaFields).filter(
        (key) => isFieldVisible(schemaFields[key]!, settings),
    );

    assert.ok(visibleKeys.includes('layout'), 'layout always visible');
    assert.ok(visibleKeys.includes('autoplay'), 'autoplay visible when layout=carousel');
    assert.ok(!visibleKeys.includes('columns'), 'columns hidden when layout=carousel');
});

// ---------------------------------------------------------------------------
// EXPERIENCE_FONT_REGISTRY export sanity (used by font_picker)
// ---------------------------------------------------------------------------

test('U EXPERIENCE_FONT_REGISTRY: exactly 6 known families (font_picker boundary)', () => {
    const families = Object.keys(EXPERIENCE_FONT_REGISTRY);
    assert.equal(families.length, 6);
    assert.ok(families.includes('Inter'), 'Inter in registry');
    assert.ok(families.includes('Playfair Display'), 'Playfair Display in registry');
    assert.ok(families.includes('Lato'), 'Lato in registry');
});
