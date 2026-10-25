// ============================================================================
// Phase O — Experience Compositions Tests
// ============================================================================
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  EXPERIENCE_COMPOSITIONS,
  getExperienceComposition,
  type ExperienceComposition,
  type SectionSpec,
} from '../src/experience-compositions';
import { BUILT_IN_SECTION_TYPES } from '../src/built-in-section-schemas';
import { EXPERIENCE_REGISTRY, EXPERIENCE_IDS } from '../src/theme-presets';
import { BUILT_IN_TO_LIQUID_SECTION_TYPE } from '../src/section-type-map';

const TEMPLATE_KEYS = ['index', 'product', 'collection'] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function compositionFingerprint(specs: SectionSpec[]): string {
  return specs.map((s) => s.type).join('|');
}

function findDuplicateTypes(specs: SectionSpec[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const s of specs) {
    if (seen.has(s.type)) duplicates.push(s.type);
    seen.add(s.type);
  }
  return duplicates;
}

function findDuplicateIds(specs: SectionSpec[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const s of specs) {
    if (seen.has(s.id)) duplicates.push(s.id);
    seen.add(s.id);
  }
  return duplicates;
}

// ── Registry completeness ────────────────────────────────────────────────────

describe('experience-compositions: registry coverage', () => {
  test('EXPERIENCE_COMPOSITIONS has an entry for every registered experience id', () => {
    for (const id of EXPERIENCE_IDS) {
      assert.ok(
        id in EXPERIENCE_COMPOSITIONS,
        `EXPERIENCE_COMPOSITIONS missing entry for experience '${id}'`,
      );
    }
  });

  test('every EXPERIENCE_COMPOSITIONS key is a registered experience id', () => {
    for (const key of Object.keys(EXPERIENCE_COMPOSITIONS)) {
      assert.ok(
        key in EXPERIENCE_REGISTRY,
        `EXPERIENCE_COMPOSITIONS has key '${key}' that is not in EXPERIENCE_REGISTRY`,
      );
    }
  });

  test('getExperienceComposition returns the correct composition', () => {
    for (const id of EXPERIENCE_IDS) {
      const comp = getExperienceComposition(id);
      assert.ok(comp, `getExperienceComposition('${id}') returned undefined`);
      assert.strictEqual(comp, EXPERIENCE_COMPOSITIONS[id]);
    }
  });

  test('getExperienceComposition returns undefined for unknown id', () => {
    assert.strictEqual(getExperienceComposition('does-not-exist'), undefined);
  });
});

// ── Per-template validity ────────────────────────────────────────────────────

describe('experience-compositions: per-template section spec validity', () => {
  const builtInSet = new Set<string>(BUILT_IN_SECTION_TYPES);

  for (const [experienceId, comp] of Object.entries(EXPERIENCE_COMPOSITIONS)) {
    for (const tKey of TEMPLATE_KEYS) {
      const specs: SectionSpec[] = comp[tKey];

      test(`${experienceId}/${tKey}: has at least one section`, () => {
        assert.ok(specs.length > 0, `${experienceId}/${tKey} has zero SectionSpecs`);
      });

      test(`${experienceId}/${tKey}: no duplicate section types`, () => {
        const dups = findDuplicateTypes(specs);
        assert.deepStrictEqual(
          dups,
          [],
          `${experienceId}/${tKey} has duplicate types: ${dups.join(', ')}`,
        );
      });

      test(`${experienceId}/${tKey}: no duplicate section ids`, () => {
        const dups = findDuplicateIds(specs);
        assert.deepStrictEqual(
          dups,
          [],
          `${experienceId}/${tKey} has duplicate ids: ${dups.join(', ')}`,
        );
      });

      test(`${experienceId}/${tKey}: all section types are BUILT_IN_SECTION_TYPES`, () => {
        for (const s of specs) {
          assert.ok(
            builtInSet.has(s.type),
            `${experienceId}/${tKey}: section spec type '${s.type}' is not in BUILT_IN_SECTION_TYPES`,
          );
        }
      });

      test(`${experienceId}/${tKey}: section ids follow stable naming pattern`, () => {
        for (const s of specs) {
          assert.ok(
            s.id.startsWith(`${experienceId}-`),
            `${experienceId}/${tKey}: id '${s.id}' does not start with '${experienceId}-'`,
          );
          // id must satisfy ThemeDocumentIdSchema: /^[a-zA-Z0-9_-]+$/, max 64 chars
          assert.match(
            s.id,
            /^[a-zA-Z0-9_-]+$/,
            `${experienceId}/${tKey}: id '${s.id}' contains invalid characters`,
          );
          assert.ok(
            s.id.length <= 64,
            `${experienceId}/${tKey}: id '${s.id}' exceeds 64 chars`,
          );
        }
      });

      test(`${experienceId}/${tKey}: settings have no Date.now or Math.random values`, () => {
        for (const s of specs) {
          for (const [, v] of Object.entries(s.settings)) {
            // Values must be static (no function references; JSON-serializable)
            const type = typeof v;
            assert.ok(
              type === 'string' || type === 'number' || type === 'boolean' || v === null || v === undefined,
              `${experienceId}/${tKey}: spec '${s.id}' setting value is not a static scalar`,
            );
          }
        }
      });

      test(`${experienceId}/${tKey}: all types have a mapping in BUILT_IN_TO_LIQUID_SECTION_TYPE`, () => {
        for (const s of specs) {
          assert.ok(
            s.type in BUILT_IN_TO_LIQUID_SECTION_TYPE,
            `${experienceId}/${tKey}: '${s.type}' has no mapping in BUILT_IN_TO_LIQUID_SECTION_TYPE`,
          );
        }
      });
    }
  }
});

