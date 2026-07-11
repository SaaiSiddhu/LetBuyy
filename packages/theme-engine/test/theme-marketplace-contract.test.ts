// Phase AE — Theme Marketplace Partner-Submission Validation Contract Tests
//
// Verifies that validateThemeForMarketplace correctly composes all existing
// validators (K/AA/Y/N) into a deterministic, fail-closed gate.
//
// Test groups:
//   AE-K-*  Stage K pass/fail (via validateThemeInstall composition)
//   AE-AA-* Stage AA pass/fail (custom CSS in settings_data.current)
//   AE-Y-*  Stage Y pass/fail (@app block credential key check)
//   AE-N-*  Stage N pass/fail (ThemeDocument parse)
//   AE-DET  Determinism (same input → identical result on repeated calls)
//   AE-OK   Fully-clean bundles produce ok=true

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateThemeForMarketplace,
  type ThemeMarketplaceValidationResult,
} from '../src/theme-marketplace-contract.ts';

import {
  createMinimalLiquidThemeBundleFixture,
  createUrbanKicksLiquidThemeBundleFixture,
  THEME_LIQUID_BUNDLE_SCHEMA_VERSION,
  type LiquidThemePackageBundle,
} from '../src/theme-bundle.ts';

import { createLetbuyyCoreLiquidThemeBundleFixture } from '../src/theme-bundle-core.ts';

// ---- helpers ----------------------------------------------------------------

/**
 * Deep-clone a fixture via JSON round-trip so mutations do not leak between tests.
 * Safe for plain JSON-serialisable bundles (no functions/symbols).
 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Return a bundle with a CSS-injection payload injected into settings_data.current. */
function bundleWithCustomCss(
  base: LiquidThemePackageBundle,
  cssValue: string,
  key: string = 'custom_css',
): LiquidThemePackageBundle {
  const b = clone(base);
  b.config = b.config ?? { settings_schema: [], settings_data: { current: {}, presets: {} } };
  b.config.settings_data = b.config.settings_data ?? { current: {}, presets: {} };
  (b.config.settings_data.current as Record<string, unknown>)[key] = cssValue;
  return b;
}

/** Return a bundle with a blocked setting key in the first @app template block found. */
function bundleWithBlockedAppBlockKey(
  base: LiquidThemePackageBundle,
  blockedKey: string,
  blockedValue: string,
): LiquidThemePackageBundle {
  const b = clone(base);
  for (const template of Object.values(b.templates)) {
    for (const section of Object.values(template.sections)) {
      for (const block of Object.values(section.blocks as Record<string, { type: string; settings: Record<string, unknown> }>)) {
        if (block.type === '@app' || block.type.startsWith('app:')) {
          block.settings[blockedKey] = blockedValue;
          return b;
        }
      }
    }
  }
  // No @app block found; attach one to the first section's blocks.
  for (const template of Object.values(b.templates)) {
    for (const section of Object.values(template.sections as Record<string, { blocks: Record<string, unknown>; block_order: string[] }>)) {
      section.blocks['ae_test_app_block'] = {
        type: '@app',
        settings: { [blockedKey]: blockedValue },
        disabled: false,
        blocks: {},
        block_order: [],
      };
      section.block_order.push('ae_test_app_block');
      return b;
    }
  }
  return b;
}

// ============================================================================
// AE-OK — Fully-clean first-party bundles pass the gate
// ============================================================================

test('AE-OK-01 minimal fixture passes all stages (ok=true)', () => {
  const result = validateThemeForMarketplace(createMinimalLiquidThemeBundleFixture());
  assert.equal(result.ok, true,
    `Expected ok=true; blocking violations: ${
      result.violations.filter(v => !v.advisory).map(v => v.message).join(', ') || '(none)'
    }`,
  );
  assert.equal(
    result.violations.filter(v => !v.advisory).length, 0,
    'Expected zero blocking violations for minimal fixture',
  );
});

test('AE-OK-02 Urban Kicks fixture passes all stages (ok=true)', () => {
  const result = validateThemeForMarketplace(createUrbanKicksLiquidThemeBundleFixture());
  assert.equal(result.ok, true,
    `Expected ok=true; blocking violations: ${
      result.violations.filter(v => !v.advisory).map(v => v.message).join(', ') || '(none)'
    }`,
  );
});

