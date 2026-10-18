import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isStaleThemeEditorBaseVersion } from '../execution/theme-execution.adapter';

test('theme editor optimistic lock requires the exact explicit nonnegative integer version', () => {
    assert.equal(isStaleThemeEditorBaseVersion(1, 0), true);
    assert.equal(isStaleThemeEditorBaseVersion(3, 2), true);
    assert.equal(isStaleThemeEditorBaseVersion(3, 3), false);
    assert.equal(isStaleThemeEditorBaseVersion(0, 0), false);
    for (const base of [-1, 1.5, 4, NaN, Infinity]) assert.equal(isStaleThemeEditorBaseVersion(3, base), true);
    assert.equal(isStaleThemeEditorBaseVersion(3, undefined), true);
    assert.equal(isStaleThemeEditorBaseVersion(3, null), true);
});