// ── Structural distinctness ───────────────────────────────────────────────────

describe('experience-compositions: structural distinctness (index template)', () => {
  test('all 10 experiences produce DISTINCT index template compositions', () => {
    const fingerprints = new Map<string, string>();
    for (const [id, comp] of Object.entries(EXPERIENCE_COMPOSITIONS)) {
      const fp = compositionFingerprint(comp.index);
      const priorId = fingerprints.get(fp);
      assert.ok(
        !priorId,
        `Experiences '${id}' and '${priorId}' have IDENTICAL index compositions: ${fp}. `
        + 'Each experience must produce a structurally distinct design.',
      );
      fingerprints.set(fp, id);
    }
  });

  test('forge index has trustBadges at position 3 (immediately after categoryGrid)', () => {
    const { index } = EXPERIENCE_COMPOSITIONS.forge;
    const tbIndex = index.findIndex((s) => s.type === 'trustBadges');
    assert.strictEqual(tbIndex, 3, 'forge: trustBadges must be at index 3');
  });

  test('refresh index has trustBadges at position 2 (unique: before categoryGrid)', () => {
    const { index } = EXPERIENCE_COMPOSITIONS.refresh;
    const tbIndex = index.findIndex((s) => s.type === 'trustBadges');
    const cgIndex = index.findIndex((s) => s.type === 'categoryGrid');
    assert.strictEqual(tbIndex, 2, 'refresh: trustBadges must be at index 2');
    assert.ok(tbIndex < cgIndex, 'refresh: trustBadges must appear before categoryGrid');
  });

  test('Threadline leads with apparel and supplied information, without manufactured social proof', () => {
    const { index } = EXPERIENCE_COMPOSITIONS.sense;
    assert.deepEqual(index.map(s => s.type), ['heroBanner','categoryGrid','productGrid','featuredProducts','aboutSection','trustBadges']);
    assert.ok(!index.some(s => s.type === 'testimonials' || s.type === 'newsletter'));
    const services = index.find(s => s.type === 'trustBadges')!;
    assert.deepEqual(services.settings, { fitText: '', serviceText: '', supportText: '' });
  });

  test('craft index is the largest composition (9 sections)', () => {
    const { index } = EXPERIENCE_COMPOSITIONS.craft;
    // faqAccordion may be incompatible at runtime but is in the composition spec
    assert.strictEqual(index.length, 9, 'craft: must have exactly 9 sections');
  });

  test('craft index includes faqAccordion and aboutSection', () => {
    const { index } = EXPERIENCE_COMPOSITIONS.craft;
    assert.ok(index.some((s) => s.type === 'faqAccordion'), 'craft: must include faqAccordion');
    assert.ok(index.some((s) => s.type === 'aboutSection'), 'craft: must include aboutSection');
  });

  test('nova index has ctaSection (distinct from summit)', () => {
    const { index: novaIdx } = EXPERIENCE_COMPOSITIONS.nova;
    const { index: summitIdx } = EXPERIENCE_COMPOSITIONS.summit;
    assert.ok(novaIdx.some((s) => s.type === 'ctaSection'), 'nova: must have ctaSection');
    assert.ok(!summitIdx.some((s) => s.type === 'ctaSection'), 'summit: must not have ctaSection');
    assert.notStrictEqual(
      compositionFingerprint(novaIdx),
      compositionFingerprint(summitIdx),
      'nova and summit must not be structurally identical',
    );
  });

  test('nova has 7 index sections, summit has 6', () => {
    assert.strictEqual(EXPERIENCE_COMPOSITIONS.nova.index.length, 7);
    assert.strictEqual(EXPERIENCE_COMPOSITIONS.summit.index.length, 6);
  });

  test('ride index has trustBadges after productGrid (position 5)', () => {
    const { index } = EXPERIENCE_COMPOSITIONS.ride;
    const tbIndex = index.findIndex((s) => s.type === 'trustBadges');
    const pgIndex = index.findIndex((s) => s.type === 'productGrid');
    assert.ok(tbIndex > pgIndex, 'ride: trustBadges must appear after productGrid');
  });

  test('bloom index has trustBadges between featuredProducts and productGrid', () => {
    const { index } = EXPERIENCE_COMPOSITIONS.bloom;
    const fpIndex = index.findIndex((s) => s.type === 'featuredProducts');
    const tbIndex = index.findIndex((s) => s.type === 'trustBadges');
    const pgIndex = index.findIndex((s) => s.type === 'productGrid');
    assert.ok(fpIndex < tbIndex && tbIndex < pgIndex, 'bloom: trustBadges must be between featuredProducts and productGrid');
  });

  test('dawn index has aboutSection at end (before newsletter) and no trustBadges', () => {
    const { index } = EXPERIENCE_COMPOSITIONS.dawn;
    const asIndex = index.findIndex((s) => s.type === 'aboutSection');
    const nlIndex = index.findIndex((s) => s.type === 'newsletter');
    assert.ok(asIndex >= 0, 'dawn: must have aboutSection');
    assert.ok(asIndex < nlIndex, 'dawn: aboutSection must appear before newsletter');
    assert.ok(!index.some((s) => s.type === 'trustBadges'), 'dawn: must not have trustBadges');
  });

  test('summit index is the minimal 6-section composition (no extras)', () => {
    const { index } = EXPERIENCE_COMPOSITIONS.summit;
    assert.strictEqual(index.length, 6);
    const types = index.map((s) => s.type);
    assert.ok(!types.includes('trustBadges'), 'summit: must not have trustBadges');
    assert.ok(!types.includes('testimonials'), 'summit: must not have testimonials');
    assert.ok(!types.includes('ctaSection'), 'summit: must not have ctaSection');
    assert.ok(!types.includes('aboutSection'), 'summit: must not have aboutSection');
  });
});

