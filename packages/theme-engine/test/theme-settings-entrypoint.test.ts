import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_THEME_SETTINGS as canonicalDefaults } from '../src/index';
import { DEFAULT_THEME_SETTINGS as browserDefaults } from '@letbuyy/theme-engine/theme-settings';

test('the browser settings entry point and main API share the same canonical defaults', () => {
    assert.strictEqual(browserDefaults, canonicalDefaults);
});
