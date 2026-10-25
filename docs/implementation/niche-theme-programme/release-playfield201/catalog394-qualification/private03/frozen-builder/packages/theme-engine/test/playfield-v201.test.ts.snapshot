import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from '../src/first-party-theme-catalog';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core';
import { createPlayfieldTheme } from '../src/playfield-theme';
import { createPlayfieldThemeV201 } from '../src/playfield-theme-v201';
import { fromThemeDocumentV2, toThemeDocumentV2 } from '../src/theme-document';

// Hashes taken before this allocated source change; no catalog capture is generated here.
const baseline = [
  {
    "slug": "letbuyy-forge",
    "designVersion": "default",
    "sha256": "7d83a19e92dd3943751e77a3a1181373ae39f0141a89b41e949a47e3301f463d"
  },
  {
    "slug": "letbuyy-forge",
    "designVersion": "2.0.0",
    "sha256": "cadab65d5351e1d5f8506d3620df481700ff38ae7e23c19f7282d1f31be79b46"
  },
  {
    "slug": "letbuyy-sense",
    "designVersion": "default",
    "sha256": "61082be647eadae9b6e42002be241a82ba6c3627427568f6e64e2cf961c3742e"
  },
  {
    "slug": "letbuyy-sense",
    "designVersion": "2.0.0",
    "sha256": "61082be647eadae9b6e42002be241a82ba6c3627427568f6e64e2cf961c3742e"
  },
  {
    "slug": "letbuyy-aura",
    "designVersion": "default",
    "sha256": "a8f5c97ac1a95745a40bcde495e2c9a6d601ee434b8e9f41c7a5a4cdb4bed127"
  },
  {
    "slug": "letbuyy-aura",
    "designVersion": "2.0.0",
    "sha256": "e1f8ee24971241d472ec34e50b855fdb94cea769cdde777bd119ba3c1d17619c"
  },
  {
    "slug": "letbuyy-craft",
    "designVersion": "default",
    "sha256": "22870a2aa9020051c2019f3a46aed1d45e4e351f24611d62f47fb59c93050867"
  },
  {
    "slug": "letbuyy-craft",
    "designVersion": "2.0.0",
    "sha256": "4e068c69808b5cb82b8caaabbb9197580c425c1edc43b298fb667959ab050497"
  },
  {
    "slug": "letbuyy-refresh",
    "designVersion": "default",
    "sha256": "57ac510a46f9912cc1c9693b643a6facc5d83b00e92318a389f11d665f71fa54"
  },
  {
    "slug": "letbuyy-refresh",
    "designVersion": "2.0.0",
    "sha256": "6b05ab842f55dd6fcc7b99991a5e5160a5214e4417aedd46c343e94a3041a718"
  },
  {
    "slug": "letbuyy-ride",
    "designVersion": "default",
    "sha256": "58aa537e78fcdaa00bba549891befe53d01408427c55e4d692960420512a1c1e"
  },
  {
    "slug": "letbuyy-ride",
    "designVersion": "2.0.0",
    "sha256": "127a261320b208ec845277abe51c176921767934988f98a2ce73188bfa95c224"
  },
  {
    "slug": "letbuyy-dawn",
    "designVersion": "default",
    "sha256": "1917340805bf4559a0f77e5dda01b18d942855e4fdd3786af324c4c0f8883209"
  },
  {
    "slug": "letbuyy-dawn",
    "designVersion": "2.0.0",
    "sha256": "d98a0388e3775d4f00dec8c992316af74d8255fd993cc08fc47032b7b4a8aee0"
  },
  {
    "slug": "letbuyy-bloom",
    "designVersion": "default",
    "sha256": "9872b5c037acd9312293de09fcd135001b188b41a5e46d42ba5b4b59e5de3d59"
  },
  {
    "slug": "letbuyy-bloom",
    "designVersion": "2.0.0",
    "sha256": "eb21c6b0e48b40cb11b5f3ba1e45f6f2ec8c50667175e82c8edb6bbe36299efc"
  },
  {
    "slug": "letbuyy-nova",
    "designVersion": "default",
    "sha256": "c4d3d6738d0600191364fb25cf25d892b6eb54279a2754dac230391d0a31e450"
  },
  {
    "slug": "letbuyy-nova",
    "designVersion": "2.0.0",
    "sha256": "a06efcb494f2d8b47d901b57388743de7a1bece20afe818255e8c03ae60597f8"
  },
  {
    "slug": "letbuyy-summit",
    "designVersion": "default",
    "sha256": "c09a6c9d5088034bcb8b2fe79b1ac2452f53904c04a27c7a4164cc52104b1c13"
  },
  {
    "slug": "letbuyy-summit",
    "designVersion": "2.0.0",
    "sha256": "4702e911bbc5d90b9ec46b9ff3d902249d7411b699e0a0c81283a713f91c1655"
  }
];