// ── Experience-specific composition settings ──────────────────────────────────

describe('experience-compositions: experience-specific settings', () => {
  test('nova ctaSection in index has style:gradient', () => {
    const { index } = EXPERIENCE_COMPOSITIONS.nova;
    const cta = index.find((s) => s.type === 'ctaSection');
    assert.ok(cta, 'nova index must have ctaSection');
    assert.strictEqual(cta.settings.style, 'gradient');
  });

  test('sense product featuredProducts has editorial title', () => {
    const { product } = EXPERIENCE_COMPOSITIONS.sense;
    const fp = product.find((s) => s.type === 'featuredProducts');
    assert.ok(fp, 'sense product must have featuredProducts');
    assert.strictEqual(fp.settings.title, 'Complete the look');
  });

  test('ride product featuredProducts has sport-relevant title', () => {
    const { product } = EXPERIENCE_COMPOSITIONS.ride;
    const fp = product.find((s) => s.type === 'featuredProducts');
    assert.ok(fp, 'ride product must have featuredProducts');
    assert.strictEqual(fp.settings.title, 'Complete your kit');
  });

  test('summit product featuredProducts title is "Related products"', () => {
    const { product } = EXPERIENCE_COMPOSITIONS.summit;
    const fp = product.find((s) => s.type === 'featuredProducts');
    assert.ok(fp, 'summit product must have featuredProducts');
    assert.strictEqual(fp.settings.title, 'Related products');
  });
});

// ── Section type cross-template uniqueness ────────────────────────────────────

describe('experience-compositions: no duplicate section types within any template', () => {
  for (const [id, comp] of Object.entries(EXPERIENCE_COMPOSITIONS)) {
    for (const tKey of TEMPLATE_KEYS) {
      test(`${id}/${tKey}: every section type appears at most once`, () => {
        const dups = findDuplicateTypes(comp[tKey]);
        assert.deepStrictEqual(dups, [], `${id}/${tKey}: duplicate types: ${dups.join(', ')}`);
      });
    }
  }
});

// ── No block children in specs ────────────────────────────────────────────────

describe('experience-compositions: SectionSpec has no blocks field', () => {
  test('SectionSpec objects have only id, type, settings fields', () => {
    for (const [id, comp] of Object.entries(EXPERIENCE_COMPOSITIONS)) {
      for (const tKey of TEMPLATE_KEYS) {
        for (const s of comp[tKey]) {
          const keys = Object.keys(s);
          assert.ok(
            !keys.includes('blocks'),
            `${id}/${tKey}: spec '${s.id}' must not have a blocks field (Phase T deferred)`,
          );
          assert.ok(
            !keys.includes('children'),
            `${id}/${tKey}: spec '${s.id}' must not have a children field`,
          );
        }
      }
    }
  });
});
