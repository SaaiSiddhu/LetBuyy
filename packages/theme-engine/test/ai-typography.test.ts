// Phase L3 — ai-typography unit tests
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  TYPOGRAPHY_PAIRING_CATALOG,
  generateTypographyPairing,
  findTypographyPairing,
  type TypographyPairing,
  type TypographyIntent,
} from '../src/ai-typography';
import { EXPERIENCE_FONT_REGISTRY } from '../src/experience-fonts';

// ── Catalog integrity ─────────────────────────────────────────────────────────

describe('TYPOGRAPHY_PAIRING_CATALOG', () => {
  it('has exactly 5 entries — one per TypographyIntent', () => {
    assert.equal(TYPOGRAPHY_PAIRING_CATALOG.length, 5);
  });

  it('covers all 5 intents', () => {
    const intents = new Set(TYPOGRAPHY_PAIRING_CATALOG.map((p) => p.intent));
    const expected: TypographyIntent[] = ['editorial', 'technical', 'artisanal', 'friendly', 'neutral'];
    for (const intent of expected) {
      assert.ok(intents.has(intent), `missing intent: ${intent}`);
    }
  });

  it('every headingFontFamily is in EXPERIENCE_FONT_REGISTRY', () => {
    for (const pairing of TYPOGRAPHY_PAIRING_CATALOG) {
      assert.ok(
        EXPERIENCE_FONT_REGISTRY[pairing.headingFontFamily],
        `headingFontFamily "${pairing.headingFontFamily}" not in EXPERIENCE_FONT_REGISTRY`,
      );
    }
  });

  it('every fontFamily (body) is in EXPERIENCE_FONT_REGISTRY', () => {
    for (const pairing of TYPOGRAPHY_PAIRING_CATALOG) {
      assert.ok(
        EXPERIENCE_FONT_REGISTRY[pairing.fontFamily],
        `fontFamily "${pairing.fontFamily}" not in EXPERIENCE_FONT_REGISTRY`,
      );
    }
  });

  it('every pairing has a googleFontsHref (string or null)', () => {
    for (const pairing of TYPOGRAPHY_PAIRING_CATALOG) {
      assert.ok(
        pairing.googleFontsHref === null || typeof pairing.googleFontsHref === 'string',
        `googleFontsHref should be string or null, got: ${pairing.googleFontsHref}`,
      );
    }
  });
});

// ── findTypographyPairing ─────────────────────────────────────────────────────

describe('findTypographyPairing', () => {
  it('returns the pairing for the requested intent', () => {
    const intents: TypographyIntent[] = ['editorial', 'technical', 'artisanal', 'friendly', 'neutral'];
    for (const intent of intents) {
      const pairing = findTypographyPairing(intent);
      assert.equal(pairing.intent, intent);
    }
  });

  it('always returns a result (never undefined)', () => {
    const pairing = findTypographyPairing('neutral');
    assert.ok(pairing, 'expected a pairing object');
    assert.ok(pairing.headingFontFamily, 'expected a headingFontFamily');
    assert.ok(pairing.fontFamily, 'expected a fontFamily');
  });
});

// ── generateTypographyPairing ─────────────────────────────────────────────────

describe('generateTypographyPairing', () => {
  it('is deterministic — same args → same result', () => {
    const a = generateTypographyPairing({ industry: 'fashion' });
    const b = generateTypographyPairing({ industry: 'fashion' });
    assert.deepEqual(a, b);
  });

  it('returns a TypographyPairing with all required fields', () => {
    const p: TypographyPairing = generateTypographyPairing();
    assert.ok(p.headingFontFamily, 'missing headingFontFamily');
    assert.ok(p.fontFamily, 'missing fontFamily');
    assert.ok(p.intent, 'missing intent');
  });

  it('all returned families are in EXPERIENCE_FONT_REGISTRY', () => {
    const industries = ['electronics', 'fashion', 'beauty', 'furniture', 'food', 'sports', 'books', 'pet', 'general'];
    for (const industry of industries) {
      const p = generateTypographyPairing({ industry });
      assert.ok(
        EXPERIENCE_FONT_REGISTRY[p.headingFontFamily],
        `${industry}: headingFontFamily "${p.headingFontFamily}" not in EXPERIENCE_FONT_REGISTRY`,
      );
      assert.ok(
        EXPERIENCE_FONT_REGISTRY[p.fontFamily],
        `${industry}: fontFamily "${p.fontFamily}" not in EXPERIENCE_FONT_REGISTRY`,
      );
    }
  });

  it('industry="electronics" → technical intent', () => {
    const p = generateTypographyPairing({ industry: 'electronics' });
    assert.equal(p.intent, 'technical');
  });

  it('industry="fashion" → editorial intent', () => {
    const p = generateTypographyPairing({ industry: 'fashion' });
    assert.equal(p.intent, 'editorial');
  });

  it('industry="beauty" → artisanal intent', () => {
    const p = generateTypographyPairing({ industry: 'beauty' });
    assert.equal(p.intent, 'artisanal');
  });

  it('industry="food" → friendly intent', () => {
    const p = generateTypographyPairing({ industry: 'food' });
    assert.equal(p.intent, 'friendly');
  });

  it('industry="furniture" → neutral intent', () => {
    const p = generateTypographyPairing({ industry: 'furniture' });
    assert.equal(p.intent, 'neutral');
  });

  it('tone="premium" wins over industry', () => {
    // tone wins over industry
    const p = generateTypographyPairing({ industry: 'electronics', tone: 'premium' });
    assert.equal(p.intent, 'editorial');
  });

  it('tone="playful" → friendly', () => {
    const p = generateTypographyPairing({ tone: 'playful' });
    assert.equal(p.intent, 'friendly');
  });

  it('unknown industry → neutral fallback', () => {
    const p = generateTypographyPairing({ industry: 'unknown-industry-xyz' });
    assert.equal(p.intent, 'neutral');
  });

  it('no args → neutral fallback', () => {
    const p = generateTypographyPairing();
    assert.equal(p.intent, 'neutral');
  });

  it('null industry/tone → neutral fallback', () => {
    const p = generateTypographyPairing({ industry: null, tone: null });
    assert.equal(p.intent, 'neutral');
  });
});