test('all twenty previous default/v2 builder outputs remain byte-identical', () => {
    for (const row of baseline) {
        const bundle = createFirstPartyCatalogBundle(row.slug, row.designVersion === 'default' ? {} : { designVersion: '2.0.0' });
        assert.equal(createHash('sha256').update(JSON.stringify(bundle)).digest('hex'), row.sha256, row.slug + ':' + row.designVersion);
    }
});

test('2.0.1 requires both explicit niche-v2 and Playfield opt-in; the other nine listings/builders are unchanged', () => {
    assert.deepEqual(firstPartyThemeListings({ designVersion: '2.0.0', playfieldVersion: '2.0.1' }), firstPartyThemeListings({ designVersion: '2.0.0' }));
    for (const listing of firstPartyThemeListings()) {
        assert.deepEqual(createFirstPartyCatalogBundle(listing.slug, { playfieldVersion: '2.0.1' }), createFirstPartyCatalogBundle(listing.slug));
        const old = createFirstPartyCatalogBundle(listing.slug, { designVersion: '2.0.0' });
        const next = createFirstPartyCatalogBundle(listing.slug, { designVersion: '2.0.0', playfieldVersion: '2.0.1' });
        if (listing.slug === 'letbuyy-bloom') assert.equal(next.package.version, '2.0.1');
        else assert.deepEqual(next, old, listing.slug);
    }
});

test('append-only factory changes only package version and declared PDP contract; original input/styles/routes remain unchanged', () => {
    const base = createLetbuyyCoreLiquidThemeBundleFixture(), before = structuredClone(base);
    const old = createPlayfieldTheme(base), next = createPlayfieldThemeV201(base);
    assert.deepEqual(base, before); assert.equal(old.package.version, '2.0.0'); assert.equal(next.package.version, '2.0.1'); assert.equal(next.package.version_number, 3);
    assert.deepEqual(next.layout, old.layout); assert.deepEqual(next.templates, old.templates); assert.deepEqual(next.config, old.config);
    for (const key of Object.keys(old.sections)) if (key !== 'product-detail') assert.deepEqual(next.sections[key], old.sections[key], key);
    assert.deepEqual(next.sections['product-detail'].schema, old.sections['product-detail'].schema);
    const source = next.sections['product-detail'].source;
    for (const hook of ['data-lb-toy-presentation','data-lb-toy-field="age"','data-lb-toy-warnings','data-lb-toy-contents','data-lb-toy-contents-completeness','data-lb-toy-details','data-lb-toy-field="materials"','data-lb-toy-field="finish"','data-lb-toy-field="care"','data-lb-toy-status']) assert.ok(source.includes(hook), hook);
    assert.doesNotMatch(old.sections['product-detail'].source, /data-lb-toy-/);
    assert.match(source, /lb-variant-picker/); assert.match(source, /lb-add-to-cart/);
    assert.deepEqual(fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(next)))), next);
});
