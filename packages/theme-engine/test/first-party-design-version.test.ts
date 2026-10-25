import assert from 'node:assert/strict';
import test from 'node:test';
import { createLetbuyyCoreLiquidThemeBundleFixture, isFirstPartyCoreBundleSlug } from '../src/theme-bundle-core';
import { compilePortableToLiquidBundle } from '../src/portable-to-liquid';

const presets = ['forge', 'sense', 'aura', 'craft', 'refresh', 'ride', 'dawn', 'bloom', 'nova', 'summit'];

test('versioned niche designs do not receive legacy Core composition repairs', () => {
  for (const preset of presets) {
    assert.equal(isFirstPartyCoreBundleSlug(`letbuyy-${preset}`, '2.0.0'), false, preset);
    assert.equal(isFirstPartyCoreBundleSlug(`letbuyy-${preset}`, '1.0.0'), true, `${preset} v1`);
    assert.equal(isFirstPartyCoreBundleSlug(`letbuyy-${preset}`), true, `${preset} legacy capture`);
  }
});

test('actual Core and unknown packages keep their existing compatibility classification', () => {
  assert.equal(isFirstPartyCoreBundleSlug('letbuyy-core-liquid', '2.0.0'), true);
  assert.equal(isFirstPartyCoreBundleSlug('merchant-theme', '2.0.0'), false);
  assert.equal(isFirstPartyCoreBundleSlug('letbuyy-unregistered', '2.0.0'), false);
});

test('saving a v2 niche section does not restore an intentionally omitted legacy link', () => {
  for (const preset of presets) {
    const base = createLetbuyyCoreLiquidThemeBundleFixture();
    base.package.slug = `letbuyy-${preset}`;
    base.package.version = '2.0.0';
    const saved = compilePortableToLiquidBundle({ templates: { index: {
      sections: { merchant: { type: 'featured-products', settings: { title: 'Merchant selection' } } },
      order: ['merchant'],
    } } }, { baseBundle: base }).bundle;
    assert.deepEqual(saved.templates.index.sections.merchant.settings, { title: 'Merchant selection' }, preset);
  }
});