test('AE-OK-03 Letbuyy Core fixture passes all stages (ok=true)', () => {
  const result = validateThemeForMarketplace(createLetbuyyCoreLiquidThemeBundleFixture());
  assert.equal(result.ok, true,
    `Expected ok=true; blocking violations: ${
      result.violations.filter(v => !v.advisory).map(v => v.message).join(', ') || '(none)'
    }`,
  );
});

test('AE-OK-04 safe CSS default in settings_data.current passes Stage AA', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle = bundleWithCustomCss(base, '.hero { color: red; background: #fff; }');
  const result = validateThemeForMarketplace(bundle);
  assert.equal(result.ok, true,
    `Expected ok=true for safe CSS; violations: ${result.violations.map(v => v.message).join(', ')}`,
  );
  const aaViolations = result.violations.filter(v => v.stage === 'AA');
  assert.equal(aaViolations.length, 0, 'Expected no AA violations for safe CSS');
});

test('AE-OK-05 empty settings_data.current string passes Stage AA', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle = bundleWithCustomCss(base, '');
  const result = validateThemeForMarketplace(bundle);
  const aaViolations = result.violations.filter(v => v.stage === 'AA');
  assert.equal(aaViolations.length, 0, 'Empty string must produce no AA violations');
});

// ============================================================================
// AE-K — Stage K (validateThemeInstall composition)
// ============================================================================

test('AE-K-01 null input returns ok=false with K:schema-invalid', () => {
  const result = validateThemeForMarketplace(null);
  assert.equal(result.ok, false, 'null input must be rejected');
  assert.ok(
    result.violations.some(v => v.stage === 'K' && v.code === 'K:schema-invalid'),
    `Expected K:schema-invalid; got: ${JSON.stringify(result.violations)}`,
  );
});

test('AE-K-02 empty object returns ok=false with K:schema-invalid', () => {
  const result = validateThemeForMarketplace({});
  assert.equal(result.ok, false, 'empty object must be rejected');
  assert.ok(
    result.violations.some(v => v.stage === 'K' && v.code === 'K:schema-invalid'),
    `Expected K:schema-invalid; got: ${JSON.stringify(result.violations)}`,
  );
});

test('AE-K-03 unknown schema_version returns ok=false with K:schema-invalid or K:compat-range', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  const bad: LiquidThemePackageBundle = {
    ...clone(base),
    schema_version: 'future-epoch-unknown',
    package: {
      ...base.package,
      compatibility_range: '>=future-epoch-unknown',
    },
  };
  const result = validateThemeForMarketplace(bad);
  assert.equal(result.ok, false);
  assert.ok(
    result.violations.some(
      v => v.stage === 'K' && (v.code === 'K:schema-invalid' || v.code === 'K:compat-range'),
    ),
    `Expected K:schema-invalid or K:compat-range; got: ${JSON.stringify(result.violations)}`,
  );
});

test('AE-K-04 valid bundle with non-matching compat range returns ok=false', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  // Use a known schema version but set compat range to a future unsupported epoch.
  // This bypasses the G4 version-gate (schema_version is known) but fails compat range.
  const bad: LiquidThemePackageBundle = {
    ...clone(base),
    package: {
      ...base.package,
      compatibility_range: '>=9999-unsupported-epoch',
    },
  };
  const result = validateThemeForMarketplace(bad);
  assert.equal(result.ok, false);
  assert.ok(
    result.violations.some(v => v.stage === 'K' && v.code === 'K:compat-range'),
    `Expected K:compat-range violation; got: ${JSON.stringify(result.violations)}`,
  );
});

test('AE-K-05 Stage K parity-gap warnings are advisory (do not set ok=false)', () => {
  // A bundle with all known section types may produce parity-gap advisory warnings.
  // The Urban Kicks fixture includes well-known section types so it may or may not
  // produce parity-gap warnings; either way ok must remain true.
  const result = validateThemeForMarketplace(createUrbanKicksLiquidThemeBundleFixture());
  // Advisory violations must have advisory=true
  const advisoryViolations = result.violations.filter(v => v.advisory === true);
  for (const v of advisoryViolations) {
    assert.ok(
      v.code === `K:${v.code.slice(2)}` || v.stage === 'K',
      `Advisory violation must be from Stage K; got: ${JSON.stringify(v)}`,
    );
  }
  // ok must still be true (advisory violations do not block)
  assert.equal(result.ok, true,
    `Advisory violations must not cause ok=false; got: ${JSON.stringify(result.violations)}`,
  );
});

