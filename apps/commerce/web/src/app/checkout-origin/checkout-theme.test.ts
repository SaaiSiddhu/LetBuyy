import assert from 'node:assert/strict';
import test from 'node:test';
import { firstPartyThemeListings } from '@letbuyy/theme-engine';
import { checkoutThemeStyle } from './checkout-theme';

test('all ten persisted catalog identities select their own checkout treatment, including published UUIDs', () => {
    const catalog = firstPartyThemeListings({ designVersion: '2.0.0' });
    assert.equal(catalog.length, 10);
    const treatments = new Set<string>();
    for (const theme of catalog) {
        const byId = checkoutThemeStyle(theme.id);
        assert.equal(byId.slug, theme.slug);
        assert.deepEqual(byId, checkoutThemeStyle(theme.slug));
        assert.notEqual(byId.style, 'standard');
        treatments.add(byId.style);
    }
    assert.equal(treatments.size, 10);
    assert.deepEqual(checkoutThemeStyle('untrusted<script>'), { slug: 'default', style: 'standard' });
});
