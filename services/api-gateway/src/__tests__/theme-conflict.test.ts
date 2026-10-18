import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isStaleThemeEditorBaseVersion } from '../execution/theme-execution.adapter';

test('theme editor optimistic lock treats zero as a provided stale base version', () => {
    assert.equal(isStaleThemeEditorBaseVersion(1, 0), true);
    assert.equal(isStaleThemeEditorBaseVersion(3, 2), true);
    assert.equal(isStaleThemeEditorBaseVersion(3, 3), false);
    assert.equal(isStaleThemeEditorBaseVersion(3, undefined), false);
    assert.equal(isStaleThemeEditorBaseVersion(3, null), false);
});