// ============================================================================
// AE-AA — Stage AA (custom CSS in settings_data.current)
// ============================================================================

test('AE-AA-01 @import in settings_data.current is rejected (Stage AA)', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle = bundleWithCustomCss(base, '@import url("https://evil.com/x.css");');
  const result = validateThemeForMarketplace(bundle);
  assert.equal(result.ok, false, 'Expected ok=false for @import in settings_data');
  const aaViolations = result.violations.filter(v => v.stage === 'AA' && v.code === 'AA:css-injection');
  assert.ok(aaViolations.length > 0, `Expected AA:css-injection; got: ${JSON.stringify(result.violations)}`);
  assert.ok(
    aaViolations.some(v => v.message.includes('@import')),
    `Expected @import message; got: ${JSON.stringify(aaViolations)}`,
  );
});

test('AE-AA-02 url(javascript:) in settings_data.current is rejected (Stage AA)', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle = bundleWithCustomCss(base, 'body { background: url(javascript:alert(1)); }');
  const result = validateThemeForMarketplace(bundle);
  assert.equal(result.ok, false, 'Expected ok=false for url(javascript:)');
  const aaViolations = result.violations.filter(v => v.stage === 'AA');
  assert.ok(aaViolations.length > 0, `Expected AA violation; got: ${JSON.stringify(result.violations)}`);
});

test('AE-AA-03 </style> breakout in settings_data.current is rejected (Stage AA)', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle = bundleWithCustomCss(base, 'body { color: red; } </style><script>alert(1)</script>');
  const result = validateThemeForMarketplace(bundle);
  assert.equal(result.ok, false, 'Expected ok=false for </style> breakout');
  const aaViolations = result.violations.filter(v => v.stage === 'AA');
  assert.ok(aaViolations.length > 0, `Expected AA violation; got: ${JSON.stringify(result.violations)}`);
});

test('AE-AA-04 expression() in settings_data.current is rejected (Stage AA)', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle = bundleWithCustomCss(base, 'div { width: expression(alert(1)); }');
  const result = validateThemeForMarketplace(bundle);
  assert.equal(result.ok, false, 'Expected ok=false for expression()');
  const aaViolations = result.violations.filter(v => v.stage === 'AA');
  assert.ok(aaViolations.length > 0, `Expected AA violation; got: ${JSON.stringify(result.violations)}`);
});

test('AE-AA-05 multiple settings_data keys are ALL checked (Stage AA)', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  // First key is safe; second key contains an injection vector.
  const bundle = bundleWithCustomCss(
    bundleWithCustomCss(base, '.hero { color: red }', 'safe_css'),
    '@import url("evil");',
    'malicious_css',
  );
  const result = validateThemeForMarketplace(bundle);
  assert.equal(result.ok, false, 'Expected ok=false when any key has injection');
  const aaViolations = result.violations.filter(v => v.stage === 'AA');
  assert.ok(aaViolations.length > 0, 'Expected at least one AA violation');
  // The safe key must NOT appear in violations
  assert.ok(
    !aaViolations.some(v => v.message.includes('safe_css')),
    'Safe CSS key must not appear in violations',
  );
  // The malicious key MUST appear
  assert.ok(
    aaViolations.some(v => v.message.includes('malicious_css')),
    'Malicious CSS key path must appear in AA violation message',
  );
});

test('AE-AA-06 unicode-escaped @import in settings_data.current is rejected (Stage AA)', () => {
  // CSS unicode escape: \0040 = @, \0069 = i
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle = bundleWithCustomCss(base, '\\0040import url("evil");');
  const result = validateThemeForMarketplace(bundle);
  assert.equal(result.ok, false, 'Expected ok=false for unicode-escaped @import');
  const aaViolations = result.violations.filter(v => v.stage === 'AA');
  assert.ok(aaViolations.length > 0, `Expected AA violation; got: ${JSON.stringify(result.violations)}`);
});

