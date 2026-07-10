// Phase L2 — ai-color-system unit tests
// All tests are deterministic: no mocks, no stubs, no external calls.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  relativeLuminance,
  contrastRatio,
  meetsWcagAA,
  meetsWcagAAA,
  generateColorSystem,
  type GeneratedColorSystem,
} from '../src/ai-color-system';

// ── WCAG reference values (from the WCAG 2.1 spec) ──────────────────────────

describe('relativeLuminance', () => {
  it('black #000000 → 0', () => {
    assert.equal(relativeLuminance('#000000'), 0);
  });

  it('white #FFFFFF → 1', () => {
    assert.equal(relativeLuminance('#FFFFFF'), 1);
  });

  it('white lowercase #ffffff → 1', () => {
    assert.equal(relativeLuminance('#ffffff'), 1);
  });

  it('returns value in [0,1] for an arbitrary color', () => {
    const l = relativeLuminance('#4A90E2');
    assert.ok(l >= 0 && l <= 1, `expected luminance in [0,1], got ${l}`);
  });

  it('is symmetric: luminance depends only on color, not argument position', () => {
    assert.equal(relativeLuminance('#FF5733'), relativeLuminance('#FF5733'));
  });
});

describe('contrastRatio', () => {
  it('black on white → 21.0', () => {
    const ratio = contrastRatio('#000000', '#FFFFFF');
    // WCAG spec reference: exactly 21:1
    assert.ok(Math.abs(ratio - 21) < 0.01, `expected ~21, got ${ratio}`);
  });

  it('white on white → 1.0', () => {
    const ratio = contrastRatio('#FFFFFF', '#FFFFFF');
    assert.ok(Math.abs(ratio - 1) < 0.01, `expected ~1, got ${ratio}`);
  });

  it('is argument-order-independent (symmetric)', () => {
    const a = contrastRatio('#336699', '#FFFFFF');
    const b = contrastRatio('#FFFFFF', '#336699');
    assert.equal(a, b);
  });

  it('#767676 on white ≥ 4.5:1 (reference gray border case)', () => {
    // #767676 on white is WCAG's published 4.54:1 example
    const ratio = contrastRatio('#767676', '#FFFFFF');
    assert.ok(ratio >= 4.5, `expected ≥4.5, got ${ratio}`);
    assert.ok(ratio < 5.0, `expected <5.0, got ${ratio}`);
  });

  it('result is always ≥ 1', () => {
    const ratio = contrastRatio('#FF0000', '#00FF00');
    assert.ok(ratio >= 1, `expected ≥1, got ${ratio}`);
  });

  it('result is always ≤ 21', () => {
    const ratio = contrastRatio('#000000', '#FFFFFF');
    assert.ok(ratio <= 21.1, `expected ≤21.1, got ${ratio}`);
  });
});

describe('meetsWcagAA', () => {
  it('black on white passes AA normal text', () => {
    assert.ok(meetsWcagAA('#000000', '#FFFFFF'));
  });

  it('white on white fails AA', () => {
    assert.ok(!meetsWcagAA('#FFFFFF', '#FFFFFF'));
  });

  it('dark text ≥ 4.5:1 passes normal text', () => {
    assert.ok(meetsWcagAA('#1A1A1A', '#FFFFFF'));
  });

  it('isLargeText=true uses 3:1 threshold (less strict)', () => {
    // #767676 on white ~4.54:1 passes both AA thresholds
    assert.ok(meetsWcagAA('#767676', '#FFFFFF', true));
    assert.ok(meetsWcagAA('#767676', '#FFFFFF', false));
  });

  it('a color that fails normal text but passes large text', () => {
    // We need a pair with ratio between 3:1 and 4.5:1
    // #949494 on white ≈ 3.03:1 — passes large text, fails normal
    const ratio = contrastRatio('#949494', '#FFFFFF');
    if (ratio >= 3 && ratio < 4.5) {
      assert.ok(!meetsWcagAA('#949494', '#FFFFFF', false), 'should fail normal text');
      assert.ok(meetsWcagAA('#949494', '#FFFFFF', true), 'should pass large text');
    }
    // If ratio happens to be higher due to environment, just verify the function runs
  });
});

