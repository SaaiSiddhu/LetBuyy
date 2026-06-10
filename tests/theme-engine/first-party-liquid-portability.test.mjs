import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const THEME_BUNDLE_SOURCE = 'packages/theme-engine/src/theme-bundle.ts';
const THEME_GOVERNANCE_SOURCE = 'packages/theme-engine/src/theme-governance.ts';
const STOREFRONT_REACT_REGISTRY_SOURCE = 'apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('first-party Urban Kicks ships as a portable Liquid bundle', () => {
  const source = read(THEME_BUNDLE_SOURCE);

  assert.match(source, /export function createUrbanKicksLiquidThemeBundleFixture/);
  assert.match(source, /slug: 'urban-kicks-liquid'/);
  assert.match(source, /name: 'Urban Kicks Liquid'/);
  assert.match(source, /First-party Urban Kicks storefront converted to portable Liquid sections and blocks/);
  assert.match(source, /type: 'announcement-bar'/);
  assert.match(source, /type: 'hero-banner'/);
  assert.match(source, /type: 'category-grid'/);
  assert.match(source, /type: 'featured-products'/);
  assert.match(source, /type: 'product-grid'/);
  assert.match(source, /type: 'newsletter-signup'/);
});

test('brand-new spotlight section is provided by bundle files, not storefront code', () => {
  const bundleSource = read(THEME_BUNDLE_SOURCE);
  const registrySource = read(STOREFRONT_REACT_REGISTRY_SOURCE);

  assert.match(bundleSource, /'spotlight-default': \{/);
  assert.match(bundleSource, /type: 'spotlight'/);
  assert.match(bundleSource, /path: 'sections\/spotlight\.liquid'/);
  assert.match(bundleSource, /class="lb-first-party-spotlight"/);
  assert.match(bundleSource, /Zero storefront code change/);
  assert.doesNotMatch(registrySource, /spotlight/i);
});

test('converted Liquid theme keeps reusable and app block portability', () => {
  const source = read(THEME_BUNDLE_SOURCE);

  assert.match(source, /path: 'blocks\/category\.liquid'/);
  assert.match(source, /path: 'blocks\/product-card\.liquid'/);
  assert.match(source, /path: 'blocks\/badge\.liquid'/);
  assert.match(source, /type: '@app'/);
  assert.match(source, /slot: 'home\.spotlight\.offer'/);
});

test('Liquid parity map covers the frozen React section files with portable sections', () => {
  const bundleSource = read(THEME_BUNDLE_SOURCE);
  const governanceSource = read(THEME_GOVERNANCE_SOURCE);
  const parityEntries = [...governanceSource.matchAll(/liquidSectionType:\s*'([^']+)'/g)].map((match) => match[1]);

  assert.equal(parityEntries.length, 20);
  assert.match(bundleSource, /export function createLiquidParitySectionFiles/);

  for (const sectionType of parityEntries) {
    const keyPattern = sectionType.includes('-') ? `['"]${sectionType}['"]` : `(?:['"]${sectionType}['"]|${sectionType})`;
    assert.match(bundleSource, new RegExp(`${keyPattern}:\\s*(?:createLiquidSectionFile|\\{)`));
    assert.match(bundleSource, new RegExp(`type:\\s*['"]${sectionType}['"]`));
  }
});
