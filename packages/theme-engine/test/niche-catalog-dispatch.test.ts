import assert from 'node:assert/strict';
import test from 'node:test';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '../src/first-party-theme-catalog';

test('all nine v2 packages require explicit distribution version and retain stable catalog identities', () => {
  const legacy = firstPartyThemeListings();
  const next = firstPartyThemeListings({ designVersion: '2.0.0' });
  for (const listing of next.filter(row => row.presetId !== 'sense')) {
    const previous = legacy.find(row => row.id === listing.id)!;
    assert.equal(previous.slug, listing.slug);
    const original = createFirstPartyCatalogBundle(listing.slug);
    const bundle = createFirstPartyCatalogBundle(listing.slug, { designVersion: '2.0.0' });
    assert.equal(original.package.version, '1.0.0', listing.slug);
    assert.equal(bundle.package.version, '2.0.0', listing.slug);
    assert.equal(bundle.package.name, listing.name);
    assert.equal(bundle.package.slug, listing.slug);
    for (const route of Object.keys(original.templates)) assert.ok(bundle.templates[route], `${listing.slug}:${route}`);
    assert.notDeepEqual(bundle.templates.index.order, original.templates.index.order, listing.slug);
  }
  assert.equal(legacy.find(row => row.presetId === 'bloom')!.category, 'pet');
  assert.equal(next.find(row => row.presetId === 'bloom')!.category, 'toys');
  assert.equal(legacy.find(row => row.presetId === 'summit')!.name, 'Summit');
  assert.equal(next.find(row => row.presetId === 'summit')!.name, 'Kindred');
});

test('Threadline keeps the same bundle and unknown catalog slugs fail closed', () => {
  assert.deepEqual(createFirstPartyCatalogBundle('letbuyy-sense'), createFirstPartyCatalogBundle('letbuyy-sense', { designVersion: '2.0.0' }));
  assert.throws(() => createFirstPartyCatalogBundle('unknown', { designVersion: '2.0.0' }), /Unknown/);
});

test('the distribution builder includes historical order facts only in the nine explicit v2 packages', () => {
  for (const listing of firstPartyThemeListings({ designVersion: '2.0.0' })) {
    const legacy = createFirstPartyCatalogBundle(listing.slug);
    const next = createFirstPartyCatalogBundle(listing.slug, { designVersion: '2.0.0' });
    assert.doesNotMatch(legacy.sections['customer-order-detail'].source, /item\.niche_facts_text/, listing.slug);
    if (listing.presetId === 'sense') {
      assert.deepEqual(next, legacy);
      continue;
    }
    assert.match(next.sections['customer-order-detail'].source, /item\.niche_facts_text/, listing.slug);
    assert.equal(next.layout.theme.source.split('data-niche-order-presentation="1"').length - 1, 1, listing.slug);
  }
});
