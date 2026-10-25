import assert from 'node:assert/strict';
import test from 'node:test';
import { assertBundleIdentity, runThemeDataContract, sha256 } from './theme-data-contract.mjs';
import { createFirstPartyCatalogBundle } from '../private-heading-successor/packages/theme-engine/src/first-party-theme-catalog.ts';
import { parseLiquidThemePackageBundle } from '../private-heading-successor/packages/theme-engine/src/theme-bundle.ts';
import { toThemeDocumentV2, fromThemeDocumentV2 } from '../private-heading-successor/packages/theme-engine/src/theme-document.ts';

const actual = createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0', circuitVersion: '2.0.1' });
const before = JSON.stringify(actual);
const forbiddenAdapters = new Proxy({}, { get() { throw new Error('adapters must not be touched before identity admission'); } });

test('an independently supplied matching actual slug/version/hash is accepted without mutation', () => {
  assertBundleIdentity(actual, { slug: 'letbuyy-forge', version: '2.0.1', bundleSha256: sha256(actual) });
  assert.equal(JSON.stringify(actual), before);
});

test('missing expected identity or wrong slug/version fails before schema/editor adapters', () => {
  for (const expectedIdentity of [undefined, { slug: 'letbuyy-forge' }, { slug: 'letbuyy-other', version: '2.0.1' }, { slug: 'letbuyy-forge', version: '2.0.0' }]) {
    assert.throws(() => runThemeDataContract({ bundle: actual, expectedIdentity, templateKey: 'index', adapters: forbiddenAdapters }), /expected slug|slug does not match|version mismatch/);
  }
  assert.equal(JSON.stringify(actual), before);
});

test('an unrecognized successor factory option cannot silently qualify a 2.0.0 fallback', () => {
  const fallback = createFirstPartyCatalogBundle('letbuyy-forge', { designVersion: '2.0.0', unrecognizedSuccessorOption: '2.0.1' });
  assert.equal(fallback.package.version, '2.0.0');
  assert.throws(() => runThemeDataContract({ bundle: fallback, expectedIdentity: { slug: 'letbuyy-forge', version: '2.0.1' }, templateKey: 'index', adapters: forbiddenAdapters }), /version mismatch/);
});

test('a changed package hash is refused even when the slug/version strings match', () => {
  assert.throws(() => assertBundleIdentity(actual, { slug: 'letbuyy-forge', version: '2.0.1', bundleSha256: '0'.repeat(64) }), /package bytes differ/);
  assert.equal(JSON.stringify(actual), before);
});

test('canonical definition roundtrip preserves absent, empty and explicit child metadata distinctly', () => {
  for (const value of [undefined, [], ['badge']]) {
    const fixture = structuredClone(actual);
    if (value === undefined) delete fixture.blocks.badge.schema.allowed_child_types;
    else fixture.blocks.badge.schema.allowed_child_types = value;
    const parsed = parseLiquidThemePackageBundle(fixture);
    const restored = fromThemeDocumentV2(JSON.parse(JSON.stringify(toThemeDocumentV2(parsed))));
    assert.deepEqual(restored.blocks.badge.schema, parsed.blocks.badge.schema);
    assert.deepEqual(restored.blocks.badge.schema.allowed_child_types, value);
  }
  assert.equal(JSON.stringify(actual), before);
});
