import assert from 'node:assert/strict';
import test from 'node:test';
import { EDITOR_FIELD_TYPES, normalizeEditorSchemaField, resolveFieldOptions, validateFieldValue, type ExtendedThemeSettingsSchema } from '../src/schema-field-extensions.ts';
import { ThemeBundleSettingFieldSchema } from '../src/theme-bundle.ts';
import { collectThemeTemplateValidationIssues, getDefaultStorefrontThemeTemplate, getSectionSchemas, getThemeSettingsSchema } from '../src/index.ts';

test('storage accepts exactly the shared editor field vocabulary with required/visibility/resource metadata', () => {
    for (const type of EDITOR_FIELD_TYPES) {
        const input = { type, label: 'Declared setting', required: true, visible_if: { field: 'enabled', value: false }, resource_type: 'page', default: false };
        assert.deepEqual(ThemeBundleSettingFieldSchema.parse(input), input);
    }
    assert.equal(ThemeBundleSettingFieldSchema.safeParse({ type: 'arbitrary_plugin_control', label: 'Unknown' }).success, false);
});
test('normalization retains labeled primitive options, false/zero/empty defaults and conditional metadata', () => {
    for (const value of [false, 0, '']) {
        const input = { type: 'select', label: 'Declared choice', default: value, options: [{ label: 'Disabled', value: false }, { label: 'Zero', value: 0 }, { label: 'Empty', value: '' }], required: true, visible_if: { field: 'enabled', value: false }, resource_type: 'page' };
        const normalized = normalizeEditorSchemaField(input, 'Fallback label');
        assert.equal(normalized.default, value); assert.deepEqual(normalized.options, input.options);
        assert.deepEqual(normalized.visible_if, input.visible_if); assert.equal(normalized.required, true); assert.equal(normalized.resource_type, 'page');
        assert.deepEqual(resolveFieldOptions(normalized), input.options);
        assert.equal(validateFieldValue(normalized, value), value === '' ? 'Declared choice is required' : null);
    }
});
test('unknown descriptors and malformed options preserve the value with a read-only diagnostic', () => {
    const value = { nested: [false, 0, ''], reference: 'owned-resource' };
    const unknown = normalizeEditorSchemaField({ type: 'future_control', label: 'Future setting', default: value }, 'Fallback');
    assert.ok(unknown.readOnlyReason); assert.deepEqual(unknown.default, value);
    assert.ok(normalizeEditorSchemaField({ type: 'select', options: [{ unexpected: value }] }, 'Choice').readOnlyReason);
    assert.equal(normalizeEditorSchemaField({ type: 'font', label: 'Font' }, 'Fallback').type, 'font_picker');
    assert.equal(normalizeEditorSchemaField({ type: 'checkbox', label: 'Enabled', default: false }, 'Fallback').type, 'checkbox');
});
test('canonical draft validation accepts declared boolean/numeric options, rejects type coercion and enforces visible required fields', () => {
    const slug = 'letbuyy-core';
    const settingsSchema: ExtendedThemeSettingsSchema = structuredClone(getThemeSettingsSchema(slug));
    settingsSchema.settings.synthetic_contract = { label: 'Synthetic controls', description: 'Owned contract test', fields: {
        choice: { type: 'select', label: 'Choice', options: [{ value: false, label: 'Off' }, { value: 0, label: 'Zero' }] },
        enabled: { type: 'checkbox', label: 'Enabled' },
        conditional: { type: 'text', label: 'Conditional text', required: true, visible_if: { field: 'enabled', value: true } },
    } };
    const config = structuredClone(getDefaultStorefrontThemeTemplate(slug));
    config.themeSettings.choice = false; config.themeSettings.enabled = false;
    const issues = () => collectThemeTemplateValidationIssues({ templateConfig: config, runtime: { sectionSchemas: getSectionSchemas(slug), settingsSchema }, themeSlug: slug });
    assert.deepEqual(issues(), []);
    config.themeSettings.choice = 0; assert.deepEqual(issues(), []);
    config.themeSettings.choice = '0'; assert.ok(issues().some(issue => issue.includes('declared options')));
    config.themeSettings.choice = false; config.themeSettings.enabled = true;
    assert.ok(issues().some(issue => issue.includes('conditional') && issue.includes('required')));
    config.themeSettings.conditional = 'Owned required value'; assert.deepEqual(issues(), []);
});