test('AE-AA-07 deeply-nested (depth 5) @import in settings_data.current is rejected (Stage AA)', () => {
  // Regression guard: the earlier walk cap of depth>4 silently skipped string
  // leaves nested 5+ levels below settings_data.current, so an @import buried at
  // .a.b.c.d.e escaped the CSS scan and the bundle passed the marketplace gate.
  // The walker now covers all legitimate depths, so this MUST be rejected.
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle = clone(base);
  bundle.config = bundle.config ?? { settings_schema: [], settings_data: { current: {}, presets: {} } };
  bundle.config.settings_data = bundle.config.settings_data ?? { current: {}, presets: {} };
  (bundle.config.settings_data.current as Record<string, unknown>).a = {
    b: { c: { d: { e: '@import url("https://evil.example/x.css");' } } },
  };
  const result = validateThemeForMarketplace(bundle);
  assert.equal(result.ok, false, 'Expected ok=false for depth-5 @import');
  const aaViolations = result.violations.filter(v => v.stage === 'AA');
  assert.ok(aaViolations.length > 0, `Expected AA violation for depth-5 payload; got: ${JSON.stringify(result.violations)}`);
});

test('AE-AA-08 settings nested beyond the walk cap is rejected fail-closed (Stage AA)', () => {
  // Fail-closed contract: a bundle nested deeper than the walk cap has unscanned
  // string leaves that could hide an injection vector, so it is rejected outright
  // rather than admitted with a validation blind spot.
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle = clone(base);
  bundle.config = bundle.config ?? { settings_schema: [], settings_data: { current: {}, presets: {} } };
  bundle.config.settings_data = bundle.config.settings_data ?? { current: {}, presets: {} };
  // Build a chain 20 levels deep (> MAX_SETTINGS_WALK_DEPTH=12) ending in a plain string.
  let node: Record<string, unknown> = {};
  const root = node;
  for (let i = 0; i < 20; i++) {
    const next: Record<string, unknown> = {};
    node.child = next;
    node = next;
  }
  node.leaf = 'harmless-looking-value';
  (bundle.config.settings_data.current as Record<string, unknown>).deep = root;
  const result = validateThemeForMarketplace(bundle);
  assert.equal(result.ok, false, 'Expected ok=false for settings nested beyond the walk cap');
  const tooDeep = result.violations.filter(v => v.stage === 'AA' && v.code === 'AA:settings-too-deep');
  assert.ok(tooDeep.length > 0, `Expected AA:settings-too-deep; got: ${JSON.stringify(result.violations)}`);
});

// ============================================================================
// AE-Y — Stage Y (@app block credential key check)
// ============================================================================

test('AE-Y-01 @app block with api_key setting is rejected (Stage Y)', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle = bundleWithBlockedAppBlockKey(base, 'api_key', 'sk-partner-key');
  const result = validateThemeForMarketplace(bundle);
  assert.equal(result.ok, false, 'Expected ok=false for @app block with api_key');
  const yViolations = result.violations.filter(v => v.stage === 'Y' && v.code === 'Y:blocked-setting-key');
  assert.ok(yViolations.length > 0, `Expected Y:blocked-setting-key; got: ${JSON.stringify(result.violations)}`);
  assert.ok(
    yViolations.some(v => v.message.includes('api_key')),
    `Expected "api_key" in Y violation message; got: ${JSON.stringify(yViolations)}`,
  );
});

test('AE-Y-02 @app block with webhook_secret setting is rejected (Stage Y)', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle = bundleWithBlockedAppBlockKey(base, 'webhook_secret', 'whsec_leaked');
  const result = validateThemeForMarketplace(bundle);
  assert.equal(result.ok, false, 'Expected ok=false for @app block with webhook_secret');
  const yViolations = result.violations.filter(v => v.stage === 'Y');
  assert.ok(yViolations.length > 0, `Expected Y violation; got: ${JSON.stringify(result.violations)}`);
  assert.ok(
    yViolations.some(v => v.message.includes('webhook_secret')),
    `Expected "webhook_secret" in violation message`,
  );
});

test('AE-Y-03 @app block with safe settings passes Stage Y', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle = bundleWithBlockedAppBlockKey(base, 'display_title', 'My App');
  const result = validateThemeForMarketplace(bundle);
  const yViolations = result.violations.filter(v => v.stage === 'Y');
  assert.equal(yViolations.length, 0,
    `Expected no Y violations for safe setting; got: ${JSON.stringify(yViolations)}`,
  );
});

