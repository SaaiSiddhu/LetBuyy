import assert from 'node:assert/strict';
import test from 'node:test';
import { firstPartyThemeListings } from '@letbuyy/theme-engine';
import { sanitizeBranding, checkoutPaymentAppearance } from './branding';
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

test('all ten catalog palettes reach the payment popup and preserve explicit merchant overrides', () => {
    const catalog = firstPartyThemeListings({ designVersion: '2.0.0' });
    assert.equal(catalog.length, 10);
    for (const theme of catalog) {
        const branding = sanitizeBranding(null, theme.settings);
        assert.equal(checkoutPaymentAppearance(branding, 'https://store.example.invalid').color, theme.settings.primaryColor);
    }
    const merchant = sanitizeBranding({ primary_color: catalog[2].settings.primaryColor as string }, catalog[0].settings);
    assert.equal(checkoutPaymentAppearance(merchant, 'https://store.example.invalid').color, catalog[2].settings.primaryColor);
});

test('payment logos resolve against the verified storefront and unsafe or absent images are omitted', () => {
    const branding = sanitizeBranding({ logo_url: '/assets/store-logo.png' }, null);
    assert.equal(checkoutPaymentAppearance(branding, 'https://store.example.invalid').image, 'https://store.example.invalid/assets/store-logo.png');
    for (const logo of [null, 'javascript:alert(1)', 'data:image/png,secret', 'https://user:password@images.example.invalid/logo.png', 'http://images.example.invalid/logo.png']) {
        assert.equal(checkoutPaymentAppearance({ ...branding, logoUrl: logo }, 'https://store.example.invalid').image, undefined);
    }
    assert.equal(checkoutPaymentAppearance({ ...branding, logoUrl: 'https://images.example.invalid/logo.png' }, 'https://store.example.invalid').image, 'https://images.example.invalid/logo.png');
});