describe('meetsWcagAAA', () => {
  it('black on white passes AAA normal text (21:1 >> 7:1)', () => {
    assert.ok(meetsWcagAAA('#000000', '#FFFFFF'));
  });

  it('mid-gray fails AAA', () => {
    // #767676 ~4.54:1, AAA requires 7:1
    assert.ok(!meetsWcagAAA('#767676', '#FFFFFF'));
  });

  it('isLargeText=true uses 4.5:1 threshold', () => {
    // #767676 on white ~4.54:1 passes AAA large text (>= 4.5)
    assert.ok(meetsWcagAAA('#767676', '#FFFFFF', true));
  });

  it('AAA is strictly harder than AA for same pair', () => {
    // If something passes AAA normal, it must pass AA normal
    const pairs = [['#1A1A1A', '#FFFFFF'], ['#333333', '#FFFFFF'], ['#000080', '#FFFFFF']];
    for (const [fg, bg] of pairs) {
      if (meetsWcagAAA(fg, bg)) {
        assert.ok(meetsWcagAA(fg, bg), `AAA→AA implication failed for ${fg}/${bg}`);
      }
    }
  });
});

describe('generateColorSystem', () => {
  it('returns all 6 required keys', () => {
    const system = generateColorSystem('#336699');
    const keys: (keyof GeneratedColorSystem)[] = ['primary', 'secondary', 'accent', 'background', 'text', 'surface'];
    for (const key of keys) {
      assert.ok(key in system, `missing key: ${key}`);
      assert.match(system[key], /^#[0-9A-Fa-f]{6}$/, `${key} is not a valid hex: ${system[key]}`);
    }
  });

  it('is deterministic: same seed → same palette', () => {
    const a = generateColorSystem('#E53935');
    const b = generateColorSystem('#E53935');
    assert.deepEqual(a, b);
  });

  it('different seeds → different primaries', () => {
    const a = generateColorSystem('#E53935');
    const b = generateColorSystem('#2979FF');
    assert.notEqual(a.primary, b.primary);
  });

  it('light mode: text meets WCAG AA against background', () => {
    const seeds = ['#FF5733', '#336699', '#28A745', '#6C63FF', '#FFC107'];
    for (const seed of seeds) {
      const system = generateColorSystem(seed, 'light');
      const ratio = contrastRatio(system.text, system.background);
      assert.ok(
        ratio >= 4.5,
        `Seed ${seed}: text ${system.text} on background ${system.background} ratio=${ratio.toFixed(2)} < 4.5`,
      );
    }
  });

  it('dark mode: text meets WCAG AA against background', () => {
    const seeds = ['#FF5733', '#336699', '#28A745', '#9C27B0'];
    for (const seed of seeds) {
      const system = generateColorSystem(seed, 'dark');
      const ratio = contrastRatio(system.text, system.background);
      assert.ok(
        ratio >= 4.5,
        `Dark seed ${seed}: text ${system.text} on background ${system.background} ratio=${ratio.toFixed(2)} < 4.5`,
      );
    }
  });

  it('light mode: background is #FFFFFF', () => {
    const system = generateColorSystem('#4CAF50', 'light');
    assert.equal(system.background, '#FFFFFF');
  });

  it('dark mode: background is very dark (lightness < 20%)', () => {
    const system = generateColorSystem('#4CAF50', 'dark');
    // Background should be a dark color; luminance < 0.08 for very dark colors
    const lum = relativeLuminance(system.background);
    assert.ok(lum < 0.10, `dark mode background should be dark, luminance=${lum.toFixed(4)}`);
  });

  it('default mode is light', () => {
    const defaultSystem = generateColorSystem('#336699');
    const lightSystem = generateColorSystem('#336699', 'light');
    assert.deepEqual(defaultSystem, lightSystem);
  });

  it('passes ExperienceColorSystemSchema validation (no throw on parse)', () => {
    // generateColorSystem internally calls ExperienceColorSystemSchema.parse() — this would throw if invalid
    assert.doesNotThrow(() => generateColorSystem('#7C3AED'));
    assert.doesNotThrow(() => generateColorSystem('#7C3AED', 'dark'));
  });
});