test('AE-Y-04 non-@app blocks are NOT checked by Stage Y (no false positives)', () => {
  // A regular section block is NOT @app-typed; its settings should not be inspected.
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle = clone(base);
  // Inject a blocked key into a non-@app block settings
  for (const template of Object.values(bundle.templates)) {
    for (const section of Object.values(template.sections as Record<string, { blocks: Record<string, { type: string; settings: Record<string, unknown> }> }>)) {
      for (const block of Object.values(section.blocks)) {
        if (!block.type.startsWith('@') && !block.type.startsWith('app:')) {
          // Non-@app block — inject a blocked key (should NOT trigger Y)
          block.settings['api_key'] = 'should-not-trigger-Y';
          break;
        }
      }
    }
  }
  const result = validateThemeForMarketplace(bundle);
  const yViolations = result.violations.filter(v => v.stage === 'Y');
  assert.equal(yViolations.length, 0,
    `Non-@app blocks must not trigger Stage Y; got: ${JSON.stringify(yViolations)}`,
  );
});

// ============================================================================
// AE-N — Stage N (ThemeDocument parse)
// ============================================================================

test('AE-N-01 Urban Kicks converts to valid ThemeDocument (Stage N passes)', () => {
  const result = validateThemeForMarketplace(createUrbanKicksLiquidThemeBundleFixture());
  const nViolations = result.violations.filter(v => v.stage === 'N');
  assert.equal(nViolations.length, 0,
    `Expected no N violations for Urban Kicks; got: ${JSON.stringify(nViolations)}`,
  );
});

test('AE-N-02 Letbuyy Core converts to valid ThemeDocument (Stage N passes)', () => {
  const result = validateThemeForMarketplace(createLetbuyyCoreLiquidThemeBundleFixture());
  const nViolations = result.violations.filter(v => v.stage === 'N');
  assert.equal(nViolations.length, 0,
    `Expected no N violations for Letbuyy Core; got: ${JSON.stringify(nViolations)}`,
  );
});

// ============================================================================
// AE-DET — Determinism
// ============================================================================

test('AE-DET-01 same valid bundle input produces identical result on repeated calls', () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const r1 = validateThemeForMarketplace(bundle);
  const r2 = validateThemeForMarketplace(bundle);
  assert.deepEqual(r1, r2, 'validateThemeForMarketplace must be deterministic');
});

test('AE-DET-02 same invalid bundle input produces identical result on repeated calls', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  const bundle = bundleWithCustomCss(base, '@import url("evil");');
  const r1 = validateThemeForMarketplace(bundle);
  const r2 = validateThemeForMarketplace(bundle);
  assert.deepEqual(r1, r2, 'validateThemeForMarketplace must be deterministic for invalid bundles');
});

test('AE-DET-03 violations array is always ordered (blocking first, advisory last)', () => {
  const base = createMinimalLiquidThemeBundleFixture();
  // Inject both an advisory parity-gap (via unknown section type) and a blocking AA violation.
  // The parity-gap comes from Stage K warn; @import comes from Stage AA error.
  const bundle = bundleWithCustomCss(base, '@import url("evil");');
  const result = validateThemeForMarketplace(bundle);

  let seenAdvisory = false;
  for (const v of result.violations) {
    if (v.advisory) {
      seenAdvisory = true;
    } else {
      assert.equal(seenAdvisory, false,
        `Blocking violation "${v.code}" appeared after an advisory violation — order invariant violated`,
      );
    }
  }
});

// ============================================================================
// AE-FAIL-CLOSED — Paranoid inputs
// ============================================================================

test('AE-FC-01 undefined input returns ok=false (fail-closed)', () => {
  const result = validateThemeForMarketplace(undefined);
  assert.equal(result.ok, false, 'undefined must be rejected');
});

test('AE-FC-02 string input returns ok=false (fail-closed)', () => {
  const result = validateThemeForMarketplace('not-a-bundle');
  assert.equal(result.ok, false, 'string input must be rejected');
});

test('AE-FC-03 array input returns ok=false (fail-closed)', () => {
  const result = validateThemeForMarketplace([]);
  assert.equal(result.ok, false, 'array input must be rejected');
});

test('AE-FC-04 result always has ok and violations properties', () => {
  const inputs: unknown[] = [null, undefined, {}, 'string', 42, [], createMinimalLiquidThemeBundleFixture()];
  for (const input of inputs) {
    const result = validateThemeForMarketplace(input);
    assert.equal(typeof result.ok, 'boolean', `ok must be boolean for input: ${JSON.stringify(input)}`);
    assert.ok(Array.isArray(result.violations), `violations must be an array for input: ${JSON.stringify(input)}`);
  }
});
